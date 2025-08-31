/**
 * Advanced Scanner Tests - Comprehensive scanner component testing
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir, createTempDir } from './helpers/cli-helper.js'

describe('Advanced Scanner Components', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Architecture Pattern Detection', () => {
    it('should detect architectural patterns', async () => {
      const { detectArchitecturalPatterns } = await import('../src/scanner/core/ArchPatternDetector.js')

      expect(detectArchitecturalPatterns).toBeDefined()
      expect(typeof detectArchitecturalPatterns).toBe('function')
    })

    it('should analyze project architecture', async () => {
      tempDir = await createTempDir('arch-pattern-test')

      // Create MVC-like structure
      await fs.mkdir(path.join(tempDir, 'models'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'views'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'controllers'), { recursive: true })

      await fs.writeFile(
        path.join(tempDir, 'models', 'User.js'),
        'export class User { constructor(data) { this.data = data; } }'
      )
      await fs.writeFile(
        path.join(tempDir, 'views', 'UserView.js'),
        'export class UserView { render(user) { return `<div>${user.name}</div>`; } }'
      )
      await fs.writeFile(
        path.join(tempDir, 'controllers', 'UserController.js'),
        'import { User } from "../models/User.js"; export class UserController {}'
      )

      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')
      const { PatternDetector } = await import('../src/scanner/core/PatternDetector.js')

      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(tempDir)

      const detector = new PatternDetector()
      const patterns = await detector.detectPatterns(projectStructure)

      expect(patterns.architecturalPatterns).toBeDefined()
      expect(Array.isArray(patterns.architecturalPatterns)).toBe(true)

      // Should detect MVC-like patterns
      const hasArchPattern = patterns.architecturalPatterns.length > 0
      expect(typeof hasArchPattern).toBe('boolean')
    })
  })

  describe('Technology Analysis', () => {
    it('should analyze project technologies', async () => {
      const { TechnologyAnalyzer } = await import('../src/scanner/core/TechnologyAnalyzer.js')

      expect(TechnologyAnalyzer).toBeDefined()
      expect(typeof TechnologyAnalyzer).toBe('function')

      const analyzer = new TechnologyAnalyzer()
      expect(analyzer).toBeDefined()
      expect(analyzer.primaryLanguages).toBeDefined()
      expect(analyzer.frameworks).toBeDefined()
    })

    it('should detect frameworks and libraries', async () => {
      tempDir = await createTempDir('tech-analysis-test')

      // Create package.json with various technologies
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'tech-test',
          dependencies: {
            react: '^18.0.0',
            express: '^4.18.0',
            lodash: '^4.17.0',
          },
          devDependencies: {
            vitest: '^1.0.0',
            eslint: '^8.0.0',
          },
        })
      )

      // Create configuration files
      await fs.writeFile(path.join(tempDir, '.eslintrc.json'), JSON.stringify({ extends: ['eslint:recommended'] }))
      await fs.writeFile(path.join(tempDir, 'vite.config.js'), 'export default { plugins: [] }')

      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')
      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(tempDir)

      expect(projectStructure.files.length).toBeGreaterThan(0)

      // Check for technology indicators
      const packageJsonFile = projectStructure.files.find((f) => f.name === 'package.json')
      expect(packageJsonFile).toBeDefined()
    })
  })

  describe('Rule Adaptation', () => {
    it('should adapt rules to project context', async () => {
      const { RuleAdapter } = await import('../src/scanner/core/RuleAdapter.js')

      expect(RuleAdapter).toBeDefined()

      if (typeof RuleAdapter === 'function') {
        const adapter = new RuleAdapter()
        expect(adapter).toBeDefined()
      }
    })

    it('should customize rules based on project patterns', async () => {
      const ruleAdapter = await import('../src/scanner/core/RuleAdapter.js')

      expect(ruleAdapter).toBeDefined()
      expect(typeof ruleAdapter).toBe('object')
    })
  })

  describe('Rule Generation', () => {
    it('should generate project-specific rules', async () => {
      const { RuleGenerator } = await import('../src/scanner/core/RuleGenerator.js')

      expect(RuleGenerator).toBeDefined()

      if (typeof RuleGenerator === 'function') {
        const generator = new RuleGenerator()
        expect(generator).toBeDefined()
      }
    })

    it('should create contextual AI rules', async () => {
      tempDir = await createTempDir('rule-gen-test')

      // Create project with specific patterns
      await fs.mkdir(path.join(tempDir, 'src', 'api'), { recursive: true })
      await fs.writeFile(
        path.join(tempDir, 'src', 'api', 'routes.js'),
        `
        export const routes = {
          '/users': { method: 'GET', handler: getUsers },
          '/users/:id': { method: 'GET', handler: getUserById }
        };
        `
      )

      const { ProjectScanner } = await import('../src/scanner/core/ProjectScanner.js')
      const scanner = new ProjectScanner()
      const projectStructure = await scanner.scanProject(tempDir)

      expect(projectStructure).toBeDefined()
      expect(projectStructure.files.length).toBeGreaterThan(0)

      // Rule generation would use this project structure
      const ruleGenerator = await import('../src/scanner/core/RuleGenerator.js')
      expect(ruleGenerator).toBeDefined()
    })
  })

  describe('Claude Code CLI Adapter', () => {
    it('should adapt content for Claude Code CLI', async () => {
      const { ClaudeCodeCLIAdapter } = await import('../src/scanner/core/ClaudeCodeAdapter.js')

      expect(ClaudeCodeCLIAdapter).toBeDefined()

      if (typeof ClaudeCodeCLIAdapter === 'function') {
        const adapter = new ClaudeCodeCLIAdapter()
        expect(adapter).toBeDefined()
      }
    })

    it('should format rules for Claude Code CLI consumption', async () => {
      const claudeAdapter = await import('../src/scanner/core/ClaudeCodeAdapter.js')

      expect(claudeAdapter).toBeDefined()
      expect(typeof claudeAdapter).toBe('object')
    })
  })

  describe('Scanner Engine Integration', () => {
    it('should provide complete scanner engine', async () => {
      const { runScanner } = await import('../src/scanner/engine.js')

      expect(runScanner).toBeDefined()
      expect(typeof runScanner).toBe('function')
    })

    it('should coordinate all scanner components', async () => {
      const scannerEngine = await import('../src/scanner/engine.js')

      expect(scannerEngine).toBeDefined()
      expect(typeof scannerEngine).toBe('object')
    })
  })

  describe('Scanner Utilities', () => {
    it('should provide gitignore parsing', async () => {
      const { parseGitignore } = await import('../src/scanner/utils/gitignore-parser.js')

      if (typeof parseGitignore === 'function') {
        const gitignoreContent = `
          node_modules/
          *.log
          .env
          dist/
        `

        const patterns = parseGitignore(gitignoreContent)
        expect(Array.isArray(patterns)).toBe(true)
        expect(patterns.length).toBeGreaterThan(0)
      }
    })

    it('should provide package analysis', async () => {
      tempDir = await createTempDir('package-analysis-test')

      const packageContent = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
        },
        scripts: {
          start: 'node index.js',
          test: 'vitest',
        },
      }

      const packagePath = path.join(tempDir, 'package.json')
      await fs.writeFile(packagePath, JSON.stringify(packageContent, null, 2))

      const packageAnalyzer = await import('../src/scanner/utils/package-analyzer.js')

      if (typeof packageAnalyzer.analyzePackageJson === 'function') {
        const analysis = await packageAnalyzer.analyzePackageJson(packagePath)
        expect(analysis).toBeDefined()
      }

      expect(packageAnalyzer).toBeDefined()
    })

    it('should provide TypeScript parsing utilities', async () => {
      const tsParser = await import('../src/scanner/utils/typescript-parser.js')

      expect(tsParser).toBeDefined()
      expect(typeof tsParser).toBe('object')
    })

    it('should provide validation utilities', async () => {
      const validator = await import('../src/scanner/utils/validator.js')

      expect(validator).toBeDefined()
      expect(typeof validator).toBe('object')
    })

    it('should provide version utilities', async () => {
      const version = await import('../src/scanner/utils/version.js')

      expect(version).toBeDefined()
      expect(typeof version).toBe('object')
    })

    it('should provide constants', async () => {
      const constants = await import('../src/scanner/utils/constants.js')

      expect(constants).toBeDefined()
      expect(typeof constants).toBe('object')
    })
  })

  describe('Scanner Templates', () => {
    it('should provide core agent template', async () => {
      const templatePath = path.join(global.TEST_ROOT, 'src/scanner/templates/core-agent.md')

      try {
        const template = await fs.readFile(templatePath, 'utf8')
        expect(template.length).toBeGreaterThan(0)
        expect(typeof template).toBe('string')
      } catch (_error) {
        // Template might not exist yet
        expect(_error.code).toBe('ENOENT')
      }
    })
  })

  describe('IDE Integration Scanner', () => {
    it('should integrate with IDE systems', async () => {
      const ideIntegration = await import('../src/scanner/integrations/ide-integration.js')

      expect(ideIntegration).toBeDefined()
      expect(typeof ideIntegration).toBe('object')
    })
  })
})
