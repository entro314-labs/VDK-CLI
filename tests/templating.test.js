/**
 * Templating Tests - Complete coverage of template rendering functionality
 */
import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir } from './helpers/cli-helper.js'

describe('Template Rendering', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Light Templating', () => {
    it('should apply basic template substitution', async () => {
      const { applyLightTemplating } = await import('../src/scanner/utils/light-templating.js')

      const template = 'Hello ${name}, welcome to ${project}!'
      const variables = { name: 'John', project: 'VDK CLI' }

      const result = applyLightTemplating(template, variables)
      expect(result).toBe('Hello John, welcome to VDK CLI!')
    })

    it('should handle nested object variables', async () => {
      const { applyLightTemplating } = await import('../src/scanner/utils/light-templating.js')

      const template = 'Project: ${project.name} v${project.version}'
      const variables = {
        project: { name: 'VDK CLI', version: '2.0.2' },
      }

      const result = applyLightTemplating(template, variables)
      expect(result).toBe('Project: VDK CLI v2.0.2')
    })

    it('should handle missing variables gracefully', async () => {
      const { applyLightTemplating } = await import('../src/scanner/utils/light-templating.js')

      const template = 'Hello ${name}, ${missing} variable!'
      const variables = { name: 'John' }

      const result = applyLightTemplating(template, variables)
      expect(result).toBe('Hello John, ${missing} variable!')
    })

    it('should prepare template variables from analysis data', async () => {
      const { prepareTemplateVariables } = await import('../src/scanner/utils/light-templating.js')

      const mockAnalysisData = {
        projectStructure: {
          packageJson: { name: 'test-project' },
          files: [
            { path: 'src/index.js', name: 'index.js' },
            { path: 'tests/test.js', name: 'test.js' },
          ],
          directories: [
            { name: 'src', path: 'src' },
            { name: 'tests', path: 'tests' },
            { name: 'docs', path: 'docs' },
          ],
        },
        techData: {
          primaryLanguages: ['javascript'],
          frameworks: ['react'],
        },
      }

      const variables = prepareTemplateVariables(mockAnalysisData)

      expect(variables).toBeDefined()
      expect(variables.projectName).toBe('test-project')
      expect(typeof variables.hasTests).toBe('boolean')
      expect(typeof variables.hasDocs).toBe('boolean')
      expect(variables.projectType).toBeDefined()
    })

    it('should provide template helpers', async () => {
      const { templateHelpers } = await import('../src/scanner/utils/light-templating.js')

      expect(templateHelpers).toBeDefined()
      expect(typeof templateHelpers).toBe('object')
    })

    it('should handle empty templates', async () => {
      const { applyLightTemplating } = await import('../src/scanner/utils/light-templating.js')

      const result = applyLightTemplating('', {})
      expect(result).toBe('')
    })

    it('should handle templates without variables', async () => {
      const { applyLightTemplating } = await import('../src/scanner/utils/light-templating.js')

      const template = 'This is a static template'
      const result = applyLightTemplating(template, {})
      expect(result).toBe('This is a static template')
    })
  })

  describe('Package Analysis Integration', () => {
    it('should work with PackageAnalyzer', async () => {
      const { PackageAnalyzer } = await import('../src/scanner/utils/package-analyzer.js')

      expect(PackageAnalyzer).toBeDefined()
      expect(typeof PackageAnalyzer).toBe('function')

      const analyzer = new PackageAnalyzer()
      expect(analyzer).toBeDefined()
    })
  })
})
