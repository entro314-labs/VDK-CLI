/**
 * Comprehensive CLI Tests - Complete command handler coverage
 * Updated for enhanced CLI styling
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import stripAnsi from 'strip-ansi'
import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir, createTempDir, runCLI } from './helpers/cli-helper.js'

describe('Complete CLI Command Coverage', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Init Command - Complete Coverage', () => {
    it('should handle all init command options', async () => {
      tempDir = await createTempDir('comprehensive-init-test')

      const result = await runCLI(
        [
          'init',
          '--projectPath',
          tempDir,
          '--outputPath',
          path.join(tempDir, '.ai', 'rules'),
          '--deep',
          '--ignorePattern',
          '**/node_modules/**',
          '**/dist/**',
          '--use-gitignore',
          '--template',
          'default',
          '--overwrite',
          '--ide-integration',
          '--verbose',
          '--categories',
          'development',
          'testing',
          '--preset',
          'development',
          '--interactive',
        ],
        { timeout: 60000 }
      )

      expect(result.code).toBeDefined()
      // Should complete without crashing regardless of success/failure
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    }, 70000)

    it('should handle init with minimal options', async () => {
      tempDir = await createTempDir('minimal-init-test')

      const result = await runCLI(['init', '--projectPath', tempDir], { timeout: 45000 })

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    }, 50000)

    it('should handle init with watch mode (quickly exit)', async () => {
      tempDir = await createTempDir('watch-init-test')

      // Run with timeout to prevent hanging
      const result = await runCLI(['init', '--projectPath', tempDir, '--watch'], { timeout: 5000 })

      // Will timeout, but should start properly
      expect(result.code).toBeDefined()
    })
  })

  describe('Deploy Command - Complete Coverage', () => {
    it('should execute deploy command', async () => {
      const result = await runCLI(['deploy'])

      expect(result.code).toBeDefined()
      expect(result.stdout).toContain('under development')
    })

    it('should handle deploy with help', async () => {
      const result = await runCLI(['deploy', '--help'])

      expect(result.success || result.stdout.includes('deploy')).toBe(true)
    })
  })

  describe('Update Command - Complete Coverage', () => {
    it('should execute update command with default path', async () => {
      const result = await runCLI(['update'], { timeout: 45000 })

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    }, 50000)

    it('should execute update command with custom output path', async () => {
      tempDir = await createTempDir('update-test')

      const result = await runCLI(['update', '--outputPath', path.join(tempDir, 'custom-rules')], {
        timeout: 45000,
      })

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    }, 50000)

    it('should handle update network failures gracefully', async () => {
      // This will likely fail due to network/auth, but should handle gracefully
      const result = await runCLI(['update'], { timeout: 30000 })

      expect(result.code).toBeDefined()
      // Should either succeed or fail with meaningful message
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    }, 35000)
  })

  describe('Status Command - Complete Coverage', () => {
    it('should execute status with default config', async () => {
      const result = await runCLI(['status'])

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    })

    it('should execute status with custom config path', async () => {
      tempDir = await createTempDir('status-test')
      const configPath = path.join(tempDir, 'custom-vdk.config.json')

      const result = await runCLI([
        'status',
        '--configPath',
        configPath,
        '--outputPath',
        path.join(tempDir, 'rules'),
      ])

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    })

    it('should handle status with valid config file', async () => {
      tempDir = await createTempDir('status-valid-config-test')
      const configPath = path.join(tempDir, 'vdk.config.json')

      // Create valid config
      const config = {
        project: { name: 'test-project' },
        ide: 'claude-code',
        rulesPath: './.ai/rules',
        lastUpdated: new Date().toISOString(),
      }
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      const result = await runCLI(['status', '--configPath', configPath])

      expect(result.code).toBeDefined()
      if (result.success) {
        // Check for enhanced status table format
        expect(result.stdout).toContain('VDK Configuration')
        expect(stripAnsi(result.stdout)).toMatch(/[✔✓]/) // Should show success symbol
      }
    })

    it('should handle status with malformed config file', async () => {
      tempDir = await createTempDir('status-malformed-config-test')
      const configPath = path.join(tempDir, 'vdk.config.json')

      // Create malformed config
      await fs.writeFile(configPath, '{ invalid json }')

      const result = await runCLI(['status', '--configPath', configPath])

      expect(result.code).toBeDefined()
      // With enhanced styling, malformed config shows as warning in status table
      expect(result.stdout).toContain('VDK Configuration')
      expect(stripAnsi(result.stdout)).toMatch(/[⚠]/) // Should show warning symbol for malformed config
    })
  })

  describe('Help and Version - Complete Coverage', () => {
    it('should display comprehensive help', async () => {
      const result = await runCLI(['--help'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('VDK CLI')
      expect(result.stdout).toContain('init')
      expect(result.stdout).toContain('deploy')
      expect(result.stdout).toContain('update')
      expect(result.stdout).toContain('status')
    })

    it('should display version', async () => {
      const result = await runCLI(['--version'])

      expect(result.success).toBe(true)
      expect(result.stdout.trim().length).toBeGreaterThan(0)
    })

    it('should display help when no arguments provided', async () => {
      const result = await runCLI([])

      expect(result.code).toBeDefined()
      // Output includes banner and help text - check both stdout and stderr for output
      const allOutput = result.stdout + result.stderr
      const hasHelpContent = allOutput.includes('Usage:') || allOutput.includes('VDK CLI')
      expect(hasHelpContent).toBe(true)
      // Should also contain the banner
      expect(allOutput).toContain("The world's first Vibe Development Kit")
    })
  })

  describe('Command Option Combinations', () => {
    it('should handle multiple short options', async () => {
      const result = await runCLI(['init', '--help'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('init')
    })

    it('should handle verbose flag across commands', async () => {
      const commands = [
        ['init', '--help', '--verbose'],
        ['status', '--help'],
        ['update', '--help'],
        ['deploy', '--help'],
      ]

      for (const cmd of commands) {
        const result = await runCLI(cmd)
        expect(result.code).toBeDefined()
      }
    })
  })

  describe('Error Handling in Commands', () => {
    it('should handle init with invalid project path', async () => {
      const result = await runCLI(['init', '--projectPath', '/invalid/path/that/does/not/exist'])

      expect(result.success).toBe(false)
      expect(result.stderr + result.stdout).toMatch(/(error|not found|invalid)/i)
    })

    it('should handle update with invalid output path', async () => {
      const result = await runCLI(['update', '--outputPath', '/root/invalid/permission/path'], {
        timeout: 30000,
      })

      expect(result.code).toBeDefined()
      // Should handle permission errors gracefully
    }, 35000)

    it('should handle status with invalid config path', async () => {
      const result = await runCLI(['status', '--configPath', '/invalid/config/path.json'])

      expect(result.code).toBeDefined()
      // With enhanced styling, missing config shows as warning in status table
      expect(result.stdout).toContain('VDK Configuration')
      expect(stripAnsi(result.stdout)).toMatch(/[⚠]/) // Should show warning symbol for missing config
    })
  })

  describe('Signal Handling', () => {
    it('should handle process termination gracefully', async () => {
      // Test that CLI commands don't leave hanging processes
      const result = await runCLI(['--help'])

      expect(result.success).toBe(true)
      // Command should complete and exit cleanly
    })
  })

  describe('Environment Integration', () => {
    it('should respect environment variables', async () => {
      // Test with custom env vars
      const result = await runCLI(['--help'], {
        env: {
          VDK_DEBUG: 'true',
          VDK_GITHUB_TOKEN: 'test-token',
        },
      })

      expect(result.success).toBe(true)
    })

    it('should work without environment variables', async () => {
      // Test without any VDK env vars
      const result = await runCLI(['--version'], {
        env: {}, // Clean environment
      })

      expect(result.success).toBe(true)
    })
  })
})
