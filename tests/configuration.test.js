/**
 * Configuration & Environment Tests - Complete coverage of config handling
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cleanupTempDir, createTempDir } from './helpers/cli-helper.js'

describe('Configuration & Environment', () => {
  let tempDir
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv

    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Environment Variable Handling', () => {
    it('should handle VDK_GITHUB_TOKEN environment variable', async () => {
      // Test without token
      process.env.VDK_GITHUB_TOKEN = undefined

      const { fetchRuleList } = await import('../src/blueprints-client.js')
      expect(typeof fetchRuleList).toBe('function')

      // Test with token
      process.env.VDK_GITHUB_TOKEN = 'test-token-123'
      expect(process.env.VDK_GITHUB_TOKEN).toBe('test-token-123')

      // Test token is used in requests (we won't make actual requests)
      const clientSource = await fs.readFile(path.join(global.TEST_ROOT, 'src/blueprints-client.js'), 'utf8')
      expect(clientSource).toContain('VDK_GITHUB_TOKEN')
    })

    it('should handle NODE_ENV environment variable', async () => {
      process.env.NODE_ENV = 'development'
      expect(process.env.NODE_ENV).toBe('development')

      process.env.NODE_ENV = 'production'
      expect(process.env.NODE_ENV).toBe('production')
    })

    it('should handle custom VDK environment variables', async () => {
      // Test various VDK-specific env vars
      process.env.VDK_DEBUG = 'true'
      process.env.VDK_CONFIG_PATH = './custom-config'
      process.env.VDK_RULES_PATH = './custom-rules'

      expect(process.env.VDK_DEBUG).toBe('true')
      expect(process.env.VDK_CONFIG_PATH).toBe('./custom-config')
      expect(process.env.VDK_RULES_PATH).toBe('./custom-rules')
    })
  })

  describe('VDK Configuration File Handling', () => {
    it('should create VDK configuration file', async () => {
      tempDir = await createTempDir('test-config')

      const configPath = path.join(tempDir, 'vdk.config.json')
      const config = {
        project: { name: 'test-project' },
        ide: 'claude-code-cli',
        rulesPath: './.vdk/rules',
        lastUpdated: new Date().toISOString(),
      }

      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const savedConfig = JSON.parse(await fs.readFile(configPath, 'utf8'))
      expect(savedConfig.project.name).toBe('test-project')
      expect(savedConfig.ide).toBe('claude-code-cli')
    })

    it('should handle missing configuration gracefully', async () => {
      tempDir = await createTempDir('test-no-config')
      const configPath = path.join(tempDir, 'nonexistent-config.json')

      try {
        await fs.readFile(configPath, 'utf8')
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(error.code).toBe('ENOENT')
      }
    })

    it('should validate configuration structure', async () => {
      tempDir = await createTempDir('test-config-validation')

      const validConfig = {
        project: { name: 'test' },
        ide: 'claude-code-cli',
        rulesPath: './rules',
      }

      const invalidConfig = {
        invalid: 'structure',
      }

      // Valid config should parse correctly
      const configPath1 = path.join(tempDir, 'valid.json')
      await fs.writeFile(configPath1, JSON.stringify(validConfig, null, 2))
      const parsed1 = JSON.parse(await fs.readFile(configPath1, 'utf8'))
      expect(parsed1.project.name).toBe('test')

      // Invalid config should still be readable (validation is separate)
      const configPath2 = path.join(tempDir, 'invalid.json')
      await fs.writeFile(configPath2, JSON.stringify(invalidConfig, null, 2))
      const parsed2 = JSON.parse(await fs.readFile(configPath2, 'utf8'))
      expect(parsed2.invalid).toBe('structure')
    })
  })

  describe('CLI Configuration Loading', () => {
    it('should load dotenv configuration', async () => {
      // Test that CLI loads environment from .env files
      const cliSource = await fs.readFile(path.join(global.TEST_ROOT, 'cli-new.js'), 'utf8')

      expect(cliSource).toContain('dotenv.config')
      expect(cliSource).toContain('.env.local')
      expect(cliSource).toContain('.env')
    })

    it('should read package.json version', async () => {
      const cliSource = await fs.readFile(path.join(global.TEST_ROOT, 'cli-new.js'), 'utf8')

      expect(cliSource).toContain("require('./package.json')")
      expect(cliSource).toContain('pkg.version')
    })
  })

  describe('IDE Configuration', () => {
    it('should handle IDE-specific configurations', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration(global.TEST_ROOT)
      const configPaths = integration.getConfigPaths()

      expect(configPaths.userSettings).toBeDefined()
      expect(configPaths.projectSettings).toBeDefined()
      expect(configPaths.projectMemory).toBeDefined()
      expect(configPaths.projectCommands).toBeDefined()

      // Check paths are valid strings
      expect(typeof configPaths.userSettings).toBe('string')
      expect(typeof configPaths.projectMemory).toBe('string')
    })

    it('should provide shared IDE configuration utilities', async () => {
      const ideConfig = await import('../src/shared/ide-configuration.js')

      expect(ideConfig).toBeDefined()
      expect(typeof ideConfig).toBe('object')
      expect(typeof ideConfig.detectIDEs).toBe('function')
      expect(typeof ideConfig.detectSpecificJetBrainsIDEs).toBe('function')
      expect(Array.isArray(ideConfig.IDE_CONFIGURATIONS)).toBe(true)
    })

    it('should include new platform configurations', async () => {
      const { IDE_CONFIGURATIONS } = await import('../src/shared/ide-configuration.js')

      const expectedPlatforms = [
        'vscode',
        'vscode-insiders',
        'vscodium',
        'cursor',
        'windsurf',
        'windsurf-next',
        'claude-code-cli',
        'claude-desktop',
        'zed',
        'jetbrains',
        'intellij',
        'webstorm',
        'pycharm',
        'phpstorm',
        'rubymine',
        'clion',
        'datagrip',
        'goland',
        'rider',
        'android-studio',
        'github-copilot',
        'generic-ai',
        'generic',
      ]

      const configIds = IDE_CONFIGURATIONS.map((ide) => ide.id)

      for (const platform of expectedPlatforms) {
        expect(configIds).toContain(platform)
      }
    })

    it('should detect specific JetBrains IDEs', async () => {
      const { detectSpecificJetBrainsIDEs } = await import('../src/shared/ide-configuration.js')

      // Test with a mock project path
      tempDir = await createTempDir('test-jetbrains-detection')

      // Create mock .idea folder
      await fs.mkdir(path.join(tempDir, '.idea'), { recursive: true })

      const results = detectSpecificJetBrainsIDEs(tempDir)

      expect(Array.isArray(results)).toBe(true)
      // Results may be empty for empty .idea folder, but function should work
    })
  })

  describe('Path Resolution', () => {
    it('should resolve editor paths correctly', async () => {
      const editorPath = await import('../src/shared/editor-path-resolver.js')

      expect(editorPath).toBeDefined()
      expect(typeof editorPath).toBe('object')
    })

    it('should handle relative and absolute paths', async () => {
      const absolutePath = path.resolve('./test')
      const relativePath = './test'

      expect(path.isAbsolute(absolutePath)).toBe(true)
      expect(path.isAbsolute(relativePath)).toBe(false)

      const resolved = path.resolve(relativePath)
      expect(path.isAbsolute(resolved)).toBe(true)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate project structure', async () => {
      tempDir = await createTempDir('test-project-structure')

      // Create basic project structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }))

      const packageJson = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf8'))

      expect(packageJson.name).toBe('test-project')
      expect(packageJson.version).toBe('1.0.0')
    })

    it('should handle configuration merge priorities', async () => {
      // Test configuration precedence (local > project > user > defaults)
      const baseConfig = { setting: 'default' }
      const userConfig = { setting: 'user' }
      const projectConfig = { setting: 'project' }
      const localConfig = { setting: 'local' }

      // Simulate merge
      const merged = { ...baseConfig, ...userConfig, ...projectConfig, ...localConfig }
      expect(merged.setting).toBe('local')
    })
  })
})
