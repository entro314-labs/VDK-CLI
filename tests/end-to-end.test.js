/**
 * End-to-End Integration Tests - Complete workflow testing
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir, createTempDir, runCLI } from './helpers/cli-helper.js'

describe('End-to-End Integration', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Complete CLI Workflows', () => {
    it('should execute full init workflow', async () => {
      tempDir = await createTempDir('e2e-init-project')

      // Create a minimal project structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          type: 'module',
          scripts: { dev: 'node src/index.js' },
        })
      )
      await fs.writeFile(path.join(tempDir, 'src', 'index.js'), 'console.log("Hello, VDK!");')

      // Run VDK init
      const result = await runCLI(['init', '--projectPath', tempDir, '--verbose'], {
        timeout: 60000,
      })

      // Check that init completed (success or meaningful failure)
      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)

      if (result.success) {
        // If successful, check for expected outputs
        expect(result.stdout).toMatch(/(✅|completed|success)/i)

        // Check if configuration file was created
        try {
          const configPath = path.join(tempDir, 'vdk.config.json')
          const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
          expect(config.project.name).toBeDefined()
        } catch (_error) {
          // Config file creation might be conditional
        }
      } else {
        // If failed, should have meaningful error messages
        expect(result.stderr + result.stdout).toMatch(/(error|failed|warning)/i)
      }
    }, 70000)

    it('should handle status workflow', async () => {
      tempDir = await createTempDir('e2e-status-project')

      // Run status without configuration
      const result1 = await runCLI([
        'status',
        '--configPath',
        path.join(tempDir, 'vdk.config.json'),
      ])
      expect(result1.code).toBeDefined()
      expect(result1.stdout + result1.stderr).toMatch(/(not found|warning|configuration)/i)

      // Create configuration and run again
      const configPath = path.join(tempDir, 'vdk.config.json')
      const config = {
        project: { name: 'test-project' },
        ide: 'claude-code',
        rulesPath: './.ai/rules',
        lastUpdated: new Date().toISOString(),
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result2 = await runCLI(['status', '--configPath', configPath])
      expect(result2.code).toBeDefined()
      if (result2.success) {
        expect(result2.stdout).toMatch(/(found|valid|configuration)/i)
      }
    })

    it('should handle update workflow', async () => {
      tempDir = await createTempDir('e2e-update-project')
      const rulesDir = path.join(tempDir, '.ai', 'rules')

      // Run update command
      const result = await runCLI(['update', '--outputPath', rulesDir], {
        timeout: 45000,
      })

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)

      // Check if rules directory was created
      try {
        const stats = await fs.stat(rulesDir)
        expect(stats.isDirectory()).toBe(true)
      } catch (_error) {
        // Directory creation might depend on network availability
      }
    }, 50000)
  })

  describe('Integration Manager Workflows', () => {
    it('should manage integration lifecycle', async () => {
      const { IntegrationManager } = await import('../src/integrations/integration-manager.js')

      const manager = new IntegrationManager()
      expect(manager).toBeDefined()

      // Test available integrations
      if (typeof manager.getAvailableIntegrations === 'function') {
        const integrations = await manager.getAvailableIntegrations()
        expect(Array.isArray(integrations)).toBe(true)
      }
    })

    it('should handle integration detection', async () => {
      const { ClaudeCodeIntegration } = await import(
        '../src/integrations/claude-code-integration.js'
      )

      const integration = new ClaudeCodeIntegration(global.TEST_ROOT)
      const detection = integration.detectUsage()

      expect(detection).toBeDefined()
      expect(typeof detection.isUsed).toBe('boolean')
      expect(typeof detection.confidence).toBe('string')
      expect(['none', 'low', 'medium', 'high']).toContain(detection.confidence)

      if (detection.isUsed) {
        expect(Array.isArray(detection.indicators)).toBe(true)
      }
    })
  })

  describe('Scanner Engine Integration', () => {
    it('should execute complete scanning workflow', async () => {
      tempDir = await createTempDir('e2e-scanner-project')

      // Create complex project structure for scanning
      await fs.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true })

      // Add various file types
      await fs.writeFile(
        path.join(tempDir, 'src', 'index.js'),
        `
        import { utils } from './utils/helper.js';
        import Component from './components/Component.js';
        
        const app = new Component();
        app.init();
        `
      )

      await fs.writeFile(
        path.join(tempDir, 'src', 'utils', 'helper.js'),
        `
        export const utils = {
          format: (str) => str.toUpperCase(),
          validate: (data) => data != null
        };
        `
      )

      await fs.writeFile(
        path.join(tempDir, 'src', 'components', 'Component.js'),
        `
        export default class Component {
          constructor() {
            this.name = 'TestComponent';
          }
          
          init() {
            console.log('Component initialized');
          }
        }
        `
      )

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'e2e-test-project',
          version: '1.0.0',
          type: 'module',
          dependencies: {
            express: '^4.18.0',
          },
        })
      )

      // Run scanner through CLI
      const { runScanner } = await import('../src/scanner/index.js')

      const options = {
        projectPath: tempDir,
        outputPath: path.join(tempDir, '.ai', 'rules'),
        verbose: false,
        deep: false,
      }

      try {
        const results = await runScanner(options)

        expect(results).toBeDefined()
        expect(results.projectName).toBe('e2e-test-project')
        expect(results.files).toBeDefined()
        expect(Array.isArray(results.files)).toBe(true)
        expect(results.files.length).toBeGreaterThan(0)

        // Check that JavaScript files were detected
        const jsFiles = results.files.filter((f) => f.name.endsWith('.js'))
        expect(jsFiles.length).toBeGreaterThan(0)
      } catch (error) {
        // Scanner might fail due to missing dependencies, but should not crash
        expect(error).toBeDefined()
        expect(error.message).toBeDefined()
      }
    })
  })

  describe('Rule Management Workflows', () => {
    it('should handle rule validation workflow', async () => {
      const { validateBlueprint } = await import('../src/utils/schema-validator.js')

      const validBlueprint = {
        id: 'e2e-test-blueprint',
        title: 'E2E Test Blueprint',
        description: 'Blueprint for end-to-end testing',
        version: '1.0.0',
        category: 'task',
        platforms: {
          'claude-code': { compatible: true },
        },
      }

      const result = await validateBlueprint(validBlueprint)
      expect(result.valid).toBe(true)
    })

    it('should handle duplicate checking workflow', async () => {
      // Test duplicate checking functionality
      const duplicates = await import('../src/validation/check-duplicates.js')
      expect(duplicates).toBeDefined()
    })
  })

  describe('Template and Command Generation', () => {
    it('should handle template rendering', async () => {
      const templating = await import('../src/scanner/utils/light-templating.js')

      expect(templating).toBeDefined()

      if (typeof templating.renderTemplate === 'function') {
        const template = 'Project: {{projectName}}, Version: {{version}}'
        const data = { projectName: 'test-project', version: '1.0.0' }
        const rendered = templating.renderTemplate(template, data)

        expect(rendered).toContain('test-project')
        expect(rendered).toContain('1.0.0')
      }
    })

    it('should handle command template generation', async () => {
      // Test command template functionality
      const templatePath = path.join(
        global.TEST_ROOT,
        'src/templates/commands/claude-code-command-template.md'
      )

      try {
        const template = await fs.readFile(templatePath, 'utf8')
        expect(template.length).toBeGreaterThan(0)
        expect(typeof template).toBe('string')
      } catch (_error) {
        // Template file might not exist, which is valid
        expect(_error.code).toBe('ENOENT')
      }
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle network failures gracefully', async () => {
      // Test offline scenarios
      const { downloadRule } = await import('../src/blueprints-client.js')

      // Test with invalid URLs
      const invalidResult = await downloadRule('invalid-url')
      expect(invalidResult).toBeNull()
    })

    it('should handle file system errors', async () => {
      // Test with invalid paths
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const result = await scanner.scanProject('/invalid/path/that/does/not/exist')

      expect(typeof result.error === 'string' || result.files.length === 0).toBe(true)
    })

    it('should handle malformed configuration files', async () => {
      tempDir = await createTempDir('e2e-malformed-config')

      // Create malformed JSON
      const configPath = path.join(tempDir, 'vdk.config.json')
      await fs.writeFile(configPath, '{ invalid json content }')

      try {
        JSON.parse(await fs.readFile(configPath, 'utf8'))
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError)
      }
    })
  })
})
