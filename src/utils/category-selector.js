/**
 * Category Selection Utility
 * Provides interactive category selection for command fetching
 */

import { intro, multiselect, outro, select } from '@clack/prompts'
import chalk from 'chalk'

/**
 * Available command categories with descriptions
 */
export const COMMAND_CATEGORIES = {
  development: {
    name: 'Development',
    description: 'Core development tasks: bug fixes, migrations, project setup',
    commands: ['bug-fix', 'dependencies', 'integrate', 'migrate', 'onboard', 'project-setup', 'prototype'],
    essential: true,
  },
  quality: {
    name: 'Quality & Testing',
    description: 'Code quality, debugging, refactoring, and testing',
    commands: [
      'benchmark',
      'clean',
      'debug',
      'health-check',
      'perf',
      'refactor',
      'review',
      'standardize',
      'tdd',
      'technical-debt',
      'validate',
    ],
    essential: true,
  },
  workflow: {
    name: 'Workflow & CI/CD',
    description: 'Git workflows, deployment, monitoring, and coordination',
    commands: [
      'ci-gen',
      'commit',
      'coordinate',
      'deploy',
      'git-workflow',
      'monitor',
      'parallel',
      'plan',
      'pr',
      'release',
    ],
    essential: false,
  },
  meta: {
    name: 'Documentation & Analysis',
    description: 'Documentation, research, visualization, and API management',
    commands: ['api', 'changelog', 'diagram', 'document', 'explain', 'research', 'summary', 'visualize'],
    essential: false,
  },
  security: {
    name: 'Security',
    description: 'Security auditing and hardening',
    commands: ['audit', 'harden'],
    essential: false,
  },
}

/**
 * Predefined preset configurations
 */
export const PRESETS = {
  minimal: {
    name: 'Minimal',
    description: 'Essential commands for basic development',
    categories: ['development'],
    commands: ['bug-fix', 'integrate', 'project-setup', 'review', 'refactor'],
  },
  development: {
    name: 'Development Focus',
    description: 'Core development and quality commands',
    categories: ['development', 'quality'],
    commands: null, // null means all commands from categories
  },
  full: {
    name: 'Full Suite',
    description: 'All available commands',
    categories: ['development', 'quality', 'workflow', 'meta', 'security'],
    commands: null,
  },
  production: {
    name: 'Production Ready',
    description: 'Commands for production environments',
    categories: ['development', 'quality', 'workflow', 'security'],
    commands: null,
  },
  auto: {
    name: 'Auto (Smart Selection)',
    description: 'Automatically select based on project analysis',
    categories: [], // Will be determined dynamically
    commands: null,
  },
}

/**
 * Smart category selection based on project analysis
 */
export function getSmartCategories(projectContext) {
  const smartCategories = ['development'] // Always include development

  // Add quality if testing frameworks detected
  if (projectContext.techStack?.testingFrameworks?.length > 0) {
    smartCategories.push('quality')
  }

  // Add workflow if CI/CD indicators found
  if (
    projectContext.projectStructure?.hasCI ||
    projectContext.techStack?.libraries?.some(
      (lib) => lib.includes('github-actions') || lib.includes('gitlab-ci') || lib.includes('jenkins')
    )
  ) {
    smartCategories.push('workflow')
  }

  // Add security for production projects
  if (
    projectContext.techStack?.frameworks?.some(
      (fw) => fw.includes('next') || fw.includes('express') || fw.includes('fastapi')
    )
  ) {
    smartCategories.push('security')
  }

  // Add meta for documentation-heavy projects
  if (projectContext.projectStructure?.fileTypes?.md > 5) {
    smartCategories.push('meta')
  }

  return smartCategories
}

/**
 * Interactive category selection
 */
