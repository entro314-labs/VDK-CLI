/**
 * ImportCommand
 * -------------
 * Handles 'vdk import' command - Import existing AI context from various platforms.
 * Auto-detects platform and converts to VDK format / IR.
 */

import path from 'node:path';
import fs from 'fs-extra';
import { detectPlatformFromPath } from '../../ir/index.js';
import { UniversalFormatConverter } from '../../publishing/UniversalFormatConverter.js';
import { BaseCommand } from '../base/BaseCommand.js';

export class ImportCommand extends BaseCommand {
  constructor() {
    super('import', 'Import existing AI context from Claude, Cursor, Copilot, or Windsurf');
    this.converter = new UniversalFormatConverter();
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-i, --input <path>', 'Input file or directory to import', '.')
      .option('-o, --output <path>', 'Output directory for imported files', './.vdk/imported')
      .option('-p, --platform <platform>', 'Override platform detection')
      .option('--analyze', 'Only analyze without importing', false)
      .option('--merge', 'Merge with existing VDK rules', false)
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  /**
   * Execute the import command
   */
  async execute(options) {
    this.showHeader();

    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);

    // Check input exists
    if (!(await fs.pathExists(inputPath))) {
      this.logError(`Input path does not exist: ${inputPath}`);
      return { success: false };
    }

    const spinner = this.createSpinner('Detecting AI context files...');
    spinner.start();

    try {
      // Find all context files
      const contextFiles = await this.findContextFiles(inputPath);
      spinner.succeed(`Found ${contextFiles.length} AI context file(s)`);

      if (contextFiles.length === 0) {
        this.logWarning('No AI context files found. Looking for:');
        this.logInfo('  • .claude/ directory or CLAUDE.md');
        this.logInfo('  • .cursor/rules/');
        this.logInfo('  • .github/copilot-instructions.md');
        this.logInfo('  • .windsurf/rules/');
        return { success: true, filesImported: 0 };
      }

      // Analyze each file
      const analyses = [];
      for (const file of contextFiles) {
        const content = await fs.readFile(file.path, 'utf-8');
        const analysis = await this.converter.importToIR({
          content,
          filePath: file.path,
          platform: options.platform || file.platform,
        });
        analyses.push({
          file: file.path,
          relativePath: path.relative(inputPath, file.path),
          ...analysis,
        });
      }

      // Show analysis
      this.showAnalysis(analyses, options.verbose);

      // If analyze only, stop here
      if (options.analyze) {
        return {
          success: true,
          mode: 'analyze',
          analyses,
        };
      }

      // Import files
      const importSpinner = this.createSpinner('Importing context files...');
      importSpinner.start();

      await fs.ensureDir(outputPath);

      const imported = [];
      for (const analysis of analyses) {
        const outputFile = path.join(outputPath, `${analysis.ir.name}.json`);

        await fs.writeJson(
          outputFile,
          {
            schemaVersion: '3.0',
            importedAt: new Date().toISOString(),
            sourcePlatform: analysis.sourcePlatform,
            sourceFile: analysis.relativePath,
            ir: analysis.ir,
          },
          { spaces: 2 }
        );

        imported.push(outputFile);
      }

      importSpinner.succeed(`Imported ${imported.length} file(s)`);

      // Summary
      this.logInfo('\n📊 Import Summary:');
      this.logInfo(`   Source: ${this.formatPath(inputPath)}`);
      this.logInfo(`   Output: ${this.formatPath(outputPath)}`);
      this.logInfo(`   Files imported: ${imported.length}`);

      // Platform breakdown
      const platformCounts = {};
      for (const a of analyses) {
        platformCounts[a.sourcePlatform] = (platformCounts[a.sourcePlatform] || 0) + 1;
      }
      for (const [platform, count] of Object.entries(platformCounts)) {
        this.logInfo(`   ${platform}: ${count} file(s)`);
      }

      return {
        success: true,
        filesImported: imported.length,
        analyses,
        outputPath,
      };
    } catch (error) {
      spinner.fail('Import failed');
      this.logError(error.message);
      if (options.verbose) {
        console.error(error);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Find all AI context files in a path
   */
  async findContextFiles(inputPath) {
    const files = [];
    const stat = await fs.stat(inputPath);

    if (stat.isFile()) {
      // Single file
      const platform = detectPlatformFromPath(inputPath);
      files.push({ path: inputPath, platform });
      return files;
    }

    // Directory search
    const searchPatterns = [
      { glob: 'CLAUDE.md', platform: 'claude-code' },
      { glob: '.claude/**/*.md', platform: 'claude-code' },
      { glob: '.cursor/rules/**/*.mdc', platform: 'cursor' },
      { glob: '.cursor/rules/**/*.md', platform: 'cursor' },
      { glob: '.github/copilot-instructions.md', platform: 'github-copilot' },
      { glob: '.windsurf/rules/**/*.md', platform: 'windsurf' },
    ];

    for (const pattern of searchPatterns) {
      const matches = await this.findFiles(inputPath, pattern.glob);
      for (const match of matches) {
        if (!files.some(f => f.path === match)) {
          files.push({ path: match, platform: pattern.platform });
        }
      }
    }

    return files;
  }

  /**
   * Find files matching a glob pattern
   */
  async findFiles(basePath, pattern) {
    const matches = [];

    // Simple glob implementation for common patterns
    const parts = pattern.split('/');
    const walk = async (dir, partIndex) => {
      if (partIndex >= parts.length) return;

      const part = parts[partIndex];
      const isLast = partIndex === parts.length - 1;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (part === '**') {
            // Recursive match
            if (entry.isDirectory()) {
              await walk(fullPath, partIndex);
              await walk(fullPath, partIndex + 1);
            } else if (isLast || this.matchGlob(entry.name, parts[partIndex + 1])) {
              matches.push(fullPath);
            }
          } else if (this.matchGlob(entry.name, part)) {
            if (isLast) {
              matches.push(fullPath);
            } else if (entry.isDirectory()) {
              await walk(fullPath, partIndex + 1);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    await walk(basePath, 0);
    return matches;
  }

  /**
   * Simple glob matching
   */
  matchGlob(name, pattern) {
    if (pattern === '*') return true;
    if (pattern.startsWith('*.')) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern;
  }

  /**
   * Show analysis results
   */
  showAnalysis(analyses, verbose) {
    this.logInfo('\n📋 Analysis Results:\n');

    for (const analysis of analyses) {
      const icon = analysis.valid ? '✅' : '⚠️';
      this.logInfo(`${icon} ${this.formatPath(analysis.relativePath)}`);
      this.logInfo(`   Platform: ${analysis.sourcePlatform}`);
      this.logInfo(`   Type: ${analysis.analysis.componentType}`);
      this.logInfo(`   Name: ${analysis.analysis.name}`);

      if (verbose) {
        if (analysis.analysis.description) {
          this.logInfo(`   Description: ${analysis.analysis.description.substring(0, 80)}...`);
        }
        if (analysis.analysis.hasTriggers) {
          this.logInfo(`   Has triggers: Yes`);
        }
        if (analysis.analysis.hasTools) {
          this.logInfo(`   Has tools: Yes`);
        }
        if (analysis.analysis.fileReferenceCount > 0) {
          this.logInfo(`   File references: ${analysis.analysis.fileReferenceCount}`);
        }
        if (analysis.analysis.contentSections > 0) {
          this.logInfo(`   Content sections: ${analysis.analysis.contentSections}`);
        }
      }

      if (!analysis.valid) {
        for (const error of analysis.errors) {
          this.logWarning(`   ⚠️ ${error}`);
        }
      }

      this.logInfo('');
    }
  }
}

export default ImportCommand;
