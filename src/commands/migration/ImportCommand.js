/**
 * ImportCommand
 * -----------------------
 * Auto-detect and import existing AI assistant rules from various formats
 * and platforms into the VDK unified format.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import chalk from 'chalk'

export class ImportCommand extends BaseCommand {
  constructor() {
    super('import', 'Auto-detect and import existing AI assistant rules')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .option('-p, --project-path <path>', 'Path to the project', process.cwd())
      .option('--preview', 'Show what would be imported without applying changes', false)
      .option('--clean', 'Remove import files after successful import', false)
      .option('--force', 'Overwrite existing VDK configurations', false)
      .option('--override-personal', 'Override personal preferences during adaptation', false)
      .option('-v, --verbose', 'Enable verbose output', false)
  }

  /**
   * Execute the import command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    try {
      const { AutoMigrator } = await import('../../migration/AutoMigrator.js')
      const projectPath = options.projectPath || process.cwd()
      const migrator = new AutoMigrator(projectPath)

      const result = await migrator.migrate({
        preview: options.preview,
        clean: options.clean,
        force: options.force,
        overridePersonal: options.overridePersonal,
        verbose: options.verbose,
      })

      // Show success and suggest publishing if rules look good
      if (result.success && result.suggestions?.publishWorthy) {
        console.log('')
        console.log(this.colorCyan('💡 Your adapted rules look great! Consider sharing with the community:'))
        console.log(chalk.gray('   vdk publish .claude/CLAUDE.md'))
      }

      this.trackSuccess({
        importedFiles: result.importedFiles?.length || 0,
        publishWorthy: result.suggestions?.publishWorthy,
      })

      return result
    } catch (error) {
      this.exitWithError(`Import failed: ${error.message}`, error)
    }
  }
}
