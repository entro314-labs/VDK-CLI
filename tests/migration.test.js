/**
 * Migration System Tests
 * Tests the AI context migration functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MigrationManager } from '../src/migration/migration-manager.js'
import { MigrationDetector } from '../src/migration/core/migration-detector.js'
import { MigrationAdapter } from '../src/migration/core/migration-adapter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const testProjectPath = path.join(__dirname, 'fixtures', 'migration-test-project')

describe('Migration System', () => {
  let tempDir

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = path.join(__dirname, 'temp', `migration-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    // Create test project structure with AI contexts
    await createTestProject(tempDir)
  })

  afterEach(async () => {
    // Cleanup
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('MigrationDetector', () => {
    it('should detect Claude Code CLI contexts', async () => {
      const detector = new MigrationDetector(tempDir)
      const mockProjectData = {
        files: [
          {
            name: 'CLAUDE.md',
            relativePath: 'CLAUDE.md',
            path: path.join(tempDir, 'CLAUDE.md'),
            size: 1000,
          },
        ],
        directories: [],
      }

      const contexts = await detector.detectAIContexts(mockProjectData)

      expect(contexts).toBeDefined()
      expect(contexts.length).toBeGreaterThan(0)

      const claudeContext = contexts.find((ctx) => ctx.type === 'claude-code-cli')
      expect(claudeContext).toBeDefined()
      expect(claudeContext.confidence).toBe('high')
    })

    it('should detect Cursor contexts', async () => {
      const detector = new MigrationDetector(tempDir)
      const mockProjectData = {
        files: [
          {
            name: '.cursorrules',
            relativePath: '.cursorrules',
            path: path.join(tempDir, '.cursorrules'),
            size: 500,
          },
        ],
        directories: [],
      }

      const contexts = await detector.detectAIContexts(mockProjectData)

      const cursorContext = contexts.find((ctx) => ctx.type === 'cursor')
      expect(cursorContext).toBeDefined()
      expect(cursorContext.confidence).toBe('high')
    })

    it('should calculate confidence correctly', async () => {
      const detector = new MigrationDetector(tempDir)

      // High confidence case
      const highConf = detector.calculateConfidence('claude-code-cli', 'CLAUDE.md', 'mcp: server tool:', 'CLAUDE.md')
      expect(highConf).toBe('high')

      // Low confidence case - generic-ai with proper path and content
      const lowConf = detector.calculateConfidence(
        'generic-ai',
        'context.md',
        'This is some AI context with assistant and prompt keywords',
        '.vdk/context.md'
      )
      expect(lowConf).toBe('low')
    })
  })

  describe('MigrationAdapter', () => {
    it('should adapt Claude Code CLI contexts to VDK format', async () => {
      const adapter = new MigrationAdapter()
      const mockContext = {
        type: 'claude-code-cli',
        source: 'Claude Code CLI',
        fileName: 'CLAUDE.md',
        relativePath: 'CLAUDE.md',
        hasMemory: true,
        claudeSpecific: {
          hasSlashCommands: false,
          hasMCPReferences: true,
          hasFileReferences: true,
        },
        bodyContent: '# Project Memory\\n\\nThis project uses Next.js and TypeScript.',
        sections: [{ title: 'Project Memory', content: ['This project uses Next.js and TypeScript.'] }],
      }

      const mockProjectContext = {
        techData: {
          frameworks: ['Next.js'],
          primaryLanguages: ['typescript'],
        },
      }

      const adapted = await adapter.adaptSingleContext(mockContext, mockProjectContext)

      expect(adapted).toBeDefined()
      expect(adapted.id).toBeDefined()
      expect(adapted.title).toBeDefined()
      expect(adapted.category).toBe('core')
      expect(adapted.platforms['claude-code-cli']).toBeDefined()
      expect(adapted.platforms['claude-code-cli'].compatible).toBe(true)
      expect(adapted.platforms['claude-code-cli'].memory).toBe(true)
      expect(adapted.migration).toBeDefined()
      expect(adapted.migration.originalSource).toBe('Claude Code CLI')
    })

    it('should generate appropriate blueprint IDs', async () => {
      const adapter = new MigrationAdapter()

      const context1 = { type: 'claude-code-cli', fileName: 'CLAUDE.md' }
      const id1 = adapter.generateBlueprintId(context1)
      expect(id1).toBe('claude-claude')

      const context2 = { type: 'cursor', fileName: '.cursorrules' }
      const id2 = adapter.generateBlueprintId(context2)
      expect(id2).toBe('cursor-cursorrules')
    })

    it('should extract tags from context and project data', async () => {
      const adapter = new MigrationAdapter()
      const context = {
        bodyContent: 'This is about React components and API testing',
        type: 'cursor',
      }
      const projectContext = {
        techData: {
          frameworks: ['React', 'Next.js'],
          primaryLanguages: ['typescript', 'javascript'],
        },
      }

      const tags = adapter.extractTags(context, projectContext)

      expect(tags).toContain('migrated-from-cursor')
      expect(tags).toContain('typescript')
      expect(tags).toContain('React')
      expect(tags).toContain('api')
    })
  })

  describe('MigrationManager Integration', () => {
    it('should complete full migration workflow', async () => {
      const manager = new MigrationManager({
        projectPath: tempDir,
        migrationOutputPath: path.join(tempDir, 'vdk-migration'),
        verbose: false,
      })

      const results = await manager.migrate({
        dryRun: true,
        deployToIdes: false,
      })

      expect(results).toBeDefined()
      expect(results.detected).toBeDefined()
      expect(results.converted).toBeDefined()
      expect(Array.isArray(results.detected)).toBe(true)
      expect(Array.isArray(results.converted)).toBe(true)
    })

    it('should handle empty projects gracefully', async () => {
      const emptyDir = path.join(tempDir, 'empty')
      await fs.mkdir(emptyDir)

      const manager = new MigrationManager({
        projectPath: emptyDir,
        verbose: false,
      })

      const results = await manager.migrate({ dryRun: true })

      expect(results.detected.length).toBe(0)
      expect(results.converted.length).toBe(0)
    })

    it('should generate migration statistics', async () => {
      const manager = new MigrationManager({ projectPath: tempDir })

      // Simulate some results
      manager.results = {
        detected: [{ type: 'claude-code-cli' }, { type: 'cursor' }],
        converted: [{ id: 'test1' }],
        generated: [{ id: 'test1', path: '/test' }],
        deployed: { successful: [{ name: 'Claude Code CLI' }] },
        failed: [],
        skipped: [],
      }

      const stats = manager.getStats()

      expect(stats.detected).toBe(2)
      expect(stats.converted).toBe(1)
      expect(stats.generated).toBe(1)
      expect(stats.deployed).toBe(1)
      expect(stats.successRate).toBe('50.0')
    })
  })
})

/**
 * Create test project with various AI context files
 */
