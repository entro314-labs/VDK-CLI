/**
 * SyncCommand
 * -----------------------
 * Handles 'vdk sync' command - Sync blueprints from VDK Hub and repository
 */

import { SyncOperations } from '../../shared/sync-operations.js'
import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'

export class SyncCommand extends BaseCommand {
  constructor() {
    super('sync', 'Sync blueprints from VDK Hub and repository')
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-o, --outputPath <path>', 'Path to the blueprints directory', './.vdk/rules')
      .option('--force', 'Force full sync instead of incremental', false)
      .option('--category <category>', 'Sync specific category only')
      .option('--hub-only', 'Sync only from Hub, not repository', false)
      .option('--repo-only', 'Sync only from repository, not Hub', false)
  }

  /**
   * Execute the sync command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    const rulesDir = await commandContext.ensureRulesDirectory(options.outputPath)
    const syncOps = new SyncOperations(this)

    let totalSynced = 0
    let hubSynced = 0
    let repoSynced = 0

    // Sync from Hub if available and not disabled
    if (this.hubOps && !options.repoOnly) {
      const hubResult = await syncOps.syncFromHub(rulesDir, {
        force: options.force,
        category: options.category,
        type: 'blueprints',
      })
      hubSynced = hubResult.synced
      totalSynced += hubSynced
    }

    // Sync from repository if not disabled
    if (!options.hubOnly) {
      const repoResult = await syncOps.syncFromRepository(rulesDir, {
        force: options.force,
        category: options.category,
        type: 'blueprints',
      })
      repoSynced = repoResult.synced
      totalSynced += repoSynced
    }

    // Track completion
    this.trackSuccess({
      blueprintsGenerated: totalSynced,
      metadata: {
        hub_synced: hubSynced,
        repo_synced: repoSynced,
        force: options.force,
      },
    })

    // Display final results
    this.showSyncResults(totalSynced, hubSynced, repoSynced)

    return {
      success: true,
      totalSynced,
      hubSynced,
      repoSynced,
    }
  }

  /**
   * Display sync results
   */
  showSyncResults(totalSynced, hubSynced, repoSynced) {
    if (totalSynced > 0) {
      this.logSuccess(`Total: ${totalSynced} blueprints synced`)

      if (hubSynced > 0) {
        this.logInfo(`Hub: ${hubSynced} blueprints`)
      }
      if (repoSynced > 0) {
        this.logInfo(`Repository: ${repoSynced} blueprints`)
      }
    } else {
      this.logSuccess('All blueprints are up to date')
    }
  }
}
