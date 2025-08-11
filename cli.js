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

import { 
  downloadRule, 
  fetchRuleList,
  fetchBlueprintsWithMetadata,
  searchBlueprints,
  analyzeBlueprintDependencies,
  getBlueprintsForPlatform,
  getBlueprintStatistics
} from './src/blueprints-client.js'
import { runScanner } from './src/scanner/index.js'
import { MigrationManager } from './src/migration/migration-manager.js'
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
  .command('migrate')
  .description('Migrate existing AI contexts to VDK format')
  .option('-p, --projectPath <path>', 'Path to the project to scan', process.cwd())
  .option('-o, --outputPath <path>', 'Path where VDK rules should be saved', './.ai/rules')
  .option('--migrationOutput <path>', 'Path for migration files', './vdk-migration')
  .option('--dry-run', 'Preview migration without creating files', false)
  .option('--no-deploy', 'Skip deployment to IDE integrations')
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (options) => {
    try {
      const migrationManager = new MigrationManager({
        projectPath: options.projectPath,
        outputPath: options.outputPath,
        migrationOutputPath: options.migrationOutput,
        verbose: options.verbose
      })

      await migrationManager.migrate({
        dryRun: options.dryRun,
        deployToIdes: options.deploy !== false
      })
    } catch (error) {
      console.error(boxes.error(`Migration failed:\n${error.message}`))
      if (options.verbose) {
        console.error(error.stack)
      }
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
      
      // Check for existing AI contexts that could be migrated
      try {
        const { MigrationManager } = await import('./src/migration/migration-manager.js')
        const migrationManager = new MigrationManager({ projectPath: process.cwd() })
        const projectScanner = migrationManager.projectScanner
        const projectData = await projectScanner.scanProject(process.cwd())
        const migrationDetector = migrationManager.migrationDetector
        const contexts = await migrationDetector.detectAIContexts(projectData)
        
        if (contexts.length > 0) {
          statusTable.push([
            'Existing AI Contexts',
            status.warning('Found'),
            `${format.count(contexts.length)} contexts available for migration\nRun ${colors.primary('vdk migrate')} to convert them`,
          ])
        }
      } catch (error) {
        // Migration detection failed, skip silently
      }
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
          `Get started by running:\n${colors.primary('vdk init')}\n\nThis will scan your project and create project-aware AI rules.\n\nIf you have existing AI contexts, try:\n${colors.primary('vdk migrate')} to convert them to VDK format`,
          'Quick Start'
        )}`
      )
    }
  })

// Enhanced schema validation command
program
  .command('validate')
  .description('Validate blueprint schema compatibility with AI Context Schema v2.1.0')
  .option('-p, --path <path>', 'Path to blueprint/rule files', './.ai/rules')
  .option('-f, --file <file>', 'Validate specific blueprint file')
  .option('--check-dependencies', 'Validate blueprint relationships and dependencies')
  .option('--check-platforms', 'Validate platform-specific configurations')
  .option('-v, --verbose', 'Show detailed validation results', false)
  .action(async (options) => {
    try {
      const { validateBlueprint, validateCommand } = await import('./src/utils/schema-validator.js')
      const path = await import('node:path')
      const fs = await import('node:fs/promises')
      const matter = (await import('gray-matter')).default

      console.log(headers.section('Schema Validation'))
      const spinner = spinners.scanning('Validating blueprints...')
      spinner.start()

      let filesToValidate = []
      
      if (options.file) {
        filesToValidate.push(path.resolve(options.file))
      } else {
        const rulesDir = path.resolve(options.path)
        try {
          const files = await fs.readdir(rulesDir, { recursive: true })
          filesToValidate = files
            .filter(file => file.endsWith('.mdc') || file.endsWith('.md'))
            .map(file => path.join(rulesDir, file))
        } catch (error) {
          spinner.fail(`Failed to read directory ${rulesDir}: ${error.message}`)
          return
        }
      }

      if (filesToValidate.length === 0) {
        spinner.fail('No blueprint files found to validate')
        return
      }

      spinner.text = `Validating ${filesToValidate.length} blueprint files...`

      const results = []
      let validCount = 0
      let errorCount = 0

      for (const filePath of filesToValidate) {
        try {
          const content = await fs.readFile(filePath, 'utf8')
          const parsed = matter(content)
          
          // Determine validation type
          const isCommand = parsed.data.commandType || parsed.data.target
          const validation = isCommand 
            ? await validateCommand(parsed.data)
            : await validateBlueprint(parsed.data)

          results.push({
            file: path.relative(process.cwd(), filePath),
            valid: validation.valid,
            errors: validation.errors,
            type: isCommand ? 'command' : 'blueprint'
          })

          if (validation.valid) {
            validCount++
          } else {
            errorCount++
          }
        } catch (error) {
          results.push({
            file: path.relative(process.cwd(), filePath),
            valid: false,
            errors: [`Parse error: ${error.message}`],
            type: 'unknown'
          })
          errorCount++
        }
      }

      spinner.stop()

      // Display results
      const resultTable = tables.validation()
      
      results.forEach(result => {
        const statusIcon = result.valid ? status.success('✓') : status.error('✗')
        const errorsText = result.errors.length > 0 
          ? (options.verbose ? result.errors.join('\n') : `${result.errors.length} error(s)`)
          : 'Valid'
        
        resultTable.push([
          result.file,
          result.type,
          statusIcon,
          errorsText
        ])
      })

      console.log(resultTable.toString())
      console.log(`\n${validCount} valid, ${errorCount} errors`)

      if (errorCount > 0 && !options.verbose) {
        console.log(status.info('Use --verbose flag to see detailed error messages'))
      }

      if (options.checkDependencies) {
        console.log(status.warning('Dependency validation feature is planned for implementation'))
      }

      if (options.checkPlatforms) {
        console.log(status.warning('Platform configuration validation feature is planned for implementation'))
      }

      process.exit(errorCount > 0 ? 1 : 0)
    } catch (error) {
      console.error(boxes.error(`Validation failed: ${error.message}`))
      process.exit(1)
    }
  })

// Blueprint creation command with new schema support
program
  .command('create')
  .description('Create a new blueprint with AI Context Schema v2.1.0 structure')
  .option('-n, --name <name>', 'Blueprint name')
  .option('-t, --title <title>', 'Blueprint title') 
  .option('-d, --description <description>', 'Blueprint description')
  .option('-c, --category <category>', 'Blueprint category', 'tool')
  .option('-a, --author <author>', 'Blueprint author')
  .option('--tags <tags...>', 'Blueprint tags (space-separated)')
  .option('--complexity <level>', 'Complexity level (simple, medium, complex)', 'medium')
  .option('--scope <scope>', 'Impact scope (file, component, feature, project, system)', 'project')
  .option('--audience <audience>', 'Target audience (developer, architect, team-lead, junior, senior, any)', 'developer')
  .option('--maturity <level>', 'Maturity level (experimental, beta, stable, deprecated)', 'beta')
  .option('-o, --output <path>', 'Output file path', './.ai/rules')
  .option('--interactive', 'Interactive blueprint creation', false)
  .action(async (options) => {
    try {
      const { select, input, multiselect, confirm } = await import('@clack/prompts')
      const path = await import('node:path')
      const fs = await import('node:fs/promises')

      console.log(headers.section('Blueprint Creation'))

      let blueprintData = {}

      if (options.interactive) {
        // Interactive mode
        blueprintData.name = await input({
          message: 'Blueprint name (kebab-case):',
          placeholder: 'my-awesome-blueprint',
          validate: (value) => {
            if (!value) return 'Name is required'
            if (!/^[a-z0-9-]+$/.test(value)) return 'Name must be kebab-case (lowercase, hyphens only)'
            return
          }
        })

        blueprintData.title = await input({
          message: 'Blueprint title:',
          placeholder: 'My Awesome Blueprint'
        })

        blueprintData.description = await input({
          message: 'Description:',
          placeholder: 'A brief description of what this blueprint does'
        })

        blueprintData.category = await select({
          message: 'Category:',
          options: [
            { value: 'core', label: 'Core' },
            { value: 'language', label: 'Language' },
            { value: 'technology', label: 'Technology' },
            { value: 'stack', label: 'Stack' },
            { value: 'task', label: 'Task' },
            { value: 'assistant', label: 'Assistant' },
            { value: 'tool', label: 'Tool' },
            { value: 'project', label: 'Project' },
          ]
        })

        blueprintData.complexity = await select({
          message: 'Complexity level:',
          options: [
            { value: 'simple', label: 'Simple' },
            { value: 'medium', label: 'Medium' },
            { value: 'complex', label: 'Complex' },
          ]
        })

        blueprintData.scope = await select({
          message: 'Impact scope:',
          options: [
            { value: 'file', label: 'File' },
            { value: 'component', label: 'Component' },
            { value: 'feature', label: 'Feature' },
            { value: 'project', label: 'Project' },
            { value: 'system', label: 'System' },
          ]
        })

        blueprintData.audience = await select({
          message: 'Target audience:',
          options: [
            { value: 'developer', label: 'Developer' },
            { value: 'architect', label: 'Architect' },
            { value: 'team-lead', label: 'Team Lead' },
            { value: 'junior', label: 'Junior' },
            { value: 'senior', label: 'Senior' },
            { value: 'any', label: 'Any' },
          ]
        })

        blueprintData.maturity = await select({
          message: 'Maturity level:',
          options: [
            { value: 'experimental', label: 'Experimental' },
            { value: 'beta', label: 'Beta' },
            { value: 'stable', label: 'Stable' },
            { value: 'deprecated', label: 'Deprecated' },
          ]
        })

        const tagsInput = await input({
          message: 'Tags (comma-separated):',
          placeholder: 'javascript, react, typescript'
        })
        blueprintData.tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()) : []

        blueprintData.author = await input({
          message: 'Author:',
          placeholder: 'Your name or organization'
        })

        const addPlatforms = await confirm({
          message: 'Configure platform-specific settings?',
          initialValue: false
        })

        if (addPlatforms) {
          const selectedPlatforms = await multiselect({
            message: 'Select target platforms:',
            options: [
              { value: 'claude-code', label: 'Claude Code' },
              { value: 'cursor', label: 'Cursor' },
              { value: 'windsurf', label: 'Windsurf' },
              { value: 'zed', label: 'Zed' },
              { value: 'vscode', label: 'VS Code' },
              { value: 'github-copilot', label: 'GitHub Copilot' },
            ]
          })

          blueprintData.platforms = {}
          for (const platform of selectedPlatforms) {
            blueprintData.platforms[platform] = { compatible: true }
          }
        } else {
          blueprintData.platforms = {
            'claude-code': { compatible: true },
            cursor: { compatible: true },
            windsurf: { compatible: true },
          }
        }
      } else {
        // Non-interactive mode using command line options
        if (!options.name) {
          console.error(status.error('Blueprint name is required. Use --name or --interactive'))
          process.exit(1)
        }

        blueprintData = {
          name: options.name,
          title: options.title || options.name,
          description: options.description || `${options.title || options.name} blueprint`,
          category: options.category,
          complexity: options.complexity,
          scope: options.scope,
          audience: options.audience,
          maturity: options.maturity,
          author: options.author,
          tags: options.tags || [],
          platforms: {
            'claude-code': { compatible: true },
            cursor: { compatible: true },
            windsurf: { compatible: true },
          }
        }
      }

      // Add required fields
      blueprintData.id = blueprintData.name
      blueprintData.version = '1.0.0'
      blueprintData.created = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      blueprintData.lastUpdated = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

      // Create blueprint file content
      const frontmatter = Object.keys(blueprintData)
        .map(key => {
          const value = blueprintData[key]
          if (Array.isArray(value)) {
            return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`
          } else if (typeof value === 'object' && value !== null) {
            return `${key}:\n${JSON.stringify(value, null, 2).split('\n').map(line => `  ${line}`).join('\n')}`
          } else {
            return `${key}: "${value}"`
          }
        })
        .join('\n')

      const blueprintContent = `---
${frontmatter}
---

# ${blueprintData.title}

## Description

${blueprintData.description}

## Implementation

Add your implementation details here...

## Usage

Describe how to use this blueprint...

## Examples

Provide examples of the blueprint in action...

---

*Generated with VDK CLI - AI Context Schema v2.1.0*
`

      // Write the blueprint file
      const outputPath = path.resolve(options.output)
      await fs.mkdir(outputPath, { recursive: true })
      const filePath = path.join(outputPath, `${blueprintData.name}.mdc`)
      
      await fs.writeFile(filePath, blueprintContent)
      
      console.log(status.success(`Blueprint created: ${format.path(filePath)}`))
      console.log(status.info(`Run ${colors.primary('vdk validate --file ' + filePath)} to validate the blueprint`))

    } catch (error) {
      console.error(boxes.error(`Blueprint creation failed: ${error.message}`))
      process.exit(1)
    }
  })

