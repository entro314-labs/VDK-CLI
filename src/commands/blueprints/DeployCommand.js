/**
 * DeployCommand
 * -----------------------
 * Deploy blueprints to your project from community or repository sources.
 * Handles both community rules and repository blueprints with preview functionality.
 */

import chalk from 'chalk';
import { EquivalenceEvaluator } from '../../blueprints/equivalence/EquivalenceEvaluator.js';
import { RuleAdapter } from '../../scanner/core/RuleAdapter.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

const CANONICAL_KINDS = new Set([
  'project-memory',
  'conditional-rule',
  'skill',
  'command',
  'workflow',
  'agent',
  'hook',
  'mcp-integration',
  'plugin-distribution',
]);

export class DeployCommand extends BaseCommand {
  constructor() {
    super('deploy', 'Deploy blueprints to your project');
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .argument(
        '[blueprint-id]',
        'Blueprint or rule ID to deploy (e.g., rule:abc123, nextjs-patterns)'
      )
      .option('-p, --project-path <path>', 'Path to the project', process.cwd())
      .option('--preview', 'Preview deployment without applying changes', false)
      .option('--allow-major-changes', 'Allow significant adaptations for compatibility', false)
      .option('--include-l4', 'Allow deployment of provenance variants (L4)', false)
      .option('--source <source>', 'Source: community, repository, or auto', 'auto')
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  /**
   * Execute the deploy command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    console.log('');
    console.log(this.colorCyan('VDK Blueprint Deployment'));
    this.showUsageGuide();

    const blueprintId = options.args?.[0];

    // If no blueprint ID provided, show usage guide
    if (!blueprintId) {
      return;
    }

    // Determine deployment source
    const isCommunityRule = blueprintId.startsWith('rule:') || options.source === 'community';
    const isRepositoryBlueprint =
      !isCommunityRule && (options.source === 'repository' || options.source === 'auto');

    if (isCommunityRule || options.source === 'community') {
      return await this.deployCommunity(blueprintId, options);
    } else if (isRepositoryBlueprint) {
      return await this.deployRepository(blueprintId, options);
    }
  }

  /**
   * Show deployment usage guide
   */
  showUsageGuide() {
    console.log('');
    console.log(this.colorCyan('📋 Deploy Options:'));
    console.log('');
    console.log('1. Deploy Community Blueprint:');
    console.log(
      `   ${this.colorPrimary('vdk deploy rule:abc123')}     # Deploy community rule by ID`
    );
    console.log(`   ${this.colorPrimary('vdk deploy nextjs-patterns')} # Deploy by name or slug`);
    console.log('');
    console.log('2. Deploy Repository Blueprint:');
    console.log(
      `   ${this.colorPrimary('vdk deploy typescript-strict')} # Deploy from VDK-Blueprints repository`
    );
    console.log('');
    console.log('3. Browse Available Blueprints:');
    console.log(
      `   ${this.colorPrimary('vdk browse')}              # Browse repository blueprints`
    );
    console.log(
      `   ${this.colorPrimary('vdk browse --community')}   # Browse community blueprints`
    );
    console.log(`   ${this.colorPrimary('vdk browse --trending')}    # Browse trending blueprints`);
    console.log('');
    console.log('4. Preview Before Deploying:');
    console.log(
      `   ${this.colorPrimary('vdk deploy rule:abc123 --preview')} # See what would be deployed`
    );
    console.log('');
  }

  /**
   * Deploy community blueprint
   */
  async deployCommunity(blueprintId, options) {
    try {
      const { CommunityDeployer } = await import('../../community/CommunityDeployer.js');
      const deployer = new CommunityDeployer(options.projectPath || process.cwd());

      const normalizedId = blueprintId.startsWith('rule:') ? blueprintId.slice(5) : blueprintId;

      if (options.preview) {
        return await this.previewCommunityDeployment(deployer, normalizedId);
      }

      const result = await deployer.deploy(normalizedId, {
        allowMajorChanges: options.allowMajorChanges,
        verbose: options.verbose,
      });

      console.log('');
      this.logSuccess(`✅ Deployed: ${result.blueprintTitle}`);
      this.logInfo(`📊 Compatibility: ${result.compatibilityScore}/10`);
      this.logInfo(`🚀 Applied to: ${result.platforms.join(', ')}`);

      return result;
    } catch (error) {
      if (/not found/i.test(error.message)) {
        console.log('');
        this.logInfo('💡 Try:');
        this.logInfo('   vdk browse --community');
        this.logInfo('   vdk browse --trending');
      }
      this.exitWithError(`Community deployment failed: ${error.message}`, error);
    }
  }

  /**
   * Preview community deployment
   */
  async previewCommunityDeployment(deployer, blueprintId) {
    const preview = await deployer.previewDeployment(blueprintId);

    console.log('');
    console.log(this.colorCyan('📋 Community Blueprint Preview:'));
    console.log(
      `Blueprint: ${preview.blueprint.title} by @${preview.blueprint.author || 'community'}`
    );
    console.log(`Description: ${preview.blueprint.description || 'No description'}`);
    console.log(`Project Context: ${preview.projectContext}`);
    console.log(`Compatibility: ${preview.adaptationPlan.compatibilityScore}/10`);
    console.log(`Estimated Files: ${preview.estimatedFiles}`);

    if (preview.adaptationPlan.changes.length > 0) {
      console.log('');
      console.log(this.colorCyan('Planned Adaptations:'));
      preview.adaptationPlan.changes.forEach(change => {
        console.log(`  • ${change.description}`);
      });
    }

    if (preview.adaptationPlan.warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow('Warnings:'));
      preview.adaptationPlan.warnings.forEach(warning => {
        console.log(chalk.yellow(`  ⚠️  ${warning}`));
      });
    }

    console.log('');
    console.log(this.colorPrimary('Run without --preview to deploy'));

    return preview;
  }

