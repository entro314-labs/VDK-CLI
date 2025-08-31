/**
 * AnalyzeCommand
 * -----------------------
 * Analyze blueprint dependencies and relationships.
 * Provides insights into blueprint compatibility, conflicts, and dependencies.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'

export class AnalyzeCommand extends BaseCommand {
  constructor() {
    super('analyze', 'Analyze blueprint dependencies and relationships')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .argument('<blueprint-id>', 'Blueprint ID to analyze')
      .option('-v, --verbose', 'Show detailed analysis information', false)
  }

  /**
   * Execute the analyze command
   */
  async execute(options) {
    await commandContext.initialize()

    const blueprintId = options.args?.[0]
    if (!blueprintId) {
      this.exitWithError('Blueprint ID argument is required. Use --help for usage information')
    }

    this.showHeader(`Blueprint Analysis: ${blueprintId}`)

    try {
      const { analyzeBlueprintDependencies } = await import('../../blueprints-client.js')
      const analysis = await this.performAnalysis(blueprintId, analyzeBlueprintDependencies)

      this.displayAnalysisResults(analysis, options.verbose)

      this.trackSuccess({
        blueprintId,
        hasConflicts: analysis.conflicts.length > 0,
        hasDependencies: analysis.dependencies.required.length > 0,
        missingDependencies: analysis.dependencies.missing.length,
      })

      return analysis
    } catch (error) {
      this.exitWithError(`Analysis failed: ${error.message}`, error)
    }
  }

  /**
   * Perform blueprint analysis
   */
  async performAnalysis(blueprintId, analyzeFn) {
    const spinner = this.createSpinner(`Analyzing blueprint: ${blueprintId}`)
    spinner.start()

    try {
      const analysis = await analyzeFn(blueprintId)
      spinner.succeed('Analysis completed')
      return analysis
    } catch (error) {
      spinner.fail('Analysis failed')
      throw error
    }
  }

  /**
   * Display analysis results
   */
  displayAnalysisResults(analysis, verbose) {
    // Blueprint overview
    console.log(`\n📋 Blueprint: ${analysis.blueprint.title || analysis.blueprint.name}`)
    console.log(`Description: ${analysis.blueprint.description}`)
    console.log(`Category: ${analysis.blueprint.category}`)
    console.log(`Complexity: ${analysis.blueprint.complexity}`)
    console.log(`Maturity: ${analysis.blueprint.maturity}`)

    // Required dependencies
    if (analysis.dependencies.required.length > 0) {
      console.log(`\n✅ Required Dependencies:`)
      analysis.dependencies.required.forEach((dep) => {
        console.log(`- ${dep.name}: ${dep.title || dep.description}`)
      })
    }

    // Suggested dependencies
    if (analysis.dependencies.suggested.length > 0) {
      console.log(`\n💡 Suggested Dependencies:`)
      analysis.dependencies.suggested.forEach((dep) => {
        console.log(`- ${dep.name}: ${dep.title || dep.description}`)
      })
    }

    // Missing dependencies
    if (analysis.dependencies.missing.length > 0) {
      console.log(`\n❌ Missing Dependencies:`)
      analysis.dependencies.missing.forEach((depId) => {
        console.log(`- ${depId} (not found in repository)`)
      })
    }

    // Conflicts
    if (analysis.conflicts.length > 0) {
      console.log(`\n⚠️  Conflicts With:`)
      analysis.conflicts.forEach((conflict) => {
        console.log(`- ${conflict.name}: ${conflict.title || conflict.description}`)
      })
    }

    // Superseded blueprints
    if (analysis.superseded.length > 0) {
      console.log(`\n🔄 Supersedes:`)
      analysis.superseded.forEach((superseded) => {
        console.log(`- ${superseded.name}: ${superseded.title || superseded.description}`)
      })
    }

    // Verbose information
    if (verbose) {
      this.displayVerboseAnalysis(analysis)
    }

    // Summary recommendations
    this.displayRecommendations(analysis)
  }

  /**
   * Display verbose analysis information
   */
  displayVerboseAnalysis(analysis) {
    console.log('\n' + this.colorCyan('🔍 Detailed Analysis:'))

    if (analysis.blueprint.platforms) {
      const compatiblePlatforms = Object.keys(analysis.blueprint.platforms).filter(
        (p) => analysis.blueprint.platforms[p].compatible
      )
      console.log(`\nPlatform Compatibility: ${compatiblePlatforms.join(', ')}`)
    }

    if (analysis.blueprint.tags && analysis.blueprint.tags.length > 0) {
      console.log(`Tags: ${analysis.blueprint.tags.join(', ')}`)
    }

    if (analysis.blueprint.author) {
      console.log(`Author: ${analysis.blueprint.author}`)
    }

    if (analysis.blueprint.version) {
      console.log(`Version: ${analysis.blueprint.version}`)
    }
  }

  /**
   * Display recommendations based on analysis
   */
  displayRecommendations(analysis) {
    console.log('\n' + this.colorCyan('💡 Recommendations:'))

    if (analysis.dependencies.missing.length > 0) {
      console.log('- Resolve missing dependencies before deployment')
    }

    if (analysis.conflicts.length > 0) {
      console.log('- Review conflicts and consider alternative blueprints')
    }

    if (analysis.dependencies.suggested.length > 0) {
      console.log('- Consider installing suggested dependencies for enhanced functionality')
    }

    if (analysis.superseded.length > 0) {
      console.log('- This blueprint supersedes older versions - consider migration')
    }

    if (analysis.dependencies.missing.length === 0 && analysis.conflicts.length === 0) {
      console.log(this.colorPrimary('✅ Blueprint is ready for deployment!'))
    }
  }
}
