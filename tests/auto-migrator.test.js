/**
 * AutoMigrator Comprehensive Test Suite
 *
 * Covers all functionality in AutoMigrator.js with thorough testing of:
 * - Migration detection and rule type identification
 * - Rule format adaptation (Cursor, Claude, Copilot, Windsurf)
 * - Project analysis and context extraction
 * - Rule-to-project adaptation workflows
 * - Integration with existing deployment systems
 * - Preview functionality and user interface
 * - Error handling and edge cases
 * - Cleanup and file management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { AutoMigrator } from '../src/migration/AutoMigrator.js'

// Mock dependencies
vi.mock('fs/promises')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    set text(value) {},
  })),
}))

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    yellow: (str) => str,
    green: (str) => str,
    red: (str) => str,
    cyan: (str) => str,
    gray: (str) => str,
  },
}))

// Mock project scanner and related dependencies
vi.mock('../src/scanner/core/ProjectScanner.js', () => ({
  ProjectScanner: vi.fn().mockImplementation(() => ({
    scanProject: vi.fn(),
  })),
}))

vi.mock('../src/scanner/core/TechnologyAnalyzer.js', () => ({
  TechnologyAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeProject: vi.fn().mockResolvedValue({
      framework: 'nextjs',
      language: 'typescript',
      testFramework: 'vitest',
      packageManager: 'pnpm',
    }),
  })),
}))

vi.mock('../src/scanner/core/RuleGenerator.js', () => ({
  RuleGenerator: vi.fn().mockImplementation(() => ({
    generateIDESpecificRules: vi.fn(),
  })),
}))

vi.mock('../src/integrations/index.js', () => ({
  createIntegrationManager: vi.fn().mockReturnValue({
    discoverIntegrations: vi.fn(),
    scanAll: vi.fn(),
    initializeActive: vi.fn(),
    getByName: vi.fn(),
  }),
}))

vi.mock('../src/scanner/core/PatternDetector.js', () => ({
  PatternDetector: vi.fn().mockImplementation(() => ({})),
}))

// Mock console methods
const consoleSpy = {
  warn: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
}

vi.stubGlobal('console', consoleSpy)

describe('AutoMigrator', () => {
  let autoMigrator
  let mockProjectScanner
  let mockIntegrationManager
  let mockRuleGenerator
  const testProjectPath = '/test/project'
  const testImportPath = '/test/project/.vdk/import'

  beforeEach(() => {
    autoMigrator = new AutoMigrator(testProjectPath)
    // Create mock scanner with required methods
    mockProjectScanner = {
      scanProject: vi.fn(),
    }
    // Replace the scanner instance
    autoMigrator.projectScanner = mockProjectScanner

    mockIntegrationManager = {
      discoverIntegrations: vi.fn().mockResolvedValue(),
      scanAll: vi.fn().mockResolvedValue(),
      initializeActive: vi.fn().mockResolvedValue({ errors: [] }),
      getActiveIntegrations: vi.fn().mockReturnValue([{ name: 'claude-code' }, { name: 'cursor' }]),
    }

    mockRuleGenerator = {
      generateIDESpecificRules: vi.fn().mockResolvedValue([]),
    }

    // Set the mocks on the autoMigrator instance
    autoMigrator.integrationManager = mockIntegrationManager

    // Reset all mocks
    vi.clearAllMocks()
    consoleSpy.warn.mockClear()
    consoleSpy.log.mockClear()
    consoleSpy.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with project path and setup import directory', () => {
      expect(autoMigrator.projectPath).toBe(testProjectPath)
      expect(autoMigrator.importPath).toBe(testImportPath)
      expect(autoMigrator.projectScanner).toBeDefined()
      expect(autoMigrator.technologyAnalyzer).toBeDefined()
      expect(autoMigrator.patternDetector).toBeDefined()
      expect(autoMigrator.ruleAdapters.size).toBeGreaterThan(0)
    })

    it('should initialize rule adapters for all supported formats', () => {
      expect(autoMigrator.ruleAdapters.has('cursor')).toBe(true)
      expect(autoMigrator.ruleAdapters.has('claude')).toBe(true)
      expect(autoMigrator.ruleAdapters.has('copilot')).toBe(true)
      expect(autoMigrator.ruleAdapters.has('windsurf')).toBe(true)
    })
  })

  describe('Rule Detection', () => {
    beforeEach(() => {
      fs.access.mockResolvedValue() // Import directory exists
    })

    it('should detect cursor rules correctly', async () => {
      const cursorContent = `# Cursor Rules

Use TypeScript for all new code.
Follow React best practices.
Implement proper error handling.`

      fs.readdir.mockResolvedValue([{ name: '.cursorrules', isFile: () => true }])
      fs.readFile.mockResolvedValue(cursorContent)

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(1)
      expect(detectedRules[0]).toEqual({
        type: 'cursor',
        format: 'cursorrules',
        content: cursorContent,
        originalFile: '.cursorrules',
        filePath: path.join(testImportPath, '.cursorrules'),
        confidence: 'high',
      })
    })

    it('should detect Claude memory files correctly', async () => {
      const claudeContent = `# Claude Memory

## Project Context
This is a React TypeScript project.

## Coding Preferences
- Use functional components
- Implement proper types`

      fs.readdir.mockResolvedValue([{ name: 'claude-memory.md', isFile: () => true }])
      fs.readFile.mockResolvedValue(claudeContent)

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(1)
      expect(detectedRules[0]).toEqual({
        type: 'claude',
        format: 'memory',
        content: claudeContent,
        originalFile: 'claude-memory.md',
        filePath: path.join(testImportPath, 'claude-memory.md'),
        confidence: 'high',
      })
    })

    it('should detect GitHub Copilot configuration', async () => {
      const copilotContent = JSON.stringify({
        guidelines: ['Use best practices', 'Follow conventions'],
        rules: ['Prefer functional programming', 'Use TypeScript types'],
      })

      fs.readdir.mockResolvedValue([{ name: 'copilot-instructions.json', isFile: () => true }])
      fs.readFile.mockResolvedValue(copilotContent)

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(1)
      expect(detectedRules[0].type).toBe('copilot')
      expect(detectedRules[0].format).toBe('json')
      expect(detectedRules[0].parsed).toEqual({
        guidelines: ['Use best practices', 'Follow conventions'],
        rules: ['Prefer functional programming', 'Use TypeScript types'],
      })
      expect(detectedRules[0].confidence).toBe('high')
    })

    it('should detect Windsurf rules', async () => {
      const windsurfContent = `<windsurf:context>
  <windsurf:rules>
    Use modern JavaScript patterns
    Implement proper error handling
  </windsurf:rules>
</windsurf:context>`

      fs.readdir.mockResolvedValue([{ name: 'windsurf-rules.xml', isFile: () => true }])
      fs.readFile.mockResolvedValue(windsurfContent)

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(1)
      expect(detectedRules[0].type).toBe('windsurf')
      expect(detectedRules[0].format).toBe('xml')
      expect(detectedRules[0].confidence).toBe('high')
    })

    it('should detect generic AI rules as fallback', async () => {
      const genericContent = `AI Assistant Rules

Follow these guidelines when helping with code:
1. Use clear variable names
2. Add comments for complex logic
3. Handle errors gracefully`

      fs.readdir.mockResolvedValue([{ name: 'ai-rules.txt', isFile: () => true }])
      fs.readFile.mockResolvedValue(genericContent)

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(1)
      expect(detectedRules[0].type).toBe('generic')
      expect(detectedRules[0].format).toBe('text')
      expect(detectedRules[0].confidence).toBe('low')
    })

    it('should skip empty files', async () => {
      fs.readdir.mockResolvedValue([{ name: 'empty.md', isFile: () => true }])
      fs.readFile.mockResolvedValue('')

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(0)
    })

    it('should handle missing import directory', async () => {
      fs.access.mockRejectedValue(new Error('Directory not found'))

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(0)
    })

    it('should handle file reading errors gracefully', async () => {
      fs.readdir.mockResolvedValue([{ name: 'problematic.md', isFile: () => true }])
      fs.readFile.mockRejectedValue(new Error('Permission denied'))

      const detectedRules = await autoMigrator.detectImportedRules()

      expect(detectedRules).toHaveLength(0)
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Could not process problematic.md'))
    })
  })

  describe('Project Analysis', () => {
    it('should analyze current project successfully', async () => {
      const mockProjectData = {
        structure: {
          directories: ['src', 'tests'],
          files: ['package.json', 'tsconfig.json'],
        },
        dependencies: ['react', 'typescript', 'jest'],
      }

      mockProjectScanner.scanProject.mockResolvedValue(mockProjectData)

      const context = await autoMigrator.analyzeCurrentProject()

      expect(context.name).toBe('project')
      expect(context.techStack).toEqual(['javascript', 'nodejs'])
      expect(context.primaryFramework).toBe('nodejs')
      expect(context.primaryLanguage).toBe('javascript')
      expect(context.architecture).toBe('standard')
      expect(context.patterns).toEqual(['modular'])
    })

    it('should handle project analysis failures with fallback', async () => {
      mockProjectScanner.scanProject.mockRejectedValue(new Error('Analysis failed'))

      const context = await autoMigrator.analyzeCurrentProject()

      expect(context.name).toBe('project')
      expect(context.techStack).toEqual(['javascript'])
      expect(context.primaryFramework).toBe('generic')
      expect(context.primaryLanguage).toBe('javascript')
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Project analysis failed'))
    })

    it('should handle inaccessible project directory', async () => {
      fs.access.mockRejectedValue(new Error('Directory not accessible'))

      const context = await autoMigrator.analyzeCurrentProject()

      // When project analysis fails, it should still return a basic context
      expect(context.name).toBe('project') // Uses path.basename which returns 'project'
      expect(context.primaryFramework).toBe('generic')
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Project directory inaccessible'))
    })
  })

  describe('Migration Preview', () => {
    const mockDetectedRules = [
      {
        type: 'cursor',
        content: 'cursor rule content',
        format: 'cursorrules',
        originalFile: '.cursorrules',
        confidence: 'high',
      },
      {
        type: 'claude',
        content: 'claude memory content',
        format: 'memory',
        originalFile: 'claude.md',
        confidence: 'high',
      },
    ]

    const mockProjectContext = {
      name: 'test-project',
      techStack: ['react', 'typescript'],
      primaryFramework: 'react',
      primaryLanguage: 'typescript',
    }

    beforeEach(() => {
      autoMigrator.detectImportedRules = vi.fn().mockResolvedValue(mockDetectedRules)
      autoMigrator.analyzeCurrentProject = vi.fn().mockResolvedValue(mockProjectContext)
    })

    it('should create migration preview successfully', async () => {
      // Mock rule adapter preview responses
      const cursorAdapter = autoMigrator.ruleAdapters.get('cursor')
      cursorAdapter.previewAdaptation = vi.fn().mockResolvedValue({
        adaptations: ['Will add React patterns', 'Will enhance TypeScript support'],
      })

      const claudeAdapter = autoMigrator.ruleAdapters.get('claude')
      claudeAdapter.previewAdaptation = vi.fn().mockResolvedValue({
        adaptations: ['Will add current project context', 'Will add technology guidelines'],
      })

      const preview = await autoMigrator.createMigrationPreview(mockDetectedRules, mockProjectContext)

      expect(preview.rules).toHaveLength(2)
      expect(preview.rules[0].type).toBe('cursor')
      expect(preview.rules[0].adaptations).toContain('Will add React patterns')
      expect(preview.rules[1].type).toBe('claude')
      expect(preview.adaptations).toHaveLength(4)
      expect(preview.platforms).toContain('claude-code')
      expect(preview.platforms).toContain('cursor')
      expect(preview.summary).toContain('2 rule files')
    })

    it('should handle missing adapters gracefully', async () => {
      const unsupportedRule = {
        type: 'unsupported',
        content: 'content',
        format: 'unknown',
        originalFile: 'unknown.txt',
        confidence: 'low',
      }

      const preview = await autoMigrator.createMigrationPreview([unsupportedRule], mockProjectContext)

      expect(preview.rules).toHaveLength(0)
      expect(preview.warnings).toContain('No adapter available for unsupported rules')
    })

    it('should generate proper preview summary', () => {
      const preview = {
        rules: [{ type: 'cursor' }, { type: 'claude' }],
        adaptations: ['adaptation1', 'adaptation2', 'adaptation3'],
        platforms: ['claude-code', 'cursor', 'windsurf'],
      }

      const summary = autoMigrator.generatePreviewSummary(preview)

      expect(summary).toBe('Will migrate 2 rule files with 3 adaptations for 3 platforms')
    })
  })

  describe('Rule Adaptation', () => {
    const mockDetectedRules = [
      {
        type: 'cursor',
        content: 'Use TypeScript for all code.',
        format: 'cursorrules',
        originalFile: '.cursorrules',
      },
    ]

    const mockProjectContext = {
      name: 'react-app',
      techStack: ['react', 'typescript'],
      primaryFramework: 'react',
    }

    it('should adapt rules to project context successfully', async () => {
      const cursorAdapter = autoMigrator.ruleAdapters.get('cursor')
      cursorAdapter.adapt = vi.fn().mockResolvedValue({
        content: 'Adapted TypeScript rules for React project.',
        adaptations: ['Added React patterns', 'Enhanced TypeScript support'],
        projectContext: mockProjectContext,
      })

      const adaptedRules = await autoMigrator.adaptRulesToProject(mockDetectedRules, mockProjectContext, {
        overridePersonal: false,
      })

      expect(adaptedRules).toHaveLength(1)
      expect(adaptedRules[0].source).toBe('cursor')
      expect(adaptedRules[0].originalFile).toBe('.cursorrules')
      expect(adaptedRules[0].adapted.content).toContain('Adapted TypeScript rules')
      expect(adaptedRules[0].quality).toBeGreaterThan(0)

      expect(cursorAdapter.adapt).toHaveBeenCalledWith({
        sourceContent: 'Use TypeScript for all code.',
        sourceFormat: 'cursorrules',
        targetContext: mockProjectContext,
        preservePersonalPreferences: true,
        originalFile: '.cursorrules',
      })
    })

    it('should handle adaptation failures gracefully', async () => {
      const cursorAdapter = autoMigrator.ruleAdapters.get('cursor')
      cursorAdapter.adapt = vi.fn().mockRejectedValue(new Error('Adaptation failed'))

      const adaptedRules = await autoMigrator.adaptRulesToProject(mockDetectedRules, mockProjectContext, {})

      expect(adaptedRules).toHaveLength(0)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to adapt cursor rules: Adaptation failed')
      )
    })

    it('should calculate adaptation quality correctly', () => {
      const goodAdapted = {
        content: 'x'.repeat(2500), // Long content
        adaptations: ['adaptation1', 'adaptation2', 'adaptation3'],
      }

      const contextWithTech = {
        techStack: ['react', 'typescript', 'jest'],
      }

      const quality = autoMigrator.calculateAdaptationQuality(goodAdapted, contextWithTech)

      expect(quality).toBeGreaterThan(7) // Base 5 + length 2 + adaptations 3 + tech matches
      expect(quality).toBeLessThanOrEqual(10)
    })
  })

  describe('Blueprint Conversion', () => {
    it('should convert adapted rules to VDK blueprint format', () => {
      const adaptedRules = [
        {
          source: 'cursor',
          adapted: {
            content: 'Cursor rules adapted content',
            projectContext: { techStack: ['react', 'typescript'] },
          },
        },
        {
          source: 'claude',
          adapted: {
            content: 'Claude memory adapted content',
          },
        },
      ]

      const blueprint = autoMigrator.convertToBlueprint(adaptedRules)

      expect(blueprint.id).toMatch(/^migrated-rules-\d+$/)
      expect(blueprint.title).toBe('Migrated AI Rules')
      expect(blueprint.description).toContain('cursor, claude')
      expect(blueprint.version).toBe('1.0.0')
      expect(blueprint.category).toBe('project')
      expect(blueprint.author).toBe('VDK Auto-Migration')
      expect(blueprint.tags).toContain('migrated')
      expect(blueprint.tags).toContain('react')
      expect(blueprint.tags).toContain('typescript')
      expect(blueprint.content).toContain('Cursor rules adapted content')
      expect(blueprint.content).toContain('Claude memory adapted content')
      expect(blueprint.platforms['claude-code'].compatible).toBe(true)
      expect(blueprint.platforms.cursor.compatible).toBe(true)
    })

    it('should handle empty adapted rules', () => {
      const blueprint = autoMigrator.convertToBlueprint([])

      expect(blueprint.content).toBe('')
      expect(blueprint.tags).toEqual(['migrated', 'auto-generated'])
    })
  })

  describe('Integration and Deployment', () => {
    const mockAdaptedRules = [
      {
        source: 'cursor',
        adapted: { content: 'adapted cursor content' },
        quality: 8,
      },
    ]

    beforeEach(async () => {
      // Reset and configure all mocks for this test suite
      vi.clearAllMocks()

      // Configure rule generator mock
      mockRuleGenerator.generateIDESpecificRules.mockResolvedValue([
        { id: 'rule1', content: 'generated rule 1' },
        { id: 'rule2', content: 'generated rule 2' },
      ])

      // Configure integration manager mock
      mockIntegrationManager.discoverIntegrations.mockResolvedValue()
      mockIntegrationManager.scanAll.mockResolvedValue()
      mockIntegrationManager.initializeActive.mockResolvedValue({
        success: true,
        errors: [],
      })
      mockIntegrationManager.getActiveIntegrations.mockReturnValue([{ name: 'claude-code' }, { name: 'cursor' }])

      // Ensure the integration manager is properly set
      autoMigrator.integrationManager = mockIntegrationManager
    })

    it('should deploy adapted rules successfully', async () => {
      const deployResult = await autoMigrator.deployAdaptedRules(mockAdaptedRules, {
        verbose: false,
      })

      expect(deployResult.success).toBe(true)
      expect(deployResult.platforms).toEqual(['claude-code', 'cursor'])
      expect(deployResult.errors).toEqual([])

      expect(mockIntegrationManager.discoverIntegrations).toHaveBeenCalledWith({ verbose: false })
      expect(mockIntegrationManager.scanAll).toHaveBeenCalledWith({ verbose: false })
      expect(mockIntegrationManager.initializeActive).toHaveBeenCalledWith({
        rules: expect.any(Array),
        overwrite: false,
        verbose: false,
      })
    })

    it('should handle deployment failures gracefully', async () => {
      mockIntegrationManager.initializeActive.mockRejectedValue(new Error('Deployment failed'))

      const deployResult = await autoMigrator.deployAdaptedRules(mockAdaptedRules, {})

      expect(deployResult.success).toBe(false)
      expect(deployResult.errors).toContain('Deployment failed')
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Deployment failed'))
    })

    it('should handle integration warnings', async () => {
      mockIntegrationManager.initializeActive.mockResolvedValue({
        success: true,
        errors: ['Warning: Platform X not found', 'Warning: Configuration incomplete'],
      })

      const deployResult = await autoMigrator.deployAdaptedRules(mockAdaptedRules, {})

      expect(deployResult.success).toBe(true)
      expect(deployResult.errors).toHaveLength(2)
    })
  })

  describe('Complete Migration Workflow', () => {
    beforeEach(() => {
      // Mock successful detection
      fs.access.mockResolvedValue()
      fs.readdir.mockResolvedValue([
        { name: '.cursorrules', isFile: () => true },
        { name: 'claude.md', isFile: () => true },
      ])
      fs.readFile.mockResolvedValueOnce('Cursor rules content').mockResolvedValueOnce('# Claude Memory\nClaude content')

      // Mock successful project analysis
      mockProjectScanner.scanProject.mockResolvedValue({
        structure: {},
        dependencies: [],
      })

      // Mock successful adaptation
      const mockAdaptedRules = [
        { source: 'cursor', adapted: { content: 'adapted' }, quality: 8 },
        { source: 'claude', adapted: { content: 'adapted' }, quality: 7 },
      ]
      autoMigrator.adaptRulesToProject = vi.fn().mockResolvedValue(mockAdaptedRules)

      // Mock successful deployment
      autoMigrator.deployAdaptedRules = vi.fn().mockResolvedValue({
        success: true,
        platforms: ['claude-code', 'cursor'],
        errors: [],
      })
    })

    it('should complete full migration successfully', async () => {
      const result = await autoMigrator.migrate({ clean: true })

      expect(result.success).toBe(true)
      expect(result.rulesProcessed).toBe(2)
      expect(result.platformsDeployed).toEqual(['claude-code', 'cursor'])
      expect(result.suggestions).toBeDefined()
    })

    it('should handle preview mode', async () => {
      autoMigrator.createMigrationPreview = vi.fn().mockResolvedValue({
        summary: 'Preview summary',
        rules: [],
        adaptations: [],
        platforms: [],
        warnings: [],
      })

      const result = await autoMigrator.migrate({ preview: true })

      expect(result.success).toBe(true)
      expect(result.preview).toBeDefined()
      expect(autoMigrator.adaptRulesToProject).not.toHaveBeenCalled()
      expect(autoMigrator.deployAdaptedRules).not.toHaveBeenCalled()
    })

    it('should handle no rules found scenario', async () => {
      fs.access.mockRejectedValue(new Error('Directory not found'))

      const result = await autoMigrator.migrate()

      expect(result.success).toBe(false)
      expect(result.reason).toBe('no_rules_found')
    })

    it('should clean import directory after successful migration', async () => {
      fs.readdir.mockResolvedValueOnce([{ name: '.cursorrules', isFile: () => true }])
      fs.readdir.mockResolvedValueOnce(['file1.txt', 'file2.md']) // For cleanup
      fs.unlink.mockResolvedValue()
      fs.rmdir.mockResolvedValue()

      await autoMigrator.migrate({ clean: true })

      expect(fs.unlink).toHaveBeenCalledWith(path.join(testImportPath, 'file1.txt'))
      expect(fs.unlink).toHaveBeenCalledWith(path.join(testImportPath, 'file2.md'))
      expect(fs.rmdir).toHaveBeenCalledWith(testImportPath)
    })

    it('should handle cleanup failures gracefully', async () => {
      fs.readdir.mockResolvedValueOnce([{ name: '.cursorrules', isFile: () => true }])
      fs.readdir.mockResolvedValueOnce(['file1.txt']) // For cleanup
      fs.unlink.mockRejectedValue(new Error('Cleanup failed'))

      await autoMigrator.migrate({ clean: true })

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Could not clean import directory'))
    })
  })

  describe('Rule Adapter Classes', () => {
    describe('CursorRuleAdapter', () => {
      let adapter

      beforeEach(() => {
        // Get the adapter class from the ruleAdapters map
        adapter = autoMigrator.ruleAdapters.get('cursor')
      })

      it('should adapt cursor rules with framework patterns', async () => {
        const targetContext = {
          primaryFramework: 'nextjs',
          techStack: ['typescript'],
          architecture: 'ssr',
        }

        const result = await adapter.adapt({
          sourceContent: 'Use JavaScript best practices.',
          targetContext,
        })

        expect(result.content).toContain('Next.js Patterns')
        expect(result.content).toContain('TypeScript')
        expect(result.content).toContain('Architecture: ssr')
        expect(result.adaptations).toContain('Added nextjs patterns')
        expect(result.adaptations).toContain('Enhanced TypeScript support')
        expect(result.adaptations).toContain('Added ssr patterns')
      })

      it('should preview adaptations correctly', async () => {
        const targetContext = {
          primaryFramework: 'react',
          techStack: ['typescript'],
          architecture: 'spa',
        }

        const preview = await adapter.previewAdaptation({ targetContext })

        expect(preview.adaptations).toContain('Will add react patterns')
        expect(preview.adaptations).toContain('Will enhance TypeScript support')
        expect(preview.adaptations).toContain('Will add spa architecture patterns')
      })
    })

    describe('ClaudeMemoryAdapter', () => {
      let adapter

      beforeEach(() => {
        adapter = autoMigrator.ruleAdapters.get('claude')
      })

      it('should adapt Claude memory with project context', async () => {
        const targetContext = {
          name: 'my-app',
          primaryFramework: 'vue',
          primaryLanguage: 'javascript',
          techStack: ['vue', 'vuex', 'vue-router'],
          architecture: 'spa',
          packageManager: 'yarn',
        }

        const result = await adapter.adapt({
          sourceContent: 'Original Claude memory content',
          targetContext,
        })

        expect(result.content).toContain('# Current Project Context')
        expect(result.content).toContain('## Project: my-app')
        expect(result.content).toContain('**Framework**: vue')
        expect(result.content).toContain('**Language**: javascript')
        expect(result.content).toContain('**Tech Stack**: vue, vuex, vue-router')
        expect(result.content).toContain('**Architecture**: spa')
        expect(result.content).toContain('**Package Manager**: yarn')
        expect(result.content).toContain('# Technology Guidelines')
        expect(result.adaptations).toContain('Added current project context')
        expect(result.adaptations).toContain('Added 3 technology guidelines')
      })
    })

    describe('CopilotConfigAdapter', () => {
      let adapter

      beforeEach(() => {
        adapter = autoMigrator.ruleAdapters.get('copilot')
      })

      it('should adapt valid JSON configuration', async () => {
        const sourceContent = JSON.stringify({
          guidelines: ['Existing guideline'],
          rules: ['Existing rule'],
        })

        const targetContext = {
          primaryFramework: 'angular',
          techStack: ['angular', 'typescript', 'rxjs'],
        }

        const result = await adapter.adapt({
          sourceContent,
          targetContext,
        })

        const parsedResult = JSON.parse(result.content)
        expect(parsedResult.guidelines).toHaveLength(5) // 1 existing + 1 framework + 3 tech (actual behavior)
        expect(parsedResult.guidelines[1].title).toBe('angular Best Practices')
        expect(result.adaptations).toContain('Added angular guidelines')
        expect(result.adaptations).toContain('Added 3 technology guidelines')
      })

      it('should handle invalid JSON as plain text', async () => {
        const sourceContent = 'Invalid JSON content'
        const targetContext = {
          primaryFramework: 'react',
          techStack: ['react'],
        }

        const result = await adapter.adapt({
          sourceContent,
          targetContext,
        })

        expect(result.content).toContain('Invalid JSON content')
        expect(result.content).toContain('Project Context:')
        expect(result.content).toContain('Framework: react')
        expect(result.adaptations).toEqual(['Added project context as text'])
      })
    })

    describe('WindsurfRuleAdapter', () => {
      let adapter

      beforeEach(() => {
        adapter = autoMigrator.ruleAdapters.get('windsurf')
      })

      it('should wrap non-XML content in windsurf structure', async () => {
        const sourceContent = 'Plain text windsurf rules'
        const targetContext = {
          name: 'test-project',
          techStack: ['javascript', 'nodejs'],
        }

        const result = await adapter.adapt({
          sourceContent,
          targetContext,
        })

        expect(result.content).toContain('<windsurf:context project="test-project">')
        expect(result.content).toContain('Plain text windsurf rules')
        expect(result.content).toContain('<windsurf:tech name="javascript">')
        expect(result.content).toContain('<windsurf:tech name="nodejs">')
        expect(result.content).toContain('</windsurf:context>')
        expect(result.adaptations).toContain('Added Windsurf XML structure')
        expect(result.adaptations).toContain('Added 2 technology sections')
      })

      it('should enhance existing XML content', async () => {
        const sourceContent = `<windsurf:context>
  <windsurf:rules>Existing rules</windsurf:rules>
</windsurf:context>`

        const targetContext = {
          name: 'xml-project',
          techStack: ['python', 'django'],
        }

        const result = await adapter.adapt({
          sourceContent,
          targetContext,
        })

        expect(result.content).toContain('Existing rules')
        expect(result.content).toContain('<windsurf:tech name="python">')
        expect(result.content).toContain('<windsurf:tech name="django">')
        expect(result.adaptations).toContain('Added 2 technology sections')
      })
    })
  })

  describe('Suggestions Generation', () => {
    it('should identify publish-worthy rules', () => {
      const highQualityRules = [{ quality: 8 }, { quality: 7 }, { quality: 9 }]

      const suggestions = autoMigrator.generateSuggestions(highQualityRules, {})

      expect(suggestions.publishWorthy).toBe(true)
      expect(suggestions.nextSteps).toContain('Consider sharing your adapted rules with the community')
    })

    it('should suggest improvements for low quality rules', () => {
      const mixedQualityRules = [{ quality: 8 }, { quality: 4 }]

      const suggestions = autoMigrator.generateSuggestions(mixedQualityRules, {})

      expect(suggestions.improvements).toContain('Some rules could benefit from additional customization')
    })

    it('should provide framework-specific suggestions', () => {
      const suggestions = autoMigrator.generateSuggestions([], {
        primaryFramework: 'svelte',
      })

      expect(suggestions.nextSteps).toContain('Look for svelte-specific community rules')
    })
  })

  describe('UI Helper Methods', () => {
    it('should show import instructions when no rules found', () => {
      autoMigrator.showImportInstructions()

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('To migrate existing AI rules:'))
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('mkdir -p .vdk/import'))
    })

    it('should display completion message', () => {
      const deployResult = {
        platforms: ['claude-code', 'cursor', 'windsurf'],
      }

      autoMigrator.showCompletionMessage(deployResult)

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Migration complete! Your AI tools now understand your project.')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Deployed to: claude-code, cursor, windsurf'))
    })

    it('should log detected rules with confidence indicators', () => {
      const rules = [
        { type: 'cursor', originalFile: '.cursorrules', confidence: 'high' },
        { type: 'claude', originalFile: 'memory.md', confidence: 'medium' },
        { type: 'generic', originalFile: 'rules.txt', confidence: 'low' },
      ]

      autoMigrator.logDetectedRules(rules)

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('✓ Found cursor rules'))
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('~ Found claude rules'))
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('? Found generic rules'))
    })
  })

  describe('Preview Method', () => {
    it('should create standalone preview', async () => {
      autoMigrator.detectImportedRules = vi
        .fn()
        .mockResolvedValue([{ type: 'cursor', content: 'test', confidence: 'high' }])
      autoMigrator.analyzeCurrentProject = vi.fn().mockResolvedValue({
        name: 'test-project',
      })
      autoMigrator.createMigrationPreview = vi.fn().mockResolvedValue({
        summary: 'Test preview',
      })

      const preview = await autoMigrator.previewMigration()

      expect(preview.summary).toBe('Test preview')
      expect(autoMigrator.createMigrationPreview).toHaveBeenCalled()
    })
  })
})
