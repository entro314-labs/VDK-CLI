/**
 * IDE Plugin Integration Module
 * --------------------------
 * Provides hooks and utilities for integrating the Project Scanner with IDE plugins.
 * Enables real-time rule generation and synchronization with editors.
 * Part of Phase 3 implementation for the Project-Specific Rule Generator.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'

import {
  detectIDEs as detectIDEConfigs,
  getIDEConfigById,
  getIDEConfigPaths,
  IDE_CONFIGURATIONS,
} from '../../shared/ide-configuration.js'

/**
 * IDE Integration Manager class
 * Handles communication between the Project Scanner and IDE plugins
 */
class IDEIntegrationManager {
  constructor(options = {}) {
    this.options = {
      supportedIDEs: options.supportedIDEs || IDE_CONFIGURATIONS.map((ide) => ide.id),
      watchMode: options.watchMode,
      pollingInterval: options.pollingInterval || 5000, // 5 seconds default
      verbose: options.verbose,
    }

    this.integrations = {}
    this.watchers = {}
    this.lastScanTimestamp = Date.now()
    this.changeBuffer = {}
  }

  /**
   * Initialize IDE integrations based on detected IDE configuration files
   * @param {string} projectPath - Path to the project
   * @returns {Array} - List of initialized integrations
   */
  async initialize(projectPath) {
    console.log(chalk.blue('\nInitializing IDE integrations...'))

    const detectedIDEs = await this.detectIDEs(projectPath)

    if (detectedIDEs.length === 0) {
      console.log(chalk.yellow('No supported IDE configurations detected. Using generic integration.'))
      detectedIDEs.push('generic')
    }

    // Initialize each detected integration
    for (const ideId of detectedIDEs) {
      await this.initializeIntegration(ideId, projectPath)
    }

    console.log(chalk.green(`IDE integrations initialized: ${Object.keys(this.integrations).join(', ')}`))

    return Object.keys(this.integrations)
  }

  /**
   * Detect IDE configuration files in the project
   * @param {string} projectPath - Path to the project
   * @returns {Array} - List of detected IDE IDs
   */
  async detectIDEs(projectPath) {
    // Use the centralized detection function
    const detectedConfigs = detectIDEConfigs(projectPath)

    // Filter by supported IDEs and return IDs only
    return detectedConfigs.filter((config) => this.options.supportedIDEs.includes(config.id)).map((config) => config.id)
  }

  /**
   * Initialize an IDE integration
   * @param {string} ideId - IDE identifier
   * @param {string} projectPath - Path to the project
   */
  async initializeIntegration(ideId, projectPath) {
    // Get configuration paths from centralized module
    const paths = getIDEConfigPaths(ideId, projectPath)
    const ideConfig = getIDEConfigById(ideId)

    // Create the integration object
    this.integrations[ideId] = {
      id: ideId,
      name: ideConfig ? ideConfig.name : ideId,
      configPath: paths.configPath,
      rulePath: paths.rulePath,
      handlers: this.getHandlers(ideId),
    }

    // Create rule directories if they don't exist
    const rulePath = this.integrations[ideId].rulePath
    if (!fs.existsSync(rulePath)) {
      fs.mkdirSync(rulePath, { recursive: true })
      console.log(chalk.green(`Created rule directory for ${this.integrations[ideId].name}: ${rulePath}`))
    }

    // If in watch mode, start file watchers for IDE config changes
    if (this.options.watchMode) {
      await this.startWatcher(ideId, projectPath)
    }

    if (this.options.verbose) {
      console.log(chalk.gray(`Initialized ${this.integrations[ideId].name} integration at ${rulePath}`))
    }
  }

  /**
   * Get the configuration path for an IDE
   * @param {string} ideId - IDE identifier
   * @param {string} projectPath - Path to the project
   * @returns {string} - Path to the IDE configuration
   */
  getConfigPath(ideId, projectPath) {
    const paths = getIDEConfigPaths(ideId, projectPath)
    return paths.configPath
  }

  /**
   * Get the rule path for an IDE
   * @param {string} ideId - IDE identifier
   * @param {string} projectPath - Path to the project
   * @returns {string} - Path to the IDE rules
   */
  getRulePath(ideId, projectPath) {
    const paths = getIDEConfigPaths(ideId, projectPath)
    return paths.rulePath
  }

  /**
   * Get handlers for IDE-specific events
   * @param {string} ide - IDE identifier
   * @returns {Object} - Handler functions
   */
  getHandlers(ide) {
    // Define handlers for different IDE events
    return {
      onConfigChange: async (_configPath) => {
        console.log(chalk.yellow(`${ide} configuration changed, updating rules...`))
        await this.regenerateRules(ide)
      },
      onRuleUpdate: async (rulePath) => {
        console.log(chalk.green(`Rules updated for ${ide}`))
        // Notify the IDE about rule changes if supported
        switch (ide) {
          case 'vscode':
          case 'vscode-insiders':
            this.notifyVSCode(rulePath, ide)
            break
          case 'cursor':
            this.notifyCursor(rulePath)
            break
          case 'windsurf':
          case 'windsurf-next':
            this.notifyWindsurf(rulePath, ide)
            break
          case 'github-copilot':
            this.notifyGitHubCopilot(rulePath)
            break
          case 'claude':
          case 'claude-desktop':
            this.notifyClaude(rulePath, ide)
            break
          case 'zed':
            this.notifyZed(rulePath)
            break
          case 'jetbrains':
            this.notifyJetBrains(rulePath)
            break
          default:
            console.log(chalk.gray(`[${ide} notification] Rules updated at ${rulePath}`))
            break
        }
      },
    }
  }

