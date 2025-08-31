/**
 * HubIntegration - Main VDK Hub Integration Manager
 *
 * Coordinates all Hub functionality including:
 * - Blueprint synchronization and management
 * - Package generation and deployment
 * - Telemetry collection and reporting
 * - Version compatibility checking
 * - Authentication and configuration
 *
 * This is the main entry point for all Hub-related operations
 * and provides a high-level API for CLI commands to use.
 */

import chalk from 'chalk'
import ora from 'ora'
import { VDKHubClient, VDKHubError } from './VDKHubClient.js'
import { TelemetryManager, initializeTelemetry } from './TelemetryManager.js'
import { ConfigManager, initializeConfig } from './ConfigManager.js'

export class HubIntegration {
  constructor(config = {}) {
    this.initialized = false
    this.configManager = null
    this.hubClient = null
    this.telemetryManager = null
    this.sessionId = this.generateSessionId()
    this.startTime = Date.now()
  }

  /**
   * Initialize Hub integration with configuration
   */
  async initialize() {
    if (this.initialized) {
      return this
    }

    try {
      // Load configuration
      this.configManager = await initializeConfig()
      const config = this.configManager.getConfig()

      // Create Hub client
      this.hubClient = new VDKHubClient(config.hub)

      // Initialize telemetry
      this.telemetryManager = initializeTelemetry(this.hubClient, config.telemetry)

      // Test connectivity (optional)
      if (config.hub.url && config.hub.url !== 'https://vdk.tools') {
        await this.testConnectivity(false) // Don't throw on failure
      }

      this.initialized = true
      return this
    } catch (error) {
      console.warn(chalk.yellow(`Hub initialization failed: ${error.message}`))
      // Continue with limited functionality
      this.initialized = true
      return this
    }
  }

  /**
   * Test Hub connectivity
   */
  async testConnectivity(throwOnFailure = true) {
    if (!this.hubClient) {
      if (throwOnFailure) {
        throw new Error('Hub client not initialized')
      }
      return { success: false, error: 'Hub client not initialized' }
    }

    try {
      const result = await this.hubClient.ping()

      if (result.success) {
        console.log(chalk.green(`✅ Connected to VDK Hub (${result.latency}ms)`))
        return result
      } else {
        const message = `Hub connectivity failed: ${result.error}`
        if (throwOnFailure) {
          throw new Error(message)
        }
        console.warn(chalk.yellow(`⚠️ ${message}`))
        return result
      }
    } catch (error) {
      const message = `Hub connectivity error: ${error.message}`
      if (throwOnFailure) {
        throw new Error(message)
      }
      console.warn(chalk.yellow(`⚠️ ${message}`))
      return { success: false, error: error.message }
    }
  }

  // ============================================================================
  // BLUEPRINT OPERATIONS
  // ============================================================================

  /**
   * Sync blueprints from Hub
   */
  async syncBlueprints(options = {}) {
    await this.ensureInitialized()

    const spinner = ora('Syncing blueprints from Hub...').start()
    const startTime = Date.now()

    try {
      // Get last sync time if incremental
      const syncConfig = this.configManager.getSyncConfig()
      const since = options.force ? null : syncConfig.lastSyncTime

      // Perform sync
      const result = await this.hubClient.syncBlueprints(since, {
        limit: options.limit || syncConfig.maxBlueprints,
        category: options.category,
      })

      // Update last sync time
      if (result.lastSyncTime) {
        await this.configManager.updateLastSyncTime(result.lastSyncTime)
      }

      // Track telemetry
      this.telemetryManager.addUsageEvent({
        cli_version: this.getCliVersion(),
        command: 'sync',
        platform: process.platform,
        node_version: process.version,
        execution_time_ms: Date.now() - startTime,
        success: true,
        blueprints_generated: result.blueprints.length,
        session_id: this.sessionId,
        metadata: {
          sync_type: result.metadata.syncType || 'unknown',
          total_blueprints: result.totalBlueprints,
          since: since ? 'incremental' : 'full',
        },
      })

      spinner.succeed(`Synced ${result.blueprints.length} blueprints`)

      if (result.changes.added.length > 0) {
        console.log(chalk.green(`  + ${result.changes.added.length} new blueprints`))
      }
      if (result.changes.updated.length > 0) {
        console.log(chalk.blue(`  ↻ ${result.changes.updated.length} updated blueprints`))
      }
      if (result.changes.removed.length > 0) {
        console.log(chalk.red(`  - ${result.changes.removed.length} removed blueprints`))
      }

      return result
    } catch (error) {
      spinner.fail('Blueprint sync failed')

      // Track error
      this.telemetryManager.addErrorEvent({
        cli_version: this.getCliVersion(),
        command: 'sync',
        error_type: error.constructor.name,
        error_message: error.message,
        platform: process.platform,
        session_id: this.sessionId,
      })

      if (error instanceof VDKHubError && !error.retryable) {
        throw error
      }

      // Return empty result for graceful degradation
      console.warn(chalk.yellow('Falling back to local blueprints'))
      return {
        blueprints: [],
        lastSyncTime: new Date().toISOString(),
        totalBlueprints: 0,
        changes: { added: [], updated: [], removed: [] },
        metadata: { syncType: 'failed', error: error.message },
      }
    }
  }

