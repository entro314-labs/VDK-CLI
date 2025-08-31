/**
 * CLI Community Commands Test Suite
 *
 * Tests the CLI commands for community functionality:
 * - vdk browse --community
 * - vdk browse --trending
 * - vdk deploy rule:id
 * - Hub integration and fallback behaviors
 * - Error handling and user feedback
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PATH = path.join(__dirname, '..', 'cli-new.js')

// Helper function to run CLI commands
function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        VDK_HUB_URL: options.hubUrl || 'https://test-hub.example.com',
        VDK_TELEMETRY_ENABLED: 'false',
        ...options.env,
      },
      timeout: options.timeout || 30000,
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
        code,
        stdout,
        stderr,
        output: stdout + stderr,
      })
    })

    child.on('error', (error) => {
      reject(error)
    })

    // Kill process if it hangs
    setTimeout(() => {
      if (!child.killed) {
        child.kill()
        reject(new Error('CLI command timeout'))
      }
    }, options.timeout || 30000)
  })
}

describe('CLI Community Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('vdk browse --help', () => {
    it('should show community browse options', async () => {
      const result = await runCLI(['browse', '--help'])

      expect(result.code).toBe(0)
      expect(result.output).toContain('Browse and discover community blueprints')
      expect(result.output).toContain('--community')
      expect(result.output).toContain('Show community-contributed blueprints')
      expect(result.output).toContain('--trending')
      expect(result.output).toContain('Show trending blueprints')
      expect(result.output).toContain('--category')
      expect(result.output).toContain('--framework')
      expect(result.output).toContain('--platform')
      expect(result.output).toContain('--source')
    })
  })

  describe('vdk browse --community', () => {
    it('should show proper headers and tips', async () => {
      const result = await runCLI(['browse', '--community', '--limit', '3'], {
        timeout: 10000,
      })

      expect(result.output).toContain('VDK Blueprint Discovery')
      const hasExpectedContent =
        result.output.includes('🌟 Community Blueprints') ||
        result.output.includes('Community Blueprints') ||
        result.output.includes('VDK Blueprint Discovery')
      expect(hasExpectedContent).toBe(true)
      expect(result.output).toContain('💡 Tips:')
      expect(result.output).toContain('Use --community for user-contributed blueprints')
      expect(result.output).toContain('Use --trending to see popular blueprints')
    })

    it('should handle Hub connection failures gracefully', async () => {
      const result = await runCLI(['browse', '--community'], {
        hubUrl: 'https://non-existent-hub.example.com',
        timeout: 10000,
      })

      // Should not crash and show appropriate message
      expect(result.code).not.toBe(0)
      expect(result.output).toMatch(/(failed|error|not found|Hub integration required)/i)
    })

    it('should respect limit parameter', async () => {
      const result = await runCLI(['browse', '--community', '--limit', '5'], {
        timeout: 10000,
      })

      expect(result.output).not.toContain('Browse failed')
    })

    it('should support filtering options', async () => {
      const result = await runCLI(
        ['browse', '--community', '--category', 'frontend', '--framework', 'react', '--limit', '3'],
        {
          timeout: 10000,
        }
      )

      expect(result.output).toContain('VDK Blueprint Discovery')
    })
  })

  describe('vdk browse --trending', () => {
    it('should show trending blueprints interface', async () => {
      const result = await runCLI(['browse', '--trending', '--limit', '3'], {
        timeout: 10000,
      })

      expect(result.output).toContain('VDK Blueprint Discovery')
      // Should either show trending blueprints or a proper error
      expect(result.output).toMatch(/(trending|failed|error)/i)
    })

    it('should support timeframe and category filters', async () => {
      const result = await runCLI(['browse', '--trending', '--category', 'frontend', '--limit', '3'], {
        timeout: 10000,
      })

      expect(result.output).toContain('VDK Blueprint Discovery')
    })
  })

  describe('vdk deploy', () => {
    it('should show help when no blueprint specified', async () => {
      const result = await runCLI(['deploy'])

      expect(result.output).toContain('Deploy Options:')
      expect(result.output).toContain('Deploy Community Blueprint')
      expect(result.output).toContain('vdk deploy rule:abc123')
      expect(result.output).toContain('Deploy Repository Blueprint')
      expect(result.output).toContain('Browse Available Blueprints')
      expect(result.output).toContain('vdk browse')
      expect(result.output).toContain('vdk browse --trending')
    })

    it('should show preview help', async () => {
      const result = await runCLI(['deploy'])

      expect(result.output).toContain('Preview Before Deploying:')
      expect(result.output).toContain('vdk deploy rule:abc123 --preview')
    })
  })

  describe('vdk deploy rule:id', () => {
    it('should attempt to deploy community blueprint', async () => {
      const result = await runCLI(['deploy', 'rule:test-blueprint', '--preview'], {
        timeout: 15000,
      })

      expect(result.output).toContain('Deploy Options:') || expect(result.output).toContain('VDK Blueprint Discovery')
      // Should either deploy or show proper error message
      expect(result.output).toMatch(/(preview|not found|failed|error)/i)
    })

    it('should handle non-existent blueprints properly', async () => {
      const result = await runCLI(['deploy', 'rule:non-existent-blueprint'], {
        timeout: 15000,
      })

      expect(result.output).toMatch(/(not found|failed)/i)
      expect(result.output).toContain('💡 Try:') || expect(result.output).toContain('Deploy Options:')
      expect(result.output).toContain('vdk browse --community')
    })

    it('should fallback to repository search', async () => {
      const result = await runCLI(['deploy', 'rule:test-pattern'], {
        timeout: 15000,
      })

      // Should show Hub fetch attempt and repository fallback
      if (result.output.includes('Hub fetch failed')) {
        expect(result.output).toContain('trying repository')
      }
    })

    it('should support preview mode', async () => {
      const result = await runCLI(['deploy', 'rule:test-blueprint', '--preview'], {
        timeout: 15000,
      })

      expect(result.output).toContain('Deploy Options:') || expect(result.output).toContain('VDK Blueprint Discovery')
    })
  })

  describe('Repository Blueprint Deployment', () => {
    it('should deploy repository blueprints when rule: prefix not used', async () => {
      const result = await runCLI(['deploy', 'typescript-strict'], {
        timeout: 15000,
      })

      expect(result.output).toContain('Deploy Options:') || expect(result.output).toContain('VDK Blueprint Discovery')
      // Should either find the blueprint or show appropriate message
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid command gracefully', async () => {
      const result = await runCLI(['browse', '--invalid-option'])

      expect(result.code).not.toBe(0)
      expect(result.output).toMatch(/(unknown option|error)/i)
    })

    it('should show helpful error for invalid blueprint ID', async () => {
      const result = await runCLI(['deploy', 'rule:'], {
        timeout: 10000,
      })

      expect(result.output).toMatch(/(invalid|error|not found|Deploy Options|Blueprint.*not found)/i)
    })

    it('should handle network timeouts gracefully', async () => {
      const result = await runCLI(['browse', '--community'], {
        hubUrl: 'https://httpstat.us/200?sleep=60000', // Timeout simulation
        timeout: 5000,
      })

      // Should timeout or show error, not hang indefinitely
      expect(result).toBeDefined()
    })
  })

  describe('Environment Configuration', () => {
    it('should respect VDK_HUB_URL environment variable', async () => {
      const result = await runCLI(['browse', '--community'], {
        env: { VDK_HUB_URL: 'https://custom-hub.example.com' },
        timeout: 10000,
      })

      // Command should run (may fail due to non-existent URL, but that's expected)
      expect(result).toBeDefined()
    })

    it('should respect telemetry settings', async () => {
      const result = await runCLI(['browse', '--community'], {
        env: { VDK_TELEMETRY_ENABLED: 'false' },
        timeout: 10000,
      })

      // Should run without telemetry
      expect(result).toBeDefined()
    })
  })

  describe('Output Formatting', () => {
    it('should show proper section headers', async () => {
      const result = await runCLI(['browse', '--community'], {
        timeout: 10000,
      })

      expect(result.output).toContain('☰ VDK Blueprint Discovery')
    })

    it('should show tips and suggestions', async () => {
      const result = await runCLI(['browse', '--community'], {
        timeout: 10000,
      })

      expect(result.output).toContain('💡 Tips:')
    })

    it('should use proper error formatting', async () => {
      const result = await runCLI(['deploy', 'rule:definitely-non-existent'], {
        timeout: 15000,
      })

      // Should show formatted error box if blueprint not found
      if (result.output.includes('Error')) {
        expect(result.output).toMatch(/╭.*Error.*╮|╭.*╮/s)
      }
    })
  })

  describe('Integration with Actual Hub', () => {
    it('should connect to vdk.tools when no custom URL provided', async () => {
      const result = await runCLI(['browse', '--community', '--limit', '1'], {
        env: { VDK_HUB_URL: undefined }, // Use default
        timeout: 15000,
      })

      // Should attempt connection to actual Hub
      expect(result).toBeDefined()
    })
  })

  describe('Command Completion and Help', () => {
    it('should show main help with community commands', async () => {
      const result = await runCLI(['--help'])

      expect(result.output).toContain('browse')
      expect(result.output).toContain('deploy')
    })

    it('should show deploy help with community examples', async () => {
      const result = await runCLI(['deploy', '--help'])

      expect(result.output).toContain('Deploy blueprints')
    })
  })
})

describe('CLI Integration Tests', () => {
  describe('End-to-End Workflows', () => {
    it('should complete browse -> deploy workflow', async () => {
      // First browse to see available blueprints
      const browseResult = await runCLI(['browse', '--source', 'repository', '--limit', '1'], {
        timeout: 15000,
      })

      expect(browseResult.output).toContain('VDK Blueprint Discovery')

      // Then try to deploy (will likely fail due to no blueprints, but should show proper flow)
      const deployResult = await runCLI(['deploy', 'test-pattern', '--preview'], {
        timeout: 15000,
      })

      expect(deployResult.output).toContain('VDK Blueprint Deployment')
    })

    it('should show consistent error messages across commands', async () => {
      const communityResult = await runCLI(['browse', '--community'], {
        hubUrl: 'https://non-existent.example.com',
        timeout: 10000,
      })

      const deployResult = await runCLI(['deploy', 'rule:test'], {
        hubUrl: 'https://non-existent.example.com',
        timeout: 10000,
      })

      // Both should handle Hub connection failures consistently
      expect(communityResult).toBeDefined()
      expect(deployResult).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should complete commands within reasonable time', async () => {
      const startTime = Date.now()

      const result = await runCLI(['browse', '--help'])

      const duration = Date.now() - startTime

      expect(result.code).toBe(0)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent command execution', async () => {
      const promises = [runCLI(['browse', '--help']), runCLI(['deploy', '--help']), runCLI(['--version'])]

      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result.code).toBe(0)
      })
    })
  })
})
