/**
 * Integration Manager
 * ------------------
 * Central manager for all VDK integrations with context platform priority system.
 *
 * Priority System:
 * 1. CONTEXT PLATFORMS (HIGH): Cursor, Windsurf, Claude Code CLI
 *    - Create their own context ecosystems (.cursor/rules/, .windsurf/rules/, .claude/)
 *    - Always take priority over traditional IDEs
 * 2. TRADITIONAL IDEs (MEDIUM): VS Code, JetBrains, etc.
 *    - Use extensions/plugins for AI integration
 *    - Only used as fallback when no context platforms detected
 */

import chalk from 'chalk'

import { BaseIntegration } from './base-integration.js'

/**
 * Central manager for all VDK integrations
 */
export class IntegrationManager {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath
    this.integrations = new Map()
    this.detectionResults = new Map()
    this.lastScan = null
  }

  /**
   * Register an integration
   * @param {BaseIntegration} integration - Integration instance
   */
  register(integration) {
    if (!(integration instanceof BaseIntegration)) {
      throw new Error('Integration must extend BaseIntegration')
    }

    this.integrations.set(integration.name, integration)
  }

  /**
   * Register multiple integrations
   * @param {Array<BaseIntegration>} integrations - Array of integration instances
   */
  registerMultiple(integrations) {
    integrations.forEach((integration) => this.register(integration))
  }

  /**
   * Discover and register all available integrations
   * @param {Object} options - Discovery options
   * @returns {Object} Discovery results
   */
  async discoverIntegrations(options = {}) {
    const { verbose = false } = options

    // Dynamically import and register all integrations
    const integrationModules = [
      './claude-code-integration.js',
      './cursor-integration.js',
      './windsurf-integration.js',
      './github-copilot-integration.js',
      './jetbrains-integration.js',
      './zed-integration.js',
      './vscode-variants-integration.js',
      './generic-ai-integration.js',
      './generic-ide-integration.js',
    ]

    const results = {
      loaded: [],
      failed: [],
      registered: 0,
    }

    for (const modulePath of integrationModules) {
      try {
        const module = await import(modulePath)
        let foundIntegration = false

        // Look for integration class exports
        for (const [exportName, exportValue] of Object.entries(module)) {
          if (
            exportName.includes('Integration') &&
            typeof exportValue === 'function' &&
            exportValue.prototype instanceof BaseIntegration
          ) {
            try {
              const integration = new exportValue(this.projectPath)
              this.register(integration)
              results.loaded.push({
                module: modulePath,
                class: exportName,
                name: integration.name,
              })
              results.registered++
              foundIntegration = true
            } catch (constructorError) {
              results.failed.push({
                module: modulePath,
                class: exportName,
                error: `Constructor failed: ${constructorError.message}`,
              })
            }
          }
        }

        if (!foundIntegration) {
          results.failed.push({
            module: modulePath,
            error: 'No valid Integration class found in module',
          })
        }
      } catch (error) {
        // Integration module doesn't exist or failed to load - that's OK
        // We only register integrations that are available
        results.failed.push({
          module: modulePath,
          error: error.message,
        })

        if (process.env.VDK_DEBUG || verbose) {
          console.warn(chalk.yellow(`Failed to load integration module ${modulePath}: ${error.message}`))
        }
      }
    }

    if (verbose) {
      console.log(chalk.blue(`Discovery complete: ${results.registered} integrations registered`))
      if (results.failed.length > 0 && process.env.VDK_DEBUG) {
        console.log(chalk.gray(`Failed modules: ${results.failed.length}`))
      }
    }

    return results
  }

  /**
   * Scan all registered integrations for usage
   * @param {Object} options - Scan options
   * @returns {Object} Scan results
   */
  async scanAll(options = {}) {
    const { verbose = false, force = false } = options

    if (verbose) {
      console.log(chalk.blue('🔍 Scanning for integration usage...'))
    }

    const results = {
      active: [],
      inactive: [],
      recommendations: [],
      errors: [],
      summary: {},
    }

    // Ensure we have integrations to scan
    if (this.integrations.size === 0) {
      if (verbose) {
        console.log(chalk.yellow('⚠️ No integrations registered. Run discoverIntegrations() first.'))
      }
      results.errors.push('No integrations registered')
      return results
    }

    for (const [name, integration] of this.integrations) {
      try {
        // Validate integration instance
        if (!integration || typeof integration.getCachedDetection !== 'function') {
          throw new Error(`Invalid integration instance for ${name}`)
        }

        const detection = integration.getCachedDetection(force)
        this.detectionResults.set(name, detection)

        const integrationResult = {
          name,
          isActive: integration.isActive(),
          confidence: integration.getConfidence(),
          indicators: integration.getIndicators(),
          recommendations: integration.getRecommendations(),
          detection,
        }

        if (integrationResult.isActive) {
          results.active.push(integrationResult)
        } else {
          results.inactive.push(integrationResult)
        }

        // Collect all recommendations
        results.recommendations.push(...integrationResult.recommendations)

        if (verbose && integrationResult.indicators.length > 0) {
          console.log(chalk.gray(`  • ${name}: ${integrationResult.confidence} confidence`))
          integrationResult.indicators.forEach((indicator) => {
            console.log(chalk.gray(`    - ${indicator}`))
          })
        }
      } catch (error) {
        const errorInfo = {
          integration: name,
          error: error.message,
          timestamp: new Date().toISOString(),
        }
        results.errors.push(errorInfo)

        if (verbose) {
          console.log(chalk.red(`❌ Failed to scan ${name}: ${error.message}`))
          if (process.env.VDK_DEBUG) {
            console.log(chalk.gray(`Debug: ${error.stack}`))
          }
        }

        // Add to inactive with error indicator
        results.inactive.push({
          name,
          isActive: false,
          confidence: 'error',
          indicators: [`Scan failed: ${error.message}`],
          recommendations: [`Fix ${name} integration configuration`],
          detection: { isUsed: false, confidence: 'error', indicators: [], recommendations: [] },
        })
      }
    }

    // Generate summary
    results.summary = {
      totalIntegrations: this.integrations.size,
      activeIntegrations: results.active.length,
      highConfidenceIntegrations: results.active.filter((r) => r.confidence === 'high').length,
      recommendationCount: results.recommendations.length,
      scanTime: new Date().toISOString(),
    }

    this.lastScan = results
    return results
  }

  /**
   * Get integration by name
   * @param {string} name - Integration name
   * @returns {BaseIntegration|null} Integration instance or null
   */
  getIntegration(name) {
    return this.integrations.get(name) || null
  }

  /**
   * Get all registered integration names
   * @returns {Array<string>} Array of integration names
   */
  getIntegrationNames() {
    return Array.from(this.integrations.keys())
  }

  /**
   * Get all registered integrations
   * @returns {Array<BaseIntegration>} Array of integration instances
   */
  getAllIntegrations() {
    return Array.from(this.integrations.values())
  }

  /**
   * Get active integrations with context platform priority
   * @returns {Array<Object>} Array of active integration results, prioritized
   */
  getActiveIntegrations() {
    if (!this.lastScan) {
      return []
    }

    const activeIntegrations = this.lastScan.active.filter(
      (integration) => integration.confidence === 'high' || integration.confidence === 'medium'
    )

    return this.prioritizeContextPlatforms(activeIntegrations)
  }

  /**
   * Get recommendations for all integrations
   * @returns {Array<string>} Array of recommendations
   */
  getAllRecommendations() {
    if (!this.lastScan) {
      return []
    }
    return this.lastScan.recommendations
  }

  /**
   * Initialize active integrations with VDK configuration
   * @param {Object} options - Initialization options
   * @returns {Object} Initialization results
   */
  async initializeActive(options = {}) {
    const { verbose = false } = options
    const results = {
      successful: [],
      failed: [],
      skipped: [],
    }

    const activeIntegrations = this.getActiveIntegrations()

    if (activeIntegrations.length === 0) {
      if (verbose) {
        console.log(chalk.yellow('No active integrations found to initialize'))
      }
      return results
    }

    for (const integrationResult of activeIntegrations) {
      const integration = this.getIntegration(integrationResult.name)

      if (!integration) {
        results.failed.push({
          name: integrationResult.name,
          error: 'Integration not found',
        })
        continue
      }

      try {
        if (verbose) {
          console.log(chalk.blue(`Initializing ${integration.name} integration...`))
        }

        const success = await integration.initialize({
          ...options,
          projectPath: this.projectPath,
        })

        if (success) {
          results.successful.push({
            name: integration.name,
            confidence: integration.getConfidence(),
          })

          if (verbose) {
            console.log(chalk.green(`✅ ${integration.name} initialized successfully`))
          }
        } else {
          results.failed.push({
            name: integration.name,
            error: 'Initialization returned false',
          })
        }
      } catch (error) {
        results.failed.push({
          name: integration.name,
          error: error.message,
        })

        if (verbose) {
          console.log(chalk.red(`❌ Failed to initialize ${integration.name}: ${error.message}`))
        }
      }
    }

    return results
  }

  /**
   * Get integration status summary for display
   * @returns {Object} Status summary
   */
  getStatusSummary() {
    if (!this.lastScan) {
      return {
        message: 'No integrations scanned yet',
        integrations: [],
      }
    }

    const { summary, active, inactive } = this.lastScan

    let message = ''
    if (summary.activeIntegrations === 0) {
      message = 'No active integrations detected'
    } else if (summary.highConfidenceIntegrations > 0) {
      message = `${summary.highConfidenceIntegrations} high-confidence integration(s) detected`
    } else {
      message = `${summary.activeIntegrations} integration(s) detected with varying confidence`
    }

    return {
      message,
      summary,
      active: active.map((i) => ({
        name: i.name,
        confidence: i.confidence,
        indicatorCount: i.indicators.length,
      })),
      inactive: inactive.map((i) => ({
        name: i.name,
        confidence: i.confidence,
      })),
    }
  }

  /**
   * Clear all cached detection results
   */
  clearCache() {
    for (const integration of this.integrations.values()) {
      integration._detectionCache = null
      integration._detectionCacheTime = null
    }
    this.detectionResults.clear()
    this.lastScan = null
  }

  /**
   * Get integration-specific recommendations
   * @param {string} integrationName - Name of integration
   * @returns {Array<string>} Array of recommendations for this integration
   */
  getIntegrationRecommendations(integrationName) {
    const integration = this.getIntegration(integrationName)
    if (!integration) {
      return []
    }
    return integration.getRecommendations()
  }

  /**
   * Check if a specific integration is active
   * @param {string} integrationName - Name of integration
   * @returns {boolean} True if integration is active
   */
  isIntegrationActive(integrationName) {
    const integration = this.getIntegration(integrationName)
    if (!integration) {
      return false
    }
    return integration.isActive()
  }

  /**
   * Get detailed integration information
   * @param {string} integrationName - Name of integration
   * @returns {Object|null} Detailed integration info or null
   */
  getIntegrationDetails(integrationName) {
    const integration = this.getIntegration(integrationName)
    if (!integration) {
      return null
    }

    const detection = integration.getCachedDetection()
    return {
      name: integration.name,
      isActive: integration.isActive(),
      confidence: integration.getConfidence(),
      indicators: integration.getIndicators(),
      recommendations: integration.getRecommendations(),
      configPaths: integration.getConfigPaths(),
      summary: integration.getSummary(),
      detection,
    }
  }

  /**
   * Get the primary detected IDE (highest confidence active integration)
   * @returns {Object|null} Primary IDE detection or null
   */
  getPrimaryIDE() {
    const activeIntegrations = this.getActiveIntegrations()
    if (activeIntegrations.length === 0) {
      return null
    }

    // Sort by confidence level, with project-specific config taking priority over environment detection
    const confidenceOrder = { high: 3, medium: 2, low: 1, none: 0 }
    const sorted = [...activeIntegrations].sort((a, b) => {
      // First sort by confidence level
      const confidenceDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
      if (confidenceDiff !== 0) {
        return confidenceDiff
      }

      // Context platforms get priority regardless of confidence when equal
      const aIsContextPlatform = this.isContextPlatform(a.name)
      const bIsContextPlatform = this.isContextPlatform(b.name)

      if (aIsContextPlatform && !bIsContextPlatform) return -1
      if (bIsContextPlatform && !aIsContextPlatform) return 1

      // If both are context platforms or both are traditional IDEs, keep original order
      return 0
    })

    return sorted[0]
  }

  /**
   * Prioritize context platforms over traditional IDEs
   * @param {Array} integrations - Array of integration results
   * @returns {Array} Prioritized integrations
   */
  prioritizeContextPlatforms(integrations) {
    const contextPlatforms = integrations.filter((integration) => this.isContextPlatform(integration.name))
    const traditionalIDEs = integrations.filter((integration) => !this.isContextPlatform(integration.name))

    // Context platforms always come first, then traditional IDEs
    return [...contextPlatforms, ...traditionalIDEs]
  }

  /**
   * Check if an integration is a context-creating platform
   * @param {string} name - Integration name
   * @returns {boolean} True if context platform
   */
  isContextPlatform(name) {
    const contextPlatforms = ['Cursor', 'Windsurf', 'Claude Code CLI']
    return contextPlatforms.includes(name)
  }
}