  /**
   * Generate package from Hub
   */
  async generatePackage(analysisData, options = {}) {
    await this.ensureInitialized()

    const spinner = ora('Generating blueprint package...').start()
    const startTime = Date.now()

    try {
      // Build package request
      const packageRequest = this.buildPackageRequest(analysisData, options)

      // Generate package
      const result = await this.hubClient.generatePackage(packageRequest)

      // Track telemetry
      this.telemetryManager.addUsageEvent({
        cli_version: this.getCliVersion(),
        command: 'generate',
        platform: process.platform,
        execution_time_ms: Date.now() - startTime,
        success: true,
        blueprints_generated: result.ruleCount,
        session_id: this.sessionId,
        metadata: {
          package_type: result.packageType,
          file_size: result.fileSize,
          output_format: packageRequest.outputFormat,
        },
      })

      spinner.succeed(`Generated package with ${result.ruleCount} blueprints`)
      return result
    } catch (error) {
      spinner.fail('Package generation failed')

      this.telemetryManager.addErrorEvent({
        cli_version: this.getCliVersion(),
        command: 'generate',
        error_type: error.constructor.name,
        error_message: error.message,
        platform: process.platform,
        session_id: this.sessionId,
      })

      throw error
    }
  }

  /**
   * Download package from Hub
   */
  async downloadPackage(packageId, outputPath = null) {
    await this.ensureInitialized()

    const spinner = ora('Downloading package...').start()
    const startTime = Date.now()

    try {
      const result = await this.hubClient.downloadPackage(packageId)

      // Track telemetry
      this.telemetryManager.addUsageEvent({
        cli_version: this.getCliVersion(),
        command: 'download',
        platform: process.platform,
        execution_time_ms: Date.now() - startTime,
        success: true,
        session_id: this.sessionId,
        metadata: {
          package_id: packageId,
          package_type: result.packageType,
          rule_count: result.ruleCount,
        },
      })

      spinner.succeed('Package downloaded successfully')
      return result
    } catch (error) {
      spinner.fail('Package download failed')

      this.telemetryManager.addErrorEvent({
        cli_version: this.getCliVersion(),
        command: 'download',
        error_type: error.constructor.name,
        error_message: error.message,
        platform: process.platform,
        session_id: this.sessionId,
        context: { package_id: packageId },
      })

      throw error
    }
  }

  /**
   * Deploy blueprints to Hub
   */
  async deployBlueprints(projectData, blueprints, options = {}) {
    await this.ensureInitialized()

    const spinner = ora('Deploying blueprints to Hub...').start()
    const startTime = Date.now()

    try {
      const deploymentData = {
        projectName: projectData.name,
        projectSignature: projectData.signature,
        team: options.team,
        blueprints: blueprints,
        metadata: {
          ecosystemVersion: '2.0.0',
          timestamp: new Date().toISOString(),
          cliVersion: this.getCliVersion(),
        },
      }

      const result = await this.hubClient.deployBlueprints(deploymentData)

      this.telemetryManager.addUsageEvent({
        cli_version: this.getCliVersion(),
        command: 'deploy',
        platform: process.platform,
        execution_time_ms: Date.now() - startTime,
        success: true,
        blueprints_generated: result.blueprintsCount,
        session_id: this.sessionId,
        metadata: {
          deployment_id: result.deploymentId,
          project_name: projectData.name,
        },
      })

      spinner.succeed(`Deployed ${result.blueprintsCount} blueprints`)
      console.log(chalk.cyan(`Hub URL: ${result.hubUrl}`))

      return result
    } catch (error) {
      spinner.fail('Blueprint deployment failed')

      this.telemetryManager.addErrorEvent({
        cli_version: this.getCliVersion(),
        command: 'deploy',
        error_type: error.constructor.name,
        error_message: error.message,
        platform: process.platform,
        session_id: this.sessionId,
      })

      throw error
    }
  }

  // ============================================================================
  // ANALYTICS & RECOMMENDATIONS
  // ============================================================================

  /**
   * Get blueprint recommendations
   */
  async getBlueprintRecommendations(projectAnalysis) {
    await this.ensureInitialized()

    try {
      const result = await this.hubClient.getBlueprintRecommendations(projectAnalysis)
      return result.recommendations || []
    } catch (error) {
      console.warn(chalk.yellow(`Recommendations failed: ${error.message}`))
      return []
    }
  }

