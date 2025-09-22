/**
 * Team Sync Command
 * ----------------
 * Sync VDK configuration from team shared resources (Git or Hub)
 */

import fs from 'node:fs'
import path from 'node:path'
import { BaseCommand } from '../base/BaseCommand.js'
import { SyncOperations } from '../../shared/sync-operations.js'

export class TeamSyncCommand extends BaseCommand {
  constructor() {
    super('team:sync', 'Sync VDK configuration from team resources')
  }

  configureOptions(command) {
    return command
      .option('--source <source>', 'Sync source (git|hub|auto)', 'auto')
      .option('--team-id <teamId>', 'Team ID for Hub sync')
      .option('--force', 'Force overwrite local configuration', false)
      .option('--dry-run', 'Show what would be synced without applying', false)
      .option('--backup', 'Backup existing configuration before sync', true)
  }

  async execute(options) {
    this.showHeader()

    const { source, teamId, force, dryRun, backup } = options
    const syncOps = new SyncOperations(this)
    const projectPath = process.cwd()

    this.logInfo('🔄 VDK Team Sync')
    this.logInfo('')

    try {
      let actualSource = source

      if (source === 'auto') {
        actualSource = await this.detectSource(projectPath)
        this.logInfo(`Auto-detected source: ${actualSource}`)
      }

      // Create backup if requested
      if (backup && !dryRun) {
        await syncOps.createBackup(path.join(projectPath, '.vdk'), 'team')
      }

      let result
      if (actualSource === 'git') {
        result = await syncOps.syncFromRepository(projectPath, {
          force,
          dryRun,
          type: 'team-config'
        })
      } else if (actualSource === 'hub') {
        result = await syncOps.syncFromHub(projectPath, {
          teamId,
          force,
          dryRun,
          type: 'team-config'
        })
      } else {
        this.logError(`Unknown sync source: ${actualSource}`)
        return { success: false, error: 'Invalid sync source' }
      }

      if (result.synced > 0) {
        this.logSuccess('✅ Team configuration synced successfully')
        this.logInfo(`📁 ${result.synced} files updated`)
      } else {
        this.logWarning('⚠️  No changes applied')
      }

      return {
        success: true,
        source: actualSource,
        synced: result.synced,
        backupCreated: backup && !dryRun
      }
    } catch (error) {
      this.logError(`Team sync failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  async detectSource(projectPath) {

    // Check if we're in a Git repository with VDK files
    try {
      const { execSync } = await import('child_process')
      execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'ignore' })

      // Check if there are VDK files in Git
      const gitStatus = execSync('git ls-files .vdk/', { cwd: projectPath, encoding: 'utf8' })
      if (gitStatus.trim()) {
        return 'git'
      }
    } catch {
      // Not a Git repo or no VDK files in Git
    }

    // Check for Hub team configuration
    const configPath = path.join(projectPath, '.vdk', 'config.json')
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        if (config.team?.id || process.env.VDK_TEAM_ID) {
          return 'hub'
        }
      } catch {
        // Invalid config file
      }
    }

    return 'git' // Default fallback
  }
}