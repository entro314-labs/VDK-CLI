/**
 * CommandContext
 * -----------------------
 * Shared context and utilities for all VDK CLI commands.
 * Provides consistent environment setup and common dependencies.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createIntegrationManager } from '../../integrations/index.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class CommandContext {
  constructor() {
    this.initialized = false
    this.cliDir = null
    this.packageInfo = null
    this.integrationManager = null
  }

  /**
   * Initialize the command context
   */
  async initialize() {
    if (this.initialized) return

    // Get CLI directory (VDK CLI root)
    this.cliDir = path.resolve(__dirname, '../../..')

    // Load environment variables
    dotenv.config({ path: path.join(this.cliDir, '.env.local') })
    dotenv.config({ path: path.join(this.cliDir, '.env') })

    // Load package information
    this.packageInfo = require(path.join(this.cliDir, 'package.json'))

    this.initialized = true
  }

  /**
   * Get package version
   */
  getVersion() {
    this.ensureInitialized()
    return this.packageInfo.version
  }

  /**
   * Get CLI directory path
   */
  getCliDirectory() {
    this.ensureInitialized()
    return this.cliDir
  }

  /**
   * Create integration manager for a project
   */
  async createIntegrationManager(projectPath = process.cwd()) {
    if (!this.integrationManager || this.integrationManager.projectPath !== projectPath) {
      this.integrationManager = createIntegrationManager(projectPath)
    }
    return this.integrationManager
  }

  /**
   * Read and parse VDK configuration file
   */
  async readVdkConfig(projectPath = process.cwd(), configPath = 'vdk.config.json') {
    const fullConfigPath = path.resolve(projectPath, configPath)

    try {
      await fs.access(fullConfigPath)
      const configContent = await fs.readFile(fullConfigPath, 'utf8')
      return JSON.parse(configContent)
    } catch (error) {
      return null // Config doesn't exist or is invalid
    }
  }

  /**
   * Write VDK configuration file
   */
  async writeVdkConfig(config, projectPath = process.cwd(), configPath = 'vdk.config.json') {
    const fullConfigPath = path.resolve(projectPath, configPath)
    await fs.writeFile(fullConfigPath, JSON.stringify(config, null, 2))
    return fullConfigPath
  }

  /**
   * Ensure rules directory exists
   */
  async ensureRulesDirectory(rulesPath) {
    const resolvedPath = path.resolve(rulesPath)
    await fs.mkdir(resolvedPath, { recursive: true })
    return resolvedPath
  }

  /**
   * List files in directory with filtering
   */
  async listFiles(directoryPath, filter = null) {
    try {
      const files = await fs.readdir(directoryPath, { recursive: true })
      return filter ? files.filter(filter) : files
    } catch (error) {
      return []
    }
  }

  /**
   * Check if path exists
   */
  async pathExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Resolve path relative to current working directory
   */
  resolvePath(relativePath) {
    return path.resolve(relativePath)
  }

  /**
   * Get relative path for display purposes
   */
  getRelativePath(absolutePath, basePath = process.cwd()) {
    return path.relative(basePath, absolutePath)
  }

  /**
   * Ensure context is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('CommandContext must be initialized before use')
    }
  }
}

// Export singleton instance
export const commandContext = new CommandContext()
