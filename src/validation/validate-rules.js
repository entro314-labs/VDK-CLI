#!/usr/bin/env node

/**
 * Simple Rule Validator Tool
 *
 * This script performs basic validation on MDC files:
 * - Checks for duplicate rule IDs (filenames)
 * - Validates that YAML frontmatter is parseable
 */

import { fileURLToPath } from 'node:url'

import { logger, validation } from '../utils/console.js'
import { fileSystem, pathUtils } from '../utils/file-system.js'
import { fileValidation } from '../utils/validation.js'

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = pathUtils.getDirname(__filename)

// Rule repository paths
const rulesRootDir = pathUtils.join(__dirname, '../..')
const ruleDirectories = [
  '.vdk/rules',
  '.vdk/rules/assistants',
  '.vdk/rules/languages',
  '.vdk/rules/stacks',
  '.vdk/rules/tasks',
  '.vdk/rules/technologies',
  '.vdk/rules/tools',
]

// Track all rule IDs to check for duplicates
const ruleIds = new Map()

// Simple YAML frontmatter parser
function parseYamlFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)

  if (!match) {
    // Check if there's YAML at the start without --- delimiters
    const lines = content.split('\n')
    let yamlContent = ''
    let foundYaml = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === '---') {
        break
      }
      if (line.includes(':') && !line.startsWith('#')) {
        foundYaml = true
        yamlContent += `${lines[i]}\n`
      } else if (foundYaml && line === '') {
      } else if (foundYaml) {
        break
      }
    }

    return yamlContent.trim() ? yamlContent : null
  }

  return match[1]
}

// Basic YAML validation (just check for basic structure)
function isValidYaml(yamlContent) {
  if (!yamlContent) {
    return false
  }

  try {
    const lines = yamlContent.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue
      }

      // Check for basic YAML key-value structure
      if (!(trimmed.includes(':') || trimmed.startsWith('-'))) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

// Get all MDC files recursively
async function getAllMdcFiles(dirPath) {
  try {
    const files = await fileSystem.findFiles(dirPath, /\.(mdc|md)$/)
    // Filter out common non-rule files
    return files.filter((file) => {
      const basename = pathUtils.getBasename(file)
      return !['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'].includes(basename)
    })
  } catch {
    // Directory doesn't exist, skip
    return []
  }
}

// Main validation function
async function validateRules() {
  let validFiles = 0
  let invalidFiles = 0
  let duplicateIds = 0

  logger.title('🔎 Validating MDC rule files...')
  logger.blank()

  // Get all MDC files from all directories
  const allFiles = []
  for (const dir of ruleDirectories) {
    const dirPath = pathUtils.join(rulesRootDir, dir)
    const files = await getAllMdcFiles(dirPath)
    allFiles.push(...files)
  }

  if (allFiles.length === 0) {
    logger.warning('No MDC files found in any directory.')
    process.exit(0)
  }

  logger.info(`Found ${allFiles.length} MDC files to validate`)
  logger.blank()

  // Use centralized validation
  const results = await fileValidation.validateMDCFiles(allFiles)

  // Display results
  for (const filePath of results.valid) {
    const relativePath = pathUtils.relative(rulesRootDir, filePath)
    validation.valid(relativePath)
    validFiles++
  }

  for (const { file, errors } of results.invalid) {
    const relativePath = pathUtils.relative(rulesRootDir, file)
    validation.invalid(relativePath, errors.join(', '))
    invalidFiles++
  }

  // Handle duplicate IDs
  for (const [ruleId, { current, existing }] of results.duplicateIds) {
    const currentRel = pathUtils.relative(rulesRootDir, current)
    const existingRel = pathUtils.relative(rulesRootDir, existing)
    logger.error(`Duplicate rule ID: ${ruleId}`)
    logger.red(`    Current: ${currentRel}`)
    logger.red(`    Existing: ${existingRel}`)
    duplicateIds++
  }

  // Summary
  const totalErrors = invalidFiles + duplicateIds
  validation.summary(validFiles, invalidFiles, 0)

  if (duplicateIds > 0) {
    logger.red(`  Duplicate IDs: ${duplicateIds}`)
  }

  if (totalErrors > 0) {
    logger.error('\nValidation failed. Please fix the errors above.')
    process.exit(1)
  } else {
    logger.success('\nAll rules are valid!')
    process.exit(0)
  }
}

// Run validation only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateRules().catch((err) => {
    console.error(chalk.red(`An error occurred: ${err.message}`))
    process.exit(1)
  })
}
