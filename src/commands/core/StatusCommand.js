/**
 * StatusCommand
 * -----------------------
 * Handles 'vdk status' command - Check the status of VDK setup and Hub integration
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchRuleList } from '../../blueprints-client.js';
import { MigrationManager } from '../../migration/migration-manager.js';
import {
  displayDetailedHubStatus,
  displayTroubleshootingTips,
  formatHubStatusForTable,
  getHubStatus,
} from '../../shared/hub-status.js';
import { boxes, colors, format, status, tables } from '../../utils/cli-styles.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class StatusCommand extends BaseCommand {
  constructor() {
    super('status', 'Check the status of your VDK setup and Hub integration');
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-c, --configPath <path>', 'Path to the VDK configuration file', './vdk.config.json')
      .option('-o, --outputPath <path>', 'Path to the rules directory', './.vdk/rules')
      .option('--scope <scope>', 'Status check scope (all, local, hub)', 'all')
      .option('-v, --verbose', 'Show detailed status information', false);
  }

  /**
   * Execute the status command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    // Ensure default values are applied if options are undefined
    const configPath = path.resolve(options.configPath || './vdk.config.json');
    const rulesDir = path.resolve(options.outputPath || './.vdk/rules');
    const scope = options.scope || 'all';

    // Handle hub-only scope (provides detailed hub status like hub-status command)
    if (scope === 'hub') {
      return await this.executeHubOnlyStatus(options);
    }

    const spinner = this.createSpinner('Checking VDK status...');
    spinner.start();

    const statusTable = tables.status();
    let isConfigured = false;
    let hubStatus = null;

    // Check VDK configuration (unless hub-only scope)
    if (scope === 'all' || scope === 'local') {
      isConfigured = await this.checkVdkConfiguration(statusTable, configPath);
    }

    // Check Hub integration and blueprints (unless local-only scope)
    if (scope === 'all' || scope === 'hub') {
      hubStatus = await this.checkHubAndBlueprints(statusTable, rulesDir);
    }

    // Check IDE integrations (unless hub-only scope)
    if (scope === 'all' || scope === 'local') {
      await this.checkIdeIntegrations(statusTable);
    }

    spinner.stop();
    console.log(statusTable.toString());

    // Show detailed hub information if verbose and hub is checked
    if (options.verbose && hubStatus && (scope === 'all' || scope === 'hub')) {
      console.log('\n');
      displayDetailedHubStatus(hubStatus, true);

      if (!hubStatus.connected) {
        displayTroubleshootingTips();
      }
    }

    // Show getting started message if not configured
    if (!isConfigured && scope !== 'hub') {
      this.showGettingStarted();
    }

    return { configured: isConfigured, hubConnected: hubStatus?.connected };
  }

  /**
   * Execute hub-only status check (replaces hub-status command functionality)
   */
  async executeHubOnlyStatus(options) {
    try {
      const { quickHubOperations } = await import('../../hub/index.js');
      const hubOps = await quickHubOperations();

      const spinner = this.createSpinner('Testing Hub connection...');
      spinner.start();

      const hubStatus = await getHubStatus(hubOps);

      if (hubStatus.connected) {
        spinner.succeed('Connection test completed');
      } else {
        spinner.fail('Connection test failed');
      }

      displayDetailedHubStatus(hubStatus, options.verbose);

      if (!hubStatus.connected) {
        displayTroubleshootingTips();
      }

      this.trackSuccess({
        hubConnected: hubStatus.connected,
        verbose: options.verbose,
      });

      return {
        success: true,
        hubAvailable: hubStatus.available,
        hubConnected: hubStatus.connected,
      };
    } catch (error) {
      this.exitWithError(`Hub status check failed: ${error.message}`, error);
    }
  }

  /**
   * Check VDK configuration status
   */
  async checkVdkConfiguration(statusTable, configPath) {
    try {
      const config = await commandContext.readVdkConfig(process.cwd(), path.basename(configPath));
      if (config) {
        statusTable.push([
          'VDK Configuration',
          status.success('Found'),
          `${format.keyValue('Project', config.project.name)}\n${format.keyValue('IDE', config.ide)}`,
        ]);

        // Check for migration opportunities
        await this.checkMigrationOpportunities(statusTable);
        return true;
      }
    } catch (error) {
      // Configuration doesn't exist or is invalid
    }

    statusTable.push([
      'VDK Configuration',
      status.warning('Missing'),
      `Run ${colors.primary('vdk init')} to get started`,
    ]);
    return false;
  }

  /**
   * Check for existing AI contexts that could be migrated
   */
  async checkMigrationOpportunities(statusTable) {
    try {
      const migrationManager = new MigrationManager({ projectPath: process.cwd() });
      const projectScanner = migrationManager.projectScanner;
      const projectData = await projectScanner.scanProject(process.cwd());
      const migrationDetector = migrationManager.migrationDetector;
      const contexts = await migrationDetector.detectAIContexts(projectData);

      if (contexts.length > 0) {
        statusTable.push([
          'Existing AI Contexts',
          status.warning('Found'),
          `${format.count(contexts.length)} contexts available for migration\nRun ${colors.primary('vdk migrate')} to convert them`,
        ]);
      }
    } catch (error) {
      // Migration detection failed, skip silently
      if (this.verbose) {
        console.error('Migration detection error:', error.message);
      }
    }
  }

  /**
   * Check Hub integration and blueprint status
   */
  async checkHubAndBlueprints(statusTable, rulesDir) {
    // Check Hub integration
    const hubStatus = await this.checkHubIntegration(statusTable);

    // Check local and remote blueprints
    await this.checkBlueprintStatus(statusTable, rulesDir);

    return hubStatus;
  }

  /**
   * Check Hub integration status
   */
  async checkHubIntegration(statusTable) {
    try {
      const hubStatus = await getHubStatus(this.hubOps);
      const [name, statusType, details] = formatHubStatusForTable(hubStatus);
      statusTable.push([name, status[statusType](statusType), details]);
      return hubStatus;
    } catch (error) {
      statusTable.push(['VDK Hub Integration', status.error('Error'), error.message]);
      return { connected: false, available: false, error: error.message };
    }
  }

  /**
   * Check blueprint status (local and remote)
   */
  async checkBlueprintStatus(statusTable, rulesDir) {
    try {
      // Ensure rules directory exists for checking
      await commandContext.ensureRulesDirectory(rulesDir);

      const localRules = await fs.readdir(rulesDir).catch(() => []);
      statusTable.push([
        'Local Blueprints',
        status.success('Found'),
        `${format.count(localRules.length)} blueprints in ${format.path(rulesDir)}`,
      ]);

      // Check remote repository status
      const remoteRules = await fetchRuleList();
      if (remoteRules.length > 0) {
        const remoteRuleNames = remoteRules.map(r => r.name);
        const newRules = remoteRuleNames.filter(r => !localRules.includes(r));

        if (newRules.length > 0) {
          statusTable.push([
            'VDK Repository',
            status.warning('Updates Available'),
            `${format.count(newRules.length)} new blueprints available\nRun ${colors.primary('vdk sync')} to update`,
          ]);
        } else {
          statusTable.push([
            'VDK Repository',
            status.success('Up to Date'),
            `${format.count(remoteRules.length)} total blueprints in sync`,
          ]);
        }
      } else {
        statusTable.push([
          'VDK Repository',
          status.error('Unreachable'),
          'Could not connect to VDK-Blueprints repository',
        ]);
      }
    } catch (error) {
      statusTable.push(['Blueprint Status', status.error('Error'), error.message]);
    }
  }

  /**
   * Check IDE integrations
   */
  async checkIdeIntegrations(statusTable) {
    try {
      const integrationManager = await commandContext.createIntegrationManager();

      await integrationManager.discoverIntegrations({ verbose: false });
      const scanResults = await integrationManager.scanAll({ verbose: false });

      const activeIntegrations = scanResults.active.filter(
        integration => integration.confidence === 'high' || integration.confidence === 'medium'
      );

      if (activeIntegrations.length > 0) {
        const ideList = activeIntegrations
          .map(integration => `${integration.name} (${integration.confidence} confidence)`)
          .join('\n');

        statusTable.push([
          'Detected IDEs/AI Tools',
          status.success('Found'),
          `${format.count(activeIntegrations.length)} active integrations:\n${ideList}`,
        ]);
      } else {
        statusTable.push([
          'Detected IDEs/AI Tools',
          status.warning('None'),
          'No AI assistants or IDEs detected\nUse generic rules for maximum compatibility',
        ]);
      }
    } catch (error) {
      if (process.env.VDK_DEBUG) {
        console.error('IDE detection error:', error.message);
      }
      statusTable.push([
        'Detected IDEs/AI Tools',
        status.error('Error'),
        'Could not scan for IDE integrations',
      ]);
    }
  }

  /**
   * Show getting started message
   */
  showGettingStarted() {
    console.log(
      `\n${boxes.info(
        `Get started by running:\n${colors.primary('vdk init')}\n\nThis will scan your project and create project-aware AI blueprints.\n\nOther useful commands:\n${colors.primary('vdk sync')} - Sync blueprints from Hub and repository\n${colors.primary('vdk hub status')} - Check Hub integration\n${colors.primary('vdk migrate')} - Convert existing AI contexts`,
        'Quick Start'
      )}`
    );
  }
}
