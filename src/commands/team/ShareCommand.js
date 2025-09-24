/**
 * Team Share Command
 * -----------------
 * Share project VDK configuration with team members via Git repository
 * or VDK Hub team features.
 */

import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

import { BaseCommand } from '../base/BaseCommand.js'

export class TeamShareCommand extends BaseCommand {
  constructor() {
    super('team:share', 'Share VDK configuration with team members')
  }

  configureCommand(command) {
    return command
      .description('Share VDK configuration with team members')
      .option('--method <method>', 'Sharing method (git|hub)', 'git')
      .option('--team-id <teamId>', 'Team ID for Hub sharing')
      .option('--include-local', 'Include local settings (use with caution)', false)
      .option('--dry-run', 'Show what would be shared without actually sharing', false)
      .option('--message <message>', 'Commit message for git sharing', 'chore: share VDK team configuration')
  }

  async execute(options, context) {
    const { method, teamId, includeLocal, dryRun, message } = options
    const { logger } = context

    logger.info('🤝 VDK Team Share')
    logger.info('')

    try {
      // Check if VDK is initialized
      const vdkConfigPath = path.join(context.projectPath, '.vdk')
      if (!fs.existsSync(vdkConfigPath)) {
        logger.error('VDK not initialized in this project')
        logger.info('Run `vdk init` first to create VDK configuration')
        return { success: false, error: 'VDK not initialized' }
      }

      if (method === 'git') {
        return await this.shareViaGit(options, context)
      } else if (method === 'hub') {
        return await this.shareViaHub(options, context)
      } else {
        logger.error(`Unknown sharing method: ${method}`)
        return { success: false, error: 'Invalid sharing method' }
      }
    } catch (error) {
      logger.error(`Team share failed: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  async shareViaGit(options, context) {
    const { includeLocal, dryRun, message } = options
    const { logger, projectPath } = context

    logger.info('📦 Sharing via Git repository...')

    try {
      // Check if this is a Git repository
      const { execSync } = await import('child_process')

      try {
        execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'ignore' })
      } catch {
        logger.error('This project is not a Git repository')
        logger.info('Initialize Git first: git init')
        return { success: false, error: 'Not a Git repository' }
      }

      // Prepare files to share
      const filesToShare = ['.vdk/rules/', '.vdk/config.json']

      if (includeLocal) {
        logger.warn('⚠️  Including local settings - ensure no sensitive data is shared')
        filesToShare.push('.vdk/settings.local.json')
      }

      // Check what files exist
      const existingFiles = []
      for (const file of filesToShare) {
        const fullPath = path.join(projectPath, file)
        if (fs.existsSync(fullPath)) {
          existingFiles.push(file)
        }
      }

      if (existingFiles.length === 0) {
        logger.warn('No VDK configuration files found to share')
        return { success: false, error: 'No files to share' }
      }

      if (dryRun) {
        logger.info('📋 Dry run - would share these files:')
        existingFiles.forEach((file) => {
          logger.info(`  • ${file}`)
        })
        return { success: true, dryRun: true, files: existingFiles }
      }

      // Add files to Git
      const gitAddCommands = existingFiles.map((file) => `git add "${file}"`).join(' && ')
      execSync(gitAddCommands, { cwd: projectPath, stdio: 'inherit' })

      // Commit the changes
      execSync(`git commit -m "${message}"`, { cwd: projectPath, stdio: 'inherit' })

      logger.success('✅ VDK configuration committed to Git')
      logger.info('')
      logger.info('Next steps:')
      logger.info('1. Push changes: git push')
      logger.info('2. Team members can pull and run: vdk team:sync')

      return {
        success: true,
        method: 'git',
        filesShared: existingFiles,
        commitMessage: message,
      }
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        logger.info('No changes to commit - VDK configuration already shared')
        return { success: true, message: 'Already up to date' }
      }
      throw error
    }
  }

  async shareViaHub(options, context) {
    const { teamId, dryRun } = options
    const { logger, projectPath } = context

    logger.info('☁️  Sharing via VDK Hub...')

    if (!teamId) {
      logger.error('Team ID required for Hub sharing')
      logger.info('Use --team-id <id> or set VDK_TEAM_ID environment variable')
      return { success: false, error: 'Team ID required' }
    }

    try {
      const { VDKHubClient } = await import('../../hub/VDKHubClient.js')
      const hubClient = new VDKHubClient()

      // Check authentication
      const authStatus = await hubClient.checkAuth()
      if (!authStatus.authenticated) {
        logger.error('VDK Hub authentication required')
        logger.info('Run `vdk hub auth` to authenticate')
        return { success: false, error: 'Authentication required' }
      }

      // Read VDK configuration
      const vdkConfig = this.readVDKConfig(projectPath)

      if (dryRun) {
        logger.info('📋 Dry run - would share:')
        logger.info(`  • Team ID: ${teamId}`)
        logger.info(`  • Configuration files: ${Object.keys(vdkConfig).length}`)
        return { success: true, dryRun: true, config: vdkConfig }
      }

      // Share configuration with team
      const shareResult = await hubClient.shareTeamConfig(teamId, vdkConfig)

      logger.success('✅ VDK configuration shared with team')
      logger.info(`Share URL: ${shareResult.shareUrl}`)
      logger.info('')
      logger.info(`Team members can sync with: vdk team:sync --team-id ${teamId}`)

      return {
        success: true,
        method: 'hub',
        teamId,
        shareUrl: shareResult.shareUrl,
        expiresAt: shareResult.expiresAt,
      }
    } catch (error) {
      if (error.message.includes('Team not found')) {
        logger.error('Team not found - check team ID or create team first')
      }
      throw error
    }
  }

  readVDKConfig(projectPath) {
    const config = {}
    const vdkPath = path.join(projectPath, '.vdk')

    // Read main config
    const configFile = path.join(vdkPath, 'config.json')
    if (fs.existsSync(configFile)) {
      config.main = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    }

    // Read rules
    const rulesPath = path.join(vdkPath, 'rules')
    if (fs.existsSync(rulesPath)) {
      config.rules = {}
      const ruleFiles = fs.readdirSync(rulesPath).filter((f) => f.endsWith('.md'))
      for (const file of ruleFiles) {
        const content = fs.readFileSync(path.join(rulesPath, file), 'utf8')
        config.rules[file] = content
      }
    }

    return config
  }
}
