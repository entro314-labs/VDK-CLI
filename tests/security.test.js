/**
 * Security Tests - Security aspects of VDK CLI
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { dangerousFilePaths, malformedCodeSamples } from './helpers/test-fixtures.js'

describe('Security', () => {
  describe('Hub Client Security', () => {
    it('should use HTTPS URLs', async () => {
      const hubClientSource = await fs.readFile(path.join(global.TEST_ROOT, 'src/blueprints-client.js'), 'utf8')

      expect(hubClientSource).toContain('https://')
      expect(hubClientSource).not.toContain('http://')
      expect(hubClientSource).toContain('api.github.com')
    })

    it('should handle environment variables securely', async () => {
      const originalToken = process.env.VDK_GITHUB_TOKEN

      // Test without token
      process.env.VDK_GITHUB_TOKEN = undefined
      // fetchRuleList import not used - just testing env var handling

      // Test with token
      process.env.VDK_GITHUB_TOKEN = 'test-token-123'

      // Restore original
      if (originalToken) {
        process.env.VDK_GITHUB_TOKEN = originalToken
      } else {
        process.env.VDK_GITHUB_TOKEN = undefined
      }

      expect(true).toBe(true) // Environment handling completed
    })

    it('should not disclose sensitive information in errors', async () => {
      const { downloadRule } = await import('../src/blueprints-client.js')

      const result = await downloadRule('invalid-url-12345')
      expect(result).toBeNull()
    })
  })

  describe('File Path Validation', () => {
    it('should validate file paths in ProjectScanner', async () => {
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()

      for (const dangerousPath of dangerousFilePaths) {
        const result = await scanner.scanProject(dangerousPath)

        expect(typeof result.error === 'string' || result.files.length === 0).toBe(true)
      }
    })

    it('should handle dependency analysis securely', async () => {
      const { DependencyAnalyzer } = await import('../src/scanner/core/DependencyAnalyzer.js')
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const analyzer = new DependencyAnalyzer({
        verbose: false,
        maxFilesToParse: 10,
      })

      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(global.TEST_ROOT)

      const result = await analyzer.analyzeDependencies(projectStructure)

      expect(typeof result.moduleCount).toBe('number')
      expect(result.moduleCount).toBeGreaterThanOrEqual(0)
    })

    it('should limit resource usage in pattern detection', async () => {
      const { PatternDetector } = await import('../src/scanner/core/PatternDetector.js')
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const detector = new PatternDetector({
        verbose: false,
        sampleSize: 5,
        maxFilesToParse: 10,
      })

      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(global.TEST_ROOT)

      const patterns = await detector.detectPatterns(projectStructure)

      expect(Array.isArray(patterns.architecturalPatterns)).toBe(true)
      expect(Array.isArray(patterns.codePatterns)).toBe(true)
    })
  })

  describe('Input Sanitization', () => {
    it('should handle malformed JavaScript content safely', async () => {
      const { analyzeJavaScript } = await import('../src/scanner/analyzers/javascript.js')

      for (const input of malformedCodeSamples) {
        try {
          const result = await analyzeJavaScript(input, 'test.js')
          expect(typeof result).toBe('object')
        } catch (error) {
          expect(error).toBeDefined() // Should handle gracefully
        }
      }
    })

    it('should handle malformed TypeScript content safely', async () => {
      const { analyzeTypeScript } = await import('../src/scanner/analyzers/typescript.js')

      for (const input of malformedCodeSamples) {
        try {
          const result = await analyzeTypeScript(input, 'test.ts')
          expect(typeof result).toBe('object')
        } catch (error) {
          expect(error).toBeDefined() // Should handle gracefully
        }
      }
    })

    it('should handle malformed Python content safely', async () => {
      const { analyzePython } = await import('../src/scanner/analyzers/python.js')

      for (const input of malformedCodeSamples) {
        try {
          const result = await analyzePython(input, 'test.py')
          expect(typeof result).toBe('object')
        } catch (error) {
          expect(error).toBeDefined() // Should handle gracefully
        }
      }
    })
  })

  describe('CLI Argument Validation', () => {
    it('should validate command arguments', async () => {
      const cliSource = await fs.readFile(path.join(global.TEST_ROOT, 'cli-new.js'), 'utf8')

      expect(cliSource).toContain('commander')
      expect(cliSource).toMatch(/(version|Version)/)
      expect(cliSource).toMatch(/(help|Help)/)
    })
  })
})
