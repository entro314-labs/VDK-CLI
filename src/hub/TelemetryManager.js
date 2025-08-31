/**
 * TelemetryManager - Batch and manage CLI telemetry data
 *
 * Handles automatic batching, queuing, and flushing of telemetry events
 * to the VDK Hub according to rate limits and best practices.
 *
 * Features:
 * - Automatic batching of events by type
 * - Configurable batch sizes and flush intervals
 * - Rate limiting awareness
 * - Graceful error handling
 * - Background flushing with proper cleanup
 */

import chalk from 'chalk'
import { VDKHubClient } from './VDKHubClient.js'

export class TelemetryManager {
  constructor(hubClient, config = {}) {
    this.hubClient = hubClient
    this.config = {
      batchSize: config.batchSize || 25,
      flushInterval: config.flushInterval || 60000, // 1 minute
      maxQueueSize: config.maxQueueSize || 1000,
      telemetryEnabled: config.telemetryEnabled !== false,
      ...config,
    }

    // Event queues
    this.usageQueue = []
    this.errorQueue = []
    this.integrationQueue = []

    // Flush timer
    this.flushTimer = null
    this.isShuttingDown = false

    if (this.config.telemetryEnabled) {
      this.startFlushTimer()
    }
  }

  // ============================================================================
  // EVENT COLLECTION
  // ============================================================================

