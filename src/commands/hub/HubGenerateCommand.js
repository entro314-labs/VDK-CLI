/**
 * HubGenerateCommand
 * -----------------------
 * Generate custom blueprint package from Hub based on technology stack.
 * Supports multiple output formats and custom requirements.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import fs from 'node:fs/promises'

export class HubGenerateCommand extends BaseCommand {
  constructor() {
    super('hub-generate', 'Generate custom blueprint package from Hub')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .option('--stack <stacks...>', 'Technology stacks (react, nextjs, typescript, etc.)')
      .option('--language <languages...>', 'Programming languages')
      .option('--tools <tools...>', 'Development tools (eslint, prettier, jest, etc.)')
      .option('--ai <assistants...>', 'AI assistants (claude-code, cursor, windsurf, etc.)')
      .option('--format <format>', 'Output format (bash, zip, config)', 'bash')
      .option('--requirements <text>', 'Custom requirements or preferences')
      .option('-o, --output <path>', 'Output file path')
      .option('-v, --verbose', 'Show detailed generation process', false)
  }

  /**
   * Execute the hub generate command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    try {
      const { quickHubOperations } = await import('../../hub/index.js')
      const hubOps = await quickHubOperations()

      const analysisData = this.buildAnalysisData(options)
      const generateOptions = this.buildGenerateOptions(options)

      if (options.verbose) {
        this.displayGenerationPlan(analysisData, generateOptions)
      }

      const packageResult = await this.generatePackage(hubOps, analysisData, generateOptions)

      if (options.output || options.format !== 'bash') {
        await this.downloadPackage(hubOps, packageResult, options)
      } else {
        this.displayDownloadInfo(packageResult)
      }

      this.trackSuccess({
        format: options.format,
        packageId: packageResult.packageId,
        ruleCount: packageResult.ruleCount,
        hasCustomRequirements: !!options.requirements,
      })

      return packageResult
    } catch (error) {
      this.exitWithError(`Package generation failed: ${error.message}`, error)
    }
  }

  /**
   * Build analysis data from options
   */
  buildAnalysisData(options) {
    return {
      frameworks: options.stack || [],
      languages: options.language || [],
      tools: options.tools || [],
      projectType: 'custom',
    }
  }

  /**
   * Build generation options
   */
  buildGenerateOptions(options) {
    return {
      outputFormat: options.format,
      customRequirements: options.requirements,
      integrations: (options.ai || []).map((ai) => ({ type: ai })),
    }
  }

  /**
   * Display generation plan
   */
  displayGenerationPlan(analysisData, generateOptions) {
    console.log('\n' + this.colorCyan('📋 Generation Plan:'))

    if (analysisData.frameworks.length > 0) {
      console.log(`Frameworks: ${analysisData.frameworks.join(', ')}`)
    }

    if (analysisData.languages.length > 0) {
      console.log(`Languages: ${analysisData.languages.join(', ')}`)
    }

    if (analysisData.tools.length > 0) {
      console.log(`Tools: ${analysisData.tools.join(', ')}`)
    }

    if (generateOptions.integrations.length > 0) {
      console.log(`AI Assistants: ${generateOptions.integrations.map((i) => i.type).join(', ')}`)
    }

    console.log(`Output Format: ${generateOptions.outputFormat}`)

    if (generateOptions.customRequirements) {
      console.log(`Custom Requirements: ${generateOptions.customRequirements}`)
    }

    console.log('')
  }

  /**
   * Generate package from Hub
   */
  async generatePackage(hubOps, analysisData, generateOptions) {
    const spinner = this.createSpinner('Generating package from Hub...')
    spinner.start()

    try {
      const packageResult = await hubOps.generatePackage(analysisData, generateOptions)
      spinner.succeed('Package generated successfully')

      console.log(`Package ID: ${packageResult.packageId}`)
      console.log(`Type: ${packageResult.packageType}`)
      console.log(`Blueprints: ${packageResult.ruleCount}`)
      console.log(`Size: ${Math.round(packageResult.fileSize / 1024)}KB`)

      return packageResult
    } catch (error) {
      spinner.fail('Package generation failed')
      throw error
    }
  }

  /**
   * Download and save package
   */
  async downloadPackage(hubOps, packageResult, options) {
    const spinner = this.createSpinner('Downloading package...')
    spinner.start()

    try {
      const packageContent = await hubOps.downloadPackage(packageResult.packageId)

      const outputPath = options.output || `vdk-package-${packageResult.packageId}.${packageResult.packageType}`

      if (typeof packageContent.content === 'string') {
        await fs.writeFile(outputPath, packageContent.content)
      } else {
        await fs.writeFile(outputPath, Buffer.from(packageContent.content))
      }

      spinner.succeed(`Package saved to ${this.formatPath(outputPath)}`)

      return { downloadPath: outputPath }
    } catch (error) {
      spinner.fail('Package download failed')
      throw error
    }
  }

  /**
   * Display download information for bash format
   */
  displayDownloadInfo(packageResult) {
    console.log(`\nDownload URL: ${packageResult.downloadUrl}`)
    console.log(`Expires: ${new Date(packageResult.expiresAt).toLocaleString()}`)
    console.log('\n' + this.colorCyan('💡 To save the package:'))
    console.log(`curl -o vdk-package.sh "${packageResult.downloadUrl}"`)
    console.log('chmod +x vdk-package.sh && ./vdk-package.sh')
  }
}