// Schema migration command
program
  .command('schema-migrate')
  .description('Migrate existing blueprints to AI Context Schema v2.1.0 format')
  .option('-i, --input <path>', 'Input directory containing blueprints', './.ai/rules')
  .option('-o, --output <path>', 'Output directory for migrated blueprints')
  .option('--force', 'Force migration even if already in v2.1.0 format', false)
  .option('--dry-run', 'Preview migration without making changes', false)
  .option('-v, --verbose', 'Show detailed migration progress', false)
  .action(async (options) => {
    try {
      const { SchemaMigrator } = await import('./src/migration/converters/schema-migrator.js')
      const path = await import('node:path')

      console.log(headers.section('Schema Migration to v2.1.0'))

      const inputPath = path.resolve(options.input)
      const outputPath = options.output ? path.resolve(options.output) : inputPath + '_v2'

      if (options.dryRun) {
        console.log(status.info('DRY RUN: No files will be modified'))
      }

      console.log(`Input:  ${format.path(inputPath)}`)
      console.log(`Output: ${format.path(outputPath)}`)

      const spinner = spinners.scanning('Analyzing blueprints for migration...')
      spinner.start()

      const migrator = new SchemaMigrator({ verbose: options.verbose })
      
      if (options.dryRun) {
        // For dry run, just analyze without writing
        const files = await migrator.findBlueprintFiles(inputPath)
        spinner.text = `Analyzing ${files.length} blueprint files...`
        
        let needsMigration = 0
        let alreadyMigrated = 0
        
        for (const filePath of files) {
          try {
            const fs = await import('node:fs/promises')
            const matter = (await import('gray-matter')).default
            
            const content = await fs.readFile(filePath, 'utf8')
            const parsed = matter(content)
            
            if (migrator.isAlreadyMigrated(parsed.data)) {
              alreadyMigrated++
            } else {
              needsMigration++
            }
          } catch (error) {
            // Skip problematic files for dry run
          }
        }
        
        spinner.succeed('Analysis complete')
        
        console.log(`\\nMigration Preview:`)
        console.log(`- Files found: ${files.length}`)
        console.log(`- Need migration: ${needsMigration}`)
        console.log(`- Already migrated: ${alreadyMigrated}`)
        
        if (needsMigration > 0) {
          console.log(status.info(`Run without --dry-run to perform migration`))
        } else {
          console.log(status.success('All blueprints are already in v2.1.0 format'))
        }
        
      } else {
        // Perform actual migration
        const results = await migrator.migrateBlueprints(inputPath, outputPath, {
          force: options.force,
          verbose: options.verbose
        })
        
        spinner.succeed('Migration complete')
        
        console.log(`\\nResults:`)
        console.log(`- Processed: ${results.processed}`)
        console.log(`- Migrated: ${results.migrated}`)
        console.log(`- Skipped: ${results.skipped}`)
        console.log(`- Errors: ${results.errors}`)
        
        if (results.migrated > 0) {
          console.log(status.success(`${results.migrated} blueprints migrated to v2.1.0`))
          console.log(status.info(`Run ${colors.primary('vdk validate --path ' + outputPath)} to verify migrations`))
        }
        
        if (results.errors > 0) {
          console.log(status.warning(`${results.errors} files had errors during migration`))
          if (options.verbose) {
            results.files
              .filter(f => f.error)
              .forEach(f => console.log(`  ${status.error('✗')} ${f.file}: ${f.error}`))
          }
        }
      }

    } catch (error) {
      console.error(boxes.error(`Schema migration failed: ${error.message}`))
      process.exit(1)
    }
  })

