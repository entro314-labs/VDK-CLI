/**
 * BaseCommand
 * -----------------------
 * Base class for all VDK CLI commands providing shared functionality,
 * consistent error handling, and common utilities.
 */

import { isHubAvailable, quickHubOperations } from '../../hub/index.js'
import { boxes, colors, format, headers, spinners, status } from '../../utils/cli-styles.js'
import { validators } from '../../utils/validation.js'
import { commandContext } from '../shared/CommandContext.js'

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
   * Unified validation framework for command options
   * @param {Object} options - Command options to validate
   * @param {Object} validationRules - Validation rules object
   * @returns {Object} Validation result with errors
   */
  async validateOptions(options, validationRules = {}) {
    const errors = []
    const warnings = []

    // Apply defaults if specified
    if (validationRules.defaults) {
      for (const [key, defaultValue] of Object.entries(validationRules.defaults)) {
        if (options[key] === undefined || options[key] === null) {
          options[key] = defaultValue
        }
      }
    }

    // Check required fields
    if (validationRules.required) {
      for (const field of validationRules.required) {
        if (!options[field] && options[field] !== 0 && options[field] !== false) {
          errors.push(`Missing required option: --${field}`)
        }
      }
    }

    // Validate field types and formats
    if (validationRules.fields) {
      for (const [field, rules] of Object.entries(validationRules.fields)) {
        const value = options[field]

        // Skip validation if field is not provided and not required
        if (value === undefined || value === null) continue

        // Type validation
        if (rules.type) {
          if (!this.validateFieldType(value, rules.type)) {
            errors.push(`Invalid type for --${field}: expected ${rules.type}`)
            continue
          }
        }

        // Format validation using validators
        if (rules.format) {
          const isValid = await this.validateFieldFormat(value, rules.format)
          if (!isValid) {
            errors.push(`Invalid format for --${field}: expected ${rules.format}`)
            continue
          }
        }

        // Enum validation
        if (rules.enum) {
          if (!rules.enum.includes(value)) {
            errors.push(`Invalid value for --${field}: must be one of [${rules.enum.join(', ')}]`)
            continue
          }
        }

        // Path validation
        if (rules.pathType) {
          const pathValid = await this.validatePath(value, rules.pathType)
          if (!pathValid.valid) {
            errors.push(`Invalid path for --${field}: ${pathValid.error}`)
            continue
          }
        }

        // Custom validation function
        if (rules.validate && typeof rules.validate === 'function') {
          try {
            const customResult = await rules.validate(value, options)
            if (customResult !== true) {
              errors.push(`Validation failed for --${field}: ${customResult || 'Invalid value'}`)
            }
          } catch (error) {
            errors.push(`Validation error for --${field}: ${error.message}`)
          }
        }

        // Warning checks
        if (rules.warn && typeof rules.warn === 'function') {
          try {
            const warnResult = await rules.warn(value, options)
            if (warnResult !== true && warnResult) {
              warnings.push(`Warning for --${field}: ${warnResult}`)
            }
          } catch (error) {
            warnings.push(`Warning check failed for --${field}: ${error.message}`)
          }
        }
      }
    }

    // Cross-field validation
    if (validationRules.crossValidation && typeof validationRules.crossValidation === 'function') {
      try {
        const crossResult = await validationRules.crossValidation(options)
        if (crossResult !== true && crossResult) {
          if (Array.isArray(crossResult)) {
            errors.push(...crossResult)
          } else {
            errors.push(crossResult)
          }
        }
      } catch (error) {
        errors.push(`Cross-validation error: ${error.message}`)
      }
    }

    // Show warnings if any
    if (warnings.length > 0 && this.verbose) {
      warnings.forEach((warning) => this.logWarning(warning))
    }

    // Exit with errors if validation failed
    if (errors.length > 0) {
      const errorMessage = `Validation failed:\n${errors.map((err) => `  • ${err}`).join('\n')}\n\nUse --help for usage information`
      this.exitWithError(errorMessage)
    }

    return { valid: true, warnings }
  }

  /**
   * Validate field type
   * @private
   */
  validateFieldType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true
    }
  }

  /**
   * Validate field format using validators
   * @private
   */
  async validateFieldFormat(value, format) {
    switch (format) {
      case 'email':
        return validators.email(value)
      case 'url':
        return validators.url(value)
      case 'json':
        return validators.json(value)
      case 'semver':
        return validators.semver(value)
      case 'ruleId':
        return validators.ruleId(value)
      case 'platform':
        return validators.platform(value)
      default:
        return true
    }
  }

  /**
   * Validate path existence and type
   * @private
   */
  async validatePath(path, pathType) {
    try {
      switch (pathType) {
        case 'file': {
          const fileExists = await commandContext.pathExists(path)
          if (!fileExists) {
            return { valid: false, error: `File does not exist: ${path}` }
          }
          return { valid: true }
        }

        case 'directory': {
          const dirExists = await commandContext.pathExists(path)
          if (!dirExists) {
            return { valid: false, error: `Directory does not exist: ${path}` }
          }
          return { valid: true }
        }

        case 'writeable': {
          // Check if parent directory exists for writeable paths
          const parentDir = commandContext.resolvePath(path).split('/').slice(0, -1).join('/')
          const parentExists = await commandContext.pathExists(parentDir)
          if (!parentExists) {
            return { valid: false, error: `Parent directory does not exist: ${parentDir}` }
          }
          return { valid: true }
        }

        default:
          return { valid: true }
      }
    } catch (error) {
      return { valid: false, error: error.message }
    }
  }

  /**
   * Legacy validation method for backwards compatibility
   */
  validateRequiredOptions(options, requiredFields) {
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
