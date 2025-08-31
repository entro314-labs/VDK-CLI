/**
 * InitCommand
 * -----------------------
 * Handles 'vdk init' command - Initialize VDK and generate project-aware AI rules
 * by scanning the project and setting up IDE integrations.
 */

import path from 'node:path'
import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { runScanner } from '../../scanner/index.js'

export class InitCommand extends BaseCommand {
  constructor() {
    super('init', 'Initialize VDK and generate project-aware AI rules by scanning the project')
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --projectPath <path>', 'Path to the project to scan', process.cwd())
      .option('-o, --outputPath <path>', 'Path where generated rules should be saved', './.vdk/rules')
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
      .option('-t, --template <name>', 'Name of the rule template to use', 'default')
      .option('--ide <ide>', 'Target specific IDE (vscode, intellij, jetbrains, cursor, zed, windsurf)')
      .option('--overwrite', 'Overwrite existing rule files without prompting', false)
      .option('--ide-integration', 'Enable IDE integration setup', true)
      .option('--no-ide-integration', 'Disable IDE integration setup')
      .option('--watch', 'Enable watch mode for continuous IDE integration updates', false)
      .option('-v, --verbose', 'Enable verbose output for debugging', false)
      .option(
        '--categories <categories...>',
        'Specific command categories to fetch (e.g., development, testing, workflow)'
      )
      .option('--preset <preset>', 'Preset command collection (minimal, full, development, production)', 'auto')
      .option('--interactive', 'Enable interactive category selection', false)
  }

  /**
   * Validate command options
   */
  validateOptions(options) {
    // Apply defaults if options are undefined
    options.projectPath = options.projectPath || process.cwd()
    options.outputPath = options.outputPath || './.vdk/rules'
    options.template = options.template || 'default'

    // Validate project path exists
    if (!commandContext.pathExists(options.projectPath)) {
      this.exitWithError(`Project path does not exist: ${options.projectPath}`)
    }

    // Validate template if specified
    const validTemplates = ['default', 'minimal', 'comprehensive']
    if (!validTemplates.includes(options.template)) {
      this.exitWithError(`Invalid template: ${options.template}. Valid options: ${validTemplates.join(', ')}`)
    }

    // Validate IDE if specified
    if (options.ide) {
      const validIdes = ['vscode', 'intellij', 'jetbrains', 'cursor', 'zed', 'windsurf', 'generic']
      if (!validIdes.includes(options.ide.toLowerCase())) {
        this.exitWithError(`Invalid IDE: ${options.ide}. Valid options: ${validIdes.join(', ')}`)
      }
    }
  }

  /**
   * Execute the init command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    this.validateOptions(options)

    // Initialize Hub connectivity message
    if (this.hubOps) {
      const connectivity = await this.hubOps.testConnection()
      if (connectivity.success) {
        this.logInfo('🌐 Connected to VDK Hub for enhanced features')
      }
    } else {
      this.logWarning('⚠️  Hub integration unavailable, using local features')
    }

    // Run the scanner to generate rules
    const spinner = this.createSpinner('Scanning project and generating rules...')
    spinner.start()

    try {
      const results = await runScanner(options)
      spinner.succeed('Project scan completed successfully')

      // Create VDK configuration file
      const configPath = await this.createVdkConfig(options, results)
      this.logSuccess(`VDK configuration created at ${this.formatPath(configPath)}`)

      // Track successful completion with Hub
      this.trackSuccess({
        blueprintsGenerated: results.generatedFiles?.length || 0,
        integrations: results.initializedIDEs || [],
      })

      // Handle watch mode
      if (options.watch && results.ideIntegration) {
        this.logInfo('Watch mode enabled. Press Ctrl+C to exit.')
        this.setupWatchMode(results.ideIntegration)
      }

      return {
        success: true,
        configPath,
        results,
      }
    } catch (error) {
      spinner.fail('Project scan failed')
      throw error
    }
  }

  /**
   * Create VDK configuration file
   */
  async createVdkConfig(options, results) {
    const config = {
      project: {
        name: results.projectName,
      },
      ide: results.detectedPrimaryIDE || results.initializedIDEs[0] || 'generic',
      rulesPath: options.outputPath,
      lastUpdated: new Date().toISOString(),
    }

    const configPath = await commandContext.writeVdkConfig(config, options.projectPath)
    return configPath
  }

  /**
   * Setup watch mode for continuous IDE integration updates
   */
  setupWatchMode(ideIntegration) {
    process.on('SIGINT', () => {
      this.logInfo('Shutting down watch mode...')
      ideIntegration.shutdown()
      process.exit(0)
    })

    // Keep the process running in watch mode
    return new Promise(() => {}) // Infinite promise to keep process alive
  }
}
