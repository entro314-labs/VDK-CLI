/**
 * MigrateCommand
 * -----------------------
 * Handles 'vdk migrate' command - Migrate existing AI contexts to VDK format
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { MigrationManager } from '../../migration/migration-manager.js'

export class MigrateCommand extends BaseCommand {
  constructor() {
    super('migrate', 'Migrate existing AI contexts to VDK format')
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --projectPath <path>', 'Path to the project to scan', process.cwd())
      .option('-o, --outputPath <path>', 'Path where VDK rules should be saved', './.vdk/rules')
      .option('--migrationOutput <path>', 'Path for migration files', './vdk-migration')
      .option('--dry-run', 'Preview migration without creating files', false)
      .option('--no-deploy', 'Skip deployment to IDE integrations')
      .option('-v, --verbose', 'Enable verbose output', false)
  }

  /**
   * Execute the migrate command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    const spinner = this.createSpinner('Analyzing project for existing AI contexts...')
    spinner.start()

    try {
      const migrationManager = new MigrationManager({
        projectPath: options.projectPath,
        outputPath: options.outputPath,
        migrationOutputPath: options.migrationOutput,
        verbose: options.verbose,
      })

      const result = await migrationManager.migrate({
        dryRun: options.dryRun,
        deployToIdes: options.deploy !== false,
      })

      spinner.succeed('Migration completed successfully')

      // Show migration results
      this.displayMigrationResults(result, options)

      this.trackSuccess({
        migrationResults: result,
        dryRun: options.dryRun,
      })

      return { success: true, result }
    } catch (error) {
      spinner.fail('Migration failed')
      throw error
    }
  }

  /**
   * Display migration results
   */
  displayMigrationResults(result, options) {
    if (options.dryRun) {
      this.logInfo('🔍 Migration Preview:')
    } else {
      this.logSuccess('✅ Migration Complete:')
    }

    if (result.contextsFound) {
      this.logInfo(`Found ${result.contextsFound} AI contexts`)
    }
    if (result.contextsConverted) {
      this.logInfo(`Converted ${result.contextsConverted} contexts`)
    }
    if (result.rulesGenerated) {
      this.logInfo(`Generated ${result.rulesGenerated} VDK rules`)
    }
    if (result.ideIntegrations) {
      this.logInfo(`Configured ${result.ideIntegrations} IDE integrations`)
    }

    if (!options.dryRun && result.success) {
      console.log('')
      this.logInfo('🎯 Next Steps:')
      this.logInfo('   • Run "vdk status" to verify the migration')
      this.logInfo('   • Use "vdk sync" to get additional blueprints')
      this.logInfo('   • Try "vdk validate" to check rule quality')
    }
  }
}
