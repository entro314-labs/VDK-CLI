/**
 * AnalyzeCommand
 * -----------------------
 * Analyze blueprint dependencies and relationships.
 */

import { BlueprintManifest } from '../../blueprints/BlueprintManifest.js';
import { DependencyResolver } from '../../blueprints/DependencyResolver.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class AnalyzeCommand extends BaseCommand {
  constructor() {
    super('analyze', 'Analyze blueprint dependencies and relationships');
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .argument('<blueprint-id>', 'Blueprint ID to analyze')
      .option('-v, --verbose', 'Show detailed analysis information', false);
  }

  /**
   * Execute the analyze command
   */
  async execute(options) {
    await commandContext.initialize();

    const blueprintId = options.args?.[0];
    if (!blueprintId) {
      this.exitWithError('Blueprint ID argument is required. Use --help for usage information');
    }

    this.showHeader(`Blueprint Analysis: ${blueprintId}`);

    try {
      const { analyzeBlueprintDependencies } = await import('../../blueprints-client.js');
      const analysis = await this.performAnalysis(blueprintId, analyzeBlueprintDependencies);

      this.displayAnalysisResults(analysis, options.verbose);

      this.trackSuccess({
        blueprintId,
        hasConflicts: analysis.conflicts.length > 0,
        hasDependencies: analysis.dependencies.required.length > 0,
        missingDependencies: analysis.dependencies.missing.length,
      });

      return analysis;
    } catch (error) {
      this.exitWithError(`Analysis failed: ${error.message}`, error);
    }
  }

  /**
   * Perform blueprint analysis
   */
  async performAnalysis(blueprintPath, options) {
    const spinner = this.createSpinner('Analyzing blueprint dependencies...');
    spinner.start();

    try {
      // Load blueprint manifest
      const manifest = new BlueprintManifest(blueprintPath);
      await manifest.load();

      // Validate manifest
      const validation = manifest.validate();
      if (!validation.valid) {
        spinner.warn('Blueprint has validation issues');
        validation.errors.forEach(err => this.logError(`  ✗ ${err}`));
      }

      // Get dependencies
      const deps = manifest.getDependencies();
      const metadata = manifest.getMetadata();

      // Create dependency resolver
      const resolver = new DependencyResolver();
      resolver.addBlueprint(metadata.id, manifest.manifest);

      // Build dependency graph
      const graph = resolver.buildGraph();

      spinner.succeed('Analysis complete');

      // Show results
      this.logInfo('\n📊 Blueprint Analysis:');
      this.logInfo(`\n  ID: ${metadata.id}`);
      this.logInfo(`  Kind: ${metadata.kind}`);
      this.logInfo(`  Version: ${metadata.version}`);
      this.logInfo(`  Platforms: ${manifest.getSupportedPlatforms().join(', ')}`);

      if (deps.requires.length > 0) {
        this.logInfo('\n  📦 Required Dependencies:');
        deps.requires.forEach(dep => {
          const depId = typeof dep === 'string' ? dep : dep.id;
          const version = typeof dep === 'string' ? '*' : dep.version || '*';
          this.logInfo(`    - ${depId} (${version})`);
        });
      }

      if (deps.suggests.length > 0) {
        this.logInfo('\n  💡 Suggested Dependencies:');
        deps.suggests.forEach(dep => this.logInfo(`    - ${dep}`));
      }

      if (deps.conflicts.length > 0) {
        this.logWarning('\n  ⚠️  Conflicts With:');
        deps.conflicts.forEach(dep => this.logWarning(`    - ${dep}`));
      }

      if (options.verbose && graph) {
        this.logInfo('\n  🔗 Dependency Graph:');
        this.logInfo(JSON.stringify(graph, null, 2));
      }

      return {
        success: validation.valid,
        metadata,
        dependencies: deps,
        graph,
      };
    } catch (error) {
      spinner.fail('Analysis failed');
      this.logError(error.message);
      if (options.verbose) {
        console.error(error);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Display analysis results
   */
  displayAnalysisResults(_analysis, _verbose) {
    // Results already displayed in performAnalysis
    // This method kept for compatibility
  }

  /**
   * Display verbose analysis information (legacy)
   */
  displayVerboseAnalysis(_analysis) {
    // Verbose output handled in performAnalysis
  }

  /**
   * Display recommendations based on analysis (legacy)
   */
  displayRecommendations(_analysis) {
    // Recommendations handled in performAnalysis
  }
}