// Enhanced repository commands for schema v2.1.0
program
  .command('search')
  .description('Search VDK-Blueprints repository using AI Context Schema v2.1.0 metadata')
  .option('-q, --query <text>', 'Search query for name/title/description')
  .option('-p, --platform <platform>', 'Filter by platform compatibility (claude-code, cursor, windsurf, etc.)')
  .option('-c, --category <category>', 'Filter by category (core, language, technology, etc.)')
  .option('--complexity <level>', 'Filter by complexity (simple, medium, complex)')
  .option('--scope <scope>', 'Filter by scope (file, component, feature, project, system)')
  .option('--audience <audience>', 'Filter by audience (developer, architect, team-lead, etc.)')
  .option('--maturity <maturity>', 'Filter by maturity (experimental, beta, stable, deprecated)')
  .option('--tags <tags...>', 'Filter by tags (space-separated)')
  .option('--limit <number>', 'Limit number of results', '20')
  .option('-v, --verbose', 'Show detailed blueprint information', false)
  .action(async (options) => {
    try {
      console.log(headers.section('Blueprint Search'))
      
      const criteria = {}
      if (options.query) criteria.query = options.query
      if (options.platform) criteria.platform = options.platform
      if (options.category) criteria.category = options.category
      if (options.complexity) criteria.complexity = options.complexity
      if (options.scope) criteria.scope = options.scope
      if (options.audience) criteria.audience = options.audience
      if (options.maturity) criteria.maturity = options.maturity
      if (options.tags) criteria.tags = options.tags

      console.log('Search criteria:', Object.keys(criteria).length > 0 ? criteria : 'All blueprints')
      
      const results = await searchBlueprints(criteria)
      const limitedResults = results.slice(0, parseInt(options.limit))
      
      if (limitedResults.length === 0) {
        console.log(status.warning('No blueprints found matching your criteria'))
        return
      }

      const searchTable = tables.basic()
      searchTable.push([
        colors.primary('Name'),
        colors.primary('Title'),
        colors.primary('Category'),
        colors.primary('Complexity'),
        colors.primary('Maturity'),
        colors.primary('Platforms')
      ])

      limitedResults.forEach(blueprint => {
        const platforms = Object.keys(blueprint.platforms)
          .filter(p => blueprint.platforms[p].compatible)
          .slice(0, 3)
          .join(', ')
        
        searchTable.push([
          blueprint.metadata.name || 'Unknown',
          (blueprint.metadata.title || blueprint.metadata.name || 'Untitled').substring(0, 30),
          blueprint.metadata.category || 'Unknown',
          blueprint.complexity || 'Unknown',
          blueprint.maturity || 'Unknown',
          platforms + (Object.keys(blueprint.platforms).length > 3 ? '...' : '')
        ])
      })

      console.log(searchTable.toString())
      console.log(`\nFound ${results.length} blueprints${results.length > parseInt(options.limit) ? ` (showing ${options.limit})` : ''}`)

      if (options.verbose && limitedResults.length > 0) {
        console.log('\n' + status.info('Use --verbose with specific blueprint name for detailed info'))
      }

    } catch (error) {
      console.error(boxes.error(`Search failed: ${error.message}`))
      process.exit(1)
    }
  })

