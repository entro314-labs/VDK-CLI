#!/usr/bin/env node

/**
 * Update MCP Configuration CLI Tool
 * -----------------------
 * Command-line utility for updating the editor paths and MCP server configurations
 * in the 03-mcp-configuration.mdc file based on the current environment.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { updateMCPConfigurationFile } from '../shared/editor-path-resolver.js'
import * as ideConfig from '../shared/ide-configuration.js'

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  path: process.cwd(),
  quiet: false,
  help: false,
  force: false,
}

// Parse arguments
args.forEach((arg) => {
  if (arg.startsWith('--path=')) {
    options.path = arg.substring('--path='.length)
  } else if (arg === '--quiet') {
    options.quiet = true
  } else if (arg === '--help') {
    options.help = true
  } else if (arg === '--force') {
    options.force = true
  }
})

// Show help message and exit if --help is specified
if (options.help) {
  console.log(`
${colors.bright}${colors.cyan}Update MCP Configuration Tool${colors.reset}

This tool updates the editor paths and MCP server configurations in the
03-mcp-configuration.mdc file based on detected editors and configuration files.

${colors.bright}Usage:${colors.reset}
  node update-mcp-config.js [options]

${colors.bright}Options:${colors.reset}
  --path=DIR     Path to the project root (default: current directory)
  --force        Update configuration even if no editors are detected
  --quiet        Reduce output verbosity
  --help         Show this help message

${colors.bright}Example:${colors.reset}
  node tools/update-mcp-config.js --path=/path/to/project
  `)
  process.exit(0)
}

// Set verbosity based on --quiet flag
const log = (message) => {
  if (!options.quiet) {
    console.log(message)
  }
}

/**
 * Main function to update MCP configuration
 */
async function updateMCPConfig() {
  log(`${colors.bright}${colors.cyan}Update MCP Configuration Tool${colors.reset}`)
  log('Updating editor paths and MCP server configurations...')

  // Ensure the path exists and is a directory
  if (!(fs.existsSync(options.path) && fs.statSync(options.path).isDirectory())) {
    console.error(
      `${colors.red}Error: Path does not exist or is not a directory: ${options.path}${colors.reset}`
    )
    process.exit(1)
  }

  // Detect IDEs in the project directory
  const detectedIDEs = ideConfig.detectIDEs(options.path)

  if (detectedIDEs.length === 0 && !options.force) {
    console.error(
      `${colors.yellow}Warning: No IDE configurations detected in the project.${colors.reset}`
    )
    console.error('Use --force to update configuration anyway.')
    process.exit(1)
  }

  if (detectedIDEs.length > 0) {
    log(`${colors.bright}${colors.green}Detected IDE configurations:${colors.reset}`)
    detectedIDEs.forEach((ide) => {
      log(`${colors.green}• ${ide.name}${colors.reset} (${ide.configFolder})`)
    })
    log('')
  }

  // Find rule directories
  const ruleDirectories = []

  // First, check detected IDE rule directories
  detectedIDEs.forEach((ide) => {
    const rulePath = path.join(options.path, ide.rulesFolder)
    if (fs.existsSync(rulePath)) {
      ruleDirectories.push({
        path: rulePath,
        source: ide.name,
      })
    }
  })

  // Then, check common rule directories if none found from IDEs
  if (ruleDirectories.length === 0) {
    const commonPaths = [
      '.ai/rules',
      '.vscode/ai-rules',
      '.vscode-insiders/ai-rules',
      '.vscode-oss/ai-rules',
      '.cursor/rules',
      '.claude/rules',
      '.claude/commands',
      '.windsurf/rules',
      '.windsurf-next/rules',
      '.zed/ai-rules',
      '.idea/ai-rules',
      '.github/copilot/rules'
    ]

    commonPaths.forEach((rulePath) => {
      const fullPath = path.join(options.path, rulePath)
      if (fs.existsSync(fullPath)) {
        ruleDirectories.push({
          path: fullPath,
          source: 'Common Path',
        })
      }
    })
  }

  // Prompt for rule directory if none found
  if (ruleDirectories.length === 0) {
    console.error(`${colors.yellow}Warning: No rule directories found.${colors.reset}`)

    // If force option is provided, use the default path
    if (options.force) {
      const defaultPath = path.join(options.path, '.ai/rules')
      console.log(`${colors.yellow}Creating default rule directory: ${defaultPath}${colors.reset}`)

      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true })
      }

      ruleDirectories.push({
        path: defaultPath,
        source: 'Default',
      })
    } else {
      console.error('Use --force to create a default rule directory.')
      process.exit(1)
    }
  }

  // Update the MCP configuration file in each rule directory
  let successCount = 0

  for (const ruleDir of ruleDirectories) {
    log(
      `Updating MCP configuration in ${colors.cyan}${ruleDir.path}${colors.reset} (from ${ruleDir.source})...`
    )

    // Check for the MCP configuration file
    const mcpFilePath = path.join(ruleDir.path, '03-mcp-configuration.mdc')

    if (!fs.existsSync(mcpFilePath)) {
      log(`${colors.yellow}MCP configuration file not found: ${mcpFilePath}${colors.reset}`)

      // Create file from template if it doesn't exist
      const templatePath = path.join(__dirname, '../templates/rules/03-mcp-configuration.mdc')

      if (fs.existsSync(templatePath)) {
        log(`${colors.yellow}Creating from template...${colors.reset}`)
        fs.copyFileSync(templatePath, mcpFilePath)
      } else {
        log(`${colors.yellow}Template not found, creating empty file...${colors.reset}`)
        fs.writeFileSync(
          mcpFilePath,
          `---
description: Defines the available Model Context Protocol (MCP) servers and their capabilities.
globs:
alwaysApply: false
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["Memory-MCP", "Sequential-Thinking-Advanced", "MCP-Integration"]
---
# MCP Server Configuration

This file documents the Model Context Protocol (MCP) servers available in your environment.

`,
          'utf8'
        )
      }
    }

    // Update the file
    const success = updateMCPConfigurationFile(options.path, ruleDir.path)

    if (success) {
      log(
        `${colors.green}✓${colors.reset} Successfully updated MCP configuration in ${colors.cyan}${ruleDir.path}${colors.reset}`
      )
      successCount++
    } else {
      log(
        `${colors.red}✗${colors.reset} Failed to update MCP configuration in ${colors.cyan}${ruleDir.path}${colors.reset}`
      )
    }
  }

  if (successCount > 0) {
    log(
      `${colors.green}${colors.bright}MCP configuration updated successfully in ${successCount} directories.${colors.reset}`
    )
  } else {
    console.error(
      `${colors.red}${colors.bright}Failed to update MCP configuration in any directory.${colors.reset}`
    )
    process.exit(1)
  }
}

// Run the main function only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateMCPConfig().catch((error) => {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`)
    process.exit(1)
  })
}
