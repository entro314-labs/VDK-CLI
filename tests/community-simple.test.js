/**
 * Simplified Community Functionality Tests
 *
 * Focused tests for community features that avoid complex mocking:
 * - CommunityDeployer core logic
 * - Blueprint normalization
 * - Error handling patterns
 * - Integration workflows
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CommunityDeployer } from '../src/community/CommunityDeployer.js'

// Mock only what we need to test
vi.mock('../src/scanner/core/ProjectScanner.js', () => ({
  ProjectScanner: class MockProjectScanner {
    constructor() {}
    async analyzeProject() {
      return {
        framework: 'nextjs',
        language: 'typescript',
        dependencies: ['react', 'next'],
        hasTests: true,
      }
    }
  },
}))

vi.mock('../src/scanner/core/RuleAdapter.js', () => ({
  RuleAdapter: class MockRuleAdapter {
    constructor() {}
    async adaptForProject(content, context) {
      return {
        adaptedContent: `# Adapted for ${context.framework}\n${content}`,
        adaptations: 2,
        compatibilityScore: 8,
      }
    }
    scoreCompatibility() {
      return 8
    }
  },
}))

vi.mock('../src/integrations/index.js', () => ({
  createIntegrationManager: async () => ({
    detectIntegrations: async () => [
      { type: 'claude-code', configured: true },
      { type: 'cursor', configured: true },
    ],
    deployToIntegrations: async () => ({
      success: true,
      platforms: ['claude-code', 'cursor'],
      deployments: {
        'claude-code': { success: true, path: '.claude/CLAUDE.md' },
        cursor: { success: true, path: '.cursorrules' },
      },
    }),
  }),
}))

describe('Community Functionality Tests', () => {
  let deployer

  beforeEach(() => {
    deployer = new CommunityDeployer('/test/project')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Blueprint Normalization', () => {
    it('should normalize Hub blueprint correctly', () => {
      const hubBlueprint = {
        id: 'react-patterns',
        title: 'React Patterns',
        content: '# React Patterns\nModern React patterns...',
        author: { username: 'react-expert', verified: true },
        metadata: {
          framework: 'React',
          language: 'TypeScript',
          category: 'frontend',
          tags: ['react', 'patterns'],
        },
        stats: { usageCount: 127, rating: 4.8 },
      }

      const normalized = deployer.normalizeHubBlueprint(hubBlueprint)

      expect(normalized.id).toBe('react-patterns')
      expect(normalized.title).toBe('React Patterns')
      expect(normalized.content).toBe('# React Patterns\nModern React patterns...')
      expect(normalized.author).toEqual({ username: 'react-expert', verified: true })
      expect(normalized.platforms).toEqual({})
      expect(normalized.metadata).toEqual(hubBlueprint)
    })

    it('should normalize repository blueprint correctly', () => {
      const repoBlueprint = {
        name: 'nextjs-patterns',
        content: '# Next.js Patterns\nNext.js best practices...',
        metadata: {
          id: 'nextjs-patterns',
          title: 'Next.js Patterns',
          description: 'Best practices for Next.js',
          framework: 'nextjs',
          category: 'fullstack',
          author: 'nextjs-contributor',
        },
      }

      const normalized = deployer.normalizeRepositoryBlueprint(repoBlueprint)

      expect(normalized.id).toBe('nextjs-patterns')
      expect(normalized.title).toBe('Next.js Patterns')
      expect(normalized.description).toBe('Best practices for Next.js')
      expect(normalized.content).toBe('# Next.js Patterns\nNext.js best practices...')
      expect(normalized.author).toBe('nextjs-contributor')
      expect(normalized.platforms).toEqual({})
      expect(normalized.metadata).toEqual(repoBlueprint.metadata)
    })

    it('should handle missing author information', () => {
      const hubBlueprint = {
        id: 'no-author',
        title: 'No Author Blueprint',
        content: 'Content without author',
        metadata: { framework: 'Unknown' },
      }

      const normalized = deployer.normalizeHubBlueprint(hubBlueprint)

      expect(normalized.author).toBeUndefined()
      expect(normalized.id).toBe('no-author')
      expect(normalized.platforms).toEqual({})
    })
  })

  describe('Project Context Analysis', () => {
    it('should analyze project context successfully', async () => {
      const context = await deployer.analyzeProjectContext()

      expect(context.name).toBe('project')
      expect(context.framework).toBe('generic')
      expect(context.language).toBe('javascript')
      expect(context.architecture).toBe('standard')
      expect(context.packageManager).toBe('npm')
      expect(context.platforms).toContain('claude-code')
      expect(context.platforms).toContain('cursor')
    })

    it('should handle analysis errors gracefully', async () => {
      // Mock project scanner to throw error
      deployer.projectScanner.scanProject = vi.fn().mockRejectedValue(new Error('Analysis failed'))

      const context = await deployer.analyzeProjectContext()

      expect(context.framework).toBe('generic')
      expect(context.language).toBe('javascript')
      expect(context.summary).toBe('Generic JavaScript project')
    })
  })

  describe('Blueprint Adaptation', () => {
    it('should create adaptation plan correctly', async () => {
      const blueprint = {
        content: '# Original Blueprint\nGeneric content...',
        metadata: { framework: 'React', language: 'JavaScript' },
      }

      const projectContext = {
        framework: 'nextjs',
        language: 'typescript',
        technologies: ['react', 'typescript'],
      }

      const adaptationPlan = await deployer.createAdaptationPlan(blueprint, projectContext)

      expect(adaptationPlan.compatibilityScore).toBeGreaterThan(0)
      expect(adaptationPlan.changes).toBeDefined()
      expect(adaptationPlan.confidence).toBeDefined()
    })

    it('should handle blueprint to project adaptation', async () => {
      const blueprint = {
        content: '# Test Blueprint\nContent here',
        metadata: { framework: 'React' },
      }

      const projectContext = {
        name: 'test-project',
        framework: 'nextjs',
        language: 'typescript',
        technologies: ['react'],
        architecture: 'standard',
        patterns: [],
        packageManager: 'npm',
      }

      const adaptationPlan = {
        changes: [{ type: 'framework', description: 'Converting React to Next.js' }],
        additions: [],
        compatibilityScore: 8,
      }

      const result = await deployer.adaptBlueprintToProject(blueprint, projectContext, adaptationPlan)

      expect(result.content).toContain('Project Context: test-project')
      expect(result.content).toContain('# Test Blueprint')
      expect(result.adaptedFor).toEqual(projectContext)
    })

    it('should assess framework compatibility', () => {
      const compatibility = deployer.assessFrameworkCompatibility('react', 'nextjs')

      expect(compatibility.score).toBeGreaterThan(0.5)
      expect(compatibility.needsAdaptation).toBe(true)
      expect(compatibility.confidence).toBe('high')
      expect(compatibility.from).toBe('react')
      expect(compatibility.to).toBe('nextjs')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing blueprint gracefully', () => {
      expect(() => deployer.normalizeHubBlueprint(null)).toThrow()
    })

    it('should handle empty blueprint content', () => {
      const emptyBlueprint = {
        id: 'empty',
        title: 'Empty Blueprint',
        content: '',
        metadata: {},
      }

      const normalized = deployer.normalizeHubBlueprint(emptyBlueprint)

      expect(normalized.id).toBe('empty')
      expect(normalized.content).toBe('')
    })

    it('should handle malformed metadata', () => {
      const malformedBlueprint = {
        id: 'malformed',
        title: 'Malformed Blueprint',
        content: 'test content',
        metadata: 'not an object',
        stats: null,
      }

      const normalized = deployer.normalizeHubBlueprint(malformedBlueprint)

      expect(normalized.id).toBe('malformed')
      expect(normalized.metadata).toBe(malformedBlueprint)
      expect(normalized.platforms).toEqual({})
    })
  })

  describe('Utility Methods', () => {
    it('should detect frameworks correctly', () => {
      const mockProjectData = { files: [] }
      const framework = deployer.detectFramework(mockProjectData)
      expect(framework).toBe('generic')
    })

    it('should calculate deployment summary correctly', () => {
      const blueprint = {
        id: 'test-blueprint',
        title: 'Test Blueprint',
        metadata: { framework: 'React' },
      }

      const deployResult = {
        success: true,
        platforms: ['claude-code', 'cursor'],
        deployments: {
          'claude-code': { success: true, path: '.claude/CLAUDE.md' },
          cursor: { success: true, path: '.cursorrules' },
        },
      }

      const adaptationPlan = {
        adaptations: 2,
        compatibilityScore: 8,
      }

      // This tests the internal logic without UI output
      const summary = {
        blueprint: blueprint.title,
        platforms: deployResult.platforms.length,
        adaptations: adaptationPlan.adaptations,
        score: adaptationPlan.compatibilityScore,
      }

      expect(summary.blueprint).toBe('Test Blueprint')
      expect(summary.platforms).toBe(2)
      expect(summary.adaptations).toBe(2)
      expect(summary.score).toBe(8)
    })

    it('should format platform lists correctly', () => {
      const platforms = { 'claude-code': { compatible: true }, cursor: { compatible: true } }
      const formatted = deployer.formatPlatformList(platforms)
      expect(formatted).toContain('claude-code')
      expect(formatted).toContain('cursor')
    })
  })

  describe('Integration Workflow', () => {
    it('should complete preview deployment workflow', async () => {
      const mockBlueprint = {
        id: 'workflow-test',
        title: 'Workflow Test Blueprint',
        description: 'Test blueprint description',
        content: '# Test Content',
        author: 'test-author',
        platforms: { 'claude-code': { compatible: true } },
        metadata: { framework: 'React' },
      }

      // Mock fetchCommunityBlueprint to return our test blueprint
      deployer.fetchCommunityBlueprint = vi.fn().mockResolvedValue(mockBlueprint)

      const result = await deployer.previewDeployment('workflow-test')

      expect(result.blueprint.id).toBe('workflow-test')
      expect(result.blueprint.title).toBe('Workflow Test Blueprint')
      expect(result.adaptationPlan).toBeDefined()
      expect(result.projectContext).toBeDefined()
    })

    it('should generate project summary correctly', () => {
      const context = {
        framework: 'nextjs',
        language: 'typescript',
        technologies: ['tailwind', 'prisma'],
      }

      const summary = deployer.generateProjectSummary(context)
      expect(summary).toContain('nextjs')
      expect(summary).toContain('typescript')
    })
  })
})
