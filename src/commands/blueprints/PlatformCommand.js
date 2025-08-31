/**
 * PlatformCommand
 * -----------------------
 * List blueprints compatible with specific platform.
 * Shows platform-specific configuration and compatibility details.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { colors, tables } from '../../utils/cli-styles.js'

export class PlatformCommand extends BaseCommand {
  constructor() {
    super('platform', 'List blueprints compatible with specific platform')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .argument('<platform>', 'Platform identifier (claude-code, cursor, windsurf, zed, vscode, etc.)')
      .option('--limit <number>', 'Limit number of results', '20')
      .option('-v, --verbose', 'Show detailed platform configuration', false)
  }

  /**
   * Execute the platform command
   */
  async execute(options) {
    await commandContext.initialize()

    const platform = options.args?.[0]
    if (!platform) {
      this.exitWithError('Platform argument is required. Use --help for usage information')
    }

    this.showHeader(`Blueprints for ${platform}`)

    try {
      const { getBlueprintsForPlatform } = await import('../../blueprints-client.js')

      const spinner = this.createSpinner(`Finding blueprints for ${platform}...`)
      spinner.start()

      const blueprints = await getBlueprintsForPlatform(platform)
      const limitedBlueprints = blueprints.slice(0, parseInt(options.limit))

      spinner.succeed(`Found ${blueprints.length} compatible blueprints`)

      if (limitedBlueprints.length === 0) {
        this.logWarning(`No blueprints found compatible with ${platform}`)
        this.displaySuggestedPlatforms()
        return { blueprints: [], total: 0 }
      }

      this.displayPlatformBlueprints(limitedBlueprints, platform, options)
      this.displayResultsSummary(blueprints.length, options.limit)

      this.trackSuccess({
        platform,
        totalFound: blueprints.length,
        displayed: limitedBlueprints.length,
      })

      return { blueprints: limitedBlueprints, total: blueprints.length }
    } catch (error) {
      this.exitWithError(`Platform query failed: ${error.message}`, error)
    }
  }

  /**
   * Display platform-compatible blueprints
   */
  displayPlatformBlueprints(blueprints, platform, options) {
    const platformTable = tables.basic()

    // Table headers
    platformTable.push([
      this.colorPrimary('Name'),
      this.colorPrimary('Title'),
      this.colorPrimary('Category'),
      this.colorPrimary('Platform Config'),
    ])

    // Table rows
    blueprints.forEach((blueprint) => {
      const config = blueprint.platformConfig || {}
      const configSummary = this.buildConfigSummary(config)

      platformTable.push([
        blueprint.name || 'Unknown',
        (blueprint.title || blueprint.name || 'Untitled').substring(0, 30),
        blueprint.category || 'Unknown',
        configSummary,
      ])
    })

    console.log(platformTable.toString())

    // Verbose platform configuration details
    if (options.verbose) {
      this.displayVerboseConfigDetails(blueprints, platform)
    }
  }

  /**
   * Build configuration summary string
   */
  buildConfigSummary(config) {
    let configSummary = 'Basic'

    if (config.globs) configSummary += ', Globs'
    if (config.characterLimit) configSummary += ', CharLimit'
    if (config.priority) configSummary += `, P${config.priority}`
    if (config.memory) configSummary += ', Memory'
    if (config.command) configSummary += ', Commands'
    if (config.fileExtensions) configSummary += ', FileExt'
    if (config.contextAware) configSummary += ', Context'

    return configSummary
  }

  /**
   * Display verbose configuration details
   */
  displayVerboseConfigDetails(blueprints, platform) {
    console.log('\n' + this.colorCyan('🔍 Platform Configuration Details:'))

    blueprints.slice(0, 5).forEach((blueprint, index) => {
      const config = blueprint.platformConfig || {}

      console.log(`\n${index + 1}. ${blueprint.title || blueprint.name}`)

      if (config.characterLimit) {
        console.log(`   Character Limit: ${config.characterLimit}`)
      }

      if (config.priority) {
        console.log(`   Priority: ${config.priority}`)
      }

      if (config.globs && config.globs.length > 0) {
        console.log(`   File Globs: ${config.globs.join(', ')}`)
      }

      if (config.fileExtensions && config.fileExtensions.length > 0) {
        console.log(`   File Extensions: ${config.fileExtensions.join(', ')}`)
      }

      if (config.memory) {
        console.log(`   Memory Settings: ${JSON.stringify(config.memory)}`)
      }

      if (config.contextAware) {
        console.log(`   Context Aware: ${config.contextAware}`)
      }
    })

    if (blueprints.length > 5) {
      console.log(`\n... and ${blueprints.length - 5} more blueprints`)
    }
  }

  /**
   * Display results summary
   */
  displayResultsSummary(totalFound, limit) {
    const limitInt = parseInt(limit)
    const summary = totalFound > limitInt ? ` (showing ${limit})` : ''

    console.log(`\nFound ${totalFound} compatible blueprints${summary}`)

    if (totalFound > limitInt) {
      console.log(this.colorCyan(`💡 Use --limit ${totalFound} to see all results`))
    }
  }

  /**
   * Display suggested platforms when none found
   */
  displaySuggestedPlatforms() {
    console.log('\n' + this.colorCyan('💡 Available Platforms:'))
    console.log('• claude-code   - Claude Code IDE integration')
    console.log('• cursor        - Cursor AI editor')
    console.log('• windsurf      - Windsurf AI assistant')
    console.log('• zed           - Zed editor')
    console.log('• vscode        - Visual Studio Code')
    console.log('• github-copilot - GitHub Copilot')
    console.log('• jetbrains     - JetBrains IDEs')
    console.log('• vim           - Vim/Neovim')
    console.log('')
    console.log(this.colorCyan('Use: vdk platform <platform-name>'))
  }
}
