#!/usr/bin/env node

/**
 * VDK CLI (Refactored)
 * -----------------------
 * Streamlined main entry point for the VDK command-line interface.
 * Uses modular command architecture for better maintainability and testability.
 *
 * Repository: https://github.com/entro314-labs/VDK-CLI
 */

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

import { createCLIProgram } from './src/commands/index.js'
import { banner } from './src/utils/cli-styles.js'

// Environment setup
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env.local') })
dotenv.config({ path: path.join(__dirname, '.env') })

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

// Create and configure the CLI program
const program = createCLIProgram(pkg)

// Show banner when no arguments provided
if (process.argv.slice(2).length === 0) {
  console.log(banner())
  program.outputHelp()
} else {
  // Parse and execute commands
  program.parse(process.argv)
}