  /**
   * Add usage telemetry event
   */
  addUsageEvent(event) {
    if (!this.config.telemetryEnabled || this.isShuttingDown) {
      return
    }

    // Validate event structure
    if (!this.validateUsageEvent(event)) {
      console.warn(chalk.yellow('Invalid usage event, skipping'))
      return
    }

    this.usageQueue.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    })

    this.checkQueueLimits()
    this.checkFlushCondition()
  }

  /**
   * Add error telemetry event
   */
  addErrorEvent(event) {
    if (!this.config.telemetryEnabled || this.isShuttingDown) {
      return
    }

    if (!this.validateErrorEvent(event)) {
      console.warn(chalk.yellow('Invalid error event, skipping'))
      return
    }

    this.errorQueue.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    })

    this.checkQueueLimits()
    this.checkFlushCondition()
  }

  /**
   * Add integration telemetry event
   */
  addIntegrationEvent(event) {
    if (!this.config.telemetryEnabled || this.isShuttingDown) {
      return
    }

    if (!this.validateIntegrationEvent(event)) {
      console.warn(chalk.yellow('Invalid integration event, skipping'))
      return
    }

    this.integrationQueue.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    })

    this.checkQueueLimits()
    this.checkFlushCondition()
  }

  // ============================================================================
  // BATCH FLUSHING
  // ============================================================================

  /**
   * Check if we should flush based on batch size
   */
  checkFlushCondition() {
    const totalEvents = this.usageQueue.length + this.errorQueue.length + this.integrationQueue.length

    if (totalEvents >= this.config.batchSize) {
      this.flush()
    }
  }

  /**
   * Check queue size limits to prevent memory issues
   */
  checkQueueLimits() {
    const totalEvents = this.usageQueue.length + this.errorQueue.length + this.integrationQueue.length

    if (totalEvents >= this.config.maxQueueSize) {
      console.warn(chalk.yellow('Telemetry queue full, forcing flush'))
      this.flush()
    }
  }

  /**
   * Start automatic flush timer
   */
  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.flush()
      }
    }, this.config.flushInterval)
  }

  /**
   * Flush all queued events to Hub
   */
  async flush() {
    if (!this.config.telemetryEnabled) {
      return
    }

    const promises = []

    // Flush usage events
    if (this.usageQueue.length > 0) {
      const events = this.usageQueue.splice(0, 50) // Max 50 per API spec
      promises.push(this.flushUsageEvents(events))
    }

    // Flush error events
    if (this.errorQueue.length > 0) {
      const events = this.errorQueue.splice(0, 20) // Max 20 per API spec
      promises.push(this.flushErrorEvents(events))
    }

    // Flush integration events
    if (this.integrationQueue.length > 0) {
      const events = this.integrationQueue.splice(0, 30) // Max 30 per API spec
      promises.push(this.flushIntegrationEvents(events))
    }

    if (promises.length > 0) {
      try {
        await Promise.allSettled(promises)
      } catch (error) {
        // Individual flush methods handle their own errors
        console.warn(chalk.yellow(`Telemetry flush error: ${error.message}`))
      }
    }
  }

  /**
   * Flush usage events
   */
  async flushUsageEvents(events) {
    try {
      const result = await this.hubClient.sendUsageTelemetry(events)
      if (result.success && this.config.verbose) {
        console.log(chalk.gray(`📊 Sent ${events.length} usage events`))
      }
      return result
    } catch (error) {
      console.warn(chalk.yellow(`Failed to send usage telemetry: ${error.message}`))
      return { success: false, error: error.message }
    }
  }

  /**
   * Flush error events
   */
  async flushErrorEvents(events) {
    try {
      const result = await this.hubClient.sendErrorTelemetry(events)
      if (result.success && this.config.verbose) {
        console.log(chalk.gray(`🐛 Sent ${events.length} error events`))
      }
      return result
    } catch (error) {
      console.warn(chalk.yellow(`Failed to send error telemetry: ${error.message}`))
      return { success: false, error: error.message }
    }
  }

  /**
   * Flush integration events
   */
  async flushIntegrationEvents(events) {
    try {
      const result = await this.hubClient.sendIntegrationTelemetry(events)
      if (result.success && this.config.verbose) {
        console.log(chalk.gray(`🔌 Sent ${events.length} integration events`))
      }
      return result
    } catch (error) {
      console.warn(chalk.yellow(`Failed to send integration telemetry: ${error.message}`))
      return { success: false, error: error.message }
    }
  }

  // ============================================================================
  // EVENT VALIDATION
  // ============================================================================

  /**
   * Validate usage event structure
   */
  validateUsageEvent(event) {
    const required = ['cli_version', 'command', 'platform', 'success', 'session_id']
    return required.every((field) => Object.hasOwn(event, field))
  }

  /**
   * Validate error event structure
   */
  validateErrorEvent(event) {
    const required = ['cli_version', 'command', 'error_type', 'error_message', 'platform', 'session_id']
    return required.every((field) => Object.hasOwn(event, field))
  }

  /**
   * Validate integration event structure
   */
  validateIntegrationEvent(event) {
    const required = ['cli_version', 'integration_type', 'action', 'success', 'session_id']
    return required.every((field) => Object.hasOwn(event, field))
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Track command execution
   */
  trackCommand(command, options = {}) {
    const sessionId = options.sessionId || this.generateSessionId()
    const startTime = options.startTime || Date.now()

    const event = {
      cli_version: options.cliVersion || '2.0.0',
      command: command,
      platform: process.platform,
      node_version: process.version,
      execution_time_ms: options.executionTime || Date.now() - startTime,
      success: options.success !== false,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      ...options.metadata,
    }

    this.addUsageEvent(event)
    return sessionId
  }

  /**
   * Track command error
   */
  trackError(command, error, options = {}) {
    const event = {
      cli_version: options.cliVersion || '2.0.0',
      command: command,
      error_type: error.constructor.name,
      error_message: error.message,
      stack_trace: error.stack,
      platform: process.platform,
      node_version: process.version,
      session_id: options.sessionId || this.generateSessionId(),
      timestamp: new Date().toISOString(),
      context: options.context || {},
    }

    this.addErrorEvent(event)
  }

  /**
   * Track integration detection
   */
  trackIntegration(integrationType, action = 'detected', options = {}) {
    const event = {
      cli_version: options.cliVersion || '2.0.0',
      integration_type: integrationType,
      action: action,
      success: options.success !== false,
      integration_version: options.integrationVersion,
      configuration_details: options.configurationDetails,
      session_id: options.sessionId || this.generateSessionId(),
      timestamp: new Date().toISOString(),
    }

    this.addIntegrationEvent(event)
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Get current queue statistics
   */
  getQueueStats() {
    return {
      usage: this.usageQueue.length,
      errors: this.errorQueue.length,
      integrations: this.integrationQueue.length,
      total: this.usageQueue.length + this.errorQueue.length + this.integrationQueue.length,
      enabled: this.config.telemetryEnabled,
    }
  }

  /**
   * Clear all queues
   */
  clearQueues() {
    this.usageQueue.length = 0
    this.errorQueue.length = 0
    this.integrationQueue.length = 0
  }

  /**
   * Enable/disable telemetry
   */
  setEnabled(enabled) {
    this.config.telemetryEnabled = enabled

    if (enabled) {
      this.startFlushTimer()
    } else {
      if (this.flushTimer) {
        clearInterval(this.flushTimer)
        this.flushTimer = null
      }
      this.clearQueues()
    }
  }

  /**
   * Shutdown telemetry manager and flush remaining events
   */
  async shutdown() {
    this.isShuttingDown = true

    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // Final flush of remaining events
    if (this.config.telemetryEnabled) {
      await this.flush()
    }

    this.clearQueues()
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Factory function to create telemetry manager with Hub client
 */
export function createTelemetryManager(hubClient, config = {}) {
  return new TelemetryManager(hubClient, config)
}

/**
 * Singleton telemetry manager for global use
 */
let globalTelemetryManager = null

export function getGlobalTelemetryManager() {
  return globalTelemetryManager
}

export function setGlobalTelemetryManager(manager) {
  globalTelemetryManager = manager
}

/**
 * Initialize global telemetry manager
 */
export function initializeTelemetry(hubClient, config = {}) {
  if (!globalTelemetryManager) {
    globalTelemetryManager = new TelemetryManager(hubClient, config)
  }
  return globalTelemetryManager
}
