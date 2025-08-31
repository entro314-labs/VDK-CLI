/**
 * UpdateCommand
 * -----------------------
 * Update VDK blueprints from the VDK-Blueprints repository.
 * This is a legacy command that redirects to the sync command.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'

export class UpdateCommand extends BaseCommand {
  constructor() {
    super('update', 'Update VDK blueprints from the VDK-Blueprints repository (legacy, use sync instead)')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command.option('-o, --outputPath <path>', 'Path to the rules directory', './.vdk/rules')
  }

  /**
   * Execute the update command (redirects to sync)
   */
  async execute(options) {
    await commandContext.initialize()

    this.logWarning('The "update" command is deprecated. Use "vdk sync" instead.')
    this.logInfo('Redirecting to sync command...')

    try {
      // Import and execute the sync command
      const { SyncCommand } = await import('./SyncCommand.js')
      const syncCommand = new SyncCommand()

      // Initialize sync command and execute with repo-only mode
      await syncCommand.initialize(options)
      const result = await syncCommand.execute({
        ...options,
        repoOnly: true,
        verbose: options.verbose,
      })

      this.trackSuccess({
        deprecatedCommand: true,
        redirectedToSync: true,
      })

      return result
    } catch (error) {
      this.exitWithError(`Update (sync) failed: ${error.message}`, error)
    }
  }
}
