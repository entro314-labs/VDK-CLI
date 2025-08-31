/**
 * ScanCommand
 * -----------------------
 * Handles 'vdk scan' command - Re-analyze project and update existing AI rules
 * by rescanning the project and refreshing IDE integrations.
 */

import path from 'node:path'
import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { runScanner } from '../../scanner/index.js'

export class ScanCommand extends BaseCommand {
  constructor() {
    super('scan', 'Re-analyze project and update existing AI rules')
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --projectPath <path>', 'Path to the project to rescan', process.cwd())
      .option('-o, --outputPath <path>', 'Path where updated rules should be saved', './.vdk/rules')
      .option('--ide <ide>', 'Target specific IDE for scanning (vscode, jetbrains, cursor, etc.)')
      .option('-d, --deep', 'Enable deep scanning for more thorough pattern detection', false)
      .option('-i, --ignorePattern <patterns...>', 'Glob patterns to ignore', [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
      ])
      .option(
        '--use-gitignore',
        // biome-ignore lint/nursery/noSecrets: This is a legitimate help text for CLI option
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
  }

  /**
   * Validate command options
   */
  validateOptions(options) {
    // Validate project path exists
    if (!commandContext.pathExists(options.projectPath)) {
      this.exitWithError(`Project path does not exist: ${options.projectPath}`)
    }

    // Check if VDK is initialized in this project
    const vdkConfigPath = path.join(options.projectPath, 'vdk.config.json')
    if (!commandContext.pathExists(vdkConfigPath)) {
      this.exitWithError(
        `VDK not initialized in this project. Run 'vdk init' first.\nExpected config file: ${vdkConfigPath}`
      )
    }

    // Validate IDE if specified
    if (options.ide) {
      const supportedIdes = ['vscode', 'jetbrains', 'cursor', 'windsurf', 'zed', 'generic']
      if (!supportedIdes.includes(options.ide.toLowerCase())) {
        this.exitWithError(`Unsupported IDE: ${options.ide}. Supported IDEs: ${supportedIdes.join(', ')}`)
      }
    }
  }

  /**
   * Execute the scan command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    this.validateOptions(options)

    // Load existing VDK config
    const existingConfig = await this.loadVdkConfig(options.projectPath)
    this.logInfo(`Found existing VDK configuration for project: ${existingConfig.project?.name || 'Unknown'}`)

    // Initialize Hub connectivity message
    if (this.hubOps) {
      const connectivity = await this.hubOps.testConnection()
      if (connectivity.success) {
        this.logInfo('🌐 Connected to VDK Hub for enhanced features')
      }
    } else {
      this.logWarning('⚠️  Hub integration unavailable, using local features')
    }

    // Check if incremental scan is possible
    const shouldRunIncremental = options.incremental && !options.force && (await this.canRunIncremental(options))
    const scanMode = shouldRunIncremental ? 'incremental' : 'full'

    // Prepare scanner options
    const scannerOptions = {
      ...options,
      mode: 'update', // Tell scanner we're updating, not initializing
      existingConfig,
      targetIde: options.ide,
      incremental: shouldRunIncremental,
    }

    // Run the scanner to update rules
    const spinner = this.createSpinner(`Running ${scanMode} project scan and updating rules...`)
    spinner.start()

    try {
      const results = await runScanner(scannerOptions)
      spinner.succeed(`${scanMode === 'incremental' ? 'Incremental' : 'Full'} project scan completed successfully`)

      // Update VDK configuration file
      const configPath = await this.updateVdkConfig(options, results, existingConfig)
      this.logSuccess(`VDK configuration updated at ${this.formatPath(configPath)}`)

      // Show summary of changes
      this.showScanSummary(results, scanMode)

      // Track successful completion with Hub
      this.trackSuccess({
        scanMode,
        blueprintsUpdated: results.updatedFiles?.length || 0,
        integrations: results.updatedIDEs || [],
        targetIde: options.ide,
      })

      return {
        success: true,
        scanMode,
        configPath,
        results,
      }
    } catch (error) {
      spinner.fail(`${scanMode} project scan failed`)
      throw error
    }
  }

  /**
   * Load existing VDK configuration
   */
  async loadVdkConfig(projectPath) {
    try {
      const configPath = path.join(projectPath, 'vdk.config.json')
      const configContent = await commandContext.readFile(configPath)
      return JSON.parse(configContent)
    } catch (error) {
      this.exitWithError('Failed to load existing VDK configuration', error)
    }
  }

  /**
   * Check if incremental scan is possible
   */
  async canRunIncremental(options) {
    // This would check file modification times, git status, etc.
    // For now, return false to always do full scan
    // TODO: Implement proper incremental scan detection
    return false
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
    }

    // Update IDE info if targeting specific IDE
    if (options.ide) {
      updatedConfig.ide = options.ide
    }

    const configPath = await commandContext.writeVdkConfig(updatedConfig, options.projectPath)
    return configPath
  }

  /**
   * Show scan summary
   */
  showScanSummary(results, scanMode) {
    console.log('\n' + this.colorPrimary('🔍 Scan Summary:'))
    console.log(this.formatKeyValue('Scan Mode', scanMode))
    console.log(this.formatKeyValue('Files Analyzed', this.formatCount(results.filesAnalyzed || 0)))
    console.log(this.formatKeyValue('Rules Updated', this.formatCount(results.updatedFiles?.length || 0)))

    if (results.updatedIDEs?.length > 0) {
      console.log(this.formatKeyValue('IDE Integrations Updated', results.updatedIDEs.join(', ')))
    }

    if (results.newPatterns?.length > 0) {
      console.log(this.formatKeyValue('New Patterns Detected', this.formatCount(results.newPatterns.length)))
    }

    if (results.warnings?.length > 0) {
      console.log('\n' + this.colorPrimary('⚠️  Warnings:'))
      results.warnings.forEach((warning) => {
        this.logWarning(`  ${warning}`)
      })
    }
  }
}