program
  .command('repo-stats')
  .description('Show VDK-Blueprints repository statistics and schema v2.1.0 compliance')
  .action(async () => {
    try {
      console.log(headers.section('VDK-Blueprints Repository Statistics'))
      
      const stats = await getBlueprintStatistics()
      
      console.log(`\n📊 Repository Overview:`)
      console.log(`- Total Blueprints: ${stats.total}`)
      console.log(`- Schema v2.1.0 Valid: ${stats.valid} (${Math.round(stats.valid/stats.total*100)}%)`)
      console.log(`- Invalid: ${stats.invalid}`)
      
      if (Object.keys(stats.byCategory).length > 0) {
        console.log(`\n📂 By Category:`)
        Object.entries(stats.byCategory)
          .sort(([,a], [,b]) => b - a)
          .forEach(([category, count]) => {
            console.log(`- ${category}: ${count}`)
          })
      }
      
      if (Object.keys(stats.byComplexity).length > 0) {
        console.log(`\n⚙️ By Complexity:`)
        Object.entries(stats.byComplexity)
          .sort(([,a], [,b]) => b - a)
          .forEach(([complexity, count]) => {
            console.log(`- ${complexity}: ${count}`)
          })
      }
      
      if (Object.keys(stats.byMaturity).length > 0) {
        console.log(`\n🎯 By Maturity:`)
        Object.entries(stats.byMaturity)
          .sort(([,a], [,b]) => b - a)
          .forEach(([maturity, count]) => {
            console.log(`- ${maturity}: ${count}`)
          })
      }
      
      console.log(`\n🔗 Relationships:`)
      console.log(`- With Dependencies: ${stats.relationships.withDependencies}`)
      console.log(`- With Conflicts: ${stats.relationships.withConflicts}`)
      
      if (Object.keys(stats.platformSupport).length > 0) {
        console.log(`\n🎮 Platform Support (Top 10):`)
        Object.entries(stats.platformSupport)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .forEach(([platform, count]) => {
            console.log(`- ${platform}: ${count}`)
          })
      }

    } catch (error) {
      console.error(boxes.error(`Failed to fetch repository statistics: ${error.message}`))
      process.exit(1)
    }
  })

