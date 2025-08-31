/**
 * Comprehensive Command Tests - Tests for all new command structure
 * Tests the new modular command architecture and BaseCommand functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setupTestEnvironment, resetAllMocks } from './helpers/network-mocks.js'

// Set up test environment
setupTestEnvironment()

// Mock external dependencies
vi.mock('../src/hub/index.js', () => ({
  isHubAvailable: vi.fn().mockResolvedValue(false),
  quickHubOperations: vi.fn().mockResolvedValue(null),
}))

// Mock process.exit
const mockExit = vi.fn()
vi.stubGlobal('process', { ...process, exit: mockExit })

describe('Command Architecture - Comprehensive Tests', () => {
  beforeEach(() => {
    resetAllMocks()
    mockExit.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('BaseCommand Functionality', () => {
    it('should create BaseCommand instance with hub integration', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      const command = new BaseCommand('test', 'Test command')
      
      expect(command.name).toBe('test')
      expect(command.description).toBe('Test command')
      expect(command.verbose).toBe(false)
      expect(command.hubOps).toBe(null)
      expect(command.sessionId).toBe(null)
    })

    it('should initialize with options and hub operations', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      const command = new BaseCommand('test', 'Test command')
      
      await command.initialize({ verbose: true })
      
      expect(command.verbose).toBe(true)
      // Hub should be unavailable in test environment
      expect(command.hubOps).toBe(null)
    })

    it('should provide consistent logging methods', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      const command = new BaseCommand('test', 'Test command')
      
      // Mock console methods
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      command.logSuccess('Success message')
      command.logInfo('Info message')
      command.logWarning('Warning message')
      command.logError('Error message')
      
      expect(logSpy).toHaveBeenCalledTimes(4)
      
      logSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('should handle exitWithError correctly', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      const command = new BaseCommand('test', 'Test command')
      
      // Mock console.error
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      command.exitWithError('Test error message')
      
      expect(errorSpy).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
      
      errorSpy.mockRestore()
    })

    it('should validate required options', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      const command = new BaseCommand('test', 'Test command')
      
      // Mock exitWithError to avoid process.exit
      const exitSpy = vi.spyOn(command, 'exitWithError').mockImplementation(() => {})
      
      command.validateOptions({ param1: 'value1' }, ['param1', 'param2'])
      
      expect(exitSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required options: param2')
      )
      
      exitSpy.mockRestore()
    })

    it('should enforce abstract method implementation', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      const command = new BaseCommand('test', 'Test command')
      
      await expect(command.execute({})).rejects.toThrow(
        'Command test must implement execute() method'
      )
    })
  })

  describe('Command Registry', () => {
    it('should register and manage commands', async () => {
      const { CommandRegistry } = await import('../src/commands/index.js')
      
      const registry = new CommandRegistry()
      
      expect(registry.commands).toBeInstanceOf(Map)
      expect(registry.commands.size).toBeGreaterThan(0) // Should have registered commands
    })

    it('should retrieve commands by name', async () => {
      const { CommandRegistry } = await import('../src/commands/index.js')
      
      const registry = new CommandRegistry()
      
      // Check for known commands
      const initCommand = registry.get('init')
      const scanCommand = registry.get('scan')
      
      expect(initCommand).toBeDefined()
      expect(scanCommand).toBeDefined()
    })

    it('should configure Commander program', async () => {
      const { CommandRegistry } = await import('../src/commands/index.js')
      const { Command } = await import('commander')
      
      const registry = new CommandRegistry()
      const program = new Command()
      
      const configuredProgram = registry.configureProgram(program)
      
      expect(configuredProgram).toBe(program)
      // Program should have commands registered
      expect(program.commands.length).toBeGreaterThan(0)
    })
  })

  describe('Core Commands', () => {
    it('should load InitCommand', async () => {
      const { InitCommand } = await import('../src/commands/core/InitCommand.js')
      
      const command = new InitCommand()
      
      expect(command.name).toBe('init')
      expect(command.description).toContain('Initialize VDK')
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load ScanCommand', async () => {
      const { ScanCommand } = await import('../src/commands/core/ScanCommand.js')
      
      const command = new ScanCommand()
      
      expect(command.name).toBe('scan')
      expect(command.description).toContain('Scan project')
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load StatusCommand', async () => {
      const { StatusCommand } = await import('../src/commands/core/StatusCommand.js')
      
      const command = new StatusCommand()
      
      expect(command.name).toBe('status')
      expect(command.description).toContain('Show VDK status')
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load ValidateCommand', async () => {
      const { ValidateCommand } = await import('../src/commands/core/ValidateCommand.js')
      
      const command = new ValidateCommand()
      
      expect(command.name).toBe('validate')
      expect(command.description).toContain('Validate')
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })
  })

  describe('Migration Commands', () => {
    it('should load MigrateCommand', async () => {
      const { MigrateCommand } = await import('../src/commands/migration/MigrateCommand.js')
      
      const command = new MigrateCommand()
      
      expect(command.name).toBe('migrate')
      expect(command.description).toContain('Migrate existing AI contexts')
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load ImportCommand', async () => {
      const { ImportCommand } = await import('../src/commands/migration/ImportCommand.js')
      
      const command = new ImportCommand()
      
      expect(command.name).toBe('import')
      expect(command.description).toContain('Auto-detect and import')
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load SchemaMigrateCommand', async () => {
      const { SchemaMigrateCommand } = await import('../src/commands/migration/SchemaMigrateCommand.js')
      
      const command = new SchemaMigrateCommand()
      
      expect(command.name).toBe('schema-migrate')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })
  })

  describe('Blueprint Commands', () => {
    it('should load SyncCommand', async () => {
      const { SyncCommand } = await import('../src/commands/blueprints/SyncCommand.js')
      
      const command = new SyncCommand()
      
      expect(command.name).toBe('sync')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load BrowseCommand', async () => {
      const { BrowseCommand } = await import('../src/commands/blueprints/BrowseCommand.js')
      
      const command = new BrowseCommand()
      
      expect(command.name).toBe('browse')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load CreateCommand', async () => {
      const { CreateCommand } = await import('../src/commands/blueprints/CreateCommand.js')
      
      const command = new CreateCommand()
      
      expect(command.name).toBe('create')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })
  })

  describe('Hub Commands', () => {
    it('should load HubStatusCommand', async () => {
      const { HubStatusCommand } = await import('../src/commands/hub/HubStatusCommand.js')
      
      const command = new HubStatusCommand()
      
      expect(command.name).toBe('hub-status')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })

    it('should load HubGenerateCommand', async () => {
      const { HubGenerateCommand } = await import('../src/commands/hub/HubGenerateCommand.js')
      
      const command = new HubGenerateCommand()
      
      expect(command.name).toBe('hub-generate')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })
  })

  describe('Community Commands', () => {
    it('should load PublishCommand', async () => {
      const { PublishCommand } = await import('../src/commands/community/PublishCommand.js')
      
      const command = new PublishCommand()
      
      expect(command.name).toBe('publish')
      expect(command.description).toBeDefined()
      expect(typeof command.configureOptions).toBe('function')
      expect(typeof command.execute).toBe('function')
    })
  })

  describe('Command Context', () => {
    it('should provide command context utilities', async () => {
      const { commandContext } = await import('../src/commands/shared/CommandContext.js')
      
      expect(commandContext).toBeDefined()
      expect(typeof commandContext.initialize).toBe('function')
    })
  })

  describe('CLI Program Factory', () => {
    it('should create CLI program with all commands', async () => {
      const { createCLIProgram } = await import('../src/commands/index.js')
      
      const mockPackageInfo = {
        name: 'test-cli',
        version: '1.0.0',
        description: 'Test CLI',
      }
      
      const program = createCLIProgram(mockPackageInfo)
      
      expect(program).toBeDefined()
      expect(program.name()).toBe('vdk')
      expect(program.version()).toBe('1.0.0')
      expect(program.commands.length).toBeGreaterThan(0)
    })

    it('should handle command execution errors gracefully', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      class TestCommand extends BaseCommand {
        constructor() {
          super('test-error', 'Test error command')
        }
        
        async execute() {
          throw new Error('Test execution error')
        }
      }
      
      const command = new TestCommand()
      
      // Mock the exitWithError method to avoid process.exit
      const exitSpy = vi.spyOn(command, 'exitWithError').mockImplementation(() => {})
      
      await command.run({})
      
      expect(exitSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error command failed'),
        expect.any(Error)
      )
      
      exitSpy.mockRestore()
    })
  })

  describe('Command Integration with Hub', () => {
    it('should track command execution when hub is available', async () => {
      // Mock hub as available for this test
      vi.doMock('../src/hub/index.js', () => ({
        isHubAvailable: vi.fn().mockResolvedValue(true),
        quickHubOperations: vi.fn().mockResolvedValue({
          trackCommand: vi.fn().mockReturnValue('session-id'),
        }),
      }))
      
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      class TestCommand extends BaseCommand {
        constructor() {
          super('test-hub', 'Test hub command')
        }
        
        async execute() {
          return { success: true }
        }
      }
      
      const command = new TestCommand()
      const result = await command.run({ verbose: true })
      
      expect(result).toEqual({ success: true })
    })

    it('should handle hub unavailability gracefully', async () => {
      const { BaseCommand } = await import('../src/commands/base/BaseCommand.js')
      
      class TestCommand extends BaseCommand {
        constructor() {
          super('test-no-hub', 'Test no hub command')
        }
        
        async execute() {
          return { success: true }
        }
      }
      
      const command = new TestCommand()
      const result = await command.run({ verbose: true })
      
      expect(result).toEqual({ success: true })
      expect(command.hubOps).toBe(null)
    })
  })
})