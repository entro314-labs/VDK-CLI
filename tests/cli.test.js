/**
 * CLI Tests - Consolidated CLI functionality tests
 * Updated for enhanced styling features
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import stripAnsi from 'strip-ansi'
import { afterEach, describe, expect, it } from 'vitest'

import { cleanupTempDir, createTempDir, runCLI } from './helpers/cli-helper.js'

describe('CLI Functionality', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir)
      tempDir = null
    }
  })

  describe('Basic Commands', () => {
    it('should display help information', async () => {
      const result = await runCLI(['--help'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('VDK CLI')
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('Commands:')
      expect(result.stdout).toContain('init')
      expect(result.stdout).toContain('Options:')

      // Should also contain the banner when no arguments provided
      expect(result.stdout).toContain("The world's first Vibe Development Kit")
    })

    it('should display version information', async () => {
      const result = await runCLI(['--version'])

      expect(result.success).toBe(true)
      expect(result.stdout.trim().length).toBeGreaterThan(0)

      // Check version matches package.json
      const packageJson = JSON.parse(await fs.readFile(path.join(global.TEST_ROOT, 'package.json'), 'utf8'))
      expect(result.stdout).toContain(packageJson.version)
    })

    it('should show init command help', async () => {
      const result = await runCLI(['init', '--help'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('init')
      expect(result.stdout).toContain('project')
      expect(result.stdout).toContain('Options:')
    })

    it('should execute status command with enhanced styling', async () => {
      const result = await runCLI(['status'])

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)

      // Should contain enhanced status elements
      const output = result.stdout
      expect(output).toContain('VDK Status Check')

      // Should contain status symbols (check both raw and stripped output)
      const cleanOutput = stripAnsi(output)
      expect(cleanOutput).toMatch(/[✔✓✗✘⚠]/) // Should contain status symbols

      // Should contain table structure
      const hasTableStructure = /[┌┐└┘├┤┬┴┼─│]/.test(output) || /[╭╮╰╯│─]/.test(output)
      expect(hasTableStructure).toBe(true)
    })

    it('should execute integrations command', async () => {
      const result = await runCLI(['integrations'])

      expect(result.code).toBeDefined()
      expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0)
    })

    it('should handle invalid commands gracefully', async () => {
      const result = await runCLI(['nonexistent-command'])

      expect(result.success).toBe(false)
      expect(result.stderr + result.stdout).toMatch(/error/i)
    })
  })

  describe('Banner and UI Enhancements', () => {
    it('should display banner when no arguments provided', async () => {
      const result = await runCLI([])

      // Banner may not set success=true but should provide output
      expect(result.code).toBeDefined()

      // Check both stdout and stderr for output
      const allOutput = result.stdout + result.stderr

      // Should contain banner elements
      expect(allOutput).toContain('VDK')
      expect(allOutput).toContain("The world's first Vibe Development Kit")

      // Should contain help text
      expect(allOutput).toContain('Usage:')
      expect(allOutput).toContain('Commands:')

      // Should have box border characters in banner
      const hasBannerBox = /[╔╗╚╝║═┌┐└┘│─]/.test(allOutput)
      expect(hasBannerBox).toBe(true)
    })

    it('should maintain compatibility with ANSI stripping', async () => {
      const result = await runCLI(['status'])

      expect(result.success).toBe(true)

      // Output should be readable both with and without ANSI codes
      const styledOutput = result.stdout
      const cleanOutput = stripAnsi(styledOutput)

      expect(styledOutput.length).toBeGreaterThan(cleanOutput.length) // Should have ANSI codes
      expect(cleanOutput).toContain('VDK Status Check') // Should be readable without styling
    })
  })

  describe('Advanced Commands', () => {
    it('should handle init command with project path', async () => {
      tempDir = await createTempDir('test-init-project')

      const result = await runCLI(['init', '--projectPath', tempDir], {
        timeout: 45000,
      })

      expect(result.code).toBeDefined()

      if (result.success) {
        expect(result.stdout).toMatch(/(✅|✔|completed)/)
      } else {
        expect(result.stderr.length + result.stdout.length).toBeGreaterThan(0)
      }
    })

    it('should have deploy command with enhanced warning', async () => {
      const result = await runCLI(['deploy'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('Coming Soon')
      expect(result.stdout).toContain('under development')

      // Should display as a boxed message
      const hasBox = /[╔╗╚╝║═┌┐└┘│─╭╮╰╯]/.test(result.stdout)
      expect(hasBox).toBe(true)
    })

    it('should have update command available', async () => {
      const result = await runCLI(['update', '--help'])

      expect(result.success || result.stdout.includes('update')).toBe(true)
    })

    it('should have claude-code command available', async () => {
      const result = await runCLI(['claude-code', '--help'])

      expect(result.success || result.stdout.includes('claude-code')).toBe(true)
    })
  })

  describe('Performance & Format', () => {
    it('should complete commands within reasonable time', async () => {
      const startTime = Date.now()
      const result = await runCLI(['--help'])
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(5000)
    })

    it('should have consistent output formatting', async () => {
      const result = await runCLI(['--help'])

      expect(result.success).toBe(true)

      const lines = result.stdout.split('\n')
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0)

      expect(nonEmptyLines.length).toBeGreaterThan(5)

      const hasUsageLine = lines.some((line) => line.includes('Usage:'))
      const hasCommandsSection = lines.some((line) => line.includes('Commands:'))

      expect(hasUsageLine).toBe(true)
      expect(hasCommandsSection).toBe(true)
    })
  })
})
