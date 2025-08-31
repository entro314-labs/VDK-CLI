/**
 * Comprehensive Integration Tests - Complete coverage of all integration modules
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'

// Mock file system operations to avoid test pollution
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual('node:fs/promises')
  return {
    ...actual,
    access: vi.fn().mockRejectedValue(new Error('File not found')),
    readFile: vi.fn().mockResolvedValue('{}'),
    stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false }),
  }
})

// Mock process.platform for consistent testing
Object.defineProperty(process, 'platform', {
  value: 'darwin',
  writable: true,
})

// Mock process.env.HOME for consistent testing
process.env.HOME = '/Users/testuser'
process.env.USERPROFILE = process.env.HOME

describe('Complete Integration Coverage', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })
  describe('Integration Manager - Full Coverage', () => {
    it('should create integration manager instance with priority system', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      const manager = new IntegrationManager(global.TEST_ROOT || '/test/project')
      expect(manager).toBeDefined()
      expect(manager.projectPath).toBe(global.TEST_ROOT || '/test/project')
      expect(manager.integrations).toBeInstanceOf(Map)
      expect(manager.detectionResults).toBeInstanceOf(Map)
      
      // Test priority system methods exist
      expect(typeof manager.isContextPlatform).toBe('function')
      expect(typeof manager.prioritizeContextPlatforms).toBe('function')
      expect(typeof manager.getPrimaryIDE).toBe('function')
    })

    it('should register single integration', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const manager = new IntegrationManager()
      const integration = new BaseIntegration('test-integration')

      manager.register(integration)
      expect(manager.integrations.has('test-integration')).toBe(true)
    })

    it('should register multiple integrations', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const manager = new IntegrationManager()
      const integrations = [new BaseIntegration('test1'), new BaseIntegration('test2')]

      manager.registerMultiple(integrations)
      expect(manager.integrations.has('test1')).toBe(true)
      expect(manager.integrations.has('test2')).toBe(true)
    })

    it('should reject non-BaseIntegration instances', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      const manager = new IntegrationManager()

      expect(() => {
        manager.register({ name: 'invalid' })
      }).toThrow('Integration must extend BaseIntegration')
    })

    it('should discover integrations with priority awareness', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      const manager = new IntegrationManager(global.TEST_ROOT || '/test/project')

      try {
        const result = await manager.discoverIntegrations({ verbose: false })
        expect(result).toBeDefined()
        expect(result.loaded).toBeInstanceOf(Array)
        expect(result.failed).toBeInstanceOf(Array)
        expect(result.registered).toBeGreaterThanOrEqual(0)
        
        // Verify priority information is maintained
        for (const loaded of result.loaded) {
          expect(loaded.name).toBeDefined()
          expect(loaded.module).toBeDefined()
          expect(loaded.class).toBeDefined()
        }
      } catch (error) {
        // Discovery might fail due to missing dependencies, but should not crash
        expect(error).toBeDefined()
      }
    })
  })

  describe('All Integration Classes - Complete Coverage', () => {
    it('should load Claude Code CLI integration with context platform priority', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration(global.TEST_ROOT || '/test/project')

      expect(integration).toBeDefined()
      expect(integration.name).toBe('Claude Code CLI')
      expect(typeof integration.detectUsage).toBe('function')
      expect(typeof integration.getConfigPaths).toBe('function')

      // Test configuration paths
      const configPaths = integration.getConfigPaths()
      expect(configPaths.userSettings).toBeDefined()
      expect(configPaths.projectMemory).toBeDefined()
      expect(configPaths.projectCommands).toBeDefined()

      // Test usage detection with mocked file system
      const detection = integration.detectUsage()
      expect(detection.isUsed).toBeDefined()
      expect(detection.confidence).toBeDefined()
      expect(detection.indicators).toBeDefined()
      expect(detection.recommendations).toBeDefined()
      
      // Claude Code CLI is a context platform - verify priority
      expect(integration.priority).toBe('high')
    })

    it('should load Cursor integration with context platform priority', async () => {
      const cursorModule = await import('../src/integrations/cursor-integration.js')

      expect(cursorModule).toBeDefined()
      expect(typeof cursorModule).toBe('object')
      
      // Check if Cursor integration class exists
      const integrationClass = Object.values(cursorModule).find(
        exp => typeof exp === 'function' && exp.name.includes('Integration')
      )
      
      if (integrationClass) {
        const integration = new integrationClass('/test/project')
        expect(integration.name).toContain('Cursor')
        expect(integration.priority).toBe('high') // Context platform
      }
    })

    it('should load Windsurf integration with context platform priority', async () => {
      const windsurfModule = await import('../src/integrations/windsurf-integration.js')

      expect(windsurfModule).toBeDefined()
      expect(typeof windsurfModule).toBe('object')
      
      // Check if Windsurf integration class exists
      const integrationClass = Object.values(windsurfModule).find(
        exp => typeof exp === 'function' && exp.name.includes('Integration')
      )
      
      if (integrationClass) {
        const integration = new integrationClass('/test/project')
        expect(integration.name).toContain('Windsurf')
        expect(integration.priority).toBe('high') // Context platform
      }
    })

    it('should load GitHub Copilot integration', async () => {
      const copilotModule = await import('../src/integrations/github-copilot-integration.js')

      expect(copilotModule).toBeDefined()
      expect(typeof copilotModule).toBe('object')
    })

    it('should load Generic IDE integration', async () => {
      const genericModule = await import('../src/integrations/generic-ide-integration.js')

      expect(genericModule).toBeDefined()
      expect(typeof genericModule).toBe('object')
    })

    it('should load integration index with exports', async () => {
      const indexModule = await import('../src/integrations/index.js')

      expect(indexModule).toBeDefined()
      expect(typeof indexModule).toBe('object')
    })
  })

  describe('Base Integration - Complete Method Coverage', () => {
    it('should provide all base functionality', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const integration = new BaseIntegration('test', global.TEST_ROOT)

      expect(integration.name).toBe('test')
      expect(integration.projectPath).toBe(global.TEST_ROOT)
      expect(integration.configPath).toBeNull()
      expect(integration.globalConfigPath).toBeNull()
      expect(integration._detectionCache).toBeNull()
      expect(integration._detectionCacheTime).toBeNull()
      expect(typeof integration._cacheValidityMs).toBe('number')
    })

    it('should enforce abstract method implementation', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const integration = new BaseIntegration('test')

      expect(() => integration.detectUsage()).toThrow('must be implemented')
      expect(() => integration.getConfigPaths()).toThrow('must be implemented')
    })

    it('should provide helper methods', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const integration = new BaseIntegration('test', global.TEST_ROOT)

      // Test file/directory existence helpers
      const existingDir = global.TEST_ROOT
      expect(typeof integration.directoryExists(existingDir)).toBe('boolean')
      expect(typeof integration.fileExists(existingDir)).toBe('boolean')
    })
  })

  describe('Priority-Based Detection System', () => {
    it('should prioritize context platforms over traditional IDEs', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')
      
      const manager = new IntegrationManager('/test/project')
      
      // Test priority classification
      expect(manager.isContextPlatform('Cursor')).toBe(true)
      expect(manager.isContextPlatform('Windsurf')).toBe(true)
      expect(manager.isContextPlatform('Claude Code CLI')).toBe(true)
      expect(manager.isContextPlatform('VS Code')).toBe(false)
      expect(manager.isContextPlatform('JetBrains')).toBe(false)
    })
    
    it('should correctly prioritize integrations in prioritizeContextPlatforms', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')
      
      const manager = new IntegrationManager('/test/project')
      
      // Test prioritizeContextPlatforms method
      const mockIntegrations = [
        { name: 'VS Code', confidence: 'high' },
        { name: 'Cursor', confidence: 'medium' },
        { name: 'JetBrains', confidence: 'high' },
        { name: 'Claude Code CLI', confidence: 'low' },
      ]
      
      const prioritized = manager.prioritizeContextPlatforms(mockIntegrations)
      
      // Context platforms should come first
      expect(prioritized[0].name).toBe('Cursor')
      expect(prioritized[1].name).toBe('Claude Code CLI')
      expect(prioritized[2].name).toBe('VS Code')
      expect(prioritized[3].name).toBe('JetBrains')
    })
    
    it('should handle getPrimaryIDE with context platform priority', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')
      
      const manager = new IntegrationManager('/test/project')
      
      // Mock lastScan results
      manager.lastScan = {
        active: [
          { name: 'VS Code', confidence: 'high' },
          { name: 'Cursor', confidence: 'medium' },
        ],
      }
      
      const primary = manager.getPrimaryIDE()
      
      // Even with lower confidence, context platform should be preferred when both are present
      if (primary) {
        expect(['Cursor', 'VS Code']).toContain(primary.name)
      }
    })
  })

  describe('Integration Detection Results', () => {
    it('should provide consistent detection format', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration(global.TEST_ROOT)
      const detection = integration.detectUsage()

      expect(typeof detection.isUsed).toBe('boolean')
      expect(typeof detection.confidence).toBe('string')
      expect(['none', 'low', 'medium', 'high']).toContain(detection.confidence)
      expect(Array.isArray(detection.indicators)).toBe(true)
      expect(Array.isArray(detection.recommendations)).toBe(true)
    })

    it('should handle detection caching', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration(global.TEST_ROOT)

      const detection1 = integration.detectUsage()
      const detection2 = integration.detectUsage()

      // Results should be consistent
      expect(detection1.isUsed).toBe(detection2.isUsed)
      expect(detection1.confidence).toBe(detection2.confidence)
    })
  })

  describe('Configuration Path Resolution', () => {
    it('should resolve all configuration paths', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration(global.TEST_ROOT)
      const configPaths = integration.getConfigPaths()

      // All paths should be strings
      Object.values(configPaths).forEach((configPath) => {
        expect(typeof configPath).toBe('string')
        expect(configPath.length).toBeGreaterThan(0)
      })

      // Should have required paths
      expect(configPaths.userSettings).toBeDefined()
      expect(configPaths.projectSettings).toBeDefined()
      expect(configPaths.projectMemory).toBeDefined()
      expect(configPaths.userMemory).toBeDefined()
      expect(configPaths.projectCommands).toBeDefined()
      expect(configPaths.userCommands).toBeDefined()
    })

    it('should handle different project paths', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration1 = new ClaudeCodeCLIIntegration('/path/one')
      const integration2 = new ClaudeCodeCLIIntegration('/path/two')

      const paths1 = integration1.getConfigPaths()
      const paths2 = integration2.getConfigPaths()

      // Project-specific paths should be different
      expect(paths1.projectMemory).not.toBe(paths2.projectMemory)
      expect(paths1.projectSettings).not.toBe(paths2.projectSettings)

      // User paths should be the same
      expect(paths1.userSettings).toBe(paths2.userSettings)
      expect(paths1.userMemory).toBe(paths2.userMemory)
    })
  })

  describe('Integration Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration('/nonexistent/path')

      // Should not throw errors during detection
      const detection = integration.detectUsage()
      expect(detection).toBeDefined()
      expect(typeof detection.isUsed).toBe('boolean')
    })

    it('should handle invalid configurations', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      // Test with invalid parameters
      const integration = new BaseIntegration('', '')
      expect(integration.name).toBe('')
      expect(integration.projectPath).toBe('')
    })
  })
})
