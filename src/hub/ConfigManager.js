/**
 * ConfigManager - VDK Hub Configuration Management
 *
 * Handles loading, saving, and validating VDK Hub configuration
 * including environment variables, config files, and defaults.
 *
 * Features:
 * - Environment variable integration
 * - JSON config file support
 * - Configuration validation
 * - Secure credential storage
 * - Default value management
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import chalk from 'chalk'

/**
 * Default VDK Hub configuration
 */
const DEFAULT_CONFIG = {
  hub: {
    url: process.env.VDK_HUB_URL || 'https://vdk.tools',
    apiKey: process.env.VDK_HUB_API_KEY,
    timeout: parseInt(process.env.VDK_HUB_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.VDK_HUB_RETRY_ATTEMPTS || '3'),
    telemetryEnabled: process.env.VDK_TELEMETRY_ENABLED !== 'false',
  },
  sync: {
    autoSync: true,
    syncInterval: 24 * 60 * 60 * 1000, // 24 hours
    lastSyncTime: null,
    maxBlueprints: 500,
  },
  generation: {
    defaultOutputFormat: 'bash', // 'bash' | 'zip' | 'config'
    cacheEnabled: true,
    cacheExpiry: 60 * 60 * 1000, // 1 hour
    customRequirements: null,
  },
  telemetry: {
    enabled: process.env.VDK_TELEMETRY_ENABLED !== 'false',
    batchSize: parseInt(process.env.VDK_TELEMETRY_BATCH_SIZE || '25'),
    flushInterval: parseInt(process.env.VDK_TELEMETRY_FLUSH_INTERVAL || '60000'),
    maxQueueSize: 1000,
    verbose: false,
  },
  cli: {
    version: '2.0.0',
    sessionId: null,
    logLevel: process.env.VDK_LOG_LEVEL || 'info',
    debugMode: process.env.VDK_DEBUG === 'true',
  },
}

