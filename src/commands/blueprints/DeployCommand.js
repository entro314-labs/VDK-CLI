/**
 * DeployCommand
 * -----------------------
 * Deploy blueprints to your project from community or repository sources.
 * Handles both community rules and repository blueprints with preview functionality.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import chalk from 'chalk'

export class DeployCommand extends BaseCommand {
  constructor() {
    super('deploy', 'Deploy blueprints to your project')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .argument('[blueprint-id]', 'Blueprint or rule ID to deploy (e.g., rule:abc123, nextjs-patterns)')
      .option('-p, --project-path <path>', 'Path to the project', process.cwd())
      .option('--preview', 'Preview deployment without applying changes', false)
      .option('--allow-major-changes', 'Allow significant adaptations for compatibility', false)
      .option('--source <source>', 'Source: community, repository, or auto', 'auto')
      .option('-v, --verbose', 'Enable verbose output', false)
  }

  /**
   * Execute the deploy command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    const blueprintId = options.args?.[0]

    // If no blueprint ID provided, show usage guide
    if (!blueprintId) {
      this.showUsageGuide()
      return
    }

    // Determine deployment source
    const isCommunityRule = blueprintId.startsWith('rule:') || options.source === 'community'
    const isRepositoryBlueprint = !isCommunityRule && (options.source === 'repository' || options.source === 'auto')

    if (isCommunityRule || options.source === 'community') {
      return await this.deployCommunity(blueprintId, options)
    } else if (isRepositoryBlueprint) {
      return await this.deployRepository(blueprintId, options)
    }
  }

  /**
   * Show deployment usage guide
   */
  showUsageGuide() {
    console.log('')
    console.log(this.colorCyan('📋 Deploy Options:'))
    console.log('')
    console.log('1. Deploy Community Blueprint:')
    console.log(`   ${this.colorPrimary('vdk deploy rule:abc123')}     # Deploy community rule by ID`)
    console.log(`   ${this.colorPrimary('vdk deploy nextjs-patterns')} # Deploy by name or slug`)
    console.log('')
    console.log('2. Deploy Repository Blueprint:')
    console.log(`   ${this.colorPrimary('vdk deploy typescript-strict')} # Deploy from VDK-Blueprints repository`)
    console.log('')
    console.log('3. Browse Available Blueprints:')
    console.log(`   ${this.colorPrimary('vdk browse')}              # Browse repository blueprints`)
    console.log(`   ${this.colorPrimary('vdk browse --community')}   # Browse community blueprints`)
    console.log(`   ${this.colorPrimary('vdk browse --trending')}    # Browse trending blueprints`)
    console.log('')
    console.log('4. Preview Before Deploying:')
    console.log(`   ${this.colorPrimary('vdk deploy rule:abc123 --preview')} # See what would be deployed`)
    console.log('')
  }

  /**
   * Deploy community blueprint
   */
  async deployCommunity(blueprintId, options) {
    try {
      const { CommunityDeployer } = await import('../../community/CommunityDeployer.js')
      const deployer = new CommunityDeployer(options.projectPath || process.cwd())

      const normalizedId = blueprintId.startsWith('rule:') ? blueprintId.slice(5) : blueprintId

      if (options.preview) {
        return await this.previewCommunityDeployment(deployer, normalizedId)
      }

      const result = await deployer.deploy(normalizedId, {
        allowMajorChanges: options.allowMajorChanges,
        verbose: options.verbose,
      })

      console.log('')
      this.logSuccess(`✅ Deployed: ${result.blueprintTitle}`)
      this.logInfo(`📊 Compatibility: ${result.compatibilityScore}/10`)
      this.logInfo(`🚀 Applied to: ${result.platforms.join(', ')}`)

      return result
    } catch (error) {
      this.exitWithError(`Community deployment failed: ${error.message}`, error)
    }
  }

  /**
   * Preview community deployment
   */
  async previewCommunityDeployment(deployer, blueprintId) {
    const preview = await deployer.previewDeployment(blueprintId)

    console.log('')
    console.log(this.colorCyan('📋 Community Blueprint Preview:'))
    console.log(`Blueprint: ${preview.blueprint.title} by @${preview.blueprint.author || 'community'}`)
    console.log(`Description: ${preview.blueprint.description || 'No description'}`)
    console.log(`Project Context: ${preview.projectContext}`)
    console.log(`Compatibility: ${preview.adaptationPlan.compatibilityScore}/10`)
    console.log(`Estimated Files: ${preview.estimatedFiles}`)

    if (preview.adaptationPlan.changes.length > 0) {
      console.log('')
      console.log(this.colorCyan('Planned Adaptations:'))
      preview.adaptationPlan.changes.forEach((change) => {
        console.log(`  • ${change.description}`)
      })
    }

    if (preview.adaptationPlan.warnings.length > 0) {
      console.log('')
      console.log(chalk.yellow('Warnings:'))
      preview.adaptationPlan.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  ⚠️  ${warning}`))
      })
    }

    console.log('')
    console.log(this.colorPrimary('Run without --preview to deploy'))

    return preview
  }

  /**
   * Deploy repository blueprint
   */
  async deployRepository(blueprintId, options) {
    try {
      const { fetchBlueprintsWithMetadata, searchBlueprints } = await import('../../blueprints-client.js')

      const spinner = this.createSpinner(`Looking for blueprint: ${blueprintId}`)
      spinner.start()

      // Search for blueprint by ID or name
      const searchResults = await searchBlueprints({ query: blueprintId, exactMatch: true })
      let blueprint = searchResults.find(
        (b) => b.metadata.id === blueprintId || b.metadata.title?.toLowerCase().includes(blueprintId.toLowerCase())
      )

      if (!blueprint && searchResults.length > 0) {
        blueprint = searchResults[0] // Take first fuzzy match
        spinner.warn(`Exact match not found, using: ${blueprint.metadata.title}`)
      } else if (!blueprint) {
        spinner.fail(`Blueprint '${blueprintId}' not found`)
        console.log('')
        this.logInfo('💡 Try:')
        this.logInfo('   vdk browse --category <category>')
        this.logInfo('   vdk browse --community')
        return
      } else {
        spinner.succeed(`Found: ${blueprint.metadata.title}`)
      }

      if (options.preview) {
        return await this.previewRepositoryDeployment(blueprint)
      }

      return await this.executeRepositoryDeployment(blueprint, options)
    } catch (error) {
      this.exitWithError(`Repository deployment failed: ${error.message}`, error)
    }
  }

  /**
   * Preview repository deployment
   */
  async previewRepositoryDeployment(blueprint) {
    console.log('')
    console.log(this.colorCyan('📋 Repository Blueprint Preview:'))
    console.log(`Title: ${blueprint.metadata.title}`)
    console.log(`Description: ${blueprint.metadata.description || 'No description'}`)
    console.log(`Category: ${blueprint.metadata.category || 'General'}`)
    console.log(`Complexity: ${blueprint.metadata.complexity || 'Unknown'}`)

    if (blueprint.platforms) {
      const platforms = Object.keys(blueprint.platforms).filter((p) => blueprint.platforms[p]?.compatible)
      console.log(`Platforms: ${platforms.join(', ') || 'All'}`)
    }

    console.log('')
    console.log(this.colorPrimary('Run without --preview to deploy'))

    return { preview: true, blueprint }
  }

  /**
   * Execute repository deployment
   */
  async executeRepositoryDeployment(blueprint, options) {
    // Deploy using existing integration system
    const { createIntegrationManager } = await import('../../integrations/index.js')
    const integrationManager = createIntegrationManager(options.projectPath || process.cwd())

    await integrationManager.discoverIntegrations({ verbose: options.verbose })
    await integrationManager.scanAll({ verbose: options.verbose })

    const rules = [
      {
        id: blueprint.metadata.id,
        title: blueprint.metadata.title,
        content: blueprint.content,
        metadata: blueprint.metadata,
      },
    ]

    const deployResult = await integrationManager.initializeActive({
      rules: rules,
      overwrite: true,
      verbose: options.verbose,
    })

    const platforms = integrationManager.getActiveIntegrations?.()?.map((i) => i.name) || ['deployed']

    console.log('')
    this.logSuccess(`✅ Deployed: ${blueprint.metadata.title}`)
    this.logInfo(`🚀 Applied to: ${platforms.join(', ')}`)

    if (deployResult.errors && deployResult.errors.length > 0) {
      console.log('')
      console.log(chalk.yellow('Warnings:'))
      deployResult.errors.forEach((error) => {
        console.log(chalk.yellow(`  ⚠️  ${error}`))
      })
    }

    return deployResult
  }
}
