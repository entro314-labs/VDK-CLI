/**
 * SearchCommand
 * -----------------------
 * Search VDK-Blueprints repository using AI Context Schema v2.1.0 metadata.
 * Supports advanced filtering by platform, category, complexity, and more.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { colors, tables } from '../../utils/cli-styles.js'

export class SearchCommand extends BaseCommand {
  constructor() {
    super('search', 'Search VDK-Blueprints repository using AI Context Schema v2.1.0 metadata')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
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
  }

  /**
   * Execute the search command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    try {
      const criteria = this.buildSearchCriteria(options)
      this.displaySearchCriteria(criteria)

      const { searchBlueprints } = await import('../../blueprints-client.js')
      const results = await searchBlueprints(criteria)
      const limitedResults = results.slice(0, parseInt(options.limit))

      if (limitedResults.length === 0) {
        this.logWarning('No blueprints found matching your criteria')
        return { results: [], total: 0 }
      }

      this.displaySearchResults(limitedResults, results.length, options)

      this.trackSuccess({
        totalResults: results.length,
        displayedResults: limitedResults.length,
        criteria: Object.keys(criteria),
      })

      return {
        results: limitedResults,
        total: results.length,
        criteria,
      }
    } catch (error) {
      this.exitWithError(`Search failed: ${error.message}`, error)
    }
  }

  /**
   * Build search criteria from options
   */
  buildSearchCriteria(options) {
    const criteria = {}

    if (options.query) criteria.query = options.query
    if (options.platform) criteria.platform = options.platform
    if (options.category) criteria.category = options.category
    if (options.complexity) criteria.complexity = options.complexity
    if (options.scope) criteria.scope = options.scope
    if (options.audience) criteria.audience = options.audience
    if (options.maturity) criteria.maturity = options.maturity
    if (options.tags) criteria.tags = options.tags

    return criteria
  }

  /**
   * Display search criteria
   */
  displaySearchCriteria(criteria) {
    const criteriaText = Object.keys(criteria).length > 0 ? criteria : 'All blueprints'
    console.log('Search criteria:', criteriaText)
  }

  /**
   * Display search results in table format
   */
  displaySearchResults(results, totalResults, options) {
    const searchTable = tables.basic()

    // Table headers
    searchTable.push([
      this.colorPrimary('Name'),
      this.colorPrimary('Title'),
      this.colorPrimary('Category'),
      this.colorPrimary('Complexity'),
      this.colorPrimary('Maturity'),
      this.colorPrimary('Platforms'),
    ])

    // Table rows
    results.forEach((blueprint) => {
      const platforms = Object.keys(blueprint.platforms || {})
        .filter((p) => blueprint.platforms[p]?.compatible)
        .slice(0, 3)
        .join(', ')

      const platformsDisplay = platforms + (Object.keys(blueprint.platforms || {}).length > 3 ? '...' : '')

      searchTable.push([
        blueprint.metadata?.name || 'Unknown',
        (blueprint.metadata?.title || blueprint.metadata?.name || 'Untitled').substring(0, 30),
        blueprint.metadata?.category || 'Unknown',
        blueprint.complexity || 'Unknown',
        blueprint.maturity || 'Unknown',
        platformsDisplay,
      ])
    })

    console.log(searchTable.toString())

    const limitText = totalResults > parseInt(options.limit) ? ` (showing ${options.limit})` : ''
    console.log(`\nFound ${totalResults} blueprints${limitText}`)

    if (options.verbose && results.length > 0) {
      this.showDetailedInfo(results)
    }
  }

  /**
   * Show detailed information for verbose mode
   */
  showDetailedInfo(results) {
    console.log('\n' + this.colorCyan('Detailed Blueprint Information:'))
    console.log('')

    results.slice(0, 5).forEach((blueprint, index) => {
      console.log(this.colorPrimary(`${index + 1}. ${blueprint.metadata?.title || blueprint.metadata?.name}`))
      console.log(`   Description: ${blueprint.metadata?.description || 'No description'}`)
      console.log(`   Tags: ${(blueprint.metadata?.tags || []).join(', ') || 'None'}`)
      console.log(`   Author: ${blueprint.metadata?.author || 'Unknown'}`)
      console.log(`   Created: ${blueprint.metadata?.created || 'Unknown'}`)
      console.log('')
    })

    if (results.length > 5) {
      this.logInfo(`... and ${results.length - 5} more blueprints`)
    }

    console.log(this.logInfo('💡 Use "vdk deploy <blueprint-name>" to deploy a blueprint'))
  }
}
