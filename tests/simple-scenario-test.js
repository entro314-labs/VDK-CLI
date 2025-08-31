/**
 * Simple Real-World Scenario Test
 * Quick tests to verify our fixes work with realistic scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Simple Real-World Scenarios', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `simple-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Project Type Detection', () => {
    it('should correctly identify Next.js project', async () => {
      // Setup Next.js project
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'nextjs-app',
            scripts: { dev: 'next dev' },
            dependencies: { next: '^14.0.0', react: '^18.0.0' },
          },
          null,
          2
        )
      )

      await fs.writeFile(path.join(tempDir, 'next.config.js'), 'module.exports = {}')

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)

      // Should detect Next.js specifically
      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('Next.js Application')
      expect(claudeConfig).not.toContain('React Application') // Should be specific
    })

    it('should correctly identify Astro project', async () => {
      // Setup Astro project
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'astro-site',
            type: 'module',
            scripts: { dev: 'astro dev' },
            dependencies: { astro: '^4.0.0' },
          },
          null,
          2
        )
      )

      await fs.writeFile(path.join(tempDir, 'astro.config.mjs'), 'export default {}')

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)

      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('Astro Application')
    })
  })

  describe('IDE Detection', () => {
    it('should detect Claude Code environment', async () => {
      // Setup basic project
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-project',
            dependencies: { react: '^18.0.0' },
          },
          null,
          2
        )
      )

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Claude Code CLI.*detected|found/i)

      // Should create Claude Code CLI specific files
      const claudeExists = await fs
        .access(path.join(tempDir, 'CLAUDE.md'))
        .then(() => true)
        .catch(() => false)
      expect(claudeExists).toBe(true)

      const commandsExist = await fs
        .access(path.join(tempDir, '.claude', 'commands'))
        .then(() => true)
        .catch(() => false)
      expect(commandsExist).toBe(true)
    })

    it('should handle status command correctly', async () => {
      // Setup basic project
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'status-test',
            dependencies: { express: '^4.18.0' },
          },
          null,
          2
        )
      )

      const result = await runCliCommand(['status'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected IDEs\/AI Tools/)
      expect(result.stdout).toMatch(/confidence/)
    })
  })

  describe('File Generation', () => {
    it('should generate files with correct names (filename fix test)', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'filename-test',
            dependencies: { react: '^18.0.0' },
          },
          null,
          2
        )
      )

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)

      // Check that files exist and have proper names (not empty or malformed)
      const claudeDir = path.join(tempDir, '.claude', 'commands')
      const commands = await fs.readdir(claudeDir).catch(() => [])

      expect(commands.length).toBeGreaterThan(0)

      // Verify no malformed filenames like "-core-identification-.md"
      const hasMalformedNames = commands.some((cmd) => cmd.startsWith('-') || cmd.includes('--') || cmd === '.md')
      expect(hasMalformedNames).toBe(false)

      // Verify proper names exist
      const hasProperNames = commands.some((cmd) => cmd.match(/^[a-z0-9-]+\.md$/) && cmd.length > 4)
      expect(hasProperNames).toBe(true)
    })

    it('should generate appropriate content for project type', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(
          {
            name: 'content-test',
            dependencies: { express: '^4.18.0' },
          },
          null,
          2
        )
      )

      const result = await runCliCommand(['init', '--auto-detect'])

      expect(result.exitCode).toBe(0)

      const claudeConfig = await fs.readFile(path.join(tempDir, 'CLAUDE.md'), 'utf-8')

      // Should contain project-specific content
      expect(claudeConfig).toContain('Express.js')
      expect(claudeConfig).toContain('JavaScript')
      expect(claudeConfig).toContain('Package manager: pnpm')

      // Should be valid markdown
      expect(claudeConfig).toMatch(/^# .+ - Claude Code CLI Memory/)
      expect(claudeConfig).toContain('## Project Overview')
      expect(claudeConfig).toContain('## Development Environment')
    })
  })
})

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli.js')

  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test', VDK_TEST_MODE: '1' },
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
      resolve({
        exitCode: code,
        stdout,
        stderr,
      })
    })

    // Shorter timeout for simple tests
    setTimeout(() => {
      child.kill('SIGTERM')
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTest timeout (30s)',
      })
    }, 30000)
  })
}
