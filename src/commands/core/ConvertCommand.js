/**
 * ConvertCommand
 * --------------
 * Handles 'vdk convert' command - Convert AI context between platforms.
 * Supports Claude Code → Cursor, Copilot, Windsurf and vice versa.
 */

import path from 'node:path';
import fs from 'fs-extra';

import { UniversalFormatConverter } from '../../publishing/UniversalFormatConverter.js';
import { BaseCommand } from '../base/BaseCommand.js';

export class ConvertCommand extends BaseCommand {
  constructor() {
    super('convert', 'Convert AI context between platforms (Claude, Cursor, Copilot, Windsurf)');
    this.converter = new UniversalFormatConverter();
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-i, --input <path>', 'Input file or directory to convert')
      .option('-o, --output <path>', 'Output directory for converted files')
      .option('-f, --from <platform>', 'Source platform (auto-detect if not specified)')
      .option(
        '-t, --to <platforms...>',
        'Target platform(s): claude-code, cursor, github-copilot, windsurf'
      )
      .option('--all', 'Convert to all supported platforms', false)
      .option('--dry-run', 'Preview conversion without writing files', false)
      .option('--preserve-structure', 'Preserve directory structure in output', true)
      .option('--show-loss', 'Show detailed information about conversion loss', false)
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  /**
   * Get validation rules
   */
  getValidationRules() {
    return {
      defaults: {
        output: './',
        preserveStructure: true,
        dryRun: false,
        showLoss: false,
        verbose: false,
        all: false,
      },
      fields: {
        from: {
          type: 'string',
          enum: ['claude-code', 'cursor', 'github-copilot', 'windsurf', 'auto'],
        },
        to: {
          type: 'array',
          validate: targets => {
            if (!targets || targets.length === 0) return true;
            const valid = ['claude-code', 'cursor', 'github-copilot', 'windsurf'];
            const invalid = targets.filter(t => !valid.includes(t));
            if (invalid.length > 0) {
              return `Invalid target platforms: ${invalid.join(', ')}. Valid: ${valid.join(', ')}`;
            }
            return true;
          },
        },
      },
    };
  }

  /**
   * Execute the convert command
   */
  async execute(options) {
    this.showHeader();
    await this.validateOptions(options, this.getValidationRules());

    // Validate input
    if (!options.input) {
      this.logError('Input file or directory is required. Use --input <path>');
      this.showConversionHelp();
      return { success: false };
    }

    // Determine target platforms
    let targetPlatforms = options.to || [];
    if (options.all) {
      targetPlatforms = ['claude-code', 'cursor', 'github-copilot', 'windsurf'];
    }

    if (targetPlatforms.length === 0) {
      this.logError('At least one target platform is required. Use --to <platform> or --all');
      this.showConversionHelp();
      return { success: false };
    }

    // Resolve paths
    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);

    // Check input exists
    if (!(await fs.pathExists(inputPath))) {
      this.logError(`Input path does not exist: ${inputPath}`);
      return { success: false };
    }

    const isDirectory = (await fs.stat(inputPath)).isDirectory();

    if (isDirectory) {
      return await this.convertDirectory(inputPath, outputPath, targetPlatforms, options);
    } else {
      return await this.convertFile(inputPath, outputPath, targetPlatforms, options);
    }
  }