program
  .command('analyze')
  .description('Analyze blueprint dependencies and relationships')
  .argument('<blueprint-id>', 'Blueprint ID to analyze')
  .action(async (blueprintId) => {
    try {
      console.log(headers.section(`Blueprint Analysis: ${blueprintId}`))
      
      const analysis = await analyzeBlueprintDependencies(blueprintId)
      
      console.log(`\n📋 Blueprint: ${analysis.blueprint.title || analysis.blueprint.name}`)
      console.log(`Description: ${analysis.blueprint.description}`)
      console.log(`Category: ${analysis.blueprint.category}`)
      console.log(`Complexity: ${analysis.blueprint.complexity}`)
      console.log(`Maturity: ${analysis.blueprint.maturity}`)
      
      if (analysis.dependencies.required.length > 0) {
        console.log(`\n✅ Required Dependencies:`)
        analysis.dependencies.required.forEach(dep => {
          console.log(`- ${dep.name}: ${dep.title || dep.description}`)
        })
      }
      
      if (analysis.dependencies.suggested.length > 0) {
        console.log(`\n💡 Suggested Dependencies:`)
        analysis.dependencies.suggested.forEach(dep => {
          console.log(`- ${dep.name}: ${dep.title || dep.description}`)
        })
      }
      
      if (analysis.dependencies.missing.length > 0) {
        console.log(`\n❌ Missing Dependencies:`)
        analysis.dependencies.missing.forEach(depId => {
          console.log(`- ${depId} (not found in repository)`)
        })
      }
      
      if (analysis.conflicts.length > 0) {
        console.log(`\n⚠️  Conflicts With:`)
        analysis.conflicts.forEach(conflict => {
          console.log(`- ${conflict.name}: ${conflict.title || conflict.description}`)
        })
      }
      
      if (analysis.superseded.length > 0) {
        console.log(`\n🔄 Supersedes:`)
        analysis.superseded.forEach(superseded => {
          console.log(`- ${superseded.name}: ${superseded.title || superseded.description}`)
        })
      }

    } catch (error) {
      console.error(boxes.error(`Analysis failed: ${error.message}`))
      process.exit(1)
    }
  })

