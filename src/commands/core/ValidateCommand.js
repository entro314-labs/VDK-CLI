/**
 * ValidateCommand
 * -----------------------
 * Handles 'vdk validate' command - Validate blueprint schema compatibility
 * Demonstrates how easy it is to add commands to the new architecture.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { tables, colors } from '../../utils/cli-styles.js'

export class ValidateCommand extends BaseCommand {
  constructor() {
    super('validate', 'Validate blueprint schema compatibility with AI Context Schema v2.1.0')
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-p, --path <path>', 'Path to blueprint/rule files', './.vdk/rules')
      .option('-f, --file <file>', 'Validate specific blueprint file')
      .option('--check-dependencies', 'Validate blueprint relationships and dependencies')
      .option('--check-platforms', 'Validate platform-specific configurations')
      .option('-v, --verbose', 'Show detailed validation results', false)
  }

  /**
   * Execute the validate command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader('Schema Validation')

    const spinner = this.createSpinner('Validating blueprints...')
    spinner.start()

    try {
      const filesToValidate = await this.getFilesToValidate(options)

      if (filesToValidate.length === 0) {
        spinner.fail('No blueprint files found to validate')
        return { success: false, error: 'No files found' }
      }

      spinner.text = `Validating ${filesToValidate.length} blueprint files...`

      const results = await this.validateFiles(filesToValidate)

      spinner.stop()

      // Display results
      this.displayValidationResults(results, options)

      const successCount = results.filter((r) => r.valid).length
      const errorCount = results.filter((r) => !r.valid).length

      this.trackSuccess({
        filesValidated: filesToValidate.length,
        successCount,
        errorCount,
      })

      // Show additional feature notices
      if (options.checkDependencies) {
        this.logWarning('Dependency validation feature is planned for implementation')
      }
      if (options.checkPlatforms) {
        this.logWarning('Platform configuration validation feature is planned for implementation')
      }

      return {
        success: errorCount === 0,
        totalFiles: filesToValidate.length,
        validFiles: successCount,
        errorFiles: errorCount,
        results,
      }
    } catch (error) {
      spinner.fail('Validation failed')
      throw error
    }
  }

  /**
   * Get list of files to validate
   */
  async getFilesToValidate(options) {
    if (options.file) {
      return [path.resolve(options.file)]
    }

    const rulesDir = path.resolve(options.path)
    const files = await commandContext.listFiles(rulesDir, (file) => file.endsWith('.mdc') || file.endsWith('.md'))

    return files.map((file) => path.join(rulesDir, file))
  }

  /**
   * Validate all files
   */
  async validateFiles(filesToValidate) {
    const results = []

    for (const filePath of filesToValidate) {
      try {
        const content = await fs.readFile(filePath, 'utf8')

        // Simple validation for demonstration
        // In real implementation, this would use proper schema validation
        const validation = this.validateBlueprint(content)

        results.push({
          file: commandContext.getRelativePath(filePath),
          valid: validation.valid,
          errors: validation.errors,
          type: validation.type,
        })
      } catch (error) {
        results.push({
          file: commandContext.getRelativePath(filePath),
          valid: false,
          errors: [`Parse error: ${error.message}`],
          type: 'unknown',
        })
      }
    }

    return results
  }

  /**
   * Simple blueprint validation (placeholder for real schema validation)
   */
  validateBlueprint(content) {
    const errors = []
    let type = 'blueprint'

    // Check for frontmatter
    if (!content.includes('---')) {
      errors.push('Missing frontmatter')
    }

    // Check for basic required fields
    if (!(content.includes('title:') || content.includes('name:'))) {
      errors.push('Missing title or name field')
    }

    // Check for description
    if (!content.includes('description:')) {
      errors.push('Missing description field')
    }

    // Detect command type
    if (content.includes('commandType:') || content.includes('target:')) {
      type = 'command'
    }

    return {
      valid: errors.length === 0,
      errors,
      type,
    }
  }

  /**
   * Display validation results in a table
   */
  displayValidationResults(results, options) {
    const resultTable = tables.validation()

    results.forEach((result) => {
      const statusIcon = result.valid ? this.colorPrimary('✓') : colors.red('✗')
      const errorsText =
        result.errors.length > 0
          ? options.verbose
            ? result.errors.join('\n')
            : `${result.errors.length} error(s)`
          : 'Valid'

      resultTable.push([result.file, result.type, statusIcon, errorsText])
    })

    console.log(resultTable.toString())

    const validCount = results.filter((r) => r.valid).length
    const errorCount = results.filter((r) => !r.valid).length

    console.log(`\n${validCount} valid, ${errorCount} errors`)

    if (errorCount > 0 && !options.verbose) {
      this.logInfo('Use --verbose flag to see detailed error messages')
    }

    // Exit with error code if validation failed
    if (errorCount > 0) {
      process.exitCode = 1
    }
  }
}
