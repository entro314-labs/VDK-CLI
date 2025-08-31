/**
 * VDK Project Scanner
 * Core logic for analyzing a codebase to generate custom rules.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import chalk from 'chalk'
import ora from 'ora'

import { createIntegrationManager } from '../integrations/index.js'
import {
  displaySelectionSummary,
  getCategoryFilter,
  selectCategoriesInteractively,
} from '../utils/category-selector.js'
import { PatternDetector } from './core/PatternDetector.js'
import { ProjectScanner } from './core/ProjectScanner.js'
import { RuleGenerator } from './core/RuleGenerator.js'
import { TechnologyAnalyzer } from './core/TechnologyAnalyzer.js'
import { GitIgnoreParser } from './utils/gitignore-parser.js'
import { RuleValidator } from './utils/validator.js'

/**
 * Orchestrates the project scanning process.
 * @param {object} options - The configuration options for the scanner.
 * @param {string} options.projectPath - Path to the project to scan.
 * @param {string} options.outputPath - Path where generated rules should be saved.
 * @param {boolean} options.deep - Enable deep scanning.
 * @param {string[]} options.ignorePattern - Glob patterns to ignore.
 * @param {boolean} options.useGitignore - Automatically parse .gitignore files.
 * @param {string} options.template - The name of the rule template to use.
 * @param {boolean} options.overwrite - Overwrite existing rule files.
 * @param {boolean} options.verbose - Enable verbose logging.
 * @param {boolean} options.ideIntegration - Enable IDE integration.
 * @param {boolean} options.watch - Enable watch mode for IDE integration.
 */
