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

  describe('JetBrains Integration', () => {
    it('should load jetbrains integration', async () => {
      const { JetBrainsIntegration } = await import('../src/integrations/jetbrains-integration.js')

      expect(JetBrainsIntegration).toBeDefined()
      expect(typeof JetBrainsIntegration).toBe('function')
    })

    it('should create jetbrains integration instance', async () => {
      const { JetBrainsIntegration } = await import('../src/integrations/jetbrains-integration.js')

      const integration = new JetBrainsIntegration(global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('JetBrains IDEs')

      const configPaths = integration.getConfigPaths()
      expect(configPaths).toBeDefined()
      expect(configPaths.projectConfig).toBeDefined()
      expect(configPaths.rulesPath).toBeDefined()
    })

    it('should detect JetBrains IDE usage', async () => {
      const { JetBrainsIntegration } = await import('../src/integrations/jetbrains-integration.js')

      const integration = new JetBrainsIntegration(global.TEST_ROOT)
      const detection = integration.detectUsage()

      expect(detection).toBeDefined()
      expect(typeof detection.isUsed).toBe('boolean')
      expect(typeof detection.confidence).toBe('string')
      expect(Array.isArray(detection.indicators)).toBe(true)
      expect(Array.isArray(detection.recommendations)).toBe(true)
    })
  })

  describe('Zed Integration', () => {
    it('should load zed integration', async () => {
      const { ZedIntegration } = await import('../src/integrations/zed-integration.js')

      expect(ZedIntegration).toBeDefined()
      expect(typeof ZedIntegration).toBe('function')
    })

    it('should create zed integration instance', async () => {
      const { ZedIntegration } = await import('../src/integrations/zed-integration.js')

      const integration = new ZedIntegration(global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('Zed Editor')

      const configPaths = integration.getConfigPaths()
      expect(configPaths).toBeDefined()
      expect(configPaths.projectConfig).toBeDefined()
      expect(configPaths.rulesPath).toBeDefined()
    })
  })

  describe('VS Code Variants Integration', () => {
    it('should load vscode variants integration', async () => {
      const { VSCodeInsidersIntegration, VSCodiumIntegration } = await import('../src/integrations/vscode-variants-integration.js')

      expect(VSCodeInsidersIntegration).toBeDefined()
      expect(VSCodiumIntegration).toBeDefined()
      expect(typeof VSCodeInsidersIntegration).toBe('function')
      expect(typeof VSCodiumIntegration).toBe('function')
    })

    it('should create vscode insiders integration instance', async () => {
      const { VSCodeInsidersIntegration } = await import('../src/integrations/vscode-variants-integration.js')

      const integration = new VSCodeInsidersIntegration(global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('VS Code Insiders')
      expect(integration.variant).toBe('vscode-insiders')
    })

    it('should create vscodium integration instance', async () => {
      const { VSCodiumIntegration } = await import('../src/integrations/vscode-variants-integration.js')

      const integration = new VSCodiumIntegration(global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('VSCodium')
      expect(integration.variant).toBe('vscodium')
    })
  })

  describe('Generic AI Integration', () => {
    it('should load generic ai integration', async () => {
      const { GenericAIIntegration } = await import('../src/integrations/generic-ai-integration.js')

      expect(GenericAIIntegration).toBeDefined()
      expect(typeof GenericAIIntegration).toBe('function')
    })

    it('should create generic ai integration instance', async () => {
      const { GenericAIIntegration } = await import('../src/integrations/generic-ai-integration.js')

      const integration = new GenericAIIntegration(global.TEST_ROOT)
      expect(integration).toBeDefined()
      expect(integration.name).toBe('Generic AI Platform')

      const configPaths = integration.getConfigPaths()
      expect(configPaths).toBeDefined()
      expect(configPaths.projectConfig).toBeDefined()
      expect(configPaths.rulesPath).toBeDefined()
      expect(configPaths.configFile).toBeDefined()
    })
  })

  describe('Integration Manager Discovery', () => {
    it('should discover all new integrations', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      const manager = new IntegrationManager()
      const results = await manager.discoverIntegrations({ verbose: false })

      expect(results).toBeDefined()
      expect(results.loaded).toBeDefined()
      expect(results.failed).toBeDefined()
      expect(results.registered).toBeGreaterThanOrEqual(0)

      // Check that new integrations are attempted to be loaded
      const expectedModules = [
        './jetbrains-integration.js',
        './zed-integration.js', 
        './vscode-variants-integration.js',
        './generic-ai-integration.js'
      ]

      const allModules = [...results.loaded, ...results.failed].map(r => r.module)
      for (const expectedModule of expectedModules) {
        expect(allModules.some(module => module.includes(expectedModule.replace('./', '')))).toBe(true)
      }
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