export class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.vdk')
    this.configPath = path.join(this.configDir, 'config.json')
    this.config = null
  }

  /**
   * Load configuration from file and environment
   */
  async loadConfig() {
    try {
      // Start with defaults
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))

      // Try to load user config file
      if (await this.configFileExists()) {
        const userConfig = await this.loadConfigFile()
        this.config = this.mergeConfigs(this.config, userConfig)
      }

      // Override with environment variables
      this.applyEnvironmentOverrides()

      // Validate configuration
      this.validateConfig()

      return this.config
    } catch (error) {
      console.warn(chalk.yellow(`Failed to load VDK config, using defaults: ${error.message}`))
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
      this.applyEnvironmentOverrides()
      return this.config
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config = null) {
    try {
      const configToSave = config || this.config

      if (!configToSave) {
        throw new Error('No configuration to save')
      }

      // Ensure config directory exists
      await this.ensureConfigDir()

      // Remove sensitive data from saved config
      const safeConfig = this.removeSensitiveData(configToSave)

      // Write config file
      await fs.writeFile(this.configPath, JSON.stringify(safeConfig, null, 2), { mode: 0o600 })

      return true
    } catch (error) {
      console.error(chalk.red(`Failed to save VDK config: ${error.message}`))
      return false
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.')
    }
    return this.config
  }

  /**
   * Update configuration value
   */
  updateConfig(path, value) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.')
    }

    const keys = path.split('.')
    let current = this.config

    // Navigate to parent object
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }

    // Set value
    current[keys[keys.length - 1]] = value
  }

  /**
   * Get configuration value by path
   */
  getValue(path, defaultValue = undefined) {
    if (!this.config) {
      return defaultValue
    }

    const keys = path.split('.')
    let current = this.config

    for (const key of keys) {
      if (current === null || current === undefined || !Object.hasOwn(current, key)) {
        return defaultValue
      }
      current = current[key]
    }

    return current
  }

  /**
   * Get Hub client configuration
   */
  getHubConfig() {
    return this.getValue('hub', DEFAULT_CONFIG.hub)
  }

  /**
   * Get telemetry configuration
   */
  getTelemetryConfig() {
    return this.getValue('telemetry', DEFAULT_CONFIG.telemetry)
  }

  /**
   * Get sync configuration
   */
  getSyncConfig() {
    return this.getValue('sync', DEFAULT_CONFIG.sync)
  }

  /**
   * Get generation configuration
   */
  getGenerationConfig() {
    return this.getValue('generation', DEFAULT_CONFIG.generation)
  }

  /**
   * Update last sync time
   */
  async updateLastSyncTime(timestamp) {
    this.updateConfig('sync.lastSyncTime', timestamp)
    await this.saveConfig()
  }

  /**
   * Check if config file exists
   */
  async configFileExists() {
    try {
      await fs.access(this.configPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Load configuration file
   */
  async loadConfigFile() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8')
      return JSON.parse(configContent)
    } catch (error) {
      throw new Error(`Failed to parse config file: ${error.message}`)
    }
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDir() {
    try {
      await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 })
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error.message}`)
    }
  }

  /**
   * Merge two configuration objects
   */
  mergeConfigs(base, override) {
    const result = JSON.parse(JSON.stringify(base))

    for (const key in override) {
      if (override[key] !== null && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, override[key])
      } else {
        result[key] = override[key]
      }
    }

    return result
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentOverrides() {
    // Hub configuration
    if (process.env.VDK_HUB_URL) {
      this.config.hub.url = process.env.VDK_HUB_URL
    }
    if (process.env.VDK_HUB_API_KEY) {
      this.config.hub.apiKey = process.env.VDK_HUB_API_KEY
    }
    if (process.env.VDK_HUB_TIMEOUT) {
      this.config.hub.timeout = parseInt(process.env.VDK_HUB_TIMEOUT)
    }
    if (process.env.VDK_HUB_RETRY_ATTEMPTS) {
      this.config.hub.retryAttempts = parseInt(process.env.VDK_HUB_RETRY_ATTEMPTS)
    }

    // Telemetry configuration
    if (process.env.VDK_TELEMETRY_ENABLED !== undefined) {
      const enabled = process.env.VDK_TELEMETRY_ENABLED !== 'false'
      this.config.hub.telemetryEnabled = enabled
      this.config.telemetry.enabled = enabled
    }
    if (process.env.VDK_TELEMETRY_BATCH_SIZE) {
      this.config.telemetry.batchSize = parseInt(process.env.VDK_TELEMETRY_BATCH_SIZE)
    }
    if (process.env.VDK_TELEMETRY_FLUSH_INTERVAL) {
      this.config.telemetry.flushInterval = parseInt(process.env.VDK_TELEMETRY_FLUSH_INTERVAL)
    }

    // CLI configuration
    if (process.env.VDK_CLI_VERSION) {
      this.config.cli.version = process.env.VDK_CLI_VERSION
    }
    if (process.env.VDK_LOG_LEVEL) {
      this.config.cli.logLevel = process.env.VDK_LOG_LEVEL
    }
    if (process.env.VDK_DEBUG) {
      this.config.cli.debugMode = process.env.VDK_DEBUG === 'true'
    }
  }

  /**
   * Remove sensitive data before saving
   */
  removeSensitiveData(config) {
    const safe = JSON.parse(JSON.stringify(config))

    // Remove API key from saved config (use environment variable instead)
    if (safe.hub?.apiKey) {
      delete safe.hub.apiKey
    }

    return safe
  }

  /**
   * Validate configuration values
   */
  validateConfig() {
    const errors = []

    // Validate Hub URL
    if (!this.config.hub.url) {
      errors.push('Hub URL is required')
    } else {
      try {
        new URL(this.config.hub.url)
      } catch {
        errors.push('Hub URL must be a valid URL')
      }
    }

    // Validate timeout
    if (this.config.hub.timeout < 1000 || this.config.hub.timeout > 300000) {
      errors.push('Hub timeout must be between 1000ms and 300000ms')
    }

    // Validate retry attempts
    if (this.config.hub.retryAttempts < 0 || this.config.hub.retryAttempts > 10) {
      errors.push('Retry attempts must be between 0 and 10')
    }

    // Validate batch size
    if (this.config.telemetry.batchSize < 1 || this.config.telemetry.batchSize > 100) {
      errors.push('Telemetry batch size must be between 1 and 100')
    }

    // Validate flush interval
    if (this.config.telemetry.flushInterval < 5000 || this.config.telemetry.flushInterval > 300000) {
      errors.push('Telemetry flush interval must be between 5000ms and 300000ms')
    }

    // Validate output format
    const validFormats = ['bash', 'zip', 'config']
    if (!validFormats.includes(this.config.generation.defaultOutputFormat)) {
      errors.push(`Output format must be one of: ${validFormats.join(', ')}`)
    }

    if (errors.length > 0) {
      console.warn(chalk.yellow('Configuration validation warnings:'))
      errors.forEach((error) => console.warn(chalk.yellow(`  - ${error}`)))
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG))
    this.applyEnvironmentOverrides()
    await this.saveConfig()
    return this.config
  }

  /**
   * Export configuration for debugging
   */
  exportConfig(includeSensitive = false) {
    const config = JSON.parse(JSON.stringify(this.config))

    if (!includeSensitive) {
      return this.removeSensitiveData(config)
    }

    return config
  }

  /**
   * Get configuration summary for display
   */
  getConfigSummary() {
    const config = this.getConfig()

    return {
      hubUrl: config.hub.url,
      telemetryEnabled: config.telemetry.enabled,
      autoSync: config.sync.autoSync,
      outputFormat: config.generation.defaultOutputFormat,
      hasApiKey: !!config.hub.apiKey,
      debugMode: config.cli.debugMode,
      configFileExists: this.configFileExists(),
    }
  }
}

/**
 * Singleton config manager
 */
let globalConfigManager = null

export function getGlobalConfigManager() {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager()
  }
  return globalConfigManager
}

/**
 * Initialize global configuration
 */
export async function initializeConfig() {
  const manager = getGlobalConfigManager()
  await manager.loadConfig()
  return manager
}

/**
 * Get global configuration
 */
export function getConfig() {
  return getGlobalConfigManager().getConfig()
}

/**
 * Update global configuration
 */
export async function updateConfig(path, value) {
  const manager = getGlobalConfigManager()
  manager.updateConfig(path, value)
  await manager.saveConfig()
}

/**
 * Get configuration value
 */
export function getConfigValue(path, defaultValue = undefined) {
  return getGlobalConfigManager().getValue(path, defaultValue)
}
