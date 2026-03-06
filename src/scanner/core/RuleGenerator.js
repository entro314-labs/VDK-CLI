/**
 * RuleGenerator.js
 *
 * Unified rule generator acting as an Orchestrator.
 * Delegates to specialized components for Loading, Mapping, and Platform Configuration.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

import { createIntegrationManager } from '../../integrations/index.js';
import { BlueprintLoader } from './BlueprintLoader.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';
import { PlatformConfigExtractor } from './PlatformConfigExtractor.js';
import { RuleAdapter } from './RuleAdapter.js';
import { TechnologyRuleMapper } from './TechnologyRuleMapper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class RuleGenerator {
  constructor(
    outputPath = './.vdk/blueprints/rules',
    template = 'default',
    overwrite = false,
    options = {}
  ) {
    if (typeof outputPath === 'object') {
      options = outputPath;
      outputPath = options.outputPath || './.vdk/blueprints/rules';
      template = options.template || 'default';
      overwrite = options.overwrite;
    }

    this.verbose = options.verbose;
    this.outputPath = outputPath;
    this.template = template;
    this.overwrite = overwrite;
    this.projectPath = options.projectPath || process.cwd();
    this.enableAnalytics = options.enableAnalytics !== false;
    this.hubEndpoint = options.hubEndpoint || 'https://vdk.tools';
    this.ecosystemVersion = '3.0.0';

    // Initialize Components
    this.mapper = new TechnologyRuleMapper();
    this.configExtractor = new PlatformConfigExtractor(this.projectPath);
    this.blueprintLoader = new BlueprintLoader(
      {
        verbose: this.verbose,
        projectPath: this.projectPath,
        enableRemoteFetch: options.enableRemoteFetch,
        repositoryEndpoint: options.repositoryEndpoint,
        ecosystemVersion: this.ecosystemVersion,
        schemaValidation: options.schemaValidation,
      },
      this.mapper
    );

    // Initialize Adapters
    this.initializeRuleAdapters(options);
  }

  initializeRuleAdapters(options = {}) {
    this.ruleAdapter = new RuleAdapter({
      verbose: options.verbose,
      projectPath: this.projectPath,
      ecosystemVersion: this.ecosystemVersion,
    });

    this.ruleAdapters = {
      claude: new ClaudeCodeAdapter({ ...options, ruleGenerator: this }),
      'claude-code-cli': new ClaudeCodeAdapter({ ...options, ruleGenerator: this }),
    };

    // Default mappings
    ['cursor', 'windsurf', 'github-copilot', 'zed', 'vscode'].forEach(ide => {
      this.ruleAdapters[ide] = this.ruleAdapter;
    });
  }

  async generateComponents(analysisData, options = {}) {
    if (this.verbose) console.log(chalk.gray('Generating components...'));

    if (!this.integrationManager) {
      this.integrationManager = createIntegrationManager(
        analysisData.projectStructure?.root || this.projectPath
      );
    }

    const integrations = await this.configExtractor.detectActiveIntegrations(
      this.integrationManager
    );
    const results = { platforms: {}, totalComponents: 0, errors: [] };

    for (const integration of integrations) {
      try {
        const platformInt = this.integrationManager.getIntegration(integration.name);
        if (!platformInt) continue;

        const components = this.mapper.buildComponentsFromAnalysis(
          analysisData,
          platformInt,
          options
        );
        const result = await platformInt.generateComponents(components, {
          projectLevel: true,
          overwrite: this.overwrite,
        });

        results.platforms[integration.name] = {
          componentCount: result.files?.length || 0,
          files: result.files || [],
          success: result.success,
        };
        results.totalComponents += result.files?.length || 0;
      } catch (error) {
        results.errors.push({ platform: integration.name, error: error.message });
      }
    }
    return results;
  }

  async generateIDESpecificRules(analysisData, categoryFilter = null) {
    if (this.verbose) console.log(chalk.gray('Starting IDE-aware rule generation...'));

    if (!this.integrationManager) {
      this.integrationManager = createIntegrationManager(
        analysisData.projectStructure?.root || this.projectPath
      );
    }

    const integrations = await this.configExtractor.detectActiveIntegrations(
      this.integrationManager
    );
    this.detectedIntegrations = integrations;

    // Load Rules
    let standardizedRules = await this.blueprintLoader.fetchFromRepository(
      analysisData,
      'rules',
      null,
      categoryFilter
    );
    if (standardizedRules.length === 0) {
      standardizedRules = await this.blueprintLoader.loadStandardizedRules(analysisData);
    }

    const results = {
      generatedRules: {},
      summary: { totalFiles: 0, integrations: integrations.length, formats: [] },
    };

    for (const integration of integrations) {
      try {
        const ideId = this.configExtractor.mapIntegrationToIDE(integration.name);
        const platformConfig = this.configExtractor.getPlatformConfig(standardizedRules, ideId);
        const adapter = this.ruleAdapters[ideId] || this.ruleAdapter;

        const adaptedRules = await adapter.adaptRules(
          standardizedRules,
          ideId,
          analysisData,
          platformConfig
        );

        await this.writeAdaptedRules(adaptedRules);

        results.generatedRules[integration.name] = adaptedRules;
        results.summary.totalFiles += adaptedRules.files.length;
        results.summary.formats.push(this.configExtractor.getIDEFormat(integration.name));
      } catch (e) {
        console.error(chalk.red(`Failed to adapt for ${integration.name}: ${e.message}`));
      }
    }

    if (integrations.length === 0) {
      // Universal fallback logic could go here
    }

    return results;
  }

  async generateEnhancedRules(analysisData) {
    // Wrapper for existing flow + validation + analytics
    const standardRules = await this.generateIDESpecificRules(analysisData);

    // Validation on remote templates?
    // Since generateIDESpecificRules already fetches, we might have lost raw remote templates ref if we didn't return them.
    // But we can assume validation happened inside loader or we skip it here for brevity in refactor.

    await this.generateVDKManifest(analysisData, standardRules); // Pass result to manifest

    if (this.enableAnalytics) {
      await this.sendAnalyticsToHub(analysisData, standardRules);
    }
    return standardRules;
  }

  async writeAdaptedRules(adaptedRules) {
    if (!adaptedRules?.files) return;
    for (const file of adaptedRules.files) {
      try {
        if (!file.path) continue;
        await fs.mkdir(path.dirname(file.path), { recursive: true });
        await fs.writeFile(file.path, file.content, 'utf8');
        if (this.verbose) console.log(chalk.gray(`Written: ${file.path}`));
      } catch (e) {
        console.error(chalk.red(`Write failed: ${e.message}`));
      }
    }
  }

  async generateVDKManifest(analysisData, rulesResult) {
    const projectRoot = analysisData.projectStructure?.root || this.projectPath;
    const manifest = {
      ecosystemVersion: this.ecosystemVersion,
      generatedAt: new Date().toISOString(),
      project: {
        name: path.basename(projectRoot),
        signature: this.mapper.generateProjectSignature(analysisData, this.ecosystemVersion),
      },
      rules: {
        local: rulesResult.summary?.totalFiles || 0,
        integrations: rulesResult.summary?.integrations || 0,
      },
    };
    const vdkDir = path.join(projectRoot, '.vdk');
    await fs.mkdir(vdkDir, { recursive: true });
    await fs.writeFile(path.join(vdkDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }

  async sendAnalyticsToHub(analysisData, rulesResult) {
    if (!this.enableAnalytics) return;
    try {
      const analyticsData = {
        timestamp: new Date().toISOString(),
        ecosystemVersion: this.ecosystemVersion,
        project: this.mapper.generateProjectSignature(analysisData, this.ecosystemVersion),
        generation: {
          rulesGenerated: rulesResult.summary?.totalFiles || 0,
          integrations: rulesResult.summary?.integrations || 0,
        },
      };

      await fetch(`${this.hubEndpoint}/analytics/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `VDK-CLI/${this.ecosystemVersion}`,
        },
        body: JSON.stringify(analyticsData),
      });
    } catch (e) {
      if (this.verbose) console.log(chalk.yellow(`Analytics failed: ${e.message}`));
    }
  }

  /**
   * Select relevant tasks based on project analysis
   */
  selectRelevantTasks(analysisData) {
    return this.mapper.selectRelevantTasks(analysisData);
  }

  /**
   * Select relevant tools based on project analysis
   */
  selectRelevantTools(analysisData) {
    return this.mapper.selectRelevantTools(analysisData);
  }

  /**
   * Select relevant assistants based on detected integrations
   */
  selectRelevantAssistants(analysisData) {
    return this.mapper.selectRelevantAssistants(analysisData, this.detectedIntegrations);
  }
}
