/**
 * SyncCommand
 * -----------------------
 * Handles 'vdk sync' command - Sync blueprints from VDK Hub and repository
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { fetchRuleList, downloadRule } from '../../blueprints-client.js'

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

    const startTime = Date.now()
    const rulesDir = await commandContext.ensureRulesDirectory(options.outputPath)

    let totalSynced = 0
    let hubSynced = 0
    let repoSynced = 0

    // Sync from Hub if available and not disabled
    if (this.hubOps && !options.repoOnly) {
      hubSynced = await this.syncFromHub(rulesDir, options)
      totalSynced += hubSynced
    }

    // Sync from repository if not disabled
    if (!options.hubOnly) {
      repoSynced = await this.syncFromRepository(rulesDir, options)
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
   * Sync blueprints from Hub
   */
  async syncFromHub(rulesDir, options) {
    const spinner = this.createSpinner('Syncing from VDK Hub...')
    spinner.start()

    try {
      const hubResult = await this.hubOps.syncBlueprints({
        force: options.force,
        category: options.category,
      })

      const synced = hubResult.blueprints.length

      // Save Hub blueprints
      for (const blueprint of hubResult.blueprints) {
        const fileName = `${blueprint.slug || blueprint.id}.hub.md`
        const filePath = path.join(rulesDir, fileName)
        await fs.writeFile(filePath, blueprint.content)
      }

      spinner.succeed(`Synced ${synced} blueprints from Hub`)

      // Show change summary
      if (hubResult.changes.added.length > 0) {
        this.logInfo(`+ ${hubResult.changes.added.length} new`)
      }
      if (hubResult.changes.updated.length > 0) {
        this.logInfo(`↻ ${hubResult.changes.updated.length} updated`)
      }

      return synced
    } catch (error) {
      spinner.fail('Hub sync failed')
      this.logWarning(`Hub error: ${error.message}`)
      return 0
    }
  }

  /**
   * Sync blueprints from repository
   */
  async syncFromRepository(rulesDir, options) {
    const spinner = this.createSpinner('Syncing from VDK-Blueprints repository...')
    spinner.start()

    try {
      const remoteRules = await fetchRuleList()
      if (remoteRules.length === 0) {
        spinner.fail('No blueprints found in repository or failed to connect')
        return 0
      }

      const localRules = await fs.readdir(rulesDir).catch(() => [])
      let updatedCount = 0
      let newCount = 0

      for (const remoteRule of remoteRules) {
        // Skip if category filter is specified and doesn't match
        if (options.category && remoteRule.category !== options.category) {
          continue
        }

        const ruleContent = await downloadRule(remoteRule.download_url)
        if (ruleContent) {
          const fileName = remoteRule.name.endsWith('.repo.md')
            ? remoteRule.name
            : `${remoteRule.name.replace(/\.md$/, '')}.repo.md`
          const localPath = path.join(rulesDir, fileName)

          if (localRules.includes(fileName)) {
            if (options.force || (await this.shouldUpdate(localPath, ruleContent))) {
              await fs.writeFile(localPath, ruleContent)
              updatedCount++
            }
          } else {
            await fs.writeFile(localPath, ruleContent)
            newCount++
          }
        }
      }

      const totalSynced = newCount + updatedCount
      spinner.succeed(`Synced ${totalSynced} blueprints from repository`)

      if (newCount > 0) {
        this.logInfo(`+ ${newCount} new`)
      }
      if (updatedCount > 0) {
        this.logInfo(`↻ ${updatedCount} updated`)
      }

      return totalSynced
    } catch (error) {
      spinner.fail('Repository sync failed')
      this.logWarning(`Repository error: ${error.message}`)
      return 0
    }
  }

  /**
   * Check if local file should be updated
   */
  async shouldUpdate(localPath, remoteContent) {
    try {
      const localContent = await fs.readFile(localPath, 'utf8')
      return localContent.trim() !== remoteContent.trim()
    } catch {
      return true // File doesn't exist or can't be read, should update
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
