/**
 * MCP Command
 * ===========
 * CLI command to manage MCP servers.
 */

import { mcpManager } from '../../mcp/McpManager.js';
import { BaseCommand } from '../base/BaseCommand.js';

export class McpCommand extends BaseCommand {
  constructor() {
    super('mcp', 'Manage Model Context Protocol servers');
  }

  configureOptions(command) {
    command
      .command('list')
      .description('List discovered MCP servers')
      .action(() => this.listServers());

    command
      .command('update-config')
      .description('Update MCP configuration in rule files')
      .option('-f, --force', 'Force update even if no IDEs detected', false)
      .action(options => this.updateConfig(options));

    return command;
  }

  async listServers() {
    this.showHeader();

    await mcpManager.discover();
    const servers = mcpManager.getServers();

    console.log('\nDiscovered MCP Servers:');
    if (Object.keys(servers).length === 0) {
      console.log('  (No servers found in standard locations)');
    } else {
      for (const [name, config] of Object.entries(servers)) {
        console.log(`  - ${name}`);
        console.log(`    Command: ${config.command} ${config.args?.join(' ') || ''}`);
        console.log(`    Source: ${config.source}`);
      }
    }
  }

  async updateConfig(options) {
    this.showHeader();
    const spinner = this.createSpinner('Updating MCP configuration...');
    spinner.start();

    try {
      const result = await mcpManager.updateProjectConfig(process.cwd(), options);

      if (result.success) {
        spinner.succeed(`Updated MCP configuration in ${result.updated} directories`);
        if (result.details) {
          result.details.forEach(det => {
            if (det.success) this.logSuccess(`Updated ${det.path}`);
            else this.logError(`Failed to update ${det.path}`);
          });
        }
      } else {
        spinner.fail(result.message);
        if (!options.force && result.message.includes('No IDE')) {
          this.logInfo('Tip: Use --force to create default configuration');
        }
      }
    } catch (error) {
      spinner.fail('Failed to update MCP configuration');
      this.logError(error.message);
    }
  }
}