  /**
   * Start a file watcher for an IDE configuration
   * @param {string} ide - IDE identifier
   * @param {string} projectPath - Path to the project
   */
  async startWatcher(ide, projectPath) {
    const configPath = this.getConfigPath(ide, projectPath)

    if (!fs.existsSync(configPath)) {
      return
    }

    console.log(chalk.blue(`Starting watcher for ${ide} configuration...`))

    // Simple polling-based file watcher
    this.watchers[ide] = setInterval(() => {
      const stats = fs.statSync(configPath)

      if (stats.mtime.getTime() > this.lastScanTimestamp) {
        this.bufferChange(ide, configPath)
      }
    }, this.options.pollingInterval)
  }

  /**
   * Buffer changes to prevent multiple rapid regenerations
   * @param {string} ide - IDE identifier
   * @param {string} configPath - Path to the changed configuration
   */
  bufferChange(ide, configPath) {
    if (!this.changeBuffer[ide]) {
      this.changeBuffer[ide] = {
        timestamp: Date.now(),
        path: configPath,
        timer: setTimeout(() => {
          // Process the change after a delay
          if (this.integrations[ide]?.handlers.onConfigChange) {
            this.integrations[ide].handlers.onConfigChange(configPath)
          }
          delete this.changeBuffer[ide]
          this.lastScanTimestamp = Date.now()
        }, 2000), // 2 second debounce
      }
    }
  }

  /**
   * Regenerate rules for an IDE
   * @param {string} ide - IDE identifier
   */
  async regenerateRules(ide) {
    if (!this.integrations[ide]) {
      return
    }

    const rulePath = this.integrations[ide].rulePath
    const projectPath = path.dirname(path.dirname(rulePath))

    console.log(chalk.blue(`Regenerating rules for ${ide}...`))

    // Launch the scanner process as a background task
    const scanner = spawn(
      'node',
      [path.join(process.cwd(), 'src', 'index.js'), '--path', projectPath, '--output', rulePath, '--verbose'],
      {
        detached: true,
        stdio: 'ignore',
      }
    )

    // Don't wait for the process to complete, let it run in background
    scanner.unref()

    console.log(chalk.green(`Rule regeneration initiated for ${ide}`))
  }

  /**
   * Notify VS Code about rule changes
   * @param {string} rulePath - Path to the rules
   * @param {string} variant - 'vscode' or 'vscode-insiders'
   */
  notifyVSCode(rulePath, variant = 'vscode') {
    // This would use the VS Code extension API when implemented
    console.log(
      chalk.gray(
        `[${variant === 'vscode-insiders' ? 'VS Code Insiders' : 'VS Code'} notification] Rules updated at ${rulePath}`
      )
    )
  }

  /**
   * Notify Cursor about rule changes
   * @param {string} rulePath - Path to the rules
   */
  notifyCursor(rulePath) {
    // This would use Cursor-specific mechanisms when implemented
    console.log(chalk.gray(`[Cursor notification] Rules updated at ${rulePath}`))
  }

  /**
   * Notify Windsurf about rule changes
   * @param {string} rulePath - Path to the rules
   * @param {string} variant - 'windsurf' or 'windsurf-next'
   */
  notifyWindsurf(rulePath, variant = 'windsurf') {
    // This would use Windsurf-specific mechanisms when implemented
    const variantName = variant === 'windsurf-next' ? 'Windsurf Next' : 'Windsurf'
    console.log(chalk.gray(`[${variantName} notification] Rules updated at ${rulePath}`))
  }

  /**
   * Notify GitHub Copilot about rule changes
   * @param {string} rulePath - Path to the rules
   */
  notifyGitHubCopilot(rulePath) {
    // This would use GitHub Copilot-specific mechanisms when implemented
    console.log(chalk.gray(`[GitHub Copilot notification] Rules updated at ${rulePath}`))
  }

  /**
   * Notify Claude about rule changes
   * @param {string} rulePath - Path to the rules
   * @param {string} variant - 'claude' or 'claude-desktop'
   */
  notifyClaude(rulePath, variant = 'claude') {
    // This would use Claude-specific mechanisms when implemented
    const variantName = variant === 'claude-desktop' ? 'Claude Desktop' : 'Claude Code CLI'
    console.log(chalk.gray(`[${variantName} notification] Rules updated at ${rulePath}`))
  }

  /**
   * Notify Zed Editor about rule changes
   * @param {string} rulePath - Path to the rules
   */
  notifyZed(rulePath) {
    // This would use Zed-specific mechanisms when implemented
    console.log(chalk.gray(`[Zed Editor notification] Rules updated at ${rulePath}`))
  }

  /**
   * Notify JetBrains IDE about rule changes
   * @param {string} rulePath - Path to the rules
   */
  notifyJetBrains(rulePath) {
    // This would use JetBrains-specific mechanisms when implemented
    console.log(chalk.gray(`[JetBrains notification] Rules updated at ${rulePath}`))
  }

  /**
   * Clean up resources when shutting down
   */
  shutdown() {
    // Clear all watchers
    for (const ide in this.watchers) {
      clearInterval(this.watchers[ide])
    }

    // Clear any pending change timers
    for (const ide in this.changeBuffer) {
      if (this.changeBuffer[ide].timer) {
        clearTimeout(this.changeBuffer[ide].timer)
      }
    }

    console.log(chalk.blue('IDE integrations shut down'))
  }
}

export { IDEIntegrationManager }
