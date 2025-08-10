#!/usr/bin/env node

/**
 * Duplicate Rule Checker
 *
 * This script checks for duplicate rule IDs across the repository.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import chalk from 'chalk'
import glob from 'fast-glob'

// Rule repository paths
const rulesRootDir = path.join(__dirname, '../..')
const ruleDirectories = [
  '', // Root directory
  'assistants',
  'languages',
  'stacks',
  'tasks',
  'technologies',
  'tools',
  'templates/rules',
]

async function checkDuplicateRules() {
  const ruleIds = new Map()
  let duplicatesFound = false

  console.log(chalk.blue.bold('🔎 Checking for duplicate rule IDs...\n'))

  // Process each directory
  for (const dir of ruleDirectories) {
    const dirPath = path.join(rulesRootDir, dir)
    let dirExists = false

    try {
      await fs.access(dirPath)
      dirExists = true
    } catch (_err) {
      continue
    }

    if (!dirExists) {
      continue
    }

    // Find all MDC files in the directory
    const mdcFiles = await glob(['*.mdc', '*.md'], {
      cwd: dirPath,
      ignore: ['README.md', 'CONTRIBUTING.md'], // Ignore non-rule files
    })

    if (mdcFiles.length === 0) {
      continue
    }

    // Check each file
    for (const file of mdcFiles) {
      const filePath = path.join(dirPath, file)
      const relativePath = path.relative(rulesRootDir, filePath)

      // Extract rule ID from filename
      const ruleId = path.basename(file, path.extname(file)).toLowerCase()

      if (ruleIds.has(ruleId)) {
        console.log(
          chalk.red(`✘ Duplicate rule ID found: ${ruleId}`),
          chalk.red(`\n  - ${relativePath}`),
          chalk.red(`\n  - ${ruleIds.get(ruleId)}`)
        )
        duplicatesFound = true
      } else {
        ruleIds.set(ruleId, relativePath)
      }
    }
  }

  if (!duplicatesFound) {
    console.log(chalk.green('✓ No duplicate rule IDs found.'))
    process.exit(0)
  } else {
    console.log(chalk.red.bold('\n❌ Duplicate rule IDs found. Please fix the issues above.'))
    process.exit(1)
  }
}

// Run checker only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDuplicateRules().catch((err) => {
    console.error(chalk.red(`An error occurred: ${err.message}`))
    process.exit(1)
  })
}
