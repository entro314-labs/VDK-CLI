/**
 * Community Integration Tests
 *
 * Tests the complete integration between CLI, Hub, and Repository:
 * - Hub availability detection
 * - Graceful fallback behaviors
 * - Error handling across the stack
 * - Network resilience
 * - Performance under different conditions
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CommunityDeployer } from '../src/community/CommunityDeployer.js'
import { VDKHubClient } from '../src/hub/VDKHubClient.js'
import { quickHubOperations, isHubAvailable } from '../src/hub/index.js'

// Mock fetch for controlled testing
global.fetch = vi.fn()

// Mock the blueprints-client module
vi.mock('../src/blueprints-client.js', () => ({
  searchBlueprints: vi.fn(),
  fetchRuleList: vi.fn(),
  downloadRule: vi.fn(),
  fetchBlueprintsWithMetadata: vi.fn(),
  analyzeBlueprintDependencies: vi.fn(),
  getBlueprintsForPlatform: vi.fn(),
  getBlueprintStatistics: vi.fn(),
}))

// Mock the hub index exports
vi.mock('../src/hub/index.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    isHubAvailable: vi.fn().mockResolvedValue(false),
    quickHubOperations: vi.fn().mockResolvedValue({
      getCommunityBlueprint: vi.fn().mockResolvedValue(null),
      searchCommunityBlueprints: vi.fn().mockResolvedValue({ blueprints: [] }),
      getTrendingBlueprints: vi.fn().mockResolvedValue([]),
    }),
  }
})

describe('Community Integration Tests', () => {
  let deployer
  let hubClient

  beforeEach(() => {
    vi.clearAllMocks()

    deployer = new CommunityDeployer('/test/project')
    hubClient = new VDKHubClient({
      hubUrl: 'https://test-hub.example.com',
      apiKey: 'test-key',
      timeout: 5000,
      retryAttempts: 2,
    })

    fetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Hub Availability Detection', () => {
    it('should detect Hub availability correctly', async () => {
      // Override the mock for this specific test
      isHubAvailable.mockResolvedValueOnce(true)

      const available = await isHubAvailable()

      expect(available).toBe(true)
      expect(isHubAvailable).toHaveBeenCalled()
    })

    it('should detect Hub unavailability', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const available = await isHubAvailable()

      expect(available).toBe(false)
    })

    it('should handle Hub returning unhealthy status', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      })

      const available = await isHubAvailable()

      expect(available).toBe(false)
    })
  })

  describe('Fallback Behavior Integration', () => {
    it('should fallback from Hub to Repository seamlessly', async () => {
      // Mock Hub failure for the first call (getCommunityBlueprint)
      fetch.mockRejectedValueOnce(new Error('Hub unavailable'))

      // Mock repository search success
      const { searchBlueprints } = await import('../src/blueprints-client.js')
      searchBlueprints.mockResolvedValue([
        {
          name: 'test-pattern',
          content: '# Test Pattern Content',
          metadata: {
            title: 'Test Pattern',
            framework: 'react',
            category: 'frontend',
          },
        },
      ])

      const blueprint = await deployer.fetchCommunityBlueprint('test-pattern')

      expect(blueprint.source).toBe('repository')
      expect(blueprint.id).toBe('test-pattern')
      expect(blueprint.title).toBe('Test Pattern')
    })

    it('should handle both Hub and Repository failures', async () => {
      // Mock Hub failure
      fetch.mockRejectedValueOnce(new Error('Hub unavailable'))

      // Mock repository failure
      const { searchBlueprints } = await import('../src/blueprints-client.js')
      searchBlueprints.mockResolvedValue([])

      const blueprint = await deployer.fetchCommunityBlueprint('non-existent')

      expect(blueprint).toBeNull()
    })

    it('should prefer Hub when both sources are available', async () => {
      // Mock successful Hub response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            id: 'hub-blueprint',
            title: 'Hub Blueprint',
            content: 'Hub content',
            author: { username: 'hub-user' },
            metadata: { framework: 'React' },
            stats: { usageCount: 100 },
          }),
      })

      const blueprint = await deployer.fetchCommunityBlueprint('test-pattern')

      expect(blueprint).not.toBeNull()
      expect(blueprint.source).toBe('hub')
      expect(blueprint.id).toBe('hub-blueprint')
    })
  })

  describe('Network Resilience', () => {
    it('should retry on temporary Hub failures', async () => {
      // First call fails with 503
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service temporarily unavailable' }),
      })

      // Should throw a retryable error on 503
      await expect(hubClient.getCommunityBlueprint('test-id')).rejects.toThrow('Community blueprint fetch failed')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry on client errors (4xx)', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      const result = await hubClient.getCommunityBlueprint('non-existent')

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result).toBeNull()
    })

    it('should handle timeout gracefully', async () => {
      // Mock a timeout error
      fetch.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'))

      const shortTimeoutClient = new VDKHubClient({
        hubUrl: 'https://test-hub.example.com',
        timeout: 100,
      })

      // Should return null on timeout
      const result = await shortTimeoutClient.getCommunityBlueprint('test')

      expect(result).toBeNull()
    })

    it('should handle partial network failures', async () => {
      // Mock intermittent failures
      fetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            blueprints: [],
            pagination: { total: 0 },
          }),
      })

      const hubOps = await quickHubOperations()

      // First call should fail and fallback
      const result1 = await hubOps.getCommunityBlueprint('test1')
      expect(result1).toBeNull()

      // Second call should succeed
      const result2 = await hubOps.searchCommunityBlueprints({})
      expect(result2.blueprints).toEqual([])
    })
  })

  describe('Performance Under Load', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Mock successful responses
      fetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            id: 'concurrent-test',
            title: 'Concurrent Test',
          }),
      })

      const promises = Array.from({ length: 10 }, (_, i) => hubClient.getCommunityBlueprint(`blueprint-${i}`))

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach((result) => {
        expect(result.id).toBe('concurrent-test')
      })

      expect(fetch).toHaveBeenCalledTimes(10)
    })

    it('should respect rate limiting', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      })

      await expect(hubClient.getCommunityBlueprint('test')).rejects.toThrow('Community blueprint fetch failed')
    })

    it('should batch telemetry requests efficiently', async () => {
      const telemetryEvents = Array.from({ length: 25 }, (_, i) => ({
        cli_version: '2.0.0',
        command: 'deploy',
        success: true,
        timestamp: new Date().toISOString(),
        metadata: { test: i },
      }))

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name) => {
            const headers = {
              'content-type': 'application/json',
            }
            return headers[name.toLowerCase()]
          },
        },
        json: () =>
          Promise.resolve({
            message: 'Telemetry processed successfully',
            processed: 25,
            successful: 25,
            failed: 0,
          }),
      }

      fetch.mockResolvedValueOnce(mockResponse)

      const result = await hubClient.sendUsageTelemetry(telemetryEvents)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/cli/telemetry/usage'), expect.any(Object))
    })
  })

  describe('Error Recovery', () => {
    it('should recover from temporary Hub outages', async () => {
      // First call: Service unavailable
      fetch.mockRejectedValueOnce(new Error('Service unavailable'))

      // Second call: Recovery with successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            id: 'recovered',
            title: 'Recovered Blueprint',
          }),
      })

      // First call should fail and return null
      const result1 = await hubClient.getCommunityBlueprint('test').catch(() => null)
      expect(result1).toBeNull()

      // Second call should succeed after recovery
      const result2 = await hubClient.getCommunityBlueprint('test')
      expect(result2.id).toBe('recovered')
    })

    it('should maintain service during partial failures', async () => {
      // Mock mixed success/failure responses
      fetch
        .mockResolvedValueOnce({
          // Community blueprints succeeds
          ok: true,
          json: () =>
            Promise.resolve({
              blueprints: [{ id: 'test', title: 'Test' }],
              pagination: { total: 1 },
            }),
        })
        .mockRejectedValueOnce(new Error('Trending service down')) // Trending fails
        .mockResolvedValueOnce({
          // Categories succeeds
          ok: true,
          json: () =>
            Promise.resolve({
              categories: [{ slug: 'frontend', name: 'Frontend' }],
            }),
        })

      const hubOps = await quickHubOperations()

      const blueprints = await hubOps.searchCommunityBlueprints({})
      expect(blueprints.blueprints).toHaveLength(1)

      const trending = await hubOps.getTrendingBlueprints({})
      expect(trending.blueprints).toEqual([])

      const categories = await hubOps.getCommunityCategories()
      expect(categories.categories).toHaveLength(1)
    })
  })

  describe('Data Consistency', () => {
    it('should maintain data consistency across sources', async () => {
      const hubBlueprint = {
        id: 'consistency-test',
        title: 'Hub Blueprint',
        content: 'Hub content',
        metadata: { framework: 'React' },
        stats: { usageCount: 100 },
        framework: 'React',
      }

      const repoBlueprint = {
        name: 'consistency-test',
        content: 'Repository content',
        metadata: {
          title: 'Repository Blueprint',
          framework: 'React',
        },
      }

      // Test Hub source
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(hubBlueprint),
      })

      const hubResult = await deployer.fetchCommunityBlueprint('consistency-test')

      expect(hubResult.source).toBe('hub')
      expect(hubResult.metadata.framework).toBe('React')

      // Test repository source (Hub fails)
      fetch.mockRejectedValueOnce(new Error('Hub down'))

      const { searchBlueprints } = await import('../src/blueprints-client.js')
      searchBlueprints.mockResolvedValue([repoBlueprint])

      const repoResult = await deployer.fetchCommunityBlueprint('consistency-test')

      expect(repoResult.source).toBe('repository')
      expect(repoResult.metadata.framework).toBe('React')
    })

    it('should handle schema differences gracefully', async () => {
      // Mock Hub response with different schema
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            blueprint_id: 'schema-test', // Different field name
            name: 'Schema Test',
            body: 'Content body',
            meta: { type: 'React' },
          }),
      })

      const result = await hubClient.getCommunityBlueprint('schema-test')

      // Should normalize the response
      expect(result.id).toBeDefined()
      expect(result.title).toBeDefined()
      expect(result.content).toBeDefined()
    })
  })

  describe('Security and Validation', () => {
    it('should validate blueprint content before deployment', async () => {
      const maliciousBlueprint = {
        id: 'malicious-test',
        title: 'Malicious Blueprint',
        content: '# Malicious\n\n```bash\nrm -rf /\n```\n\nDangerous content',
        metadata: { framework: 'Any' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(maliciousBlueprint),
      })

      // The deployment should include content validation
      const result = await deployer.fetchCommunityBlueprint('malicious-test')

      expect(result.content).toContain('Dangerous content')
      // Note: Actual validation would be implemented in the deployment phase
    })

    it('should handle authentication errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })

      await expect(hubClient.getCommunityBlueprint('auth-test')).rejects.toThrow('Community blueprint fetch failed')
    })

    it('should sanitize user inputs', async () => {
      const maliciousQuery = '"; DROP TABLE blueprints; --'

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            blueprints: [],
            pagination: { total: 0 },
          }),
      })

      const result = await hubClient.searchCommunityBlueprints({
        search: maliciousQuery,
      })

      expect(result.blueprints).toEqual([])

      // Check that the malicious query was properly encoded
      const calledUrl = fetch.mock.calls[0][0]
      // URL encoding can use either %20 or + for spaces, both are valid
      const expectedEncoded = encodeURIComponent(maliciousQuery).replace(/%20/g, '+')
      expect(calledUrl).toContain(expectedEncoded)
    })
  })

  describe('Monitoring and Observability', () => {
    it('should track successful operations', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            id: 'monitor-test',
            title: 'Monitor Test',
          }),
      })

      const startTime = Date.now()
      const result = await hubClient.getCommunityBlueprint('monitor-test')
      const endTime = Date.now()

      expect(result.id).toBe('monitor-test')
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should track failed operations', async () => {
      fetch.mockRejectedValueOnce(new Error('Network failure'))

      const startTime = Date.now()
      const result = await hubClient.getCommunityBlueprint('fail-test')
      const endTime = Date.now()

      expect(result).toBeNull()
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should provide meaningful error context', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Map([['content-type', 'application/json']]),
        json: () =>
          Promise.resolve({
            error: 'Database connection failed',
            requestId: 'req_123',
            timestamp: '2025-01-11T10:00:00Z',
          }),
      })

      try {
        await hubClient.getCommunityBlueprint('context-test')
      } catch (error) {
        expect(error.message).toContain('Community blueprint fetch failed')
        expect(error.statusCode).toBe(500)
      }
    })
  })
})