export async function runScanner(options) {
  const spinner = ora({ text: 'Starting project analysis...', color: 'cyan' }).start()

  try {
    const projectPath = path.resolve(options.projectPath)
    const outputPath = path.resolve(projectPath, options.outputPath)

    spinner.text = 'Parsing ignore patterns...'
    let ignorePatterns = options.ignorePattern || []
    if (options.useGitignore) {
      try {
        const gitignorePatterns = await GitIgnoreParser.parseGitIgnore(projectPath)
        ignorePatterns = [...ignorePatterns, ...gitignorePatterns]
        if (options.verbose && gitignorePatterns.length > 0) {
          spinner.info(`Successfully parsed .gitignore file with ${gitignorePatterns.length} patterns.`)
        }
      } catch (error) {
        spinner.warn('Could not parse .gitignore file. Proceeding without it.')
        if (options.verbose) {
          console.warn(`GitIgnore parse error: ${error.message}`)
        }
      }
    }

    spinner.text = 'Scanning project files...'
    const scanner = new ProjectScanner({
      projectPath,
      ignorePatterns,
      useGitIgnore: options.useGitignore,
      deepScan: options.deep,
      verbose: options.verbose,
    })
    const projectData = await scanner.scanProject(projectPath)
    spinner.succeed(`Project scan completed in ${projectData.scanDuration}ms`)

    spinner.text = 'Analyzing files...'
    const files = projectData.files
    spinner.succeed(`Found ${files.length} files to analyze.`)

    spinner.text = 'Analyzing technology stack...'
    const techAnalyzer = new TechnologyAnalyzer({ verbose: options.verbose })
    const techData = await techAnalyzer.analyzeTechnologies(projectData)
    const techSummary = [
      ...new Set([...(techData.frameworks || []), ...(techData.primaryLanguages || []), ...(techData.stacks || [])]),
    ]
      .filter(Boolean)
      .join(', ')
    spinner.succeed(`Detected technologies: ${techSummary || 'N/A'}`)

    spinner.text = 'Detecting code patterns...'
    const patternDetector = new PatternDetector({
      verbose: options.verbose,
      sampleSize: options.deep ? 100 : 50,
    })
    const patterns = await patternDetector.detectPatterns(projectData, techData)
    spinner.succeed('Code patterns detected.')

    spinner.text = 'Generating AI rules...'
    const ruleGenerator = new RuleGenerator(outputPath, options.template, options.overwrite, {
      verbose: options.verbose,
      projectPath,
    })
    const analysisData = {
      projectStructure: {
        root: projectPath,
        files,
        directories: projectData.directories,
        fileCount: files.length,
        directoryCount: projectData.directories?.length || 0,
        fileTypes: projectData.fileTypes,
      },
      technologyData: techData,
      patterns,
      outputPath,
    }

    // Handle category selection for command fetching
    let categoryFilter = null
    if (options.interactive) {
      spinner.stop() // Stop spinner for interactive input
      categoryFilter = await selectCategoriesInteractively(analysisData)
      displaySelectionSummary(categoryFilter, analysisData)
      spinner.start('Generating AI rules with selected categories...')
    } else {
      categoryFilter = getCategoryFilter(options, analysisData)
      if (categoryFilter && options.verbose) {
        console.log(chalk.cyan(`🎯 Using category filter: ${categoryFilter.preset || 'custom'}`))
      }
    }

    const ruleResults = await ruleGenerator.generateIDESpecificRules(analysisData, categoryFilter)
    spinner.succeed('AI rules generated successfully.')

    // Extract file paths from the results for display
    let generatedFiles = []
    if (ruleResults?.generatedRules) {
      for (const [_integrationName, rules] of Object.entries(ruleResults.generatedRules)) {
        if (rules?.files) {
          generatedFiles = generatedFiles.concat(rules.files)
        }
      }
    }

    // Only validate traditional rule files if they were generated
    const rulesDirectoryExists = await fs
      .access(outputPath)
      .then(() => true)
      .catch(() => false)
    if (rulesDirectoryExists) {
      spinner.text = 'Validating generated rules...'
      const validator = new RuleValidator({ verbose: options.verbose })
      await validator.validateRuleDirectory(outputPath)
      spinner.succeed('All generated rules are valid.')
    } else {
      // Skip validation for IDE-specific file generation (like Claude Code CLI memory files)
      if (options.verbose) {
        console.log(chalk.gray('Skipping traditional rule validation - using IDE-specific file generation'))
      }
    }

    let initializedIDEs = []
    let ideIntegration = null

    if (options.ideIntegration) {
      spinner.text = 'Setting up IDE integration...'
      try {
        ideIntegration = createIntegrationManager(projectPath)

        // Discover and register integrations
        await ideIntegration.discoverIntegrations({ verbose: options.verbose })

        // Scan for active integrations
        await ideIntegration.scanAll({ verbose: options.verbose })

        // Initialize active integrations
        const initResults = await ideIntegration.initializeActive({ verbose: options.verbose })

        // Get the list of successfully initialized integrations
        initializedIDEs = initResults.successful.map((result) => result.name)

        if (initializedIDEs.length > 0) {
          console.log(chalk.green(`IDE integrations initialized: ${initializedIDEs.join(', ')}`))

          // Provide user guidance for Claude Code CLI integration
          if (
            initializedIDEs.includes('Claude Code CLI') &&
            !options.interactive &&
            !options.categories &&
            options.preset === 'auto'
          ) {
            console.log(chalk.cyan('\n💡 Claude Code CLI detected! You can customize command selection:'))
            console.log(chalk.gray('   • Use --interactive for guided category selection'))
            console.log(chalk.gray('   • Use --preset development for development-focused commands'))
            console.log(chalk.gray('   • Use --categories development,quality for specific categories'))
            console.log(chalk.gray('   • Use --help to see all options'))
          }
        } else {
          console.log(chalk.yellow('No IDE integrations detected, using generic setup'))
          initializedIDEs = ['generic']
        }

        spinner.succeed('IDE integration setup complete.')
      } catch (error) {
        spinner.fail(`IDE integration setup failed: ${error.message}`)
        if (options.verbose) {
          console.error(chalk.red(error.stack))
        }
      }
    }

    console.log(`\n${chalk.green('✅ Project scanning completed successfully!')}`)
    console.log(chalk.green('Generated blueprint files:'))
    if (generatedFiles && Array.isArray(generatedFiles)) {
      generatedFiles.forEach((file) => {
        const filePath = typeof file === 'string' ? file : file.path || '[unknown file]'
        console.log(chalk.green(`- ${filePath}`))
      })
    } else {
      console.log(chalk.green(`- Blueprints saved to ${outputPath}`))
    }

    console.log(`\n${chalk.cyan('Next steps:')}`)
    console.log(chalk.cyan('1. Review the generated blueprints in your editor'))
    console.log(chalk.cyan('2. Customize any specific details as needed'))
    console.log(chalk.cyan('3. Activate the blueprints in your AI assistant\n'))

    return {
      projectName: path.basename(projectPath),
      initializedIDEs,
      detectedPrimaryIDE: ideIntegration?.getPrimaryIDE()?.name || null,
      generatedFiles,
      ideIntegration,
    }
  } catch (error) {
    spinner.fail(chalk.red(`An error occurred during scanning: ${error.message}`))
    if (options.verbose && error.stack) {
      console.error(chalk.gray('\nStack trace:'))
      console.error(chalk.gray(error.stack))
    }
    // Re-throw the error so the caller (cli.js) can handle it
    throw error
  }
}
