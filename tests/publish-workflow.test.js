/**
 * Publish Workflow Tests
 * Tests end-to-end publishing workflow and community submission processes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Publish Workflow Integration', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `publish-workflow-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Blueprint Publishing Workflow', () => {
    it('should validate blueprint before publishing', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand(['publish', '--validate-only', '--blueprint', 'test-blueprint'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Blueprint validation successful/)
      expect(result.stdout).toMatch(/Schema version: 2\.1\.0/)
      expect(result.stdout).toMatch(/Platform compatibility: \d+ platforms/)
      expect(result.stdout).toMatch(/Ready for publishing: Yes/)
    })

    it('should reject invalid blueprints during validation', async () => {
      await setupInvalidBlueprint(tempDir)

      const result = await runCliCommand(['publish', '--validate-only', '--blueprint', 'invalid-blueprint'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Blueprint validation failed/)
      expect(result.stderr).toMatch(/Missing required field: platforms/)
      expect(result.stderr).toMatch(/Invalid schema version/)
    })

    it('should publish valid blueprint to community hub', async () => {
      await setupValidBlueprint(tempDir)
      await setupPublishingCredentials(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--category',
        'development',
        '--visibility',
        'public',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Publishing to community hub.../)
      expect(result.stdout).toMatch(/Blueprint published successfully/)
      expect(result.stdout).toMatch(/Hub URL: https:\/\/hub\.vdk\.tools\/blueprints\//)
      expect(result.stdout).toMatch(/Blueprint ID: [a-f0-9-]+/)
    })

    it('should handle blueprint updates and versioning', async () => {
      await setupExistingPublishedBlueprint(tempDir)
      await setupUpdatedBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'updated-blueprint',
        '--update-existing',
        '--version-bump',
        'minor',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Updating existing blueprint/)
      expect(result.stdout).toMatch(/Version bumped: 1\.0\.0 → 1\.1\.0/)
      expect(result.stdout).toMatch(/Changelog generated/)
    })

    it('should create publication metadata and tracking', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--track-analytics',
        '--generate-metadata',
      ])

      expect(result.exitCode).toBe(0)

      // Verify metadata file was created
      const metadataFile = path.join(tempDir, '.vdk', 'published', 'test-blueprint', 'metadata.json')
      const metadataExists = await fs
        .access(metadataFile)
        .then(() => true)
        .catch(() => false)
      expect(metadataExists).toBe(true)

      const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf-8'))
      expect(metadata.published_at).toBeDefined()
      expect(metadata.hub_id).toBeDefined()
      expect(metadata.analytics_enabled).toBe(true)
      expect(metadata.version).toBe('1.0.0')
    })
  })

  describe('Community Submission Validation', () => {
    it('should perform comprehensive schema compliance checks', async () => {
      await setupSchemaCompliantBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'compliant-blueprint',
        '--strict-validation',
        '--check-compatibility',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Schema compliance: PASSED/)
      expect(result.stdout).toMatch(/Platform compatibility: PASSED/)
      expect(result.stdout).toMatch(/Security scan: PASSED/)
      expect(result.stdout).toMatch(/Performance validation: PASSED/)
    })

    it('should validate platform-specific configurations', async () => {
      await setupMultiPlatformBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'multi-platform-blueprint',
        '--validate-platforms',
        'all',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Platform validation results:/)
      expect(result.stdout).toMatch(/claude-code: ✓ VALID/)
      expect(result.stdout).toMatch(/cursor: ✓ VALID/)
      expect(result.stdout).toMatch(/vscode: ✓ VALID/)
      expect(result.stdout).toMatch(/jetbrains: ✓ VALID/)
    })

    it('should perform security and safety checks', async () => {
      await setupBlueprintWithSecurityConcerns(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'security-blueprint',
        '--security-scan',
        '--safety-check',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Security scan failed/)
      expect(result.stderr).toMatch(/Potential security issue: Executable code in rules/)
      expect(result.stderr).toMatch(/Safety concern: External URL access/)
    })

    it('should validate community guidelines compliance', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--check-guidelines',
        '--enforce-quality',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Community guidelines: PASSED/)
      expect(result.stdout).toMatch(/Quality score: \d+\/100/)
      expect(result.stdout).toMatch(/Documentation completeness: \d+%/)
      expect(result.stdout).toMatch(/Code quality: GOOD/)
    })
  })

  describe('Publishing Process Management', () => {
    it('should handle publishing queue and rate limiting', async () => {
      await setupMultipleBlueprints(tempDir)

      const result = await runCliCommand(['publish', '--batch', '--max-concurrent', '3', '--retry-on-rate-limit'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Batch publishing started/)
      expect(result.stdout).toMatch(/Queue size: \d+ blueprints/)
      expect(result.stdout).toMatch(/Concurrent limit: 3/)
      expect(result.stdout).toMatch(/All blueprints published successfully/)
    })

    it('should create and manage publishing sessions', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--create-session',
        '--session-name',
        'v2-release',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Publishing session created: v2-release/)
      expect(result.stdout).toMatch(/Session ID: [a-f0-9-]+/)

      // Verify session file exists
      const sessionFile = path.join(tempDir, '.vdk', 'sessions', 'v2-release.json')
      const sessionExists = await fs
        .access(sessionFile)
        .then(() => true)
        .catch(() => false)
      expect(sessionExists).toBe(true)
    })

    it('should handle publication rollback and recovery', async () => {
      await setupValidBlueprint(tempDir)
      await setupFailedPublication(tempDir)

      const result = await runCliCommand(['publish', '--rollback', '--session', 'failed-session', '--cleanup'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Rolling back failed publication/)
      expect(result.stdout).toMatch(/Cleanup completed/)
      expect(result.stdout).toMatch(/Local state restored/)
    })

    it('should generate publication reports and analytics', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--generate-report',
        '--analytics',
      ])

      expect(result.exitCode).toBe(0)

      // Verify report was generated
      const reportFile = path.join(tempDir, '.vdk', 'reports', 'publication-report.json')
      const reportExists = await fs
        .access(reportFile)
        .then(() => true)
        .catch(() => false)
      expect(reportExists).toBe(true)

      const report = JSON.parse(await fs.readFile(reportFile, 'utf-8'))
      expect(report.publication_summary).toBeDefined()
      expect(report.validation_results).toBeDefined()
      expect(report.performance_metrics).toBeDefined()
      expect(report.analytics_data).toBeDefined()
    })
  })

  describe('Integration with Hub API', () => {
    it('should authenticate with hub API securely', async () => {
      await setupHubCredentials(tempDir)

      const result = await runCliCommand(['publish', '--test-auth', '--api-endpoint', 'https://api.vdk.tools'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Authentication successful/)
      expect(result.stdout).toMatch(/API version: \d+\.\d+/)
      expect(result.stdout).toMatch(/User permissions: publish, read/)
    })

    it('should handle API rate limits and retries', async () => {
      await setupValidBlueprint(tempDir)
      await setupRateLimitedAPI(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--retry-attempts',
        '3',
        '--backoff-strategy',
        'exponential',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Rate limit encountered, retrying.../)
      expect(result.stdout).toMatch(/Retry attempt \d+\/3/)
      expect(result.stdout).toMatch(/Blueprint published successfully/)
    })

    it('should sync with hub for duplicate detection', async () => {
      await setupDuplicateBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'duplicate-blueprint',
        '--check-duplicates',
        '--similarity-threshold',
        '0.8',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Duplicate blueprint detected/)
      expect(result.stderr).toMatch(/Similarity: 95%/)
      expect(result.stderr).toMatch(/Existing blueprint: react-starter-template/)
    })

    it('should handle hub API errors gracefully', async () => {
      await setupValidBlueprint(tempDir)
      await setupAPIErrorScenario(tempDir)

      const result = await runCliCommand(['publish', '--blueprint', 'test-blueprint', '--handle-errors', 'graceful'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Hub API error: Service temporarily unavailable/)
      expect(result.stdout).toMatch(/Publication saved locally for retry/)
      expect(result.stdout).toMatch(/Use --resume to retry when service is available/)
    })
  })

  describe('Publication Analytics and Tracking', () => {
    it('should track publication metrics and usage', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--enable-analytics',
        '--track-usage',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Analytics tracking enabled/)
      expect(result.stdout).toMatch(/Usage metrics will be collected/)

      // Verify analytics config was created
      const analyticsFile = path.join(tempDir, '.vdk', 'analytics', 'test-blueprint.json')
      const analyticsExists = await fs
        .access(analyticsFile)
        .then(() => true)
        .catch(() => false)
      expect(analyticsExists).toBe(true)
    })

    it('should generate download and usage statistics', async () => {
      await setupPublishedBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--get-stats',
        '--blueprint',
        'published-blueprint',
        '--time-range',
        '30d',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Blueprint Statistics \(30 days\):/)
      expect(result.stdout).toMatch(/Downloads: \d+/)
      expect(result.stdout).toMatch(/Active deployments: \d+/)
      expect(result.stdout).toMatch(/Platform breakdown:/)
      expect(result.stdout).toMatch(/Average rating: \d+\.\d+\/5/)
    })

    it('should provide popularity and trending insights', async () => {
      await setupTrendingBlueprint(tempDir)

      const result = await runCliCommand(['publish', '--trending-analysis', '--blueprint', 'trending-blueprint'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Trending Analysis:/)
      expect(result.stdout).toMatch(/Growth rate: \+\d+% this week/)
      expect(result.stdout).toMatch(/Trending score: \d+\/100/)
      expect(result.stdout).toMatch(/Similar blueprints performing well:/)
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should recover from network interruptions during upload', async () => {
      await setupLargeBlueprint(tempDir)
      await setupNetworkInterruption(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'large-blueprint',
        '--resume-on-failure',
        '--chunk-upload',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Network interruption detected/)
      expect(result.stdout).toMatch(/Resuming upload from chunk \d+/)
      expect(result.stdout).toMatch(/Upload completed successfully/)
    })

    it('should validate data integrity after publication', async () => {
      await setupValidBlueprint(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'test-blueprint',
        '--verify-integrity',
        '--checksum-validation',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Integrity verification: PASSED/)
      expect(result.stdout).toMatch(/Checksum match: ✓/)
      expect(result.stdout).toMatch(/Remote validation: ✓/)
    })

    it('should handle concurrent publication conflicts', async () => {
      await setupConcurrentBlueprints(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'concurrent-blueprint',
        '--handle-conflicts',
        'merge',
        '--conflict-resolution',
        'auto',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Concurrent modification detected/)
      expect(result.stdout).toMatch(/Conflict resolution: Auto-merge/)
      expect(result.stdout).toMatch(/Publication completed with merged changes/)
    })
  })
})

// Helper functions for test setup

async function setupValidBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const blueprint = {
    schema_version: '2.1.0',
    id: 'test-blueprint',
    title: 'Test Blueprint',
    description: 'A comprehensive test blueprint for publishing workflow validation',
    version: '1.0.0',
    category: 'development',
    author: 'test-author',
    platforms: {
      'claude-code': { compatible: true, command: true, memory: true },
      cursor: { compatible: true, activation: 'auto-attached' },
      vscode: { compatible: true, extension: 'ai-assistant' },
    },
    rules: ['Use TypeScript for type safety', 'Implement comprehensive error handling', 'Follow clean code principles'],
    metadata: {
      tags: ['typescript', 'testing', 'best-practices'],
      complexity: 'medium',
      estimated_setup_time: '15 minutes',
    },
  }

  await fs.writeFile(path.join(blueprintsDir, 'test-blueprint.json'), JSON.stringify(blueprint, null, 2))
}

async function setupInvalidBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const invalidBlueprint = {
    schema_version: '1.0', // Outdated schema
    id: 'invalid-blueprint',
    title: 'Invalid Blueprint',
    // Missing required fields: platforms, description, version
    rules: ['Some rule'],
  }

  await fs.writeFile(path.join(blueprintsDir, 'invalid-blueprint.json'), JSON.stringify(invalidBlueprint, null, 2))
}

async function setupPublishingCredentials(tempDir) {
  const vdkDir = path.join(tempDir, '.vdk')
  await fs.mkdir(vdkDir, { recursive: true })

  const credentials = {
    hub_api_key: 'test-api-key-12345',
    user_id: 'test-user',
    endpoint: 'https://api.vdk.tools',
    permissions: ['publish', 'read', 'update'],
  }

  await fs.writeFile(path.join(vdkDir, 'credentials.json'), JSON.stringify(credentials, null, 2))
}

async function setupExistingPublishedBlueprint(tempDir) {
  const publishedDir = path.join(tempDir, '.vdk', 'published')
  await fs.mkdir(publishedDir, { recursive: true })

  const publishedMeta = {
    blueprint_id: 'updated-blueprint',
    hub_id: 'hub-12345',
    version: '1.0.0',
    published_at: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
  }

  await fs.writeFile(path.join(publishedDir, 'updated-blueprint.json'), JSON.stringify(publishedMeta, null, 2))
}

async function setupUpdatedBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const updatedBlueprint = {
    schema_version: '2.1.0',
    id: 'updated-blueprint',
    title: 'Updated Blueprint',
    description: 'An updated version with new features',
    version: '1.0.0', // Will be bumped during publish
    category: 'development',
    platforms: {
      'claude-code': { compatible: true, command: true, memory: true },
      cursor: { compatible: true, activation: 'auto-attached' },
    },
    rules: ['Updated rule 1', 'New rule 2', 'Enhanced rule 3'],
    changelog: {
      '1.1.0': ['Added new rules', 'Enhanced compatibility'],
    },
  }

  await fs.writeFile(path.join(blueprintsDir, 'updated-blueprint.json'), JSON.stringify(updatedBlueprint, null, 2))
}

async function setupSchemaCompliantBlueprint(tempDir) {
  await setupValidBlueprint(tempDir)

  // Rename to compliant-blueprint
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  const blueprint = JSON.parse(await fs.readFile(path.join(blueprintsDir, 'test-blueprint.json'), 'utf-8'))
  blueprint.id = 'compliant-blueprint'

  await fs.writeFile(path.join(blueprintsDir, 'compliant-blueprint.json'), JSON.stringify(blueprint, null, 2))
}

async function setupMultiPlatformBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const multiPlatformBlueprint = {
    schema_version: '2.1.0',
    id: 'multi-platform-blueprint',
    title: 'Multi-Platform Blueprint',
    description: 'Blueprint supporting all major platforms',
    version: '1.0.0',
    category: 'development',
    platforms: {
      'claude-code': { compatible: true, command: true, memory: true },
      cursor: { compatible: true, activation: 'auto-attached', priority: 'high' },
      vscode: { compatible: true, extension: 'ai-assistant', workspace: true },
      jetbrains: { compatible: true, plugin: 'ai-plugin', ide: 'intellij' },
      windsurf: { compatible: true, mode: 'workspace', priority: 8 },
    },
    rules: ['Universal rule for all platforms'],
  }

  await fs.writeFile(
    path.join(blueprintsDir, 'multi-platform-blueprint.json'),
    JSON.stringify(multiPlatformBlueprint, null, 2)
  )
}

async function setupBlueprintWithSecurityConcerns(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const securityBlueprint = {
    schema_version: '2.1.0',
    id: 'security-blueprint',
    title: 'Security Blueprint',
    description: 'Blueprint with potential security issues',
    version: '1.0.0',
    category: 'development',
    platforms: {
      'claude-code': { compatible: true },
    },
    rules: [
      'Execute: rm -rf /', // Dangerous command
      'Access: https://malicious-site.com/data', // External URL
      'Eval: user_input_function()', // Code execution
    ],
  }

  await fs.writeFile(path.join(blueprintsDir, 'security-blueprint.json'), JSON.stringify(securityBlueprint, null, 2))
}

async function setupMultipleBlueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  for (let i = 1; i <= 5; i++) {
    const blueprint = {
      schema_version: '2.1.0',
      id: `batch-blueprint-${i}`,
      title: `Batch Blueprint ${i}`,
      description: `Blueprint ${i} for batch publishing`,
      version: '1.0.0',
      category: 'development',
      platforms: {
        'claude-code': { compatible: true },
      },
      rules: [`Rule for blueprint ${i}`],
    }

    await fs.writeFile(path.join(blueprintsDir, `batch-blueprint-${i}.json`), JSON.stringify(blueprint, null, 2))
  }
}

async function setupFailedPublication(tempDir) {
  const sessionsDir = path.join(tempDir, '.vdk', 'sessions')
  await fs.mkdir(sessionsDir, { recursive: true })

  const failedSession = {
    session_id: 'failed-session',
    status: 'failed',
    error: 'Network timeout during upload',
    blueprints: ['test-blueprint'],
    created_at: '2024-01-01T00:00:00Z',
    failed_at: '2024-01-01T00:05:00Z',
  }

  await fs.writeFile(path.join(sessionsDir, 'failed-session.json'), JSON.stringify(failedSession, null, 2))
}

async function setupHubCredentials(tempDir) {
  await setupPublishingCredentials(tempDir)
}

async function setupRateLimitedAPI(tempDir) {
  // Setup mock API response configuration
  const mockDir = path.join(tempDir, '.vdk', 'test-config')
  await fs.mkdir(mockDir, { recursive: true })

  const apiConfig = {
    simulate_rate_limit: true,
    rate_limit_delay: 1000, // 1 second
    max_retries: 3,
  }

  await fs.writeFile(path.join(mockDir, 'api-mock.json'), JSON.stringify(apiConfig, null, 2))
}

async function setupDuplicateBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  // Create a blueprint that's very similar to an existing one
  const duplicateBlueprint = {
    schema_version: '2.1.0',
    id: 'duplicate-blueprint',
    title: 'React Starter Template', // Similar to existing
    description: 'A React starter template with TypeScript', // Very similar
    version: '1.0.0',
    category: 'development',
    platforms: {
      'claude-code': { compatible: true },
    },
    rules: ['Use React functional components', 'Implement TypeScript', 'Add testing setup'],
  }

  await fs.writeFile(path.join(blueprintsDir, 'duplicate-blueprint.json'), JSON.stringify(duplicateBlueprint, null, 2))
}

async function setupAPIErrorScenario(tempDir) {
  const mockDir = path.join(tempDir, '.vdk', 'test-config')
  await fs.mkdir(mockDir, { recursive: true })

  const errorConfig = {
    simulate_api_error: true,
    error_type: 'service_unavailable',
    error_message: 'Service temporarily unavailable',
  }

  await fs.writeFile(path.join(mockDir, 'error-mock.json'), JSON.stringify(errorConfig, null, 2))
}

async function setupPublishedBlueprint(tempDir) {
  await setupValidBlueprint(tempDir)

  const publishedDir = path.join(tempDir, '.vdk', 'published')
  await fs.mkdir(publishedDir, { recursive: true })

  const publishedMeta = {
    blueprint_id: 'published-blueprint',
    hub_id: 'hub-67890',
    version: '1.0.0',
    published_at: '2024-01-01T00:00:00Z',
    stats: {
      downloads: 150,
      active_deployments: 45,
      rating: 4.7,
    },
  }

  await fs.writeFile(path.join(publishedDir, 'published-blueprint.json'), JSON.stringify(publishedMeta, null, 2))
}

async function setupTrendingBlueprint(tempDir) {
  await setupPublishedBlueprint(tempDir)

  const trendingDir = path.join(tempDir, '.vdk', 'analytics')
  await fs.mkdir(trendingDir, { recursive: true })

  const trendingData = {
    blueprint_id: 'trending-blueprint',
    growth_rate: 25, // 25% growth
    trending_score: 87,
    weekly_downloads: 50,
    similar_blueprints: ['react-template', 'typescript-starter'],
  }

  await fs.writeFile(path.join(trendingDir, 'trending-blueprint.json'), JSON.stringify(trendingData, null, 2))
}

async function setupLargeBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const largeBlueprint = {
    schema_version: '2.1.0',
    id: 'large-blueprint',
    title: 'Large Blueprint',
    description: 'A large blueprint for testing upload chunking',
    version: '1.0.0',
    category: 'development',
    platforms: {
      'claude-code': { compatible: true },
    },
    rules: Array.from({ length: 1000 }, (_, i) => `Rule ${i + 1}`),
    large_data: Array.from({ length: 500 }, (_, i) => ({
      key: `key-${i}`,
      value: `value-${i}`,
      metadata: { index: i, timestamp: new Date().toISOString() },
    })),
  }

  await fs.writeFile(path.join(blueprintsDir, 'large-blueprint.json'), JSON.stringify(largeBlueprint, null, 2))
}

async function setupNetworkInterruption(tempDir) {
  const mockDir = path.join(tempDir, '.vdk', 'test-config')
  await fs.mkdir(mockDir, { recursive: true })

  const networkConfig = {
    simulate_network_interruption: true,
    interruption_at_percent: 60, // Fail at 60% upload
    resumable_upload: true,
  }

  await fs.writeFile(path.join(mockDir, 'network-mock.json'), JSON.stringify(networkConfig, null, 2))
}

async function setupConcurrentBlueprints(tempDir) {
  await setupValidBlueprint(tempDir)

  const concurrentDir = path.join(tempDir, '.vdk', 'concurrent')
  await fs.mkdir(concurrentDir, { recursive: true })

  const concurrentMeta = {
    blueprint_id: 'concurrent-blueprint',
    concurrent_modifications: [
      { user: 'user1', timestamp: '2024-01-01T00:00:00Z', changes: ['updated rules'] },
      { user: 'user2', timestamp: '2024-01-01T00:01:00Z', changes: ['updated platforms'] },
    ],
  }

  await fs.writeFile(path.join(concurrentDir, 'concurrent-blueprint.json'), JSON.stringify(concurrentMeta, null, 2))
}

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli-new.js')

  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
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

    // Handle timeout
    setTimeout(() => {
      child.kill('SIGTERM')
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTest timeout',
      })
    }, 45000) // 45 second timeout
  })
}