  /**
   * Deploy repository blueprint
   */
  async deployRepository(blueprintId, options) {
    try {
      const { searchBlueprints } = await import('../../blueprints-client.js');

      const spinner = this.createSpinner(`Looking for blueprint: ${blueprintId}`);
      spinner.start();

      // Search for blueprint by ID or name
      const exactResults = await searchBlueprints({
        query: blueprintId,
        exactMatch: true,
        includeL4: options.includeL4,
        limit: 10,
      });

      const blueprint = this.resolveDeterministicRepositoryMatch(exactResults, blueprintId);

      if (!blueprint) {
        spinner.fail(`Blueprint '${blueprintId}' not found`);
        console.log('');
        this.logInfo('💡 Try:');
        this.logInfo('   vdk browse --category <category>');
        this.logInfo('   vdk browse --community');
        return;
      } else {
        const displayName =
          blueprint.metadata?.title ||
          blueprint.metadata?.name ||
          blueprint.metadata?.id ||
          'unknown';
        spinner.succeed(`Found: ${displayName}`);
      }

      if (options.preview) {
        return await this.previewRepositoryDeployment(blueprint);
      }

      return await this.executeRepositoryDeployment(blueprint, options);
    } catch (error) {
      this.exitWithError(`Repository deployment failed: ${error.message}`, error);
    }
  }

  /**
   * Resolve a deterministic repository match for deployment.
   *
   * Preference order:
   * 1) exact metadata.id or retrieval.canonicalName match
   * 2) single exact-match result fallback
   *
   * Throws when multiple candidates remain unresolved to avoid accidental deployment.
   */
  resolveDeterministicRepositoryMatch(results = [], requestedId = '') {
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const normalize = value =>
      String(value || '')
        .trim()
        .toLowerCase();

    const target = normalize(requestedId);

    const directMatches = results.filter(item => {
      const id = normalize(item?.metadata?.id);
      const canonicalName = normalize(item?.retrieval?.canonicalName);
      return id === target || canonicalName === target;
    });

    if (directMatches.length === 1) {
      return directMatches[0];
    }

    if (directMatches.length > 1) {
      const ids = directMatches
        .map(item => item?.metadata?.id || item?.retrieval?.canonicalName || 'unknown')
        .slice(0, 5)
        .join(', ');
      throw new Error(`Ambiguous blueprint id '${requestedId}'. Matches: ${ids}`);
    }

    if (results.length === 1) {
      return results[0];
    }

    const candidates = results
      .map(item => item?.metadata?.id || item?.retrieval?.canonicalName || 'unknown')
      .slice(0, 5)
      .join(', ');

    throw new Error(
      `Unable to deterministically resolve '${requestedId}'. Candidates: ${candidates}. Use an exact metadata.id.`
    );
  }

