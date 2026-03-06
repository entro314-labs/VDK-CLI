/**
 * RepoStatsCommand
 * -----------------------
 * Show VDK-Blueprints repository statistics and canonical schema v3 compliance.
 * Provides comprehensive repository metrics and analysis.
 */

import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class RepoStatsCommand extends BaseCommand {
  constructor() {
    super(
      'repo-stats',
      'Show VDK-Blueprints repository statistics and canonical schema v3 compliance'
    );
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command.option('-v, --verbose', 'Show detailed statistics', false);
  }

  /**
   * Execute the repo-stats command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    try {
      const { getBlueprintStatistics } = await import('../../blueprints-client.js');

      const spinner = this.createSpinner('Analyzing repository statistics...');
      spinner.start();

      const stats = await getBlueprintStatistics();
      spinner.succeed('Statistics analysis completed');

      this.displayRepositoryStats(stats, options.verbose);

      this.trackSuccess({
        totalBlueprints: stats.total,
        validBlueprints: stats.valid,
        complianceRate: stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0,
      });

      return stats;
    } catch (error) {
      this.exitWithError(`Failed to fetch repository statistics: ${error.message}`, error);
    }
  }

  /**
   * Display comprehensive repository statistics
   */
  displayRepositoryStats(stats, verbose) {
    const complianceRate = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;

    // Repository overview
    console.log(`\n📊 Repository Overview:`);
    console.log(`- Total Blueprints: ${stats.total}`);
    console.log(`- Schema v3 Valid: ${stats.valid} (${complianceRate}%)`);
    console.log(`- Invalid: ${stats.invalid}`);

    if (stats.total === 0) {
      console.log('\nℹ No blueprints available from the current source.');
      console.log('  Check repository connectivity or configure a local blueprints source.');
      return;
    }

    // Category breakdown
    if (Object.keys(stats.byCategory).length > 0) {
      console.log(`\n📂 By Category:`);
      Object.entries(stats.byCategory)
        .toSorted(([, a], [, b]) => b - a)
        .forEach(([category, count]) => {
          console.log(`- ${category}: ${count}`);
        });
    }

    // Complexity breakdown
    if (Object.keys(stats.byComplexity).length > 0) {
      console.log(`\n⚙️ By Complexity:`);
      Object.entries(stats.byComplexity)
        .toSorted(([, a], [, b]) => b - a)
        .forEach(([complexity, count]) => {
          console.log(`- ${complexity}: ${count}`);
        });
    }

    // Maturity breakdown
    if (Object.keys(stats.byMaturity).length > 0) {
      console.log(`\n🎯 By Maturity:`);
      Object.entries(stats.byMaturity)
        .toSorted(([, a], [, b]) => b - a)
        .forEach(([maturity, count]) => {
          console.log(`- ${maturity}: ${count}`);
        });
    }

    // Relationship information
    console.log(`\n🔗 Relationships:`);
    console.log(`- With Dependencies: ${stats.relationships.withDependencies}`);
    console.log(`- With Conflicts: ${stats.relationships.withConflicts}`);

    // Platform support
    if (Object.keys(stats.platformSupport).length > 0) {
      const topCount = verbose ? 20 : 10;
      console.log(`\n🎮 Platform Support (Top ${topCount}):`);
      Object.entries(stats.platformSupport)
        .toSorted(([, a], [, b]) => b - a)
        .slice(0, topCount)
        .forEach(([platform, count]) => {
          console.log(`- ${platform}: ${count}`);
        });
    }

    // Verbose statistics
    if (verbose) {
      this.displayVerboseStats(stats);
    }

    // Quality insights
    this.displayQualityInsights(stats);
  }

  /**
   * Display verbose statistics
   */
  displayVerboseStats(stats) {
    console.log(`\n${this.colorCyan('🔍 Detailed Analysis:')}`);

    if (stats.averageSize) {
      console.log(`\nBlueprint Sizes:`);
      console.log(`- Average Size: ${Math.round(stats.averageSize)} bytes`);
      console.log(`- Largest: ${stats.largestSize} bytes`);
      console.log(`- Smallest: ${stats.smallestSize} bytes`);
    }

    if (stats.authorDistribution) {
      console.log(`\nTop Contributors:`);
      Object.entries(stats.authorDistribution)
        .toSorted(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([author, count]) => {
          console.log(`- ${author}: ${count} blueprints`);
        });
    }

    if (stats.tagsPopularity) {
      console.log(`\nPopular Tags:`);
      Object.entries(stats.tagsPopularity)
        .toSorted(([, a], [, b]) => b - a)
        .slice(0, 15)
        .forEach(([tag, count]) => {
          console.log(`- ${tag}: ${count}`);
        });
    }
  }

  /**
   * Display quality insights and recommendations
   */
  displayQualityInsights(stats) {
    console.log(`\n${this.colorCyan('💡 Quality Insights:')}`);

    if (stats.total === 0) {
      this.logWarning('No blueprints were analyzed, so quality metrics are unavailable.');
      return;
    }

    const complianceRate = Math.round((stats.valid / stats.total) * 100);

    if (complianceRate >= 90) {
      this.logSuccess('Excellent schema compliance rate!');
    } else if (complianceRate >= 75) {
      this.logInfo('Good schema compliance, some improvements possible');
    } else {
      this.logWarning('Schema compliance needs improvement');
    }

    // Relationship health
    const dependencyRate = Math.round((stats.relationships.withDependencies / stats.total) * 100);
    const conflictRate = Math.round((stats.relationships.withConflicts / stats.total) * 100);

    console.log(`\nRelationship Health:`);
    console.log(`- ${dependencyRate}% of blueprints have dependencies`);
    console.log(`- ${conflictRate}% of blueprints have conflicts`);

    if (conflictRate > 10) {
      this.logWarning('High conflict rate may indicate overlapping functionality');
    }

    // Platform diversity
    const platformCount = Object.keys(stats.platformSupport).length;
    console.log(`\nPlatform Coverage: ${platformCount} platforms supported`);

    if (platformCount < 5) {
      this.logInfo('Consider expanding platform support for broader compatibility');
    }
  }
}
