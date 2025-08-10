/**
 * Integration Tests - Test all IDE integration modules
 */
import { describe, expect, it } from 'vitest'

describe('IDE Integrations', () => {
  describe('Integration Manager', () => {
    it('should load integration manager', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      expect(IntegrationManager).toBeDefined()
      expect(typeof IntegrationManager).toBe('function')
    })

    it('should manage integrations lifecycle', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      const manager = new IntegrationManager()
      expect(manager).toBeDefined()

      if (typeof manager.getAvailableIntegrations === 'function') {
        const integrations = await manager.getAvailableIntegrations()
        expect(Array.isArray(integrations)).toBe(true)
      }
    })
  })

  describe('Base Integration', () => {
    it('should provide base integration class', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      expect(BaseIntegration).toBeDefined()
      expect(typeof BaseIntegration).toBe('function')
    })

    it('should create base integration instance', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const integration = new BaseIntegration('test', global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('test')
      expect(integration.projectPath).toBe(global.TEST_ROOT)
    })

    it('should require implementation of abstract methods', async () => {
      const { BaseIntegration } = await import('../src/integrations/base-integration.js')

      const integration = new BaseIntegration('test')

      expect(() => integration.detectUsage()).toThrow()
      expect(() => integration.getConfigPaths()).toThrow()
    })
  })

  describe('Claude Code Integration', () => {
    it('should load claude code integration', async () => {
      const { ClaudeCodeIntegration } = await import(
        '../src/integrations/claude-code-integration.js'
      )

      expect(ClaudeCodeIntegration).toBeDefined()
      expect(typeof ClaudeCodeIntegration).toBe('function')
    })

    it('should create claude code integration instance', async () => {
      const { ClaudeCodeIntegration } = await import(
        '../src/integrations/claude-code-integration.js'
      )

      const integration = new ClaudeCodeIntegration(global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('Claude Code')

      const configPaths = integration.getConfigPaths()
      expect(configPaths).toBeDefined()
      expect(configPaths.projectMemory).toBeDefined()
    })

    it('should detect usage', async () => {
      const { ClaudeCodeIntegration } = await import(
        '../src/integrations/claude-code-integration.js'
      )

      const integration = new ClaudeCodeIntegration(global.TEST_ROOT)
      const detection = integration.detectUsage()

      expect(detection).toBeDefined()
      expect(typeof detection.isUsed).toBe('boolean')
    })
  })

  describe('Cursor Integration', () => {
    it('should load cursor integration', async () => {
      const integration = await import('../src/integrations/cursor-integration.js')

      expect(integration).toBeDefined()
    })
  })

  describe('Windsurf Integration', () => {
    it('should load windsurf integration', async () => {
      const integration = await import('../src/integrations/windsurf-integration.js')

      expect(integration).toBeDefined()
    })
  })

  describe('GitHub Copilot Integration', () => {
    it('should load github copilot integration', async () => {
      const integration = await import('../src/integrations/github-copilot-integration.js')

      expect(integration).toBeDefined()
    })
  })

  describe('Generic IDE Integration', () => {
    it('should load generic ide integration', async () => {
      const integration = await import('../src/integrations/generic-ide-integration.js')

      expect(integration).toBeDefined()
    })
  })

  describe('Integration Index', () => {
    it('should export all integrations', async () => {
      const integrations = await import('../src/integrations/index.js')

      expect(integrations).toBeDefined()
      expect(typeof integrations).toBe('object')
    })
  })
})