  /**
   * Preview repository deployment
   */
  async previewRepositoryDeployment(blueprint) {
    const displayTitle =
      blueprint.metadata?.title || blueprint.metadata?.name || blueprint.metadata?.id || 'Untitled';

    console.log('');
    console.log(this.colorCyan('📋 Repository Blueprint Preview:'));
    console.log(`Title: ${displayTitle}`);
    console.log(`Description: ${blueprint.metadata.description || 'No description'}`);
    console.log(`Category: ${blueprint.metadata.category || 'General'}`);
    console.log(`Complexity: ${blueprint.metadata.complexity || 'Unknown'}`);

    if (blueprint.platforms) {
      const platforms = Object.keys(blueprint.platforms).filter(
        p => blueprint.platforms[p]?.compatible
      );
      console.log(`Platforms: ${platforms.join(', ') || 'All'}`);
    }

    console.log('');
    console.log(this.colorPrimary('Run without --preview to deploy'));

    return { preview: true, blueprint };
  }

  /**
   * Execute repository deployment
   */
  async executeRepositoryDeployment(blueprint, options) {
    const canonicalBlueprint = this.assertCanonicalRepositoryBlueprint(blueprint);
    return await this.executeV3Deployment(canonicalBlueprint, options);
  }

  assertCanonicalRepositoryBlueprint(blueprint) {
    if (!blueprint || typeof blueprint !== 'object') {
      throw new Error('Cannot deploy empty blueprint payload');
    }

    if (blueprint.schemaVersion !== '3.0') {
      throw new Error(
        `Canonical deployment requires schemaVersion 3.0, received '${blueprint.schemaVersion || 'undefined'}'`
      );
    }

    const kind = String(blueprint?.metadata?.kind || '')
      .trim()
      .toLowerCase();
    if (!CANONICAL_KINDS.has(kind)) {
      throw new Error(
        `Canonical deployment requires metadata.kind to be one of: ${Array.from(CANONICAL_KINDS).join(', ')}`
      );
    }

    const platformEntries = Object.entries(blueprint.platforms || {});
    if (platformEntries.length === 0) {
      throw new Error('Canonical deployment requires at least one platform configuration');
    }

    for (const [platformId, config] of platformEntries) {
      if (
        !config ||
        typeof config !== 'object' ||
        !config.components ||
        typeof config.components !== 'object'
      ) {
        throw new Error(
          `Canonical deployment requires platform '${platformId}' to define a components object`
        );
      }
    }

    return blueprint;
  }

