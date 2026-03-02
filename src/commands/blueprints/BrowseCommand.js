/**
 * BrowseCommand
 * -----------------------
 * Handles 'vdk browse' command - Browse and discover community blueprints
 */

import { searchBlueprints } from '../../blueprints-client.js';
import { colors } from '../../utils/cli-styles.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class BrowseCommand extends BaseCommand {
  constructor() {
    super('browse', 'Browse and discover community blueprints');
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('--community', 'Show community-contributed blueprints', false)
      .option('--trending', 'Show trending blueprints', false)
      .option('--category <category>', 'Filter by category')
      .option('--framework <framework>', 'Filter by framework')
      .option('--platform <platform>', 'Filter by platform compatibility')
      .option('--kind <kind>', 'Filter by canonical kind')
      .option('--specificity <layer>', 'Filter by specificity layer (L0..L4)')
      .option('--include-l4', 'Include provenance variants (L4)', false)
      .option('--limit <number>', 'Limit results', '20')
      .option('--source <source>', 'Source: hub, repository, or both', 'both');
  }

  /**
   * Execute the browse command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader('VDK Blueprint Discovery');

    if (options.community || options.trending) {
      await this.browseCommunityBlueprints(options);
    } else {
      await this.browseRepositoryBlueprints(options);
    }

    this.showBrowseTips();

    return { success: true };
  }

  /**
   * Browse community blueprints from Hub
   */
  async browseCommunityBlueprints(options) {
    if (!this.hubOps) {
      this.exitWithError(
        'Hub integration required for community features. Please check your connection.'
      );
    }

    const spinner = this.createSpinner('Fetching community blueprints...');
    spinner.start();

    try {
      let results;
      if (options.trending) {
        results = await this.hubOps.getTrendingBlueprints({
          limit: parseInt(options.limit, 10),
          timeframe: '7d',
        });
      } else {
        const { VDKHubClient } = await import('../../hub/VDKHubClient.js');
        const hubClient = new VDKHubClient();
        results = await hubClient.searchBlueprints({
          category: options.category,
          framework: options.framework,
          platform: options.platform,
          limit: parseInt(options.limit, 10),
        });
      }

      spinner.succeed(`Found ${results.blueprints?.length || 0} blueprints`);

      console.log(`\n🌟 ${options.trending ? 'Trending' : 'Community'} Blueprints`);

      if (results.blueprints && results.blueprints.length > 0) {
        results.blueprints.forEach(blueprint => {
          console.log('');
          console.log(`📝 ${blueprint.title} by @${blueprint.author || 'community'}`);
          console.log(`   ${blueprint.description || 'No description'}`);
          console.log(
            `   📈 Used ${blueprint.usageCount || 0} times | ⭐ ${blueprint.rating || 'N/A'} rating`
          );
          console.log(`   🚀 Deploy: ${colors.primary(`vdk deploy ${blueprint.id}`)}`);
        });
      } else {
        this.logInfo('No community blueprints found. Try adjusting your filters.');
      }
    } catch (error) {
      spinner.fail('Failed to fetch community blueprints');
      throw error;
    }
  }

  /**
   * Browse repository blueprints
   */
  async browseRepositoryBlueprints(options) {
    const spinner = this.createSpinner('Fetching blueprints...');
    spinner.start();

    try {
      let blueprints;
      if (
        options.category ||
        options.framework ||
        options.platform ||
        options.kind ||
        options.specificity
      ) {
        blueprints = await searchBlueprints({
          category: options.category,
          platform: options.platform,
          framework: options.framework,
          kind: options.kind,
          specificity: options.specificity,
          includeL4: options.includeL4,
          limit: options.limit,
        });
      } else {
        blueprints = await searchBlueprints({
          includeL4: options.includeL4,
          limit: options.limit,
        });
      }

      spinner.succeed(`Found ${blueprints.length} blueprints`);

      const limit = parseInt(options.limit, 10);
      const displayBlueprints = blueprints.slice(0, limit);

      console.log('');
      displayBlueprints.forEach((blueprint, index) => {
        const metadata = blueprint.metadata;
        console.log(`${index + 1}. ${colors.primary(metadata.title || 'Untitled')}`);
        console.log(`   ${metadata.description || 'No description'}`);
        console.log(
          `   Category: ${metadata.category || 'General'} | Complexity: ${metadata.complexity || 'Unknown'}`
        );
        console.log(
          `   Kind: ${blueprint.retrieval?.canonicalKind} | Layer: ${blueprint.retrieval?.specificityLayer}`
        );

        if (metadata.platforms) {
          const platforms = Object.keys(metadata.platforms).filter(
            p => metadata.platforms[p]?.compatible
          );
          console.log(`   Platforms: ${platforms.join(', ') || 'All'}`);
        }

        console.log(`   Deploy: ${colors.primary(`vdk deploy ${metadata.id}`)}`);
        console.log('');
      });

      if (blueprints.length > limit) {
        this.logInfo(
          `Showing ${limit} of ${blueprints.length} blueprints. Use --limit to see more.`
        );
      }
    } catch (error) {
      spinner.fail('Failed to fetch repository blueprints');
      throw error;
    }
  }

  /**
   * Show helpful tips for browsing
   */
  showBrowseTips() {
    console.log('');
    this.logInfo('💡 Tips:');
    this.logInfo('   • Use --community for user-contributed blueprints');
    this.logInfo('   • Use --trending to see popular blueprints');
    this.logInfo('   • Filter by --framework, --category, or --platform');
  }
}
