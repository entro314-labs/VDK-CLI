/**
 * Centralized Validation Utilities
 *
 * Consolidates common validation patterns used across the codebase
 * to reduce duplication and ensure consistent validation behavior.
 */

import matter from 'gray-matter'
import { fileSystem, pathUtils } from './file-system.js'

/**
 * Common validation functions
 */
export const validators = {
  /**
   * Validate email format
   */
  email(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate URL format
   */
  url(url) {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  /**
   * Validate file path exists
   */
  async filePath(path) {
    return await fileSystem.exists(path)
  },

  /**
   * Validate directory path exists
   */
  async directoryPath(path) {
    return await fileSystem.isDirectory(path)
  },

  /**
   * Validate JSON string
   */
  json(jsonString) {
    try {
      JSON.parse(jsonString)
      return true
    } catch {
      return false
    }
  },

  /**
   * Validate YAML frontmatter
   */
  yamlFrontmatter(content) {
    try {
      const parsed = matter(content)
      return parsed.data !== null && typeof parsed.data === 'object'
    } catch {
      return false
    }
  },

  /**
   * Validate rule ID format
   */
  ruleId(id) {
    // Rule IDs should be kebab-case strings
    const ruleIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
    return typeof id === 'string' && ruleIdRegex.test(id)
  },

  /**
   * Validate blueprint category
   */
  blueprintCategory(category) {
    const validCategories = ['core', 'language', 'framework', 'tool', 'task', 'security', 'assistant', 'custom']
    return validCategories.includes(category)
  },

  /**
   * Validate semantic version
   */
  semver(version) {
    const semverRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
    return semverRegex.test(version)
  },

  /**
   * Validate platform name
   */
  platform(platform) {
    const validPlatforms = ['cursor', 'windsurf', 'claude-code', 'vscode', 'jetbrains', 'zed', 'generic']
    return validPlatforms.includes(platform)
  },
}

/**
 * Schema validation helpers
 */
export const schema = {
  /**
   * Validate blueprint schema structure
   */
  blueprint(data) {
    const errors = []

    // Required fields
    if (!data.id) errors.push('Missing required field: id')
    if (!data.title) errors.push('Missing required field: title')
    if (!data.content) errors.push('Missing required field: content')

    // Field validations
    if (data.id && !validators.ruleId(data.id)) {
      errors.push('Invalid rule ID format')
    }

    if (data.category && !validators.blueprintCategory(data.category)) {
      errors.push('Invalid blueprint category')
    }

    if (data.version && !validators.semver(data.version)) {
      errors.push('Invalid semantic version format')
    }

    if (data.platforms) {
      if (!Array.isArray(data.platforms)) {
        errors.push('Platforms must be an array')
      } else {
        for (const platform of data.platforms) {
          if (!validators.platform(platform)) {
            errors.push(`Invalid platform: ${platform}`)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Validate MDC file structure
   */
  mdcFile(content) {
    const errors = []

    try {
      const parsed = matter(content)

      // Check for YAML frontmatter
      if (!parsed.data || typeof parsed.data !== 'object') {
        errors.push('No YAML frontmatter found')
        return { valid: false, errors }
      }

      // Validate frontmatter fields
      const validation = this.blueprint(parsed.data)
      errors.push(...validation.errors)

      // Check for content after frontmatter
      if (!parsed.content || parsed.content.trim().length === 0) {
        errors.push('No content found after frontmatter')
      }
    } catch (error) {
      errors.push(`Failed to parse file: ${error.message}`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Validate project configuration
   */
  projectConfig(config) {
    const errors = []

    if (!config.name) errors.push('Project name is required')
    if (!config.version) errors.push('Project version is required')

    if (config.version && !validators.semver(config.version)) {
      errors.push('Invalid version format')
    }

    if (config.author?.email && !validators.email(config.author.email)) {
      errors.push('Invalid author email format')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },
}

/**
 * File validation helpers
 */
export const fileValidation = {
  /**
   * Validate multiple MDC files
   */
  async validateMDCFiles(filePaths) {
    const results = {
      valid: [],
      invalid: [],
      warnings: [],
      duplicateIds: new Map(),
    }

    const ruleIds = new Map()

    for (const filePath of filePaths) {
      try {
        const content = await fileSystem.readFile(filePath)
        const validation = schema.mdcFile(content)

        if (validation.valid) {
          results.valid.push(filePath)

          // Check for duplicate rule IDs
          const parsed = matter(content)
          const ruleId = parsed.data.id

          if (ruleIds.has(ruleId)) {
            results.duplicateIds.set(ruleId, {
              current: filePath,
              existing: ruleIds.get(ruleId),
            })
          } else {
            ruleIds.set(ruleId, filePath)
          }
        } else {
          results.invalid.push({
            file: filePath,
            errors: validation.errors,
          })
        }
      } catch (error) {
        results.invalid.push({
          file: filePath,
          errors: [`Failed to read file: ${error.message}`],
        })
      }
    }

    return results
  },

  /**
   * Validate directory structure
   */
  async validateDirectory(dirPath, expectedStructure = []) {
    const errors = []

    if (!(await fileSystem.exists(dirPath))) {
      errors.push(`Directory does not exist: ${dirPath}`)
      return { valid: false, errors }
    }

    if (!(await fileSystem.isDirectory(dirPath))) {
      errors.push(`Path is not a directory: ${dirPath}`)
      return { valid: false, errors }
    }

    for (const expectedPath of expectedStructure) {
      const fullPath = pathUtils.join(dirPath, expectedPath)
      if (!(await fileSystem.exists(fullPath))) {
        errors.push(`Missing expected file/directory: ${expectedPath}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },
}

/**
 * Validation result formatting
 */
export const formatters = {
  /**
   * Format validation errors for console output
   */
  formatErrors(errors, filePath = null) {
    if (errors.length === 0) return ''

    let output = ''
    if (filePath) {
      output += `Errors in ${filePath}:\n`
    }

    errors.forEach((error) => {
      output += `  • ${error}\n`
    })

    return output
  },

  /**
   * Format validation summary
   */
  formatSummary(results) {
    return {
      total: results.valid.length + results.invalid.length,
      valid: results.valid.length,
      invalid: results.invalid.length,
      warnings: results.warnings?.length || 0,
      duplicates: results.duplicateIds?.size || 0,
    }
  },
}

export default {
  validators,
  schema,
  fileValidation,
  formatters,
}