  /**
   * Execute v3.0 blueprint deployment using RuleAdapter
   */
  async executeV3Deployment(blueprint, options) {
    const projectPath = options.projectPath || process.cwd();

    console.log('');
    this.logInfo('📦 Deploying v3.0 blueprint...');

    // Detect active integrations
    const { createIntegrationManager } = await import('../../integrations/index.js');
    const integrationManager = createIntegrationManager(projectPath);
    await integrationManager.discoverIntegrations({ verbose: options.verbose });
    await integrationManager.scanAll({ verbose: options.verbose });

    const activeIntegrations = integrationManager.getActiveIntegrations();

    if (activeIntegrations.length === 0) {
      this.logWarning('No active IDE integrations detected');
      return { success: false, platforms: [] };
    }

    // Create RuleAdapter instance
    const ruleAdapter = new RuleAdapter({
      projectPath,
      verbose: options.verbose,
      overwrite: true,
    });

    const results = {
      success: true,
      platforms: [],
      files: [],
      errors: [],
      warnings: [],
      equivalence: [],
    };

    const evaluator = new EquivalenceEvaluator();

    // Deploy to each active platform
    for (const integration of activeIntegrations) {
      const platformId = this.mapIntegrationToPlatformId(integration.name);

      if (options.verbose) {
        console.log(chalk.gray(`Deploying to ${integration.name} (${platformId})...`));
      }

      try {
        const equivalence = evaluator.evaluateBlueprintForPlatform(blueprint, platformId);
        results.equivalence.push({
          platform: integration.name,
          ...equivalence,
        });

        if (equivalence.outcome === 'unsupported') {
          results.warnings.push(...evaluator.toWarningMessages(equivalence, integration.name));
          continue;
        }

        if (equivalence.outcome === 'lossy') {
          results.warnings.push(...evaluator.toWarningMessages(equivalence, integration.name));
        }

        // Use RuleAdapter to adapt blueprint for this platform
        const adaptResult = await ruleAdapter.adaptFromBlueprint(blueprint, platformId, {
          overwrite: options.overwrite,
        });

        if (adaptResult.success === false) {
          results.warnings.push(...(adaptResult.warnings || []));
          continue;
        }

        // Write files
        if (adaptResult.files && adaptResult.files.length > 0) {
          await this.writeAdaptedFiles(adaptResult.files, options);
          results.files.push(...adaptResult.files);
          results.platforms.push(integration.name);
        }

        if (adaptResult.warnings) {
          results.warnings.push(...adaptResult.warnings);
        }
      } catch (error) {
        results.errors.push({
          platform: integration.name,
          error: error.message,
        });
        results.success = false;
      }
    }

    // Display results
    console.log('');
    this.logSuccess(`✅ Deployed: ${blueprint.title || 'Blueprint'}`);
    this.logInfo(`🚀 Applied to: ${results.platforms.join(', ')}`);
    this.logInfo(`📝 Files created: ${results.files.length}`);

    const eqCounts = results.equivalence.reduce(
      (acc, item) => {
        acc[item.outcome] = (acc[item.outcome] || 0) + 1;
        return acc;
      },
      { lossless: 0, lossy: 0, unsupported: 0 }
    );

    this.logInfo(
      `🧮 Equivalence: ${eqCounts.lossless} lossless, ${eqCounts.lossy} lossy, ${eqCounts.unsupported} unsupported`
    );

    if (results.warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow('Warnings:'));
      results.warnings.forEach(warning => {
        console.log(chalk.yellow(`  ⚠️  ${warning}`));
      });
    }

    if (results.errors.length > 0) {
      console.log('');
      console.log(chalk.red('Errors:'));
      results.errors.forEach(error => {
        console.log(chalk.red(`  ✗ ${error.platform}: ${error.error}`));
      });
    }

    return results;
  }

  /**
   * Write adapted files to disk
   */
  async writeAdaptedFiles(files, options) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    for (const file of files) {
      try {
        const filePath = file.path;

        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Write file
        await fs.writeFile(filePath, file.content, 'utf8');

        if (options.verbose) {
          console.log(chalk.green(`  ✓ ${path.relative(process.cwd(), filePath)}`));
        }
      } catch (error) {
        if (options.verbose) {
          console.error(chalk.red(`  ✗ Failed to write ${file.path}: ${error.message}`));
        }
      }
    }
  }

  /**
   * Map integration name to platform ID
   */
  mapIntegrationToPlatformId(integrationName) {
    const mapping = {
      'Claude Code CLI': 'claude-code',
      Cursor: 'cursor',
      Windsurf: 'windsurf',
      'GitHub Copilot': 'github-copilot',
      Continue: 'continue',
      Aider: 'aider',
      'OpenAI Codex': 'openai-codex',
      OpenCode: 'opencode',
      'Gemini CLI': 'gemini-cli',
      Cline: 'cline',
      'Roo Code': 'roo-code',
      Goose: 'goose',
      Junie: 'junie',
      'Google Antigravity': 'google-antigravity',
      'Kimi CLI': 'kimi-cli',
      'Mistral Vibe': 'mistral-vibe',
      Trae: 'trae',
      'JetBrains AI': 'jetbrains-ai',
      Zed: 'zed',
      Tabnine: 'tabnine',
    };

    return mapping[integrationName] || integrationName.toLowerCase().replace(/\s+/g, '-');
  }
}
