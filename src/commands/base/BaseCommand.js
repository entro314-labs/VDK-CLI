/**
 * BaseCommand
 * -----------------------
 * Base class for all VDK CLI commands providing shared functionality,
 * consistent error handling, and common utilities.
 */

import { boxes, colors, format, headers, spinners, status } from '../../utils/cli-styles.js'
import { quickHubOperations, isHubAvailable } from '../../hub/index.js'

export class BaseCommand {
  constructor(name, description) {
    this.name = name
    this.description = description
    this.verbose = false
    this.hubOps = null
    this.sessionId = null
  }

  /**
   * Initialize common command setup
   */
  async initialize(options = {}) {
    this.verbose = options.verbose

    // Initialize Hub integration if available
    try {
      const hubAvailable = await isHubAvailable()
      if (hubAvailable) {
        this.hubOps = await quickHubOperations()
        this.sessionId = this.hubOps.trackCommand(this.name, {
          startTime: Date.now(),
          options,
        })
      }
    } catch (error) {
      if (this.verbose) {
        this.logWarning('Hub integration unavailable, using local features')
      }
    }
  }

  /**
   * Track successful command completion with Hub
   */
  trackSuccess(metadata = {}) {
    if (this.hubOps && this.sessionId) {
      this.hubOps.trackCommand(this.name, {
        sessionId: this.sessionId,
        success: true,
        executionTime: Date.now() - (this.startTime || Date.now()),
        ...metadata,
      })
    }
  }

  /**
   * Track command error with Hub
   */
  trackError(error, metadata = {}) {
    if (this.hubOps && this.sessionId) {
      this.hubOps.trackError(this.name, error, {
        sessionId: this.sessionId,
        ...metadata,
      })
    }
  }

  /**
   * Display section header
   */
  showHeader(title = null) {
    console.log(headers.section(title || this.description))
  }

  /**
   * Create and start a spinner
   */
  createSpinner(text) {
    return spinners.scanning(text)
  }

  /**
   * Consistent success logging
   */
  logSuccess(message) {
    console.log(status.success(message))
  }

  /**
   * Consistent info logging
   */
  logInfo(message) {
    console.log(status.info(message))
  }

  /**
   * Consistent warning logging
   */
  logWarning(message) {
    console.log(status.warning(message))
  }

  /**
   * Consistent error logging
   */
  logError(message) {
    console.log(status.error(message))
  }

  /**
   * Display error box and exit
   */
  exitWithError(message, error = null) {
    console.error(boxes.error(message))

    if (error) {
      this.trackError(error)
      if (this.verbose && error.stack) {
        console.error(error.stack)
      }
    }

    process.exit(1)
  }

  /**
   * Validate required options
   */
  validateOptions(options, requiredFields) {
    const missing = requiredFields.filter((field) => !options[field])
    if (missing.length > 0) {
      this.exitWithError(`Missing required options: ${missing.join(', ')}\nUse --help for usage information`)
    }
  }

  /**
   * Format file paths consistently
   */
  formatPath(path) {
    return format.path(path)
  }

  /**
   * Format key-value pairs consistently
   */
  formatKeyValue(key, value) {
    return format.keyValue(key, value)
  }

  /**
   * Format counts consistently
   */
  formatCount(count) {
    return format.count(count)
  }

  /**
   * Color primary text
   */
  colorPrimary(text) {
    return colors.primary(text)
  }

  /**
   * Color cyan text
   */
  colorCyan(text) {
    return colors.primary(text) // Using primary (cyan) color
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  async execute(options) {
    throw new Error(`Command ${this.name} must implement execute() method`)
  }

  /**
   * Command runner with error handling
   */
  async run(options) {
    this.startTime = Date.now()

    try {
      await this.initialize(options)
      const result = await this.execute(options)
      this.trackSuccess()
      return result
    } catch (error) {
      this.trackError(error)

      // Don't double-log errors that are already handled by individual commands
      if (!error.logged) {
        this.exitWithError(`${this.description} failed: ${error.message}`, error)
      } else {
        process.exit(1)
      }
    }
  }
}
