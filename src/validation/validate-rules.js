#!/usr/bin/env node

/**
 * Simple Rule Validator Tool
 *
 * This script performs basic validation on MDC files:
 * - Checks for duplicate rule IDs (filenames)
 * - Validates that YAML frontmatter is parseable
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Rule repository paths
const rulesRootDir = path.join(__dirname, '../..')
const ruleDirectories = [
  '.ai/rules',
  '.ai/rules/assistants',
  '.ai/rules/languages',
  '.ai/rules/stacks',
  '.ai/rules/tasks',
  '.ai/rules/technologies',
  '.ai/rules/tools',
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
  const files = []

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isFile() && (entry.name.endsWith('.mdc') || entry.name.endsWith('.md'))) {
        // Skip common non-rule files
        if (!['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md'].includes(entry.name)) {
          files.push(fullPath)
        }
      }
      // Don't recursively scan subdirectories since we list them explicitly
    }
  } catch {
    // Directory doesn't exist, skip
  }

  return files
}

// Main validation function
async function validateRules() {
  let errors = 0
  let warnings = 0
  let validFiles = 0

  console.log(chalk.blue.bold('🔎 Validating MDC rule files...\n'))

  // Get all MDC files from all directories
  const allFiles = []
  for (const dir of ruleDirectories) {
    const dirPath = path.join(rulesRootDir, dir)
    const files = await getAllMdcFiles(dirPath)
    allFiles.push(...files)
  }

  if (allFiles.length === 0) {
    console.log(chalk.yellow('No MDC files found in any directory.'))
    process.exit(0)
  }

  console.log(chalk.cyan(`Found ${allFiles.length} MDC files to validate\n`))

  // Validate each file
  for (const filePath of allFiles) {
    const relativePath = path.relative(rulesRootDir, filePath)

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8')

      // Check for YAML frontmatter
      const yamlContent = parseYamlFrontmatter(content)

      if (!yamlContent) {
        console.log(chalk.yellow(`  ⚠ ${relativePath}:`), chalk.yellow('No YAML frontmatter found'))
        warnings++
      } else if (!isValidYaml(yamlContent)) {
        console.log(
          chalk.red(`  ✘ ${relativePath}:`),
          chalk.red('Invalid YAML frontmatter structure')
        )
        errors++
      } else {
        console.log(chalk.green(`  ✓ ${relativePath}`))
        validFiles++
      }

      // Check for duplicate rule IDs (based on filename)
      const fileName = path.basename(filePath)
      const ruleId = path.basename(fileName, path.extname(fileName)).toLowerCase()

      if (ruleIds.has(ruleId)) {
        console.log(
          chalk.red(`  ✘ Duplicate rule ID: ${ruleId}`),
          chalk.red(`\n    Current: ${relativePath}`),
          chalk.red(`\n    Existing: ${ruleIds.get(ruleId)}`)
        )
        errors++
      } else {
        ruleIds.set(ruleId, relativePath)
      }
    } catch (err) {
      console.log(chalk.red(`  ✘ ${relativePath}: Error reading file: ${err.message}`))
      errors++
    }
  }

  // Summary
  console.log(chalk.blue.bold('\nValidation Summary:'))
  console.log(chalk.green(`  Valid files: ${validFiles}`))
  console.log(chalk.yellow(`  Warnings: ${warnings}`))
  console.log(chalk.red(`  Errors: ${errors}`))

  if (errors > 0) {
    console.log(chalk.red.bold('\n❌ Validation failed. Please fix the errors above.'))
    process.exit(1)
  } else if (warnings > 0) {
    console.log(chalk.yellow.bold('\n⚠️ Validation passed with warnings.'))
    process.exit(0)
  } else {
    console.log(chalk.green.bold('\n✅ All rules are valid!'))
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
