/**
 * Plugin Command
 * ==============
 * CLI command to manage VDK plugins.
 */

import path from 'node:path';
import { pluginRegistry } from '../../plugins/registry.js';
import { BaseCommand } from '../base/BaseCommand.js';

export class PluginCommand extends BaseCommand {
  constructor() {
    super('plugin', 'Manage VDK plugins');
  }

  configureOptions(command) {
    return command
      .command('list')
      .description('List installed plugins')
      .action(() => this.listPlugins())
      .parent.command('install <path>')
      .description('Install a plugin from a local path')
      .action(path => this.installPlugin(path));
  }

  async listPlugins() {
    this.showHeader();

    // For demo/prototype, load from a default directory
    const pluginDir = path.resolve(process.cwd(), '.vdk/plugins');
    await pluginRegistry.loadFromDirectory(pluginDir);

    console.log('\nInstalled Plugins:');
    if (pluginRegistry.plugins.size === 0) {
      console.log('  (No plugins installed)');
    } else {
      for (const [id, plugin] of pluginRegistry.plugins) {
        console.log(`  - ${plugin.name} (${id}) v${plugin.version}`);
        console.log(`    ${plugin.description || ''}`);
      }
    }
  }

  async installPlugin(pluginPath) {
    this.showHeader();
    this.logInfo(`Installing plugin from ${pluginPath}...`);
    // Logic to copy plugin to .vdk/plugins would go here
    this.logSuccess('Plugin installed (Prototype)');
  }
}
