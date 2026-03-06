/**
 * ScanCommand
 * -----------------------
 * Handles 'vdk scan' command - Re-analyze project and update existing AI rules
 * by rescanning the project and refreshing IDE integrations.
 */

import path from 'node:path';
import { runScanner } from '../../scanner/index.js';
import { standardPatterns } from '../../utils/schema-validator.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class ScanCommand extends BaseCommand {
  constructor() {
    super('scan', 'Re-analyze project and update existing AI rules');
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --projectPath <path>', 'Path to the project to rescan', process.cwd())
      .option(
        '-o, --outputPath <path>',
        'Path where updated rule artifacts should be saved',
        './.vdk/blueprints/rules'
      )
      .option('--ide <ide>', 'Target specific IDE for scanning (vscode, jetbrains, cursor, etc.)')
      .option('-d, --deep', 'Enable deep scanning for more thorough pattern detection', false)
      .option('-i, --ignorePattern <patterns...>', 'Glob patterns to ignore', [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
      ])
      .option(
        '--use-gitignore',
        'Automatically parse .gitignore files for additional ignore patterns',
        true
      )
      .option('--incremental', 'Only scan changed files since last scan', false)
      .option('--force', 'Force full rescan even if no changes detected', false)
      .option('-v, --verbose', 'Enable verbose output for debugging', false)
      .option(
        '--categories <categories...>',
        'Specific command categories to update (e.g., development, testing, workflow)'
      )
      .option('--components', 'Regenerate platform-specific components', false)
      .option('--generate-agents', 'Regenerate agent components for supported platforms', false);
  }

  /**
   * Get validation rules for ScanCommand
   */
  getValidationRules() {
    return {
      defaults: {
        projectPath: process.cwd(),
        outputPath: './.vdk/blueprints/rules',
        useGitignore: true,
        incremental: false,
        force: false,
        verbose: false,
      },
      fields: {
        ...standardPatterns.projectValidation,
        ...standardPatterns.ideValidation,
        ...standardPatterns.categoriesValidation,
        ignorePattern: {
          type: 'array',
        },
      },
      crossValidation: async options => {
        const errors = [];

        // Use standard VDK initialization check
        const vdkCheck = await standardPatterns.vdkInitializedValidation(options);
        if (vdkCheck !== true) {
          errors.push(vdkCheck);
        }

        // Check conflicting options
        if (options.incremental && options.force) {
          errors.push('Cannot use --incremental with --force (force implies full scan)');
        }

        return errors.length > 0 ? errors : true;
      },
    };
  }

  /**
   * Execute the scan command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    await this.validateOptions(options, this.getValidationRules());

    // Load existing VDK config
    const existingConfig = await this.loadVdkConfig(options.projectPath);
    this.logInfo(
      `Found existing VDK configuration for project: ${existingConfig.project?.name || 'Unknown'}`
    );

    // Initialize Hub connectivity message
    if (this.hubOps) {
      const connectivity = await this.hubOps.testConnection();
      if (connectivity.success) {
        this.logInfo('🌐 Connected to VDK Hub for new features');
      }
    } else {
      this.logWarning('⚠️  Hub integration unavailable, using local features');
    }

    // Check if incremental scan is possible
    const shouldRunIncremental =
      options.incremental && !options.force && (await this.canRunIncremental(options));
    const scanMode = shouldRunIncremental ? 'incremental' : 'full';

    // Prepare scanner options
    const scannerOptions = {
      ...options,
      mode: 'update', // Tell scanner we're updating, not initializing
      existingConfig,
      targetIde: options.ide,
      incremental: shouldRunIncremental,
    };

    // Run the scanner to update rules
    const spinner = this.createSpinner(`Running ${scanMode} project scan and updating rules...`);
    spinner.start();

    try {
      const results = await runScanner(scannerOptions);
      spinner.succeed(
        `${scanMode === 'incremental' ? 'Incremental' : 'Full'} project scan completed successfully`
      );

      // Regenerate components if requested
      if (options.components || options.generateAgents) {
        await this.regenerateComponents(results, options);
      }

      // Update VDK configuration file
      const configPath = await this.updateVdkConfig(options, results, existingConfig);
      this.logSuccess(`VDK configuration updated at ${this.formatPath(configPath)}`);

      // Show summary of changes
      this.showScanSummary(results, scanMode);

      // Track successful completion with Hub
      this.trackSuccess({
        scanMode,
        blueprintsUpdated: results.updatedFiles?.length || 0,
        integrations: results.updatedIDEs || [],
        targetIde: options.ide,
        componentsRegenerated: results.componentsGenerated || 0,
      });

      return {
        success: true,
        scanMode,
        configPath,
        results,
      };
    } catch (error) {
      spinner.fail(`${scanMode} project scan failed`);
      throw error;
    }
  }

  /**
   * Regenerate platform-specific components
   */
  async regenerateComponents(results, options) {
    const spinner = this.createSpinner('Regenerating platform-specific components...');
    spinner.start();

    try {
      const { RuleGenerator } = await import('../../scanner/core/RuleGenerator.js');

      const generator = new RuleGenerator(options.outputPath, 'default', true, {
        verbose: options.verbose,
        projectPath: options.projectPath,
      });

      const componentResults = await generator.generateComponents(results, {
        generateAgents: options.generateAgents,
        overwrite: true, // Always overwrite during rescan
      });

      spinner.succeed(
        `Regenerated ${componentResults.totalComponents} components across ${Object.keys(componentResults.platforms).length} platform(s)`
      );

      if (options.verbose) {
        this.logInfo('\n📦 Component Regeneration Summary:');
        for (const [platform, result] of Object.entries(componentResults.platforms)) {
          if (result.success) {
            this.logSuccess(`  ✓ ${platform}: ${result.componentCount} components`);
          } else {
            this.logError(`  ✗ ${platform}: ${result.errors.join(', ')}`);
          }
        }
      }

      results.componentsGenerated = componentResults.totalComponents;
      results.componentResults = componentResults;

      return componentResults;
    } catch (error) {
      spinner.fail('Component regeneration failed');
      this.logError(error.message);
      if (options.verbose) {
        console.error(error);
      }
    }
  }

  /**
   * Load existing VDK configuration
   */
  async loadVdkConfig(projectPath) {
    try {
      const config = await commandContext.readVdkConfig(projectPath, 'vdk.config.json');

      if (!config) {
        throw new Error(
          `VDK configuration not found at ${path.join(projectPath, 'vdk.config.json')}`
        );
      }

      return config;
    } catch (error) {
      this.exitWithError('Failed to load existing VDK configuration', error);
    }
  }

  /**
   * Check if incremental scan is possible
   */
  async canRunIncremental(_options) {
    // This would check file modification times, git status, etc.
    // For now, return false to always do full scan
    // TODO: Implement proper incremental scan detection
    return false;
  }

  /**
   * Update VDK configuration file
   */
  async updateVdkConfig(options, results, existingConfig) {
    const updatedConfig = {
      ...existingConfig,
      lastScanned: new Date().toISOString(),
      scanHistory: [
        ...(existingConfig.scanHistory || []).slice(-4), // Keep last 5 scans
        {
          timestamp: new Date().toISOString(),
          mode: results.scanMode,
          filesUpdated: results.updatedFiles?.length || 0,
          targetIde: options.ide,
        },
      ],
    };

    // Update IDE info if targeting specific IDE
    if (options.ide) {
      updatedConfig.ide = options.ide;
    }

    const configPath = await commandContext.writeVdkConfig(updatedConfig, options.projectPath);
    return configPath;
  }

  /**
   * Show scan summary
   */
  showScanSummary(results, scanMode) {
    console.log(`\n${this.colorPrimary('🔍 Scan Summary:')}`);
    console.log(this.formatKeyValue('Scan Mode', scanMode));
    console.log(
      this.formatKeyValue('Files Analyzed', this.formatCount(results.filesAnalyzed || 0))
    );
    console.log(
      this.formatKeyValue('Rules Updated', this.formatCount(results.updatedFiles?.length || 0))
    );

    if (results.updatedIDEs?.length > 0) {
      console.log(this.formatKeyValue('IDE Integrations Updated', results.updatedIDEs.join(', ')));
    }

    if (results.newPatterns?.length > 0) {
      console.log(
        this.formatKeyValue('New Patterns Detected', this.formatCount(results.newPatterns.length))
      );
    }

    if (results.warnings?.length > 0) {
      console.log(`\n${this.colorPrimary('⚠️  Warnings:')}`);
      results.warnings.forEach(warning => {
        this.logWarning(`  ${warning}`);
      });
    }
  }
}
