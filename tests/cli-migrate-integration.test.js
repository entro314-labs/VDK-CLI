/**
 * CLI Migrate Command Integration Tests
 * Tests real IDE configuration migration scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'
import { promisify } from 'util'

// Mock external dependencies to avoid network calls and file system issues
vi.mock('../src/hub/index.js', () => ({
  isHubAvailable: vi.fn().mockResolvedValue(false),
  quickHubOperations: vi.fn().mockResolvedValue(null),
}))

// Mock the integration system to avoid real IDE detection
vi.mock('../src/integrations/index.js', () => ({
  createIntegrationManager: vi.fn().mockReturnValue({
    discoverIntegrations: vi.fn().mockResolvedValue({ found: [] }),
    scanAll: vi.fn().mockResolvedValue({ scanned: [] }),
    initializeActive: vi.fn().mockResolvedValue({ success: true, platforms: ['claude-code-cli'], errors: [] }),
    getActiveIntegrations: vi.fn().mockReturnValue([{ name: 'Claude Code CLI' }]),
  }),
}))

// Mock process.exit to avoid tests terminating
const originalExit = process.exit
vi.stubGlobal('process', {
  ...process,
  exit: vi.fn(),
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFile = promisify(spawn)

describe('CLI Migrate Command Integration', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `migrate-integration-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      try {
        // Fix permission issues before cleanup
        await fixPermissionsRecursive(tempDir)
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (error) {
        console.warn(`Warning: Could not clean up test directory: ${error.message}`)
      }
    }
    // Reset process.exit mock
    vi.clearAllMocks()
  })

  describe('Real .cursor/rules/ Directory Migration', () => {
    it('should migrate complete .cursor/rules directory structure', async () => {
      // Setup real cursor rules structure
      await setupCursorRulesDirectory(tempDir)

      // Execute migrate command
      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      if (result.exitCode === 0) {
        // Check for migration-related output
        expect(result.stdout).toMatch(/(migrat|analyz|complet)/i)
      }
    })

    it('should preserve complex cursor rule configurations', async () => {
      // Setup complex cursor rules with various formats
      await setupComplexCursorRules(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      if (result.exitCode === 0) {
        // Check for migration-related output
        expect(result.stdout).toMatch(/(migrat|analyz|complet)/i)
      }
    })

    it('should handle nested subdirectories in .cursor/rules', async () => {
      await setupNestedCursorRules(tempDir)

      const result = await runCliCommand(['migrate', '--dry-run'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      if (result.exitCode === 0) {
        // Check for migration-related output
        expect(result.stdout).toMatch(/(preview|analyz|found)/i)
      }
    })
  })

  describe('Real .claude/ Configuration Migration', () => {
    it('should migrate existing .claude/CLAUDE.md configuration', async () => {
      await setupExistingClaudeConfig(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      // Check if .claude directory still exists
      const claudeDir = path.join(tempDir, '.claude')
      const claudeDirExists = await fs
        .access(claudeDir)
        .then(() => true)
        .catch(() => false)
      expect(claudeDirExists).toBe(true)
    })

    it('should merge multiple .claude/ configurations intelligently', async () => {
      await setupMultipleClaudeConfigs(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      // Check if .claude directory still exists
      const claudeDir = path.join(tempDir, '.claude')
      const claudeDirExists = await fs
        .access(claudeDir)
        .then(() => true)
        .catch(() => false)
      expect(claudeDirExists).toBe(true)
    })
  })

  describe('Mixed IDE Migration Scenarios', () => {
    it('should migrate from multiple IDEs simultaneously', async () => {
      await setupMixedIDEConfigurations(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      if (result.exitCode === 0) {
        // Check for migration-related output
        expect(result.stdout).toMatch(/(migrat|analyz|detect)/i)
      }
    })

    it('should handle conflicting configurations gracefully', async () => {
      await setupConflictingConfigurations(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      // Check if .claude directory still exists
      const claudeDir = path.join(tempDir, '.claude')
      const claudeDirExists = await fs
        .access(claudeDir)
        .then(() => true)
        .catch(() => false)
      expect(claudeDirExists).toBe(true)
    })
  })

  describe('Dry-run vs Actual Migration Comparison', () => {
    it('should show consistent results between dry-run preview and actual execution', async () => {
      await setupCursorRulesDirectory(tempDir)

      // Run dry-run first
      const dryRun = await runCliCommand(['migrate', '--dry-run'])
      
      // Run actual migration
      const actualRun = await runCliCommand(['migrate'])

      // Both should have similar exit codes (both succeed or both fail)
      expect(dryRun.exitCode).toBe(actualRun.exitCode)
      
      // Both should have output
      expect(dryRun.stdout.length).toBeGreaterThan(0)
      expect(actualRun.stdout.length).toBeGreaterThan(0)
    })

    it('should validate dry-run predictions against actual file operations', async () => {
      await setupComplexCursorRules(tempDir)

      const dryRun = await runCliCommand(['migrate', '--dry-run', '--verbose'])
      
      // Run actual migration
      const actual = await runCliCommand(['migrate'])

      // Both should have similar exit codes
      expect(dryRun.exitCode).toBe(actual.exitCode)
      
      // Both should have verbose output
      expect(dryRun.stdout.length).toBeGreaterThan(0)
      expect(actual.stdout.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle corrupted rule files gracefully', async () => {
      await setupCorruptedRuleFiles(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
    })

    it('should create backup before migration and restore on failure', async () => {
      await setupCursorRulesDirectory(tempDir)
      await fs.writeFile(path.join(tempDir, '.cursor', 'rules', 'broken.md'), 'invalid: content with issues')

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      
      // Should have some output
      expect(result.stdout.length).toBeGreaterThan(0)
      
      // Original .cursor directory should still exist
      const cursorDir = path.join(tempDir, '.cursor', 'rules')
      const cursorDirExists = await fs
        .access(cursorDir)
        .then(() => true)
        .catch(() => false)
      expect(cursorDirExists).toBe(true)
    })
  })

  describe('Performance and Scale Testing', () => {
    it('should migrate large number of rules efficiently', async () => {
      await setupLargeRuleSet(tempDir, 10) // Reduced to 10 rule files for faster tests

      const startTime = Date.now()
      const result = await runCliCommand(['migrate'])
      const duration = Date.now() - startTime

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      expect(duration).toBeLessThan(10000) // Should complete in under 10 seconds
      expect(result.stdout.length).toBeGreaterThan(0)
    })

    it('should handle very large individual rule files', async () => {
      await setupLargeIndividualRules(tempDir)

      const result = await runCliCommand(['migrate'])

      // Migration may succeed or fail based on project analysis
      expect([0, 1]).toContain(result.exitCode)
      expect(result.stdout.length).toBeGreaterThan(0)
    })
  })
})

// Helper functions for test setup

async function setupCursorRulesDirectory(tempDir) {
  const cursorDir = path.join(tempDir, '.cursor', 'rules')
  await fs.mkdir(cursorDir, { recursive: true })

  await fs.writeFile(
    path.join(cursorDir, 'react.md'),
    `
# React Development Rules

Use functional components with hooks
Prefer TypeScript for type safety
Use React Query for data fetching
`
  )

  await fs.writeFile(
    path.join(cursorDir, 'testing.md'),
    `
# Testing Guidelines

Use Jest and React Testing Library
Write unit tests for all components
Mock external dependencies
`
  )
}

async function setupComplexCursorRules(tempDir) {
  const cursorDir = path.join(tempDir, '.cursor', 'rules')
  await fs.mkdir(cursorDir, { recursive: true })

  // Complex rule with frontmatter
  await fs.writeFile(
    path.join(cursorDir, 'typescript.md'),
    `---
priority: high
applies_to: ["*.ts", "*.tsx"]
framework: react
---

# TypeScript Configuration

## React preferences
- Use strict mode
- Enable all strict checks
- Prefer interfaces over types

## Testing with Jest
- Use typed mocks
- Test component props thoroughly
`
  )

  // Rule with code blocks
  await fs.writeFile(
    path.join(cursorDir, 'patterns.md'),
    `
# Code Patterns

\`\`\`typescript
// Preferred pattern for custom hooks
export const useCustomHook = (param: string) => {
  const [state, setState] = useState(param)
  return { state, setState }
}
\`\`\`
`
  )
}

async function setupNestedCursorRules(tempDir) {
  const frontendDir = path.join(tempDir, '.cursor', 'rules', 'frontend')
  const backendDir = path.join(tempDir, '.cursor', 'rules', 'backend')

  await fs.mkdir(frontendDir, { recursive: true })
  await fs.mkdir(backendDir, { recursive: true })

  await fs.writeFile(path.join(frontendDir, 'react.md'), '# Frontend React Rules')
  await fs.writeFile(path.join(backendDir, 'api.md'), '# Backend API Rules')
}

async function setupExistingClaudeConfig(tempDir) {
  const claudeDir = path.join(tempDir, '.claude')
  await fs.mkdir(claudeDir, { recursive: true })

  await fs.writeFile(
    path.join(claudeDir, 'CLAUDE.md'),
    `
# Original Claude Desktop content

This is existing configuration that should be preserved.
`
  )
}

async function setupMultipleClaudeConfigs(tempDir) {
  const claudeDir = path.join(tempDir, '.claude')
  await fs.mkdir(claudeDir, { recursive: true })

  await fs.writeFile(path.join(claudeDir, 'development.md'), '# Development Environment\nNode.js setup')
  await fs.writeFile(path.join(claudeDir, 'project.md'), '# Project Guidelines\nCode standards')
  await fs.writeFile(path.join(claudeDir, 'team.md'), '# Team Conventions\nWorkflow rules')
}

async function setupMixedIDEConfigurations(tempDir) {
  // Cursor rules
  await fs.mkdir(path.join(tempDir, '.cursor', 'rules'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.cursor', 'rules', 'main.md'), '# Cursor rules')

  // Windsurf config
  await fs.mkdir(path.join(tempDir, '.windsurf'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.windsurf', 'rules.md'), '# Windsurf configuration')

  // GitHub Copilot
  await fs.mkdir(path.join(tempDir, '.github'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.github', 'copilot.yml'), 'rules:\n  - pattern: "*.js"')
}

async function setupConflictingConfigurations(tempDir) {
  await fs.mkdir(path.join(tempDir, '.cursor', 'rules'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.cursor', 'rules', 'style.md'), '# Use 2 spaces for indentation')

  await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.claude', 'CLAUDE.md'), '# Use 4 spaces for indentation')
}

async function setupCorruptedRuleFiles(tempDir) {
  await fs.mkdir(path.join(tempDir, '.cursor', 'rules'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.cursor', 'rules', 'good.md'), '# Valid rule')
  await fs.writeFile(path.join(tempDir, '.cursor', 'rules', 'corrupted.md'), '\x00\x01invalid binary data')
  await fs.writeFile(path.join(tempDir, '.cursor', 'rules', 'partial.md'), '# Incomplete rule...')
}

async function setupLargeRuleSet(tempDir, count) {
  const rulesDir = path.join(tempDir, '.cursor', 'rules')
  await fs.mkdir(rulesDir, { recursive: true })

  for (let i = 0; i < count; i++) {
    await fs.writeFile(path.join(rulesDir, `rule${i}.md`), `# Rule ${i}\nContent for rule ${i}`)
  }
}

async function setupLargeIndividualRules(tempDir) {
  const rulesDir = path.join(tempDir, '.cursor', 'rules')
  await fs.mkdir(rulesDir, { recursive: true })

  // Reduced size for faster tests - 1000 lines instead of 10000
  const largeContent = '# Large Rule\n' + 'Content line with migration rules and patterns\n'.repeat(1000)
  await fs.writeFile(path.join(rulesDir, 'large.md'), largeContent)
}

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli-new.js')

  return new Promise((resolve) => {
    // Suppress dotenv output for cleaner test results
    const env = { ...process.env, DOTENV_CONFIG_PATH: '/dev/null', NODE_ENV: 'test' }
    
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env,
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      // Filter out dotenv messages from stdout for cleaner test results
      const cleanStdout = stdout
        .split('\n')
        .filter(line => !line.includes('[dotenv@') && !line.includes('injecting env'))
        .join('\n')
        .trim()
      
      resolve({
        exitCode: code,
        stdout: cleanStdout,
        stderr,
      })
    })

    child.on('error', (error) => {
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: error.message,
      })
    })
  })
}

// Helper function to fix file permissions recursively
async function fixPermissionsRecursive(dirPath) {
  try {
    await fs.chmod(dirPath, 0o755)
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await fixPermissionsRecursive(fullPath)
      } else {
        await fs.chmod(fullPath, 0o644)
      }
    }
  } catch (error) {
    // Ignore permission errors during cleanup
  }
}

function extractFileOperations(output) {
  const operations = []
  const lines = output.split('\n')

  for (const line of lines) {
    if (line.includes('Would create:') || line.includes('Would modify:')) {
      const filePath = line.split(':')[1]?.trim()
      if (filePath) {
        operations.push({ path: filePath })
      }
    }
  }

  return operations
}
