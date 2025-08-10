#!/usr/bin/env node

/**
 * VDK CLI
 * -----------------------
 * This is the main entry point for the VDK command-line interface.
 * It orchestrates commands for initializing projects, managing rules, and deploying to the VDK Hub.
 *
 * Repository: https://github.com/entro314-labs/VDK-CLI
 */

import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'
import dotenv from 'dotenv'

import { downloadRule, fetchRuleList } from './src/blueprints-client.js'
import { runScanner } from './src/scanner/index.js'
import {
  banner,
  boxes,
  colors,
  format,
  headers,
  spinners,
  status,
  tables,
} from './src/utils/cli-styles.js'

// Get the directory where cli.js is located (VDK CLI directory)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Try loading .env.local first from CLI directory, then fall back to .env
dotenv.config({ path: path.join(__dirname, '.env.local') })
dotenv.config({ path: path.join(__dirname, '.env') })

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const program = new Command()

program
  .name('vdk')
  .description("VDK CLI: The world's first Vibe Development Kit - One Context, All AI Assistants")
  .version(pkg.version)

program
  .command('init')
  .description('Initialize VDK and generate project-aware AI rules by scanning the project')
  .option('-p, --projectPath <path>', 'Path to the project to scan', process.cwd())
  .option('-o, --outputPath <path>', 'Path where generated rules should be saved', './.ai/rules')
  .option('-d, --deep', 'Enable deep scanning for more thorough pattern detection', false)
  .option('-i, --ignorePattern <patterns...>', 'Glob patterns to ignore', [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ])
  .option(
    '--use-gitignore',
    'Automatically parse .gitignore files for additional ignore patterns',
    true
  )
  .option('-t, --template <name>', 'Name of the rule template to use', 'default')
  .option('--overwrite', 'Overwrite existing rule files without prompting', false)
  .option('--ide-integration', 'Enable IDE integration setup', true)
  .option('--watch', 'Enable watch mode for continuous IDE integration updates', false)
  .option('-v, --verbose', 'Enable verbose output for debugging', false)
  .option(
    '--categories <categories...>',
    'Specific command categories to fetch (e.g., development, testing, workflow)'
  )
  .option(
    '--preset <preset>',
    'Preset command collection (minimal, full, development, production)',
    'auto'
  )
  .option('--interactive', 'Enable interactive category selection', false)
  .action(async (options) => {
    try {
      const results = await runScanner(options)

      // Create the VDK configuration file
      const configPath = path.join(options.projectPath, 'vdk.config.json')
      const config = {
        project: {
          name: results.projectName,
        },
        ide: results.initializedIDEs[0] || 'generic',
        rulesPath: options.outputPath,
        lastUpdated: new Date().toISOString(),
      }

      await fs.writeFile(configPath, JSON.stringify(config, null, 2))
      console.log(status.success(`VDK configuration created at ${format.path(configPath)}`))

      // Handle watch mode
      if (options.watch && results.ideIntegration) {
        console.log(status.info('Watch mode enabled. Press Ctrl+C to exit.'))
        process.on('SIGINT', () => {
          results.ideIntegration.shutdown()
          process.exit(0)
        })
        // Keep the process running in watch mode
        await new Promise(() => {})
      }
    } catch (_error) {
      // The scanner engine already logs errors, so we just exit to prevent double logging
      process.exit(1)
    }
  })

program
  .command('deploy')
  .description('Deploy project-aware rules (Under Development)')
  .action(() => {
    console.log(
      boxes.warning(
        'This command is under development.\nThe `deploy` command will be used to send your VDK rules to the VDK Hub.',
        'Coming Soon'
      )
    )
  })