program
  .command('platform')
  .description('List blueprints compatible with specific platform')
  .argument('<platform>', 'Platform identifier (claude-code, cursor, windsurf, zed, vscode, etc.)')
  .option('--limit <number>', 'Limit number of results', '20')
  .action(async (platform, options) => {
    try {
      console.log(headers.section(`Blueprints for ${platform}`))
      
      const blueprints = await getBlueprintsForPlatform(platform)
      const limitedBlueprints = blueprints.slice(0, parseInt(options.limit))
      
      if (limitedBlueprints.length === 0) {
        console.log(status.warning(`No blueprints found compatible with ${platform}`))
        return
      }

      const platformTable = tables.basic()
      platformTable.push([
        colors.primary('Name'),
        colors.primary('Title'),
        colors.primary('Category'),
        colors.primary('Platform Config')
      ])

      limitedBlueprints.forEach(blueprint => {
        const config = blueprint.platformConfig
        let configSummary = 'Basic'
        
        if (config.globs) configSummary += ', Globs'
        if (config.characterLimit) configSummary += ', CharLimit'
        if (config.priority) configSummary += `, P${config.priority}`
        if (config.memory) configSummary += ', Memory'
        if (config.command) configSummary += ', Commands'
        
        platformTable.push([
          blueprint.name || 'Unknown',
          (blueprint.title || blueprint.name || 'Untitled').substring(0, 30),
          blueprint.category || 'Unknown',
          configSummary
        ])
      })

      console.log(platformTable.toString())
      console.log(`\nFound ${blueprints.length} compatible blueprints${blueprints.length > parseInt(options.limit) ? ` (showing ${options.limit})` : ''}`)

    } catch (error) {
      console.error(boxes.error(`Platform query failed: ${error.message}`))
      process.exit(1)
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