  /**
   * Convert a single file
   */
  async convertFile(inputPath, outputPath, targetPlatforms, options) {
    const spinner = this.createSpinner('Converting file...');
    spinner.start();

    try {
      const content = await fs.readFile(inputPath, 'utf-8');

      // Convert using IR
      const results = await this.converter.convertToMultiplePlatformsViaIR({
        content,
        filePath: inputPath,
        targetPlatforms,
        platformOptions: this.getPlatformOptions(options),
      });

      spinner.succeed('Conversion complete');

      // Process results
      const outputFiles = [];
      let totalLoss = 0;

      for (const [platform, result] of Object.entries(results)) {
        const outputFilePath = this.getOutputPath(outputPath, result.filePath, platform, options);

        if (options.dryRun) {
          this.logInfo(`[DRY RUN] Would create: ${outputFilePath}`);
        } else {
          await fs.ensureDir(path.dirname(outputFilePath));
          await fs.writeFile(outputFilePath, result.content, 'utf-8');
          this.logSuccess(`Created: ${this.formatPath(outputFilePath)}`);
        }

        outputFiles.push({
          platform,
          path: outputFilePath,
          lossInfo: result.lossInfo || [],
        });

        // Show loss info if requested
        if (options.showLoss && result.lossInfo?.length > 0) {
          this.showLossInfo(platform, result.lossInfo);
          totalLoss += result.lossInfo.length;
        }
      }

      // Summary
      this.logInfo(`\n📊 Conversion Summary:`);
      this.logInfo(`   Source: ${this.formatPath(inputPath)}`);
      this.logInfo(`   Targets: ${targetPlatforms.join(', ')}`);
      this.logInfo(`   Files created: ${outputFiles.length}`);
      if (totalLoss > 0) {
        this.logWarning(`   ⚠️  ${totalLoss} item(s) lost during conversion`);
      }

      return {
        success: true,
        inputPath,
        outputFiles,
        totalLoss,
      };
    } catch (error) {
      spinner.fail('Conversion failed');
      this.logError(error.message);
      if (options.verbose) {
        console.error(error);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert a directory of files
   */
  async convertDirectory(inputPath, outputPath, targetPlatforms, options) {
    const spinner = this.createSpinner('Scanning directory...');
    spinner.start();

    try {
      // Find all convertible files
      const files = await this.findConvertibleFiles(inputPath);
      spinner.text = `Found ${files.length} file(s) to convert`;

      if (files.length === 0) {
        spinner.warn('No convertible files found');
        return { success: true, filesProcessed: 0 };
      }

      spinner.succeed(`Found ${files.length} file(s)`);

      // Convert each file
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const file of files) {
        const relativePath = path.relative(inputPath, file);
        const fileOutputPath = options.preserveStructure
          ? path.join(outputPath, path.dirname(relativePath))
          : outputPath;

        const result = await this.convertFile(file, fileOutputPath, targetPlatforms, {
          ...options,
          quiet: true,
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
        results.push({ file, ...result });
      }

      // Summary
      this.logInfo(`\n📊 Batch Conversion Summary:`);
      this.logInfo(`   Directory: ${this.formatPath(inputPath)}`);
      this.logInfo(`   Files processed: ${files.length}`);
      this.logSuccess(`   Successful: ${successCount}`);
      if (errorCount > 0) {
        this.logError(`   Failed: ${errorCount}`);
      }

      return {
        success: errorCount === 0,
        filesProcessed: files.length,
        successCount,
        errorCount,
        results,
      };
    } catch (error) {
      spinner.fail('Directory conversion failed');
      this.logError(error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find all convertible files in a directory
   */
  async findConvertibleFiles(dirPath) {
    const files = [];
    const extensions = ['.md', '.mdc', '.json', '.yaml', '.yml'];

    const walk = async dir => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden dirs (except .claude, .cursor, etc.)
          if (
            entry.name === 'node_modules' ||
            (entry.name.startsWith('.') &&
              !['claude', 'cursor', 'github', 'windsurf'].some(p => entry.name.includes(p)))
          ) {
            continue;
          }
          await walk(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          // Check if it's a context file
          if (this.isContextFile(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walk(dirPath);
    return files;
  }

  /**
   * Check if a file is a context/rules file
   */
  isContextFile(filePath) {
    const lower = filePath.toLowerCase();
    const name = path.basename(lower);

    // Known context files
    const knownFiles = ['claude.md', 'copilot-instructions.md'];

    if (knownFiles.some(f => name.includes(f))) return true;

    // Known directories
    if (
      lower.includes('.claude/') ||
      lower.includes('.cursor/') ||
      lower.includes('.windsurf/') ||
      lower.includes('.github/copilot')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get output path for a converted file
   */
  getOutputPath(baseOutput, suggestedPath, platform, options) {
    if (options.preserveStructure) {
      return path.join(baseOutput, platform, suggestedPath);
    }
    return path.join(baseOutput, suggestedPath);
  }

  /**
   * Get platform-specific options
   */
  getPlatformOptions(_options) {
    return {
      'github-copilot': {
        maxLength: 3000,
        priorityTruncation: true,
      },
      cursor: {
        useMDC: true,
      },
    };
  }

  /**
   * Show loss information
   */
  showLossInfo(platform, lossInfo) {
    this.logWarning(`\n⚠️  Conversion loss for ${platform}:`);
    for (const loss of lossInfo) {
      this.logWarning(`   • ${loss.field}: ${loss.reason}`);
      if (loss.suggestion) {
        this.logInfo(`     💡 ${loss.suggestion}`);
      }
    }
  }

  /**
   * Show conversion help
   */
  showConversionHelp() {
    this.logInfo('\nUsage examples:');
    this.logInfo('  vdk convert --input CLAUDE.md --to cursor');
    this.logInfo('  vdk convert --input .claude/ --to cursor github-copilot --output ./converted');
    this.logInfo('  vdk convert --input .cursor/rules/index.mdc --to claude-code --dry-run');
    this.logInfo('  vdk convert --input ./project --all --show-loss');
    this.logInfo('\nSupported platforms:');

    const conversions = this.converter.getSupportedConversions();
    for (const [platform, info] of Object.entries(conversions)) {
      const features = [];
      if (info.supportsAgents) features.push('agents');
      if (info.supportsRules) features.push('rules');
      if (info.supportsCommands) features.push('commands');
      if (info.supportsWorkflows) features.push('workflows');
      const limit = info.characterLimit ? ` (${info.characterLimit} char limit)` : '';
      this.logInfo(`  ${platform}: ${features.join(', ')}${limit}`);
    }
  }
}

export default ConvertCommand;
