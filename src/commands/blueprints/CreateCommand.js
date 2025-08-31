/**
 * CreateCommand
 * -----------------------
 * Create a new blueprint with AI Context Schema v2.1.0 structure.
 * Supports both interactive and non-interactive modes.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import path from 'node:path'
import fs from 'node:fs/promises'

export class CreateCommand extends BaseCommand {
  constructor() {
    super('create', 'Create a new blueprint with AI Context Schema v2.1.0 structure')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .option('-n, --name <name>', 'Blueprint name')
      .option('-t, --title <title>', 'Blueprint title')
      .option('-d, --description <description>', 'Blueprint description')
      .option('-c, --category <category>', 'Blueprint category', 'tool')
      .option('-a, --author <author>', 'Blueprint author')
      .option('--tags <tags...>', 'Blueprint tags (space-separated)')
      .option('--complexity <level>', 'Complexity level (simple, medium, complex)', 'medium')
      .option('--scope <scope>', 'Impact scope (file, component, feature, project, system)', 'project')
      .option(
        '--audience <audience>',
        'Target audience (developer, architect, team-lead, junior, senior, any)',
        'developer'
      )
      .option('--maturity <level>', 'Maturity level (experimental, beta, stable, deprecated)', 'beta')
      .option('-o, --output <path>', 'Output file path', './.vdk/rules')
      .option('--interactive', 'Interactive blueprint creation', false)
  }

  /**
   * Execute the create command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    try {
      let blueprintData = {}

      if (options.interactive) {
        blueprintData = await this.createInteractive()
      } else {
        blueprintData = await this.createFromOptions(options)
      }

      const filePath = await this.writeBlueprintFile(blueprintData, options.output)

      this.logSuccess(`Blueprint created: ${this.formatPath(filePath)}`)
      this.logInfo(`Run ${this.colorPrimary('vdk validate --file ' + filePath)} to validate the blueprint`)

      this.trackSuccess({
        blueprintName: blueprintData.name,
        interactive: options.interactive,
        category: blueprintData.category,
      })

      return { success: true, filePath, blueprintData }
    } catch (error) {
      this.exitWithError(`Blueprint creation failed: ${error.message}`, error)
    }
  }

  /**
   * Interactive blueprint creation
   */
  async createInteractive() {
    const { select, input, multiselect, confirm } = await import('@clack/prompts')

    const blueprintData = {}

    blueprintData.name = await input({
      message: 'Blueprint name (kebab-case):',
      placeholder: 'my-awesome-blueprint',
      validate: (value) => {
        if (!value) return 'Name is required'
        if (!/^[a-z0-9-]+$/.test(value)) return 'Name must be kebab-case (lowercase, hyphens only)'
        return undefined
      },
    })

    blueprintData.title = await input({
      message: 'Blueprint title:',
      placeholder: 'My Awesome Blueprint',
    })

    blueprintData.description = await input({
      message: 'Description:',
      placeholder: 'A brief description of what this blueprint does',
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
      ],
    })

    blueprintData.complexity = await select({
      message: 'Complexity level:',
      options: [
        { value: 'simple', label: 'Simple' },
        { value: 'medium', label: 'Medium' },
        { value: 'complex', label: 'Complex' },
      ],
    })

    blueprintData.scope = await select({
      message: 'Impact scope:',
      options: [
        { value: 'file', label: 'File' },
        { value: 'component', label: 'Component' },
        { value: 'feature', label: 'Feature' },
        { value: 'project', label: 'Project' },
        { value: 'system', label: 'System' },
      ],
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
      ],
    })

    blueprintData.maturity = await select({
      message: 'Maturity level:',
      options: [
        // biome-ignore lint/nursery/noSecrets: These are legitimate option labels
        { value: 'experimental', label: 'Experimental' },
        { value: 'beta', label: 'Beta' },
        { value: 'stable', label: 'Stable' },
        { value: 'deprecated', label: 'Deprecated' },
      ],
    })

    const tagsInput = await input({
      message: 'Tags (comma-separated):',
      placeholder: 'javascript, react, typescript',
    })
    blueprintData.tags = tagsInput ? tagsInput.split(',').map((t) => t.trim().toLowerCase()) : []

    blueprintData.author = await input({
      message: 'Author:',
      placeholder: 'Your name or organization',
    })

    const addPlatforms = await confirm({
      message: 'Configure platform-specific settings?',
      initialValue: false,
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
        ],
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

    return blueprintData
  }

  /**
   * Create blueprint from command line options
   */
  async createFromOptions(options) {
    if (!options.name) {
      this.exitWithError('Blueprint name is required. Use --name or --interactive')
    }

    return {
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
      },
    }
  }

  /**
   * Generate blueprint file content
   */
  generateBlueprintContent(blueprintData) {
    // Add required fields
    const completeData = {
      ...blueprintData,
      id: blueprintData.name,
      version: '1.0.0',
      created: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      lastUpdated: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    }

    // Create frontmatter
    const frontmatter = Object.keys(completeData)
      .map((key) => {
        const value = completeData[key]
        if (Array.isArray(value)) {
          return `${key}: [${value.map((v) => `"${v}"`).join(', ')}]`
        } else if (typeof value === 'object' && value !== null) {
          return `${key}:\n${JSON.stringify(value, null, 2)
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n')}`
        } else {
          return `${key}: "${value}"`
        }
      })
      .join('\n')

    return `---
${frontmatter}
---

# ${completeData.title}

## Description

${completeData.description}

## Implementation

Add your implementation details here...

## Usage

Describe how to use this blueprint...

## Examples

Provide examples of the blueprint in action...

---

*Generated with VDK CLI - AI Context Schema v2.1.0*
`
  }

  /**
   * Write blueprint file to disk
   */
  async writeBlueprintFile(blueprintData, outputPath) {
    const resolvedOutputPath = path.resolve(outputPath)
    await fs.mkdir(resolvedOutputPath, { recursive: true })

    const filePath = path.join(resolvedOutputPath, `${blueprintData.name}.mdc`)
    const content = this.generateBlueprintContent(blueprintData)

    await fs.writeFile(filePath, content)

    return filePath
  }
}