async function createTestProject(projectPath) {
  // Create basic project structure
  await fs.mkdir(path.join(projectPath, '.claude'), { recursive: true })
  await fs.mkdir(path.join(projectPath, '.cursor'), { recursive: true })
  await fs.mkdir(path.join(projectPath, '.github', 'copilot'), { recursive: true })

  // Claude Code CLI contexts
  await fs.writeFile(
    path.join(projectPath, 'CLAUDE.md'),
    `# Project Memory

This is a Next.js project with TypeScript.

## Code Style
- Use 2-space indentation
- Prefer const over let
- Always use semicolons

## Architecture
- Component-based architecture
- Use custom hooks for state management
- API routes in pages/api
`
  )

  await fs.writeFile(
    path.join(projectPath, '.claude', 'commands.md'),
    `# Custom Commands

/optimize - Optimize the current code for performance
/review - Review code for potential issues

## MCP Integration
Uses mcp: filesystem and mcp: database servers.
`
  )

  // Cursor contexts
  await fs.writeFile(
    path.join(projectPath, '.cursorrules'),
    `You are an expert TypeScript developer working on a Next.js project.

Always:
- Use TypeScript for type safety
- Follow the project's ESLint rules
- Write tests for new features
- Use semantic commit messages

File patterns:
- **/*.tsx for React components
- **/*.ts for utility functions
- **/*.test.ts for test files

When creating components, use:
- Functional components with hooks
- Props interfaces
- Default exports
`
  )

  // GitHub Copilot contexts
  await fs.writeFile(
    path.join(projectPath, '.github', 'copilot', 'guidelines.json'),
    JSON.stringify(
      {
        guidelines: [
          {
            title: 'Code Review Guidelines',
            description: 'Guidelines for code review',
            priority: 8,
            type: 'security',
            rules: [
              'Always validate user input',
              'Use parameterized queries for database access',
              'Implement proper error handling',
            ],
          },
        ],
      },
      null,
      2
    )
  )

  // Generic AI contexts
  await fs.mkdir(path.join(projectPath, '.ai'), { recursive: true })
  await fs.writeFile(
    path.join(projectPath, '.ai', 'context.md'),
    `# AI Context

This project is a web application built with:
- Next.js 14
- TypeScript 5
- Tailwind CSS
- Supabase

Key conventions:
- Use kebab-case for file names
- Use PascalCase for component names
- Use camelCase for variables and functions
`
  )

  // Package.json to help with tech detection
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          typescript: '^5.0.0',
          '@supabase/supabase-js': '^2.0.0',
        },
        devDependencies: {
          '@types/react': '^18.0.0',
          eslint: '^8.0.0',
          tailwindcss: '^3.0.0',
        },
      },
      null,
      2
    )
  )
}