export async function selectCategoriesInteractively(projectContext) {
  intro(chalk.blue('🎯 VDK Command Category Selection'))

  // Check if this is a demo mode (when commands aren't actually available)
  const isDemoMode = !process.env.VDK_GITHUB_TOKEN || process.env.VDK_GITHUB_TOKEN.includes('expired')

  if (isDemoMode) {
    console.log(chalk.yellow('📋 Interactive Selection Demo (commands not available due to authentication)'))
    console.log(chalk.dim('This shows what the selection process would look like:\n'))
  }

  try {
    // Show project context
    if (projectContext.techStack) {
      console.log(chalk.green('📊 Detected Project Context:'))
      console.log(`   Language: ${projectContext.techStack.primaryLanguages?.join(', ') || 'Unknown'}`)
      console.log(`   Framework: ${projectContext.techStack.frameworks?.join(', ') || 'None detected'}`)
      console.log(`   Testing: ${projectContext.techStack.testingFrameworks?.join(', ') || 'None detected'}`)
      console.log('')
    }

    // Ask for selection method
    const method = await select({
      message: 'How would you like to select commands?',
      options: [
        { value: 'preset', label: 'Use a preset configuration (recommended)' },
        { value: 'categories', label: 'Select individual categories' },
        { value: 'auto', label: 'Use smart auto-selection' },
      ],
    })

    let result
    if (method === 'preset') {
      result = await selectPreset()
    } else if (method === 'categories') {
      result = await selectIndividualCategories()
    } else if (method === 'auto') {
      const smartCategories = getSmartCategories(projectContext)
      console.log(chalk.green(`🤖 Smart selection chose: ${smartCategories.join(', ')}`))
      result = { categories: smartCategories, preset: 'auto' }
    } else {
      console.log(chalk.yellow('Invalid choice, using auto-selection'))
      result = { categories: getSmartCategories(projectContext), preset: 'auto' }
    }

    outro(chalk.green('✅ Category selection complete!'))

    if (isDemoMode) {
      console.log(chalk.yellow('\n📋 Demo complete! To actually fetch commands:'))
      console.log(chalk.gray('   • Add a valid GitHub token to .env.local'))
      console.log(chalk.gray('   • Run vdk init --interactive again'))
    }

    return result
  } catch (error) {
    if (error.message === 'User cancelled') {
      outro(chalk.yellow('Operation cancelled'))
      process.exit(0)
    }
    throw error
  }
}

/**
 * Select a preset configuration
 */
async function selectPreset() {
  const presetOptions = Object.entries(PRESETS).map(([key, preset]) => ({
    value: key,
    label: `${preset.name} - ${preset.description}`,
    hint: preset.categories.length > 0 ? `Categories: ${preset.categories.join(', ')}` : 'Smart selection',
  }))

  const selectedPreset = await select({
    message: 'Choose a preset configuration:',
    options: presetOptions,
  })

  const preset = PRESETS[selectedPreset]
  console.log(chalk.green(`Selected preset: ${preset.name}`))

  return {
    categories: preset.categories,
    preset: selectedPreset,
    specificCommands: preset.commands,
  }
}

/**
 * Select individual categories
 */
async function selectIndividualCategories() {
  const categoryOptions = Object.entries(COMMAND_CATEGORIES).map(([key, category]) => ({
    value: key,
    label: `${category.name}${category.essential ? ' ⭐' : ''}`,
    hint: `${category.description} (${category.commands.length} commands)`,
  }))

  const selectedCategories = await multiselect({
    message: 'Select command categories:',
    options: categoryOptions,
    required: true,
  })

  if (!selectedCategories || selectedCategories.length === 0) {
    console.log(chalk.yellow('No categories selected, using development'))
    return {
      categories: ['development'],
      preset: 'custom',
    }
  }

  console.log(chalk.green(`Selected categories: ${selectedCategories.join(', ')}`))

  return {
    categories: selectedCategories,
    preset: 'custom',
  }
}

/**
 * Get category filter for repository fetching
 */
export function getCategoryFilter(options, _projectContext) {
  // If specific categories provided via CLI
  if (options.categories && options.categories.length > 0) {
    return {
      categories: options.categories,
      preset: 'custom',
    }
  }

  // If preset specified
  if (options.preset && options.preset !== 'auto' && PRESETS[options.preset]) {
    const preset = PRESETS[options.preset]
    return {
      categories: preset.categories,
      preset: options.preset,
      specificCommands: preset.commands,
    }
  }

  // Auto selection
  if (!options.interactive) {
    const smartCategories = getSmartCategories(options.projectContext || {})
    return {
      categories: smartCategories,
      preset: 'auto',
    }
  }

  // This will be handled by interactive selection
  return null
}

/**
 * Display selection summary
 */
export function displaySelectionSummary(selection, _projectContext) {
  console.log(chalk.blue('\n📋 Command Selection Summary:'))
  console.log(`   Preset: ${selection.preset}`)
  console.log(`   Categories: ${selection.categories.join(', ')}`)

  if (selection.specificCommands) {
    console.log(`   Specific Commands: ${selection.specificCommands.join(', ')}`)
  }

  const totalCommands = selection.categories.reduce((total, cat) => {
    return total + (COMMAND_CATEGORIES[cat]?.commands.length || 0)
  }, 0)

  console.log(`   Estimated Commands: ${selection.specificCommands?.length > 0 || totalCommands}`)
  console.log('')
}
