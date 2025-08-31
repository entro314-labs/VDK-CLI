/**
 * Command Registry
 * -----------------------
 * Central registry for all VDK CLI commands. Handles command registration,
 * routing, and provides a clean interface for the main CLI.
 */

import { Command } from 'commander'

// Core commands
import { InitCommand } from './core/InitCommand.js'
import { ScanCommand } from './core/ScanCommand.js'
import { StatusCommand } from './core/StatusCommand.js'
import { ValidateCommand } from './core/ValidateCommand.js'

// Blueprint commands
import { SyncCommand } from './blueprints/SyncCommand.js'
import { BrowseCommand } from './blueprints/BrowseCommand.js'
import { DeployCommand } from './blueprints/DeployCommand.js'
import { CreateCommand } from './blueprints/CreateCommand.js'
import { SearchCommand } from './blueprints/SearchCommand.js'
import { AnalyzeCommand } from './blueprints/AnalyzeCommand.js'
import { UpdateCommand } from './blueprints/UpdateCommand.js'
import { RepoStatsCommand } from './blueprints/RepoStatsCommand.js'
import { PlatformCommand } from './blueprints/PlatformCommand.js'

// Migration commands
import { MigrateCommand } from './migration/MigrateCommand.js'
import { ImportCommand } from './migration/ImportCommand.js'
import { SchemaMigrateCommand } from './migration/SchemaMigrateCommand.js'

// Community commands
import { PublishCommand } from './community/PublishCommand.js'

// Hub commands
import { HubStatusCommand } from './hub/HubStatusCommand.js'
import { HubGenerateCommand } from './hub/HubGenerateCommand.js'

/**
 * Command registry class
 */
export class CommandRegistry {
  constructor() {
    this.commands = new Map()
    this.registerCommands()
  }

  /**
   * Register all available commands
   */
  registerCommands() {
    // Core commands
    this.register(new InitCommand())
    this.register(new ScanCommand())
    this.register(new StatusCommand())
    this.register(new ValidateCommand())

    // Blueprint commands
    this.register(new SyncCommand())
    this.register(new BrowseCommand())
    this.register(new DeployCommand())
    this.register(new CreateCommand())
    this.register(new SearchCommand())
    this.register(new AnalyzeCommand())
    this.register(new UpdateCommand())
    this.register(new RepoStatsCommand())
    this.register(new PlatformCommand())

    // Migration commands
    this.register(new MigrateCommand())
    this.register(new ImportCommand())
    this.register(new SchemaMigrateCommand())

    // Community commands
    this.register(new PublishCommand())

    // Hub commands
    this.register(new HubStatusCommand())
    this.register(new HubGenerateCommand())
  }

  /**
   * Register a single command
   */
  register(commandInstance) {
    this.commands.set(commandInstance.name, commandInstance)
  }

  /**
   * Get a command by name
   */
  get(commandName) {
    return this.commands.get(commandName)
  }

  /**
   * Get all registered commands
   */
  getAll() {
    return Array.from(this.commands.values())
  }

  /**
   * Configure all commands on a Commander program
   */
  configureProgram(program) {
    for (const commandInstance of this.commands.values()) {
      const commandDefinition = program.command(commandInstance.name).description(commandInstance.description)

      // Configure command-specific options
      if (commandInstance.configureOptions) {
        commandInstance.configureOptions(commandDefinition)
      }

      // Set up command action
      commandDefinition.action(async (...args) => {
        // Commander.js passes arguments followed by options as the last parameter
        const options = args[args.length - 1]
        const commandArgs = args.slice(0, -1)

        // Add arguments to options for easy access
        options.args = commandArgs

        await commandInstance.run(options)
      })
    }

    return program
  }
}

/**
 * Factory function to create configured Commander program
 */
export function createCLIProgram(packageInfo) {
  const program = new Command()

  // Configure base program
  program
    .name('vdk')
    .description("VDK CLI: The world's first Vibe Development Kit - One Context, All AI Assistants")
    .version(packageInfo.version)

  // Register all commands
  const registry = new CommandRegistry()
  registry.configureProgram(program)

  return program
}