program
  .command('update')
  .description('Update VDK blueprints from the VDK-Blueprints repository')
  .option('-o, --outputPath <path>', 'Path to the rules directory', './.ai/rules')
  .action(async (options) => {
    const rulesDir = path.resolve(options.outputPath)

    console.log(headers.section('VDK Blueprint Update'))
    const spinner = spinners.updating('Checking for updates in VDK-Blueprints repository...')
    spinner.start()

    try {
      // Ensure local rules directory exists
      await fs.mkdir(rulesDir, { recursive: true })

      const remoteRules = await fetchRuleList()
      if (remoteRules.length === 0) {
        spinner.fail('No blueprints found in the VDK-Blueprints repository or failed to connect.')
        return
      }

      const localRules = await fs.readdir(rulesDir).catch(() => [])
      let updatedCount = 0
      let newCount = 0

      spinner.text = `Found ${format.count(remoteRules.length)} blueprints. Comparing with local rules...`

      for (const remoteRule of remoteRules) {
        spinner.text = `Processing ${remoteRule.name}...`
        const localPath = path.join(rulesDir, remoteRule.name)
        const ruleContent = await downloadRule(remoteRule.download_url)

        if (ruleContent) {
          if (localRules.includes(remoteRule.name)) {
            await fs.writeFile(localPath, ruleContent)
            updatedCount++
          } else {
            await fs.writeFile(localPath, ruleContent)
            newCount++
          }
        }
      }

      spinner.stop()

      if (newCount > 0 || updatedCount > 0) {
        console.log(status.success('Update complete!'))
        if (newCount > 0) {
          console.log(status.progress(`Added ${format.count(newCount)} new rule(s)`))
        }
        if (updatedCount > 0) {
          console.log(status.progress(`Updated ${format.count(updatedCount)} existing rule(s)`))
        }
      } else {
        console.log(status.success('Your rules are already up to date'))
      }
    } catch (error) {
      if (spinner.isSpinning) {
        spinner.fail('Update failed')
      }
      console.log(boxes.error(`An error occurred during the update:\n${error.message}`))
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Check the status of your VDK setup')
  .option('-c, --configPath <path>', 'Path to the VDK configuration file', './vdk.config.json')
  .option('-o, --outputPath <path>', 'Path to the rules directory', './.ai/rules')
  .action(async (options) => {
    console.log(headers.section('VDK Status Check'))

    const configPath = path.resolve(options.configPath)
    const rulesDir = path.resolve(options.outputPath)
    const spinner = spinners.scanning('Checking VDK status...')
    spinner.start()

    const statusTable = tables.status()
    let isConfigured = false

    // 1. Check for VDK configuration file
    try {
      await fs.access(configPath)
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
      statusTable.push([
        'VDK Configuration',
        status.success('Found'),
        `${format.keyValue('Project', config.project.name)}\n${format.keyValue('IDE', config.ide)}`,
      ])
      isConfigured = true
    } catch (_error) {
      statusTable.push([
        'VDK Configuration',
        status.warning('Missing'),
        `Run ${colors.primary('vdk init')} to get started`,
      ])
    }

    // 2. Check local and remote rules
    try {
      const localRules = await fs.readdir(rulesDir).catch(() => [])
      statusTable.push([
        'Local Rules',
        status.success('Found'),
        `${format.count(localRules.length)} rules in ${format.path(rulesDir)}`,
      ])

      const remoteRules = await fetchRuleList()
      if (remoteRules.length > 0) {
        const remoteRuleNames = remoteRules.map((r) => r.name)
        const newRules = remoteRuleNames.filter((r) => !localRules.includes(r))

        if (newRules.length > 0) {
          statusTable.push([
            'VDK Hub',
            status.warning('Updates Available'),
            `${format.count(newRules.length)} new rules available\nRun ${colors.primary('vdk update')} to sync`,
          ])
        } else {
          statusTable.push([
            'VDK Hub',
            status.success('Up to Date'),
            `${format.count(remoteRules.length)} total rules in sync`,
          ])
        }
      } else {
        statusTable.push([
          'VDK Hub',
          status.error('Unreachable'),
          'Could not connect to VDK-Blueprints repository',
        ])
      }
    } catch (error) {
      statusTable.push(['Rule Status', status.error('Error'), error.message])
    }

    spinner.stop()
    console.log(statusTable.toString())

    if (!isConfigured) {
      console.log(
        `\n${boxes.info(
          `Get started by running:\n${colors.primary('vdk init')}\n\nThis will scan your project and create project-aware AI rules.`,
          'Quick Start'
        )}`
      )
    }
  })

// Show banner when no arguments provided
if (process.argv.slice(2).length === 0) {
  console.log(banner())
}

program.parse(process.argv)

if (process.argv.slice(2).length === 0) {
  program.outputHelp()
}
