/**
 * Rule Validator Utility
 * ---------------------
 * Validates generated rule files for correctness, consistency, and usefulness.
 * Part of Phase 3 implementation for the Project-Specific Rule Generator.
 */

import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import ora from 'ora'

class RuleValidator {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose,
      strictMode: options.strictMode,
      thresholds: {
        requiredFields: options.thresholds?.requiredFields || 0.95, // 95% of required fields must be present
        contentQuality: options.thresholds?.contentQuality || 0.8, // 80% of content quality checks must pass
        conflicts: options.thresholds?.conflicts || 0.0, // No conflicts allowed by default
      },
    }

    // Required fields for each rule type
    this.requiredFields = {
      frontMatter: ['lastUpdated'],
      coreAgent: ['Role & Responsibility', 'Core Principles', 'Coding Standards'],
      projectContext: ['Role & Responsibility', 'Core Principles', 'Project Technology Stack'],
      commonErrors: ['Role & Responsibility', 'Core Principles', 'Common Error Categories'],
      mcpConfig: ['Role & Responsibility', 'Core Principles', 'Available MCP Servers'],
    }

    this.results = {
      totalRules: 0,
      validRules: 0,
      warnings: [],
      errors: [],
      validationDetails: {},
    }
  }

  /**
   * Validate all rule files in a directory
   * @param {string} rulesDir - Directory containing rule files
   * @returns {Object} Validation results
   */
  async validateRuleDirectory(rulesDir) {
    const spinner = ora('Validating rule files...').start()

    try {
      if (!fs.existsSync(rulesDir)) {
        spinner.fail(`Rules directory not found: ${rulesDir}`)
        return { success: false, message: 'Rules directory not found' }
      }

      const ruleFiles = fs.readdirSync(rulesDir).filter((file) => file.endsWith('.mdc'))

      this.results.totalRules = ruleFiles.length

      if (ruleFiles.length === 0) {
        spinner.warn('No rule files found to validate')
        return { success: false, message: 'No rule files found' }
      }

      for (const file of ruleFiles) {
        const filePath = path.join(rulesDir, file)
        await this.validateRuleFile(filePath, file)
      }

      // Check for rule conflicts between files
      await this.detectRuleConflicts(rulesDir, ruleFiles)

      // Calculate success rate
      const successRate = this.results.validRules / this.results.totalRules

      if (successRate >= 0.98) {
        spinner.succeed(
          `Rule validation complete: ${chalk.green(Math.round(successRate * 100))}% of rules are valid`
        )
        return {
          success: true,
          message: `${this.results.validRules} of ${this.results.totalRules} rules are valid`,
          results: this.results,
        }
      }
      if (successRate >= 0.8) {
        spinner.warn(
          `Rule validation complete with warnings: ${chalk.yellow(Math.round(successRate * 100))}% of rules are valid`
        )
        return {
          success: true,
          message: `${this.results.validRules} of ${this.results.totalRules} rules are valid with warnings`,
          results: this.results,
        }
      }
      spinner.fail(
        `Rule validation failed: ${chalk.red(Math.round(successRate * 100))}% of rules are valid`
      )
      return {
        success: false,
        message: `Only ${this.results.validRules} of ${this.results.totalRules} rules are valid`,
        results: this.results,
      }
    } catch (error) {
      spinner.fail(`Validation failed: ${error.message}`)
      return { success: false, message: error.message }
    }
  }

  /**
   * Validate a single rule file
   * @param {string} filePath - Path to the rule file
   * @param {string} fileName - Name of the rule file
   */
  async validateRuleFile(filePath, fileName) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const validationResult = {
        file: fileName,
        valid: true,
        warnings: [],
        errors: [],
      }

      // Check for required sections
      if (!this.validateFrontMatter(content)) {
        validationResult.valid = false
        validationResult.errors.push('Missing or invalid front matter')
      }

      // Perform file-specific validations based on filename pattern
      if (fileName.match(/^00-core/)) {
        this.validateCoreAgentRule(content, validationResult)
      } else if (fileName.match(/^01-project/)) {
        this.validateProjectContextRule(content, validationResult)
      } else if (fileName.match(/^02-common-errors/)) {
        this.validateCommonErrorsRule(content, validationResult)
      } else if (fileName.match(/^03-mcp/)) {
        this.validateMcpConfigRule(content, validationResult)
      }

      // Check for empty sections
      this.validateForEmptySections(content, validationResult)

      // Check for placeholder content that hasn't been replaced
      this.validateForPlaceholders(content, validationResult)

      // Update validation results
      if (validationResult.valid) {
        this.results.validRules++
      }

      if (validationResult.warnings.length > 0) {
        this.results.warnings.push({
          file: fileName,
          warnings: validationResult.warnings,
        })
      }

      if (validationResult.errors.length > 0) {
        this.results.errors.push({
          file: fileName,
          errors: validationResult.errors,
        })
      }

      this.results.validationDetails[fileName] = validationResult

      // Log detailed results in verbose mode
      if (this.options.verbose) {
        if (validationResult.valid) {
          console.log(`${chalk.green('✓')} ${fileName} - Valid`)
        } else {
          console.log(`${chalk.red('✗')} ${fileName} - Invalid:`)
          validationResult.errors.forEach((err) => console.log(`  ${chalk.red('-')} ${err}`))
        }
        validationResult.warnings.forEach((warn) => {
          console.log(`  ${chalk.yellow('!')} Warning: ${warn}`)
        })
      }

      return validationResult
    } catch (error) {
      const validationResult = {
        file: fileName,
        valid: false,
        warnings: [],
        errors: [`Failed to validate file: ${error.message}`],
      }

      this.results.errors.push({
        file: fileName,
        errors: validationResult.errors,
      })

      return validationResult
    }
  }

  /**
   * Validate front matter in a rule file
   * @param {string} content - Content of the rule file
   * @returns {boolean} True if front matter is valid
   */
  validateFrontMatter(content) {
    const frontMatterRegex = /^---[\s\S]+?---/
    const match = content.match(frontMatterRegex)

    if (!match) {
      return false
    }

    const frontMatter = match[0]
    let valid = true

    // Check for required fields
    for (const field of this.requiredFields.frontMatter) {
      const fieldRegex = new RegExp(`${field}:`, 'i')
      if (!fieldRegex.test(frontMatter)) {
        valid = false
        break
      }
    }

    return valid
  }

  /**
   * Validate core agent rule file
   * @param {string} content - Content of the rule file
   * @param {Object} result - Validation result object to update
   */
  validateCoreAgentRule(content, result) {
    for (const section of this.requiredFields.coreAgent) {
      const sectionRegex = new RegExp(`## (?:\\d+\\. )?${section}`, 'i')
      if (!sectionRegex.test(content)) {
        result.valid = false
        result.errors.push(`Missing required section: ${section}`)
      }
    }
  }

  /**
   * Validate project context rule file
   * @param {string} content - Content of the rule file
   * @param {Object} result - Validation result object to update
   */
  validateProjectContextRule(content, result) {
    for (const section of this.requiredFields.projectContext) {
      const sectionRegex = new RegExp(`## (?:\\d+\\. )?${section}`, 'i')
      if (!sectionRegex.test(content)) {
        result.valid = false
        result.errors.push(`Missing required section: ${section}`)
      }
    }
  }

  /**
   * Validate common errors rule file
   * @param {string} content - Content of the rule file
   * @param {Object} result - Validation result object to update
   */
  validateCommonErrorsRule(content, result) {
    for (const section of this.requiredFields.commonErrors) {
      const sectionRegex = new RegExp(`## (?:\\d+\\. )?${section}`, 'i')
      if (!sectionRegex.test(content)) {
        result.valid = false
        result.errors.push(`Missing required section: ${section}`)
      }
    }
  }

  /**
   * Validate MCP configuration rule file
   * @param {string} content - Content of the rule file
   * @param {Object} result - Validation result object to update
   */
  validateMcpConfigRule(content, result) {
    for (const section of this.requiredFields.mcpConfig) {
      const sectionRegex = new RegExp(`## (?:\\d+\\. )?${section}`, 'i')
      if (!sectionRegex.test(content)) {
        result.valid = false
        result.errors.push(`Missing required section: ${section}`)
      }
    }
  }

  /**
   * Check for empty sections in a rule file
   * @param {string} content - Content of the rule file
   * @param {Object} result - Validation result object to update
   */
  validateForEmptySections(content, result) {
    const sectionRegex = /##\s+([^\n]+)\s*\n+(?:##|$)/g
    let match

    while ((match = sectionRegex.exec(content)) !== null) {
      const sectionName = match[1].trim()
      result.warnings.push(`Empty section: ${sectionName}`)
    }
  }

  /**
   * Check for placeholder content in a rule file
   * @param {string} content - Content of the rule file
   * @param {Object} result - Validation result object to update
   */
  validateForPlaceholders(content, result) {
    const placeholderRegex = /\{\{[^}]+\}\}/g
    const placeholders = content.match(placeholderRegex)

    if (placeholders && placeholders.length > 0) {
      result.warnings.push(`Unreplaced placeholders found: ${placeholders.join(', ')}`)
    }
  }

  /**
   * Detect conflicts between rule files
   * @param {string} rulesDir - Directory containing rule files
   * @param {Array<string>} ruleFiles - List of rule files to check
   */
  async detectRuleConflicts(rulesDir, ruleFiles) {
    // Extract globs from all rule files to check for overlaps
    const ruleGlobs = {}

    for (const file of ruleFiles) {
      const filePath = path.join(rulesDir, file)
      const content = fs.readFileSync(filePath, 'utf8')

      // Extract globs from front matter
      const globsMatch = content.match(/globs:\s*\[([^\]]+)\]/i)

      if (globsMatch) {
        const globs = globsMatch[1].split(',').map((glob) => glob.trim().replace(/["']/g, ''))

        ruleGlobs[file] = globs
      }
    }

    // Check for conflicting rules
    const conflicts = []

    for (const [file1, globs1] of Object.entries(ruleGlobs)) {
      for (const [file2, globs2] of Object.entries(ruleGlobs)) {
        if (file1 !== file2) {
          // Check for identical globs
          const overlappingGlobs = globs1.filter((glob) => globs2.includes(glob))

          if (overlappingGlobs.length > 0) {
            conflicts.push({
              file1,
              file2,
              overlappingGlobs,
            })
          }
        }
      }
    }

    // Add conflicts to results
    if (conflicts.length > 0) {
      for (const conflict of conflicts) {
        const warningMessage = `Conflicting globs with ${conflict.file2}: ${conflict.overlappingGlobs.join(', ')}`

        // Add warning to file1's validation results
        if (this.results.validationDetails[conflict.file1]) {
          this.results.validationDetails[conflict.file1].warnings.push(warningMessage)
        }

        // Add to global warnings
        this.results.warnings.push({
          file: conflict.file1,
          warnings: [warningMessage],
        })
      }
    }
  }
}

export { RuleValidator }
