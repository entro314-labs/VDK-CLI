/**
 * Unified Migration Command
 * ------------------------
 * Consolidated migration command that routes to appropriate migration strategies
 * based on the task type and detected context.
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class UnifiedMigrateCommand extends BaseCommand {
  constructor() {
    super('migrate', 'Migrate existing AI contexts and rules to VDK format');
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --projectPath <path>', 'Path to the project to scan', process.cwd())
      .option(
        '-o, --outputPath <path>',
        'Path where VDK rule artifacts should be saved',
        './.vdk/blueprints/rules'
      )
      .option(
        '--type <type>',
        'Migration type: auto, schema, context, or detect (default)',
        'detect'
      )
      .option('--source <path>', 'Source path for specific migration types')
      .option('--schema-version <version>', 'Target schema version for schema migration', '3.0.0')
      .option('--dry-run', 'Preview migration without creating files', false)
      .option('--preview', 'Alias for --dry-run', false)
      .option('--force', 'Force migration even if files already exist', false)
      .option('--clean', 'Remove import files after successful migration', false)
      .option('--no-deploy', 'Skip deployment to IDE integrations')
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  /**
   * Get validation rules for UnifiedMigrateCommand
   */
  getValidationRules() {
    return {
      defaults: {
        projectPath: process.cwd(),
        outputPath: './.vdk/blueprints/rules',
        type: 'detect',
        schemaVersion: '3.0.0',
        dryRun: false,
        force: false,
        clean: false,
        deploy: true,
        verbose: false,
      },
      fields: {
        projectPath: {
          type: 'string',
          pathType: 'directory',
        },
        outputPath: {
          type: 'string',
          pathType: 'writeable',
        },
        type: {
          type: 'string',
          enum: ['auto', 'schema', 'context', 'detect'],
        },
        source: {
          type: 'string',
          pathType: 'directory',
          validate: (value, options) => {
            // Source is required for schema migration type
            if (options.type === 'schema' && !value) {
              return 'Source path is required for schema migration';
            }
            return true;
          },
        },
        schemaVersion: {
          type: 'string',
          format: 'semver',
        },
      },
      crossValidation: options => {
        const errors = [];

        // Check conflicting options
        if (options.dryRun && options.clean) {
          errors.push('Cannot use --clean with --dry-run (dry run does not modify files)');
        }

        if (options.dryRun && options.deploy) {
          errors.push('Cannot deploy during dry run (use --no-deploy or remove --dry-run)');
        }

        // Validate schema migration requirements
        if (options.type === 'schema') {
          if (!(options.source || options.outputPath)) {
            errors.push(
              'Schema migration requires either --source or existing rules in output path'
            );
          }
        }

        return errors.length > 0 ? errors : true;
      },
    };
  }

  /**
   * Execute the unified migration command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    if (options.preview) {
      options.dryRun = true;
    }

    // Dry-run should never require deploy capabilities.
    // Normalize this before validation so --dry-run works out-of-the-box.
    if (options.dryRun && options.deploy !== false) {
      options.deploy = false;
      if (options.verbose) {
        this.logInfo('Dry-run mode detected: deployment automatically disabled');
      }
    }

    await this.validateOptions(options, this.getValidationRules());

    try {
      // Determine migration strategy
      const strategy = await this.determineMigrationStrategy(options);

      if (options.verbose) {
        this.logInfo(`Using migration strategy: ${strategy}`);
      }

      let result;
      switch (strategy) {
        case 'auto':
          result = await this.executeAutoMigration(options);
          break;
        case 'schema':
          result = await this.executeSchemaMigration(options);
          break;
        case 'context':
          result = await this.executeContextMigration(options);
          break;
        default:
          throw new Error(`Unknown migration strategy: ${strategy}`);
      }

      this.displayMigrationResults(result, options);
      this.trackSuccess({ strategy, ...result });

      return { success: true, strategy, result };
    } catch (error) {
      if (/no\s+rules\s+found|no\s+migration\s+targets\s+found/i.test(error.message)) {
        console.log('No rules found');
      }
      this.exitWithError(`Migration failed: ${error.message}`, error);
    }
  }

  /**
   * Determine the best migration strategy based on context
   */
  async determineMigrationStrategy(options) {
    if (options.type !== 'detect') {
      return options.type;
    }

    const spinner = this.createSpinner('Analyzing migration requirements...');
    spinner.start();

    try {
      // Check for imported files in .vdk/migrate (legacy fallback: .vdk/import)
      const importPath = `${options.projectPath}/.vdk/migrate`;
      const legacyImportPath = `${options.projectPath}/.vdk/import`;
      const hasImportedFiles =
        (await this.checkDirectory(importPath)) || (await this.checkDirectory(legacyImportPath));

      // Check for existing VDK rules that might need schema migration
      const rulesPath = options.outputPath;
      const hasExistingRules = await this.checkDirectory(rulesPath);

      // Check for AI contexts in the project
      const { MigrationDetector } = await import('../../migration/core/migration-detector.js');
      const detector = new MigrationDetector();
      const { ProjectScanner } = await import('../../scanner/core/ProjectScanner.js');
      const scanner = new ProjectScanner({ projectPath: options.projectPath, verbose: false });
      const projectData = await scanner.scanProject(options.projectPath);
      const contexts = await detector.detectAIContexts(projectData);

      spinner.stop();

      // Decision logic
      if (hasImportedFiles) {
        this.logInfo('Found imported AI rules - using auto migration');
        return 'auto';
      } else if (hasExistingRules) {
        this.logInfo('Found existing VDK rules - using schema migration');
        return 'schema';
      } else if (contexts.length > 0) {
        this.logInfo(`Found ${contexts.length} AI contexts - using context migration`);
        return 'context';
      } else {
        this.logWarning('No migration targets found');
        return 'context'; // Default fallback
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      throw error;
    }
  }

  /**
   * Execute auto migration (for imported rules)
   */
  async executeAutoMigration(options) {
    const { AutoMigrator } = await import('../../migration/AutoMigrator.js');
    const migrator = new AutoMigrator(options.projectPath);

    return await migrator.migrate({
      preview: options.dryRun,
      clean: options.clean,
      force: options.force,
      verbose: options.verbose,
    });
  }

  /**
   * Execute schema migration (for version updates)
   */
  async executeSchemaMigration(options) {
    const { SchemaV3Migrator } = await import('../../migration/converters/schema-v3-migrator.js');
    const migrator = new SchemaV3Migrator({ verbose: options.verbose });

    const inputPath = options.source || options.outputPath;
    const outputPath = options.outputPath;

    if (options.dryRun) {
      const files = await migrator.findBlueprintFiles(inputPath);
      return {
        type: 'schema',
        dryRun: true,
        filesFound: files.length,
        targetVersion: options.schemaVersion,
      };
    } else {
      return await migrator.migrateBlueprints(inputPath, outputPath, {
        force: options.force,
        verbose: options.verbose,
      });
    }
  }

  /**
   * Execute context migration (for AI contexts)
   */
  async executeContextMigration(options) {
    const { MigrationManager } = await import('../../migration/migration-manager.js');
    const migrationManager = new MigrationManager({
      projectPath: options.projectPath,
      outputPath: options.outputPath,
      verbose: options.verbose,
    });

    return await migrationManager.migrate({
      dryRun: options.dryRun,
      deployToIdes: options.deploy !== false,
    });
  }

  /**
   * Check if directory exists and has files
   */
  async checkDirectory(dirPath) {
    try {
      const fs = await import('node:fs/promises');
      const stats = await fs.stat(dirPath);
      if (stats.isDirectory()) {
        const files = await fs.readdir(dirPath);
        return files.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Display unified migration results
   */
  displayMigrationResults(result, options) {
    if (options.dryRun) {
      this.logInfo('🔍 Migration Preview:');
    } else {
      this.logSuccess('✅ Migration Complete:');
    }

    // Display results based on migration type
    if (result.type === 'schema') {
      if (result.dryRun) {
        this.logInfo(`Found ${result.filesFound} files for schema migration`);
        this.logInfo(`Target version: ${result.targetVersion}`);
      } else {
        this.logInfo(`Processed: ${result.processed || 0}`);
        this.logInfo(`Migrated: ${result.migrated || 0}`);
        this.logInfo(`Errors: ${result.errors || 0}`);
      }
    } else {
      // Auto and context migration results
      if (result.contextsFound) this.logInfo(`Found ${result.contextsFound} AI contexts`);
      if (result.contextsConverted) this.logInfo(`Converted ${result.contextsConverted} contexts`);
      if (result.rulesGenerated) this.logInfo(`Generated ${result.rulesGenerated} VDK rules`);
      if (result.ideIntegrations)
        this.logInfo(`Configured ${result.ideIntegrations} IDE integrations`);
      if (result.importedFiles?.length)
        this.logInfo(`Imported ${result.importedFiles.length} files`);
    }

    if (!options.dryRun && result.success) {
      console.log('');
      this.logInfo('🎯 Next Steps:');
      this.logInfo('   • Run "vdk status" to verify the migration');
      this.logInfo('   • Use "vdk sync" to get additional blueprints');
      this.logInfo('   • Try "vdk validate" to check rule quality');
    }
  }
}
