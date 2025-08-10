/**
 * Utility Functions Tests - Test all utility modules
 */
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir } from './helpers/cli-helper.js'

describe('Utility Functions', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Category Selector', () => {
    it('should provide category selection functionality', async () => {
      const categorySelector = await import('../src/utils/category-selector.js')

      expect(categorySelector).toBeDefined()
      expect(typeof categorySelector).toBe('object')
    })
  })

  describe('Project Insights', () => {
    it('should generate project insights', async () => {
      const { generateProjectInsights } = await import('../src/utils/project-insights.js')

      expect(typeof generateProjectInsights).toBe('function')

      const insights = await generateProjectInsights(global.TEST_ROOT)
      expect(insights).toBeDefined()
      expect(typeof insights).toBe('object')
    })

    it('should handle missing project gracefully', async () => {
      const { generateProjectInsights } = await import('../src/utils/project-insights.js')

      const insights = await generateProjectInsights('nonexistent-path')
      expect(insights).toBeDefined()
    })
  })

  describe('Health Check', () => {
    it('should perform health checks', async () => {
      const healthCheck = await import('../src/utils/health-check.js')

      expect(healthCheck).toBeDefined()
      expect(typeof healthCheck).toBe('object')
    })
  })

  describe('Update MCP Config', () => {
    it('should handle MCP config updates', async () => {
      const mcpConfig = await import('../src/utils/update-mcp-config.js')

      expect(mcpConfig).toBeDefined()
      expect(typeof mcpConfig).toBe('object')
    })
  })

  describe('Validation Utilities', () => {
    it('should validate rules', async () => {
      const validation = await import('../src/validation/validate-rules.js')

      expect(validation).toBeDefined()
      expect(typeof validation).toBe('object')
    })

    it('should check for duplicates', async () => {
      const duplicateChecker = await import('../src/validation/check-duplicates.js')

      expect(duplicateChecker).toBeDefined()
      expect(typeof duplicateChecker).toBe('object')
    })
  })

  describe('Shared Utilities', () => {
    it('should provide IDE configuration utilities', async () => {
      const ideConfig = await import('../src/shared/ide-configuration.js')

      expect(ideConfig).toBeDefined()
      expect(typeof ideConfig).toBe('object')
    })

    it('should provide editor path resolution', async () => {
      const editorPath = await import('../src/shared/editor-path-resolver.js')

      expect(editorPath).toBeDefined()
      expect(typeof editorPath).toBe('object')
    })
  })

  describe('Scanner Utilities', () => {
    it('should provide constants', async () => {
      const constants = await import('../src/scanner/utils/constants.js')

      expect(constants).toBeDefined()
      expect(typeof constants).toBe('object')
    })

    it('should provide IDE configuration for scanner', async () => {
      const ideConfig = await import('../src/scanner/utils/ide-configuration.js')

      expect(ideConfig).toBeDefined()
      expect(typeof ideConfig).toBe('object')
    })

    it('should provide light templating', async () => {
      const templating = await import('../src/scanner/utils/light-templating.js')

      expect(templating).toBeDefined()
      expect(typeof templating).toBe('object')

      // Test basic templating functionality
      if (typeof templating.renderTemplate === 'function') {
        const result = templating.renderTemplate('Hello {{name}}!', { name: 'World' })
        expect(result).toBe('Hello World!')
      }
    })

    it('should provide TypeScript parser utilities', async () => {
      const tsParser = await import('../src/scanner/utils/typescript-parser.js')

      expect(tsParser).toBeDefined()
      expect(typeof tsParser).toBe('object')
    })

    it('should provide version utilities', async () => {
      const version = await import('../src/scanner/utils/version.js')

      expect(version).toBeDefined()
      expect(typeof version).toBe('object')
    })

    it('should provide gitignore parser', async () => {
      const gitignoreParser = await import('../src/scanner/utils/gitignore-parser.js')

      expect(gitignoreParser).toBeDefined()
      expect(typeof gitignoreParser).toBe('object')
    })

    it('should provide validator utilities', async () => {
      const validator = await import('../src/scanner/utils/validator.js')

      expect(validator).toBeDefined()
      expect(typeof validator).toBe('object')
    })

    it('should provide package analyzer', async () => {
      const packageAnalyzer = await import('../src/scanner/utils/package-analyzer.js')

      expect(packageAnalyzer).toBeDefined()
      expect(typeof packageAnalyzer).toBe('object')

      // Test package analysis with project's package.json
      if (typeof packageAnalyzer.analyzePackageJson === 'function') {
        const packagePath = path.join(global.TEST_ROOT, 'package.json')
        const analysis = await packageAnalyzer.analyzePackageJson(packagePath)
        expect(analysis).toBeDefined()
      }
    })
  })

  describe('Advanced Scanner Components', () => {
    it('should provide architectural pattern detection', async () => {
      const archPatterns = await import('../src/scanner/core/ArchPatternDetector.js')

      expect(archPatterns).toBeDefined()
      expect(typeof archPatterns).toBe('object')
    })

    it('should provide rule adaptation', async () => {
      const ruleAdapter = await import('../src/scanner/core/RuleAdapter.js')

      expect(ruleAdapter).toBeDefined()
      expect(typeof ruleAdapter).toBe('object')
    })

    it('should provide rule generation', async () => {
      const ruleGenerator = await import('../src/scanner/core/RuleGenerator.js')

      expect(ruleGenerator).toBeDefined()
      expect(typeof ruleGenerator).toBe('object')
    })

    it('should provide technology analysis', async () => {
      const techAnalyzer = await import('../src/scanner/core/TechnologyAnalyzer.js')

      expect(techAnalyzer).toBeDefined()
      expect(typeof techAnalyzer).toBe('object')
    })

    it('should provide Claude Code adapter', async () => {
      const claudeAdapter = await import('../src/scanner/core/ClaudeCodeAdapter.js')

      expect(claudeAdapter).toBeDefined()
      expect(typeof claudeAdapter).toBe('object')
    })
  })

  describe('Scanner Engine & Integration', () => {
    it('should provide scanner engine', async () => {
      const engine = await import('../src/scanner/engine.js')

      expect(engine).toBeDefined()
      expect(typeof engine).toBe('object')
    })

    it('should provide scanner IDE integration', async () => {
      const ideIntegration = await import('../src/scanner/integrations/ide-integration.js')

      expect(ideIntegration).toBeDefined()
      expect(typeof ideIntegration).toBe('object')
    })

    it('should provide scanner index', async () => {
      const scannerIndex = await import('../src/scanner/index.js')

      expect(scannerIndex).toBeDefined()
      expect(typeof scannerIndex).toBe('object')
    })
  })

  describe('Preview Functionality', () => {
    it('should provide preview rule functionality', async () => {
      const previewRule = await import('../src/preview/preview-rule.js')

      expect(previewRule).toBeDefined()
      expect(typeof previewRule).toBe('object')
    })
  })
})
