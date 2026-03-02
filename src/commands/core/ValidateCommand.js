/**
 * ValidateCommand
 * -----------------------
 * Handles 'vdk validate' command - Validate blueprint schema compatibility
 * and platform-specific component configuration.
 */

import path from 'node:path';
import fs from 'fs-extra';
import { ClaudeCodeAdapter } from '../../scanner/core/ClaudeCodeAdapter.js';
import { CopilotAdapter } from '../../scanner/core/CopilotAdapter.js';
import { CursorAdapter } from '../../scanner/core/CursorAdapter.js';
import { WindsurfAdapter } from '../../scanner/core/WindsurfAdapter.js';
import { colors, tables } from '../../utils/cli-styles.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class ValidateCommand extends BaseCommand {
  constructor() {
    super('validate', 'Validate blueprint schema compatibility and platform configurations');
    this.adapters = {
      'claude-code': new ClaudeCodeAdapter(),
      cursor: new CursorAdapter(),
      'github-copilot': new CopilotAdapter(),
      windsurf: new WindsurfAdapter(),
    };
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --path <path>', 'Path to blueprint/rule files', './.vdk/rules')
      .option('-f, --file <file>', 'Validate specific blueprint file')
      .option('--platform <platform>', 'Validate against specific platform constraints')
      .option('-v, --verbose', 'Show detailed validation results', false);
  }

  /**
   * Execute the validate command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader('Schema Validation');

    const spinner = this.createSpinner('Validating files...');
    spinner.start();

    try {
      const filesToValidate = await this.getFilesToValidate(options);

      if (filesToValidate.length === 0) {
        spinner.fail('No files found to validate');
        return { success: false, error: 'No files found' };
      }

      spinner.text = `Validating ${filesToValidate.length} files...`;

      const results = await this.validateFiles(filesToValidate, options);

      spinner.stop();

      // Display results
      this.displayValidationResults(results, options);

      const successCount = results.filter(r => r.valid).length;
      const errorCount = results.filter(r => !r.valid).length;

      this.trackSuccess({
        filesValidated: filesToValidate.length,
        successCount,
        errorCount,
      });

      return {
        success: errorCount === 0,
        totalFiles: filesToValidate.length,
        validFiles: successCount,
        errorFiles: errorCount,
        results,
      };
    } catch (error) {
      spinner.fail('Validation failed');
      throw error;
    }
  }

  /**
   * Get list of files to validate
   */
  async getFilesToValidate(options) {
    if (options.file) {
      return [path.resolve(options.file)];
    }

    const searchPath = path.resolve(options.path);
    if (!(await fs.pathExists(searchPath))) {
      return [];
    }

    const stat = await fs.stat(searchPath);
    if (stat.isFile()) {
      return [searchPath];
    }

    // Find all relevant files in directory
    const files = [];
    const walk = async dir => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            !entry.name.startsWith('.') ||
            ['claude', 'cursor', 'windsurf', 'github'].some(p => entry.name.includes(p))
          ) {
            await walk(fullPath);
          }
        } else if (/\.(md|mdc|json|yaml)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    };

    await walk(searchPath);
    return files;
  }

  /**
   * Validate all files
   */
  async validateFiles(filesToValidate, options) {
    const results = [];

    for (const filePath of filesToValidate) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const validation = await this.validateContent(content, filePath, options);

        results.push({
          file: commandContext.getRelativePath(filePath),
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
          type: validation.type,
          platform: validation.platform,
        });
      } catch (error) {
        results.push({
          file: commandContext.getRelativePath(filePath),
          valid: false,
          errors: [`Read error: ${error.message}`],
          warnings: [],
          type: 'unknown',
        });
      }
    }

    return results;
  }

  /**
   * Validate content based on type and platform
   */
  async validateContent(content, filePath, options) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      type: 'unknown',
      platform: 'unknown',
    };

    // Determine platform
    let platform = options.platform;
    if (!platform) {
      if (filePath.includes('.cursor')) platform = 'cursor';
      else if (filePath.includes('.claude') || filePath.includes('CLAUDE.md'))
        platform = 'claude-code';
      else if (filePath.includes('copilot')) platform = 'github-copilot';
      else if (filePath.includes('.windsurf')) platform = 'windsurf';
    }

    result.platform = platform || 'generic';

    // Basic frontmatter check
    if (content.startsWith('---')) {
      result.type = 'frontmatter-config';
    } else {
      result.type = 'markdown-content';
    }

    // Platform-specific validation
    if (platform && this.adapters[platform]) {
      const adapter = this.adapters[platform];

      // Use adapter's validation if available
      if (typeof adapter.validate === 'function') {
        const platformValidation = adapter.validate(content);
        if (!platformValidation.valid) {
          result.valid = false;
          result.errors.push(...platformValidation.errors);
        }
        if (platformValidation.warnings) {
          result.warnings.push(...platformValidation.warnings);
        }
      }

      // Fallback/Additional checks
      if (platform === 'github-copilot' && content.length > 3000) {
        result.valid = false;
        result.errors.push(`Content exceeds 3000 chars (length: ${content.length})`);
      }
    }

    return result;
  }

  /**
   * Display validation results in a table
   */
  displayValidationResults(results, options) {
    const resultTable = tables.validation();

    results.forEach(result => {
      const statusIcon = result.valid ? this.colorPrimary('✓') : colors.red('✗');
      let details = result.type;

      if (result.errors.length > 0) {
        const errorText = options.verbose
          ? result.errors.join(', ')
          : `${result.errors.length} error(s)`;
        details += ` | ${colors.red(errorText)}`;
      }

      if (result.warnings.length > 0) {
        const warnText = options.verbose
          ? result.warnings.join(', ')
          : `${result.warnings.length} warning(s)`;
        details += ` | ${colors.yellow(warnText)}`;
      }

      resultTable.push([result.file, result.platform, statusIcon, details]);
    });

    console.log(resultTable.toString());

    const validCount = results.filter(r => r.valid).length;
    const errorCount = results.filter(r => !r.valid).length;

    console.log(`\n${validCount} valid, ${errorCount} errors`);

    if (errorCount > 0 && !options.verbose) {
      this.logInfo('Use --verbose flag to see detailed error messages');
    }

    if (errorCount > 0) {
      process.exitCode = 1;
    }
  }
}
