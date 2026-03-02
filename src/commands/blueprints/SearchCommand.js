/**
 * SearchCommand
 * -----------------------
 * Search VDK-Blueprints repository using canonical AI Context Schema v3 metadata.
 * Supports advanced filtering by platform, category, complexity, and more.
 */

import { tables } from '../../utils/cli-styles.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class SearchCommand extends BaseCommand {
  constructor() {
    super(
      'search',
      'Search VDK-Blueprints repository using canonical AI Context Schema v3 metadata'
    );
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .option('-q, --query <text>', 'Search query for name/title/description')
      .option('--exact-match', 'Require exact canonical/id match for query', false)
      .option('--fuzzy', 'Enable fuzzy matching when query is provided', false)
      .option(
        '-p, --platform <platform>',
        'Filter by platform compatibility (claude-code, cursor, windsurf, etc.)'
      )
      .option('-c, --category <category>', 'Filter by category (core, language, technology, etc.)')
      .option(
        '--kind <kind>',
        'Filter by canonical kind (project-memory, conditional-rule, skill, command, workflow, agent, hook, mcp-integration, plugin-distribution)'
      )
      .option('--specificity <layer>', 'Filter by specificity layer (L0, L1, L2, L3, L4)')
      .option('--include-l4', 'Include provenance variants (L4) in results', false)
      .option('--audit-provenance', 'Show provenance variants without deduplication', false)
      .option('--complexity <level>', 'Filter by complexity (simple, medium, complex)')
      .option('--scope <scope>', 'Filter by scope (file, component, feature, project, system)')
      .option('--audience <audience>', 'Filter by audience (developer, architect, team-lead, etc.)')
      .option(
        '--maturity <maturity>',
        'Filter by maturity (experimental, beta, stable, deprecated)'
      )
      .option('--tags <tags...>', 'Filter by tags (space-separated)')
      .option('--limit <number>', 'Limit number of results', '20')
      .option('-v, --verbose', 'Show detailed blueprint information', false);
  }

  /**
   * Execute the search command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    try {
      const criteria = this.buildSearchCriteria(options);
      this.displaySearchCriteria(criteria);

      const { searchBlueprints } = await import('../../blueprints-client.js');
      const results = await searchBlueprints(criteria);
      const limitedResults = results.slice(0, parseInt(options.limit, 10));

      if (limitedResults.length === 0) {
        this.logWarning('No blueprints found matching your criteria');
        return { results: [], total: 0 };
      }

      this.displaySearchResults(limitedResults, results.length, options);

      this.trackSuccess({
        totalResults: results.length,
        displayedResults: limitedResults.length,
        criteria: Object.keys(criteria),
      });

      return {
        results: limitedResults,
        total: results.length,
        criteria,
      };
    } catch (error) {
      this.exitWithError(`Search failed: ${error.message}`, error);
    }
  }

  /**
   * Build search criteria from options
   */
  buildSearchCriteria(options) {
    const criteria = {};

    if (options.query) criteria.query = options.query;
    if (options.exactMatch) criteria.exactMatch = true;
    if (options.fuzzy) criteria.fuzzy = true;
    if (options.platform) criteria.platform = options.platform;
    if (options.category) criteria.category = options.category;
    if (options.kind) criteria.kind = options.kind;
    if (options.specificity) criteria.specificity = options.specificity;
    if (options.includeL4) criteria.includeL4 = true;
    if (options.auditProvenance) criteria.auditProvenance = true;
    if (options.complexity) criteria.complexity = options.complexity;
    if (options.scope) criteria.scope = options.scope;
    if (options.audience) criteria.audience = options.audience;
    if (options.maturity) criteria.maturity = options.maturity;
    if (options.tags) criteria.tags = options.tags;
    if (options.limit) criteria.limit = options.limit;

    return criteria;
  }

  /**
   * Display search criteria
   */
  displaySearchCriteria(criteria) {
    const criteriaText = Object.keys(criteria).length > 0 ? criteria : 'All blueprints';
    console.log('Search criteria:', criteriaText);
  }

  /**
   * Display search results in table format
   */
  displaySearchResults(results, totalResults, options) {
    const searchTable = tables.basic();

    // Table headers
    searchTable.push([
      this.colorPrimary('Name'),
      this.colorPrimary('Title'),
      this.colorPrimary('Kind'),
      this.colorPrimary('Layer'),
      this.colorPrimary('Category'),
      this.colorPrimary('Complexity'),
      this.colorPrimary('Maturity'),
      this.colorPrimary('Platforms'),
    ]);

    // Table rows
    results.forEach(blueprint => {
      const displayName = this.getBlueprintDisplayName(blueprint);
      const platforms = Object.keys(blueprint.platforms || {})
        .filter(p => blueprint.platforms[p]?.compatible)
        .slice(0, 3)
        .join(', ');

      const platformsDisplay =
        platforms + (Object.keys(blueprint.platforms || {}).length > 3 ? '...' : '');

      searchTable.push([
        displayName,
        (blueprint.metadata?.title || displayName || 'Untitled').substring(0, 30),
        blueprint.retrieval?.canonicalKind,
        blueprint.retrieval?.specificityLayer,
        blueprint.metadata?.category || 'Unknown',
        blueprint.complexity || 'Unknown',
        blueprint.maturity || 'Unknown',
        platformsDisplay,
      ]);
    });

    console.log(searchTable.toString());

    const limitText =
      totalResults > parseInt(options.limit, 10) ? ` (showing ${options.limit})` : '';
    console.log(`\nFound ${totalResults} blueprints${limitText}`);

    if (options.verbose && results.length > 0) {
      this.showDetailedInfo(results);
    }
  }

  /**
   * Resolve a stable display name for a blueprint across canonical and source shapes.
   */
  getBlueprintDisplayName(blueprint) {
    const sourceName = blueprint?.name?.replace(/\.(md|mdc|json)$/i, '');
    return (
      blueprint?.metadata?.name ||
      blueprint?.metadata?.id ||
      blueprint?.retrieval?.canonicalName ||
      sourceName ||
      'Unknown'
    );
  }

  /**
   * Show detailed information for verbose mode
   */
  showDetailedInfo(results) {
    console.log(`\n${this.colorCyan('Detailed Blueprint Information:')}`);
    console.log('');

    results.slice(0, 5).forEach((blueprint, index) => {
      const displayName = this.getBlueprintDisplayName(blueprint);
      console.log(this.colorPrimary(`${index + 1}. ${blueprint.metadata?.title || displayName}`));
      console.log(`   Description: ${blueprint.metadata?.description || 'No description'}`);
      console.log(`   Kind: ${blueprint.retrieval?.canonicalKind}`);
      console.log(`   Layer: ${blueprint.retrieval?.specificityLayer}`);
      console.log(`   Tags: ${(blueprint.metadata?.tags || []).join(', ') || 'None'}`);
      console.log(`   Author: ${blueprint.metadata?.author || 'Unknown'}`);
      console.log(`   Created: ${blueprint.metadata?.created || 'Unknown'}`);
      console.log('');
    });

    if (results.length > 5) {
      this.logInfo(`... and ${results.length - 5} more blueprints`);
    }

    console.log(this.logInfo('💡 Use "vdk deploy <blueprint-name>" to deploy a blueprint'));
  }
}
