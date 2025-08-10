/**
 * Scanner Core Tests - Project scanning and analysis functionality
 */
import { describe, expect, it } from 'vitest'

// Mock imports are available but not used in actual tests - kept for future test enhancement

describe('Scanner Core Functionality', () => {
  const testProjectPath = global.TEST_ROOT

  describe('ProjectScanner', () => {
    it('should scan project and return expected structure', async () => {
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const results = await scanner.scanProject(testProjectPath)

      expect(results).toBeDefined()
      expect(results.projectPath).toBeDefined()
      expect(results.projectName).toBeDefined()
      expect(Array.isArray(results.files)).toBe(true)
      expect(Array.isArray(results.directories)).toBe(true)
      expect(typeof results.fileTypes).toBe('object')
      expect(Array.isArray(results.fileExtensions)).toBe(true)
      expect(typeof results.directoryStructure).toBe('object')

      expect(results.files.length).toBeGreaterThan(0)
      expect(results.directories.length).toBeGreaterThan(0)

      if (results.files.length > 0) {
        const firstFile = results.files[0]
        expect(firstFile.path).toBeDefined()
        expect(firstFile.name).toBeDefined()
        expect(firstFile.type).toBeDefined()
      }
    })

    it('should handle empty directories gracefully', async () => {
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const results = await scanner.scanProject('nonexistent-directory')

      expect(typeof results.error === 'string' || results.files.length === 0).toBe(true)
    })
  })

  describe('PatternDetector', () => {
    it('should detect patterns in project structure', async () => {
      const { PatternDetector } = await import('../src/scanner/core/PatternDetector.js')
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(testProjectPath)

      const detector = new PatternDetector()
      const patterns = await detector.detectPatterns(projectStructure)

      expect(patterns).toBeDefined()
      expect(typeof patterns.namingConventions).toBe('object')
      expect(Array.isArray(patterns.architecturalPatterns)).toBe(true)
      expect(Array.isArray(patterns.codePatterns)).toBe(true)
      expect(typeof patterns.consistencyMetrics).toBe('object')

      expect(typeof patterns.namingConventions.files).toBe('object')
      expect(typeof patterns.namingConventions.directories).toBe('object')
    })

    it('should handle malformed project structure', async () => {
      const { PatternDetector } = await import('../src/scanner/core/PatternDetector.js')

      const detector = new PatternDetector()
      const emptyStructure = {
        files: [],
        directories: [],
        fileTypes: {},
        fileExtensions: [],
      }

      const patterns = await detector.detectPatterns(emptyStructure)

      expect(patterns).toBeDefined()
      expect(typeof patterns.namingConventions).toBe('object')
    })
  })

  describe('DependencyAnalyzer', () => {
    it('should analyze dependencies and build graph', async () => {
      const { DependencyAnalyzer } = await import('../src/scanner/core/DependencyAnalyzer.js')
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(testProjectPath)

      const analyzer = new DependencyAnalyzer()
      const analysis = await analyzer.analyzeDependencies(projectStructure)

      expect(analysis).toBeDefined()
      expect(analysis.dependencyGraph).toBeDefined()
      expect(analysis.inverseGraph).toBeDefined()
      expect(typeof analysis.moduleCount).toBe('number')
      expect(typeof analysis.edgeCount).toBe('number')
      expect(Array.isArray(analysis.centralModules)).toBe(true)
      expect(Array.isArray(analysis.layeredStructure)).toBe(true)
      expect(typeof analysis.cyclesDetected).toBe('boolean')
      expect(Array.isArray(analysis.architecturalHints)).toBe(true)
    })

    it('should respect resource limits', async () => {
      const { DependencyAnalyzer } = await import('../src/scanner/core/DependencyAnalyzer.js')
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')

      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(testProjectPath)

      const analyzer = new DependencyAnalyzer({
        maxFilesToParse: 5,
        verbose: false,
      })

      const analysis = await analyzer.analyzeDependencies(projectStructure)

      expect(analysis.moduleCount).toBeGreaterThanOrEqual(0)
      expect(analysis.edgeCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration - Full Pipeline', () => {
    it('should execute full scanner pipeline', async () => {
      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')
      const { PatternDetector } = await import('../src/scanner/core/PatternDetector.js')
      const { DependencyAnalyzer } = await import('../src/scanner/core/DependencyAnalyzer.js')

      const scanner = new ProjectScanner({ verbose: false })
      const projectStructure = await scanner.scanProject(testProjectPath)

      const detector = new PatternDetector({ verbose: false })
      const patterns = await detector.detectPatterns(projectStructure)

      const analyzer = new DependencyAnalyzer({ verbose: false })
      const dependencies = await analyzer.analyzeDependencies(projectStructure)

      expect(projectStructure.files.length).toBeGreaterThan(0)
      expect(Object.keys(patterns.namingConventions).length).toBeGreaterThan(0)
      expect(dependencies.moduleCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Hub Client', () => {
    it('should have required functions available', async () => {
      const { fetchRuleList, downloadRule } = await import('../src/blueprints-client.js')

      expect(typeof fetchRuleList).toBe('function')
      expect(typeof downloadRule).toBe('function')
    })

    it('should handle invalid downloads gracefully', async () => {
      const { downloadRule } = await import('../src/blueprints-client.js')

      const result = await downloadRule('invalid-url-12345')
      expect(result).toBeNull()
    })
  })
})
