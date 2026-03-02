/**
 * Command Registry
 * -----------------------
 * Central registry for all VDK CLI commands. Handles command registration,
 * routing, and provides a clean interface for the main CLI.
 */

import { Command } from 'commander';
import { AnalyzeCommand } from './blueprints/AnalyzeCommand.js';
import { BrowseCommand } from './blueprints/BrowseCommand.js';
import { CreateCommand } from './blueprints/CreateCommand.js';
import { DeployCommand } from './blueprints/DeployCommand.js';
import { PlatformCommand } from './blueprints/PlatformCommand.js';
import { RepoStatsCommand } from './blueprints/RepoStatsCommand.js';
import { SearchCommand } from './blueprints/SearchCommand.js';
// Blueprint commands
import { SyncCommand } from './blueprints/SyncCommand.js';
// Community commands
import { PublishCommand } from './community/PublishCommand.js';
import { ConvertCommand } from './core/ConvertCommand.js';
import { GenerateCommand } from './core/GenerateCommand.js';
import { ImportCommand } from './core/ImportCommand.js';
// Core commands
import { InitCommand } from './core/InitCommand.js';
import { ScanCommand } from './core/ScanCommand.js';
import { StatusCommand } from './core/StatusCommand.js';
import { ValidateCommand } from './core/ValidateCommand.js';
import { HubGenerateCommand } from './hub/HubGenerateCommand.js';
// MCP commands
import { McpCommand } from './mcp/McpCommand.js';
import { SchemaMigrateCommand } from './migration/SchemaMigrateCommand.js';
import { SchemaUpgradeCommand } from './migration/SchemaUpgradeCommand.js';
// Migration commands
import { UnifiedMigrateCommand } from './migration/UnifiedMigrateCommand.js';
// Plugin commands
import { PluginCommand } from './plugins/PluginCommand.js';
// Team commands
import { TeamShareCommand } from './team/ShareCommand.js';
import { TeamConfigCommand } from './team/SyncCommand.js';

/**
 * Command registry class
 */
export class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.registerCommands();
  }

  /**
   * Register all available commands
   */
  registerCommands() {
    // Core commands
    this.register(new InitCommand());
    this.register(new ScanCommand());
    this.register(new StatusCommand());
    this.register(new ValidateCommand());
    this.register(new ConvertCommand());
    this.register(new ImportCommand());
    this.register(new GenerateCommand());

    // Blueprint commands
    this.register(new SyncCommand());
    this.register(new BrowseCommand());
    this.register(new DeployCommand());
    this.register(new CreateCommand());
    this.register(new SearchCommand());
    this.register(new AnalyzeCommand());
    this.register(new RepoStatsCommand());
    this.register(new PlatformCommand());

    // Migration commands
    this.register(new UnifiedMigrateCommand());
    this.register(new SchemaMigrateCommand());
    this.register(new SchemaUpgradeCommand());

    // Community commands
    this.register(new PublishCommand());

    // Hub commands
    this.register(new HubGenerateCommand());

    // MCP commands
    this.register(new McpCommand());

    // Plugin commands
    this.register(new PluginCommand());

    // Team commands
    this.register(new TeamShareCommand());
    this.register(new TeamConfigCommand());
  }

  /**
   * Register a single command
   */
  register(commandInstance) {
    this.commands.set(commandInstance.name, commandInstance);
  }

  /**
   * Get a command by name
   */
  get(commandName) {
    return this.commands.get(commandName);
  }

  /**
   * Get all registered commands
   */
  getAll() {
    return Array.from(this.commands.values());
  }

  /**
   * Configure all commands on a Commander program
   */
  configureProgram(program) {
    for (const commandInstance of this.commands.values()) {
      const commandDefinition = program
        .command(commandInstance.name)
        .description(commandInstance.description);

      // Configure command-specific options
      if (commandInstance.configureOptions) {
        commandInstance.configureOptions(commandDefinition);
      }

      // Set up command action
      commandDefinition.action(async (...args) => {
        // Commander.js passes arguments followed by a Command instance as the last parameter.
        // Convert it to plain option values so handlers can reliably read options.<name>.
        const commandArg = args[args.length - 1];
        const options = typeof commandArg?.opts === 'function' ? commandArg.opts() : commandArg;
        const commandArgs = args.slice(0, -1);

        // Add arguments to options for easy access
        options.args = commandArgs;

        await commandInstance.run(options);
      });
    }

    return program;
  }
}

/**
 * Factory function to create configured Commander program
 */
export function createCLIProgram(packageInfo) {
  const program = new Command();

  // Configure base program
  program
    .name('vdk')
    .description("VDK CLI: The world's first Vibe Development Kit - One Context, All AI Assistants")
    .version(packageInfo.version);

  // Register all commands
  const registry = new CommandRegistry();
  registry.configureProgram(program);

  return program;
}
