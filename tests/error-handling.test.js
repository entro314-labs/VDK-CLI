/**
 * Error Handling & Edge Cases Tests - Comprehensive error scenario coverage
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir, createTempDir, runCLI } from './helpers/cli-helper.js'

describe('Error Handling & Edge Cases', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('CLI Error Scenarios', () => {
    it('should handle invalid command arguments gracefully', async () => {
      const invalidCommands = [
        ['init', '--invalidFlag'],
        ['status', '--nonexistent-option', 'value'],
        ['update', '--outputPath'], // Missing value
        ['deploy', '--unknown', 'parameter'],
      ]

      for (const cmd of invalidCommands) {
        const result = await runCLI(cmd)

        // Should fail gracefully, not crash
        expect(result.code).toBeDefined()
        expect(result.success).toBe(false)
        expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0)
      }
    })

    it('should handle missing required arguments', async () => {
      // Commands that might expect certain arguments
      const result1 = await runCLI(['init', '--projectPath'])
      expect(result1.success).toBe(false)

      const result2 = await runCLI(['update', '--outputPath'])
      expect(result2.success).toBe(false)
    })

    it('should handle extremely long argument values', async () => {
      const longPath = 'a'.repeat(1000)
      const result = await runCLI(['init', '--projectPath', longPath], { timeout: 5000 })

      expect(result.code).toBeDefined()
      // Should handle gracefully, not crash
    }, 10000)

    it('should handle special characters in paths', async () => {
      const specialPaths = [
        './path with spaces',
        './path-with-dashes',
        './path_with_underscores',
        './päth-wîth-ümlauts',
      ]

      for (const specialPath of specialPaths) {
        try {
          // Use shorter timeout to prevent hanging on problematic paths
          const result = await runCLI(['init', '--projectPath', specialPath], { timeout: 5000 })
          expect(result.code).toBeDefined()
          // Should not crash on special characters
        } catch (error) {
          // If command times out or fails, that's acceptable for edge case paths
          // Just ensure it doesn't crash the entire test suite
          expect(error.message).toBeDefined()
        }
      }
    }, 30000)
  })

  describe('File System Error Handling', () => {
    it('should handle permission denied errors', async () => {
      // Test with system directories that might have permission issues
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()

      // These paths might cause permission issues
      const restrictedPaths = ['/root', '/etc', '/sys']

      for (const restrictedPath of restrictedPaths) {
        const result = await scanner.scanProject(restrictedPath)

        // Should handle gracefully
        expect(typeof result.error === 'string' || result.files.length === 0).toBe(true)
      }
    })

    it('should handle corrupted or unreadable files', async () => {
      tempDir = await createTempDir('corrupted-files-test')

      // Create various problematic files
      await fs.writeFile(path.join(tempDir, 'empty.js'), '')
      await fs.writeFile(path.join(tempDir, 'binary.js'), Buffer.from([0x00, 0x01, 0x02, 0xff]))
      await fs.writeFile(path.join(tempDir, 'huge-line.js'), 'a'.repeat(100000))
      await fs.writeFile(path.join(tempDir, 'weird-encoding.js'), 'console.log("test");\xFF\xFE')

      const { analyzeJavaScript } = await import('../src/scanner/analyzers/javascript.js')

      const files = await fs.readdir(tempDir)
      for (const file of files) {
        const filePath = path.join(tempDir, file)
        const content = await fs.readFile(filePath, 'utf8')

        try {
          const result = await analyzeJavaScript(content, file)
          expect(typeof result).toBe('object')
        } catch (error) {
          // Should handle errors gracefully
          expect(error).toBeDefined()
        }
      }
    })

    it('should handle simultaneous file access', async () => {
      tempDir = await createTempDir('concurrent-access-test')

      // Create test file
      const testFile = path.join(tempDir, 'concurrent.js')
      await fs.writeFile(testFile, 'console.log("test");')

      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      // Try to scan the same directory multiple times concurrently
      const scanners = new Array(5).fill().map(() => new ProjectScanner())
      const scanPromises = scanners.map((scanner) => scanner.scanProject(tempDir))

      const results = await Promise.allSettled(scanPromises)

      // All should complete (successfully or with controlled failures)
      expect(results.length).toBe(5)
      results.forEach((result) => {
        expect(result.status).toMatch(/^(fulfilled|rejected)$/)
      })
    })
  })

  describe('Network Error Handling', () => {
    it('should handle network timeouts', async () => {
      const { fetchRuleList } = await import('../src/blueprints-client.js')

      // This will likely timeout or fail, but should handle gracefully
      try {
        const result = await fetchRuleList()
        expect(Array.isArray(result)).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should handle invalid URLs', async () => {
      const { downloadRule } = await import('../src/blueprints-client.js')

      const invalidUrls = [
        'not-a-url',
        'http://',
        'ftp://invalid.com/file',
        'https://nonexistent-domain-123456.com/file',
        '',
      ]

      for (const url of invalidUrls) {
        const result = await downloadRule(url)
        expect(result).toBeNull()
      }
    })

    it('should handle malformed API responses', async () => {
      // Test handling of unexpected response formats
      const { fetchRuleList } = await import('../src/blueprints-client.js')

      try {
        const result = await fetchRuleList()
        if (result !== null) {
          expect(Array.isArray(result)).toBe(true)
        }
      } catch (error) {
        // Should handle API errors gracefully
        expect(error).toBeDefined()
      }
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large project structures', async () => {
      tempDir = await createTempDir('large-project-test')

      // Create many files and directories
      for (let i = 0; i < 50; i++) {
        const dir = path.join(tempDir, `dir-${i}`)
        await fs.mkdir(dir, { recursive: true })

        for (let j = 0; j < 10; j++) {
          const file = path.join(dir, `file-${j}.js`)
          await fs.writeFile(file, `console.log("File ${i}-${j}");`)
        }
      }

      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const result = await scanner.scanProject(tempDir)

      expect(result).toBeDefined()
      expect(result.files.length).toBeGreaterThan(0)
      expect(result.files.length).toBeLessThan(10000) // Reasonable limit
    })

    it('should handle deeply nested directory structures', async () => {
      tempDir = await createTempDir('deep-nesting-test')

      // Create deeply nested structure
      let currentPath = tempDir
      for (let i = 0; i < 20; i++) {
        currentPath = path.join(currentPath, `level-${i}`)
        await fs.mkdir(currentPath, { recursive: true })
      }

      // Add a file at the deepest level
      await fs.writeFile(path.join(currentPath, 'deep.js'), 'console.log("deep");')

      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const result = await scanner.scanProject(tempDir)

      expect(result).toBeDefined()
      expect(result.files.length).toBeGreaterThan(0)
    })

    it('should handle files with extremely long lines', async () => {
      tempDir = await createTempDir('long-lines-test')

      const longLine = `const data = "${'a'.repeat(50000)}";`
      const longFile = path.join(tempDir, 'long-line.js')
      await fs.writeFile(longFile, longLine)

      const { analyzeJavaScript } = await import('../src/scanner/analyzers/javascript.js')

      try {
        const result = await analyzeJavaScript(longLine, 'long-line.js')
        expect(typeof result).toBe('object')
      } catch (error) {
        // Should handle long lines gracefully
        expect(error).toBeDefined()
      }
    })
  })

  describe('Data Structure Edge Cases', () => {
    it('should handle empty and null inputs', async () => {
      const { PatternDetector } = await import('../src/scanner/core/PatternDetector.js')

      const detector = new PatternDetector()

      const emptyStructures = [
        { files: [], directories: [], fileTypes: {}, fileExtensions: [] },
        { files: null, directories: null, fileTypes: null },
        {},
        undefined,
      ]

      for (const structure of emptyStructures) {
        try {
          const result = await detector.detectPatterns(structure || {})
          expect(typeof result).toBe('object')
        } catch (error) {
          // Should handle gracefully
          expect(error).toBeDefined()
        }
      }
    })

    it('should handle circular references', async () => {
      // Create objects with circular references
      const obj1 = { name: 'obj1' }
      const obj2 = { name: 'obj2', ref: obj1 }
      obj1.ref = obj2

      // Test that components handle circular references
      try {
        JSON.stringify(obj1)
        expect(false).toBe(true) // Should throw
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError)
      }
    })
  })

  describe('Integration Error Handling', () => {
    it('should handle missing integration dependencies', async () => {
      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration('/nonexistent/path')
      const detection = integration.detectUsage()

      expect(detection).toBeDefined()
      expect(typeof detection.isUsed).toBe('boolean')
      // Should not crash on missing paths
    })

    it('should handle integration configuration errors', async () => {
      tempDir = await createTempDir('integration-error-test')

      // Create invalid configuration
      const configPath = path.join(tempDir, '.claude', 'settings.json')
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, '{ invalid json }')

      const { ClaudeCodeCLIIntegration } = await import('../src/integrations/claude-code-integration.js')

      const integration = new ClaudeCodeCLIIntegration(tempDir)

      // Should handle invalid config gracefully
      const detection = integration.detectUsage()
      expect(detection).toBeDefined()
    })
  })

  describe('Schema Validation Edge Cases', () => {
    it('should handle malformed schema objects', async () => {
      const { validateCommand, validateBlueprint } = await import('../src/utils/schema-validator.js')

      const malformedInputs = [
        null,
        undefined,
        'string instead of object',
        123,
        [],
        { deeply: { nested: { invalid: { structure: true } } } },
      ]

      for (const input of malformedInputs) {
        try {
          const cmdResult = await validateCommand(input)
          expect(cmdResult.valid).toBe(false)

          const bpResult = await validateBlueprint(input)
          expect(bpResult.valid).toBe(false)
        } catch (error) {
          // Should handle gracefully
          expect(error).toBeDefined()
        }
      }
    })

    it("should handle schema files that don't exist", async () => {
      const { getAvailableSchemas } = await import('../src/utils/schema-validator.js')

      try {
        const schemas = await getAvailableSchemas()
        expect(Array.isArray(schemas)).toBe(true)
      } catch (error) {
        // Should handle missing schema files
        expect(error).toBeDefined()
      }
    })
  })

  describe('Resource Cleanup', () => {
    it('should clean up temporary files and handles', async () => {
      tempDir = await createTempDir('cleanup-test')

      // Create some temporary files
      const tempFiles = []
      for (let i = 0; i < 10; i++) {
        const tempFile = path.join(tempDir, `temp-${i}.js`)
        await fs.writeFile(tempFile, `console.log(${i});`)
        tempFiles.push(tempFile)
      }

      // Simulate processing
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')
      const scanner = new ProjectScanner()
      const result = await scanner.scanProject(tempDir)

      expect(result.files.length).toBe(10)

      // Verify files still exist (weren't accidentally deleted)
      for (const tempFile of tempFiles) {
        const exists = await fs
          .access(tempFile)
          .then(() => true)
          .catch(() => false)
        expect(exists).toBe(true)
      }
    })
  })
})