  /**
   * Check version compatibility
   */
  async checkVersionCompatibility() {
    await this.ensureInitialized()

    try {
      const versionInfo = {
        cliVersion: this.getCliVersion(),
        nodeVersion: process.version,
        platform: process.platform,
        features: [
          'claude-code-cli-integration',
          'cursor-context-integration',
          'windsurf-context-integration',
          'telemetry',
        ],
      }

      const result = await this.hubClient.checkVersionCompatibility(versionInfo)
      return result
    } catch (error) {
      console.warn(chalk.yellow(`Version check failed: ${error.message}`))
      return {
        success: false,
        compatibility: { compatible: true, upgradeRecommended: false },
        error: error.message,
      }
    }
  }

  // ============================================================================
  // INTEGRATION TRACKING
  // ============================================================================

  /**
   * Track integration detection
   */
  trackIntegrationDetection(integrations) {
    if (!this.telemetryManager) {
      return
    }

    for (const integration of integrations) {
      this.telemetryManager.trackIntegration(integration.type, 'detected', {
        sessionId: this.sessionId,
        success: true,
        integrationVersion: integration.version,
        configurationDetails: {
          has_settings: integration.hasSettings,
          has_memory_file: integration.hasMemoryFile,
          project_configured: integration.configured,
        },
      })
    }
  }

  /**
   * Track command execution
   */
  trackCommand(command, options = {}) {
    if (!this.telemetryManager) {
      return
    }

    return this.telemetryManager.trackCommand(command, {
      sessionId: this.sessionId,
      cliVersion: this.getCliVersion(),
      ...options,
    })
  }

  /**
   * Track error
   */
  trackError(command, error, context = {}) {
    if (!this.telemetryManager) {
      return
    }

    this.telemetryManager.trackError(command, error, {
      sessionId: this.sessionId,
      cliVersion: this.getCliVersion(),
      context,
    })
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Build package request from analysis data
   */
  buildPackageRequest(analysisData, options = {}) {
    const generationConfig = this.configManager.getGenerationConfig()

    return {
      userId: options.userId,
      sessionId: this.sessionId,
      stackChoices: this.extractStackChoices(analysisData),
      languageChoices: this.extractLanguageChoices(analysisData),
      toolPreferences: this.extractToolPreferences(analysisData),
      aiAssistantChoices: this.extractAIAssistantChoices(options.integrations || []),
      environmentDetails: {
        nodeVersion: process.version,
        packageManager: analysisData.packageManager || 'npm',
        targetIde: options.targetIde || 'general',
        targetAI: options.targetAI || 'general',
        projectType: analysisData.projectType || 'unknown',
      },
      outputFormat: options.outputFormat || generationConfig.defaultOutputFormat,
      customRequirements: options.customRequirements || generationConfig.customRequirements,
    }
  }

  /**
   * Extract stack choices from analysis data
   */
  extractStackChoices(analysisData) {
    const stacks = {}

    if (analysisData.frameworks) {
      for (const framework of analysisData.frameworks) {
        stacks[framework.toLowerCase()] = true
      }
    }

    return stacks
  }

  /**
   * Extract language choices from analysis data
   */
  extractLanguageChoices(analysisData) {
    const languages = {}

    if (analysisData.languages) {
      for (const language of analysisData.languages) {
        languages[language.toLowerCase()] = true
      }
    }

    return languages
  }

  /**
   * Extract tool preferences from analysis data
   */
  extractToolPreferences(analysisData) {
    const tools = {}

    if (analysisData.tools) {
      for (const tool of analysisData.tools) {
        tools[tool.toLowerCase()] = true
      }
    }

    return tools
  }

  /**
   * Extract AI assistant choices from integrations
   */
  extractAIAssistantChoices(integrations) {
    const choices = {}

    for (const integration of integrations) {
      choices[integration.type] = true
    }

    return choices
  }

  /**
   * Ensure Hub integration is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Get CLI version
   */
  getCliVersion() {
    return this.configManager?.getValue('cli.version', '2.0.0') || '2.0.0'
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current session information
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      cliVersion: this.getCliVersion(),
    }
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hubConnected: !!this.hubClient,
      telemetryEnabled: this.telemetryManager?.isTelemetryEnabled(),
      configLoaded: !!this.configManager,
      sessionId: this.sessionId,
    }
  }

  /**
   * Shutdown integration and flush telemetry
   */
  async shutdown() {
    if (this.telemetryManager) {
      await this.telemetryManager.shutdown()
    }
  }
}

/**
 * Singleton Hub integration instance
 */
let globalHubIntegration = null

export function getGlobalHubIntegration() {
  if (!globalHubIntegration) {
    globalHubIntegration = new HubIntegration()
  }
  return globalHubIntegration
}

/**
 * Initialize global Hub integration
 */
export async function initializeHubIntegration(config = {}) {
  const integration = getGlobalHubIntegration()
  await integration.initialize()
  return integration
}

/**
 * Factory function for creating Hub integration
 */
export function createHubIntegration(config = {}) {
  return new HubIntegration(config)
}
