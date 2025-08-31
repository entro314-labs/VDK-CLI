/**
 * Centralized Console Utilities
 *
 * Consolidates all chalk styling and ora spinner functionality
 * to reduce duplication and ensure consistent output formatting.
 */

import chalk from 'chalk'
import ora from 'ora'

/**
 * Styled console output utilities
 */
export const logger = {
  success: (message) => console.log(chalk.green(`✅ ${message}`)),
  error: (message) => console.log(chalk.red(`❌ ${message}`)),
  warning: (message) => console.log(chalk.yellow(`⚠️  ${message}`)),
  info: (message) => console.log(chalk.blue(`ℹ️  ${message}`)),

  // Standard chalk colors without icons
  green: (message) => console.log(chalk.green(message)),
  red: (message) => console.log(chalk.red(message)),
  yellow: (message) => console.log(chalk.yellow(message)),
  blue: (message) => console.log(chalk.blue(message)),
  cyan: (message) => console.log(chalk.cyan(message)),
  gray: (message) => console.log(chalk.gray(message)),

  // Formatted output
  title: (message) => console.log(chalk.bold.blue(message)),
  subtitle: (message) => console.log(chalk.cyan(message)),

  // Special formatting
  dim: (message) => console.log(chalk.dim(message)),
  bold: (message) => console.log(chalk.bold(message)),

  // Empty line
  blank: () => console.log(''),

  // Raw chalk access for complex styling
  chalk,
}

/**
 * Spinner utilities with consistent styling
 */
export const spinner = {
  create: (text, options = {}) => {
    return ora({
      text: chalk.blue(text),
      color: 'blue',
      ...options,
    })
  },

  // Common spinner patterns
  start: (text) => {
    const spinner = ora({
      text: chalk.blue(text),
      color: 'blue',
    }).start()
    return spinner
  },

  succeed: (spinner, text) => {
    spinner.succeed(chalk.green(text))
  },

  fail: (spinner, text) => {
    spinner.fail(chalk.red(text))
  },

  warn: (spinner, text) => {
    spinner.warn(chalk.yellow(text))
  },

  info: (spinner, text) => {
    spinner.info(chalk.blue(text))
  },
}

/**
 * Progress indicators
 */
export const progress = {
  step: (current, total, message) => {
    const prefix = chalk.gray(`[${current}/${total}]`)
    console.log(`${prefix} ${chalk.blue(message)}`)
  },

  checkmark: (message) => {
    console.log(chalk.green(`  ✓ ${message}`))
  },

  cross: (message) => {
    console.log(chalk.red(`  ✘ ${message}`))
  },

  bullet: (message) => {
    console.log(chalk.gray(`  • ${message}`))
  },
}

/**
 * Validation output helpers
 */
export const validation = {
  valid: (file) => {
    console.log(chalk.green(`  ✓ ${file}`))
  },

  invalid: (file, reason) => {
    console.log(chalk.red(`  ✘ ${file}:`), chalk.red(reason))
  },

  warning: (file, reason) => {
    console.log(chalk.yellow(`  ⚠ ${file}:`), chalk.yellow(reason))
  },

  summary: (valid, invalid, warnings = 0) => {
    logger.blank()
    logger.title('Validation Summary:')
    logger.green(`  Valid files: ${valid}`)
    logger.red(`  Invalid files: ${invalid}`)
    if (warnings > 0) {
      logger.yellow(`  Warnings: ${warnings}`)
    }
  },
}

/**
 * Table formatting helpers
 */
export const table = {
  header: (columns) => {
    const formatted = columns.map((col) => chalk.bold.blue(col)).join(' | ')
    console.log(formatted)
    console.log(chalk.gray('-'.repeat(formatted.length)))
  },

  row: (columns) => {
    console.log(columns.join(' | '))
  },
}

/**
 * Integration status helpers
 */
export const integration = {
  scanning: (name) => logger.info(`Scanning ${name} integration...`),
  found: (name, confidence) => logger.success(`${name} detected (${confidence}% confidence)`),
  notFound: (name) => logger.gray(`${name} not detected`),
  initialized: (name) => logger.success(`${name} initialized successfully`),
  failed: (name, error) => logger.error(`Failed to initialize ${name}: ${error}`),
}

/**
 * File operation helpers
 */
export const file = {
  created: (path) => logger.success(`Created ${path}`),
  updated: (path) => logger.info(`Updated ${path}`),
  deleted: (path) => logger.warning(`Deleted ${path}`),
  reading: (path) => logger.dim(`Reading ${path}...`),
  writing: (path) => logger.dim(`Writing ${path}...`),
}

// Re-export chalk and ora for backward compatibility during migration
export { chalk, ora }
