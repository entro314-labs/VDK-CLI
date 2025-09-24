/**
 * InitCommand
 * -----------------------
 * Handles 'vdk init' command - Initialize VDK and generate project-aware AI rules
 * by scanning the project and setting up IDE integrations.
 */

import path from 'node:path'
import { runScanner } from '../../scanner/index.js'
import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'

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
      .option('--use-gitignore', 'Automatically parse .gitignore files for additional ignore patterns', true)
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
   * Get validation rules for InitCommand
   */
  getValidationRules() {
    return {
      defaults: {
        projectPath: process.cwd(),
        outputPath: './.vdk/rules',
        template: 'default',
        useGitignore: true,
        ideIntegration: true,
        preset: 'auto',
        overwrite: false,
        deep: false,
        watch: false,
        verbose: false,
        interactive: false,
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
        template: {
          type: 'string',
          enum: ['default', 'minimal', 'comprehensive'],
        },
        ide: {
          type: 'string',
          enum: ['vscode', 'intellij', 'jetbrains', 'cursor', 'zed', 'windsurf', 'generic'],
          validate: (value) => {
            if (value) {
              return value.toLowerCase() === value ? true : 'IDE name must be lowercase'
            }
            return true
          },
        },
        preset: {
          type: 'string',
          enum: ['auto', 'minimal', 'full', 'development', 'production'],
        },
        ignorePattern: {
          type: 'array',
          warn: (patterns) => {
            if (patterns && patterns.length > 10) {
              return 'Large number of ignore patterns may impact performance'
            }
            return true
          },
        },
        categories: {
          type: 'array',
          validate: (categories) => {
            if (categories) {
              const validCategories = ['development', 'testing', 'workflow', 'deployment', 'analysis']
              const invalidCategories = categories.filter((cat) => !validCategories.includes(cat))
              if (invalidCategories.length > 0) {
                return `Invalid categories: ${invalidCategories.join(', ')}. Valid options: ${validCategories.join(', ')}`
              }
            }
            return true
          },
        },
      },
      crossValidation: (options) => {
        const errors = []

        // Check conflicting options
        if (options.watch && options.dryRun) {
          errors.push('Cannot use --watch with --dry-run')
        }

        if (options.interactive && options.categories) {
          errors.push('Cannot specify --categories when using --interactive mode')
        }

        // Check IDE integration requirements
        if (options.watch && !options.ideIntegration) {
          errors.push('Watch mode requires IDE integration to be enabled')
        }

        return errors.length > 0 ? errors : true
      },
    }
  }

  /**
   * Execute the init command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    await this.validateOptions(options, this.getValidationRules())

    // Initialize Hub connectivity message
    if (this.hubOps) {
      const connectivity = await this.hubOps.testConnection()
      if (connectivity.success) {
        this.logInfo('🌐 Connected to VDK Hub for new features')
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
    // Track resources for cleanup
    this.watchResources = {
      ideIntegration,
      timers: new Set(),
      watchers: new Set(),
      intervals: new Set(),
      isShuttingDown: false,
    }

    // Comprehensive signal handling for graceful shutdown
    const signalHandler = (signal) => {
      if (this.watchResources.isShuttingDown) {
        this.logWarning('Forcefully shutting down...')
        process.exit(1)
      }

      this.logInfo(`Received ${signal}, shutting down watch mode...`)
      this.cleanupWatchMode()
        .then(() => {
          process.exit(0)
        })
        .catch((error) => {
          this.logError(`Cleanup failed: ${error.message}`)
          process.exit(1)
        })
    }

    // Handle multiple shutdown signals
    process.on('SIGINT', signalHandler)
    process.on('SIGTERM', signalHandler)
    process.on('SIGQUIT', signalHandler)

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      this.logError(`Uncaught exception in watch mode: ${error.message}`)
      this.cleanupWatchMode().finally(() => process.exit(1))
    })

    process.on('unhandledRejection', (reason, promise) => {
      this.logError(`Unhandled rejection in watch mode: ${reason}`)
      this.cleanupWatchMode().finally(() => process.exit(1))
    })

    // Set up periodic health check
    const healthCheckInterval = setInterval(() => {
      if (ideIntegration && typeof ideIntegration.healthCheck === 'function') {
        try {
          ideIntegration.healthCheck()
        } catch (error) {
          this.logWarning(`IDE integration health check failed: ${error.message}`)
        }
      }
    }, 30000) // Check every 30 seconds

    this.watchResources.intervals.add(healthCheckInterval)

    // Keep the process running in watch mode with proper Promise handling
    return new Promise((resolve, reject) => {
      // Store resolve/reject for proper cleanup
      this.watchResources.promise = { resolve, reject }

      // Set a timeout to prevent infinite hanging (24 hours max)
      const timeout = setTimeout(
        () => {
          this.logInfo('Watch mode timeout reached (24 hours), shutting down...')
          this.cleanupWatchMode().then(resolve).catch(reject)
        },
        24 * 60 * 60 * 1000
      )

      this.watchResources.timers.add(timeout)
    })
  }

  /**
   * Clean up all watch mode resources
   */
  async cleanupWatchMode() {
    if (this.watchResources.isShuttingDown) {
      return // Already cleaning up
    }

    this.watchResources.isShuttingDown = true

    try {
      // Clear all timers
      for (const timer of this.watchResources.timers) {
        clearTimeout(timer)
      }
      this.watchResources.timers.clear()

      // Clear all intervals
      for (const interval of this.watchResources.intervals) {
        clearInterval(interval)
      }
      this.watchResources.intervals.clear()

      // Close all file watchers
      for (const watcher of this.watchResources.watchers) {
        if (watcher && typeof watcher.close === 'function') {
          await watcher.close()
        }
      }
      this.watchResources.watchers.clear()

      // Shutdown IDE integration
      if (this.watchResources.ideIntegration) {
        try {
          if (typeof this.watchResources.ideIntegration.shutdown === 'function') {
            await this.watchResources.ideIntegration.shutdown()
          }
        } catch (error) {
          this.logWarning(`IDE integration shutdown error: ${error.message}`)
        }
      }

      // Resolve the watch promise if it exists
      if (this.watchResources.promise && this.watchResources.promise.resolve) {
        this.watchResources.promise.resolve()
      }

      this.logInfo('Watch mode cleanup completed')
    } catch (error) {
      this.logError(`Error during watch mode cleanup: ${error.message}`)
      throw error
    }
  }
}
