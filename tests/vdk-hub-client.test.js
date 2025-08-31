/**
 * VDKHubClient Comprehensive Test Suite
 *
 * Covers all functionality in VDKHubClient.js with thorough testing of:
 * - Health checks and connectivity
 * - Blueprint synchronization
 * - Package generation and download
 * - Telemetry collection (usage, errors, integrations)
 * - Version compatibility
 * - Deployment and analytics
 * - Blueprint recommendations
 * - Community operations
 * - Authentication management
 * - Error handling and retry logic
 * - Configuration management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { VDKHubClient, VDKHubError } from '../src/hub/VDKHubClient.js'

// Mock dependencies
vi.mock('fs/promises')
vi.mock('chalk', () => ({
  default: {
    yellow: (str) => str,
    green: (str) => str,
    red: (str) => str,
    cyan: (str) => str,
    gray: (str) => str,
  },
}))

// Mock console methods to avoid noise in tests
const consoleSpy = {
  warn: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
}

vi.stubGlobal('console', consoleSpy)

// Mock fetch globally
global.fetch = vi.fn()

// Mock AbortSignal.timeout for Node.js compatibility
global.AbortSignal = global.AbortSignal || {}
global.AbortSignal.timeout = vi.fn(() => ({ abort: vi.fn() }))

describe('VDKHubClient', () => {
  let hubClient
  const mockConfig = {
    hubUrl: 'https://test-hub.example.com',
    apiKey: 'test-api-key',
    timeout: 5000,
    retryAttempts: 2,
    telemetryEnabled: true,
  }

  beforeEach(() => {
    hubClient = new VDKHubClient(mockConfig)

    // Reset all mocks
    vi.clearAllMocks()
    fetch.mockClear()
    consoleSpy.warn.mockClear()
    consoleSpy.log.mockClear()
    consoleSpy.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const client = new VDKHubClient()

      expect(client.baseUrl).toBe('https://vdk.tools')
      expect(client.apiUrl).toBe('https://vdk.tools/api')
      expect(client.timeout).toBe(30000)
      expect(client.retryAttempts).toBe(3)
      expect(client.telemetryEnabled).toBe(true)
    })

    it('should initialize with custom configuration', () => {
      expect(hubClient.baseUrl).toBe(mockConfig.hubUrl)
      expect(hubClient.apiUrl).toBe(`${mockConfig.hubUrl}/api`)
      expect(hubClient.timeout).toBe(mockConfig.timeout)
      expect(hubClient.retryAttempts).toBe(mockConfig.retryAttempts)
      expect(hubClient.telemetryEnabled).toBe(mockConfig.telemetryEnabled)
    })

    it('should respect environment variables', () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        VDK_HUB_URL: 'https://env-hub.example.com',
        VDK_HUB_API_KEY: 'env-api-key',
        VDK_HUB_TIMEOUT: '15000',
        VDK_HUB_RETRY_ATTEMPTS: '5',
        VDK_TELEMETRY_ENABLED: 'false',
      }

      const client = new VDKHubClient()

      expect(client.baseUrl).toBe('https://env-hub.example.com')
      expect(client.apiKey).toBe('env-api-key')
      expect(client.timeout).toBe(15000)
      expect(client.retryAttempts).toBe(5)
      expect(client.telemetryEnabled).toBe(false)

      process.env = originalEnv
    })

    it('should provide current configuration', () => {
      const config = hubClient.getConfig()

      expect(config).toEqual({
        baseUrl: mockConfig.hubUrl,
        apiUrl: `${mockConfig.hubUrl}/api`,
        timeout: mockConfig.timeout,
        retryAttempts: mockConfig.retryAttempts,
        telemetryEnabled: mockConfig.telemetryEnabled,
        hasApiKey: true,
      })
    })
  })

  describe('Health Check and Connectivity', () => {
    it('should successfully ping the hub', async () => {
      const mockResponse = {
        status: 'healthy',
        version: '2.0.0',
        timestamp: '2024-01-01T00:00:00Z',
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.ping()

      expect(result.success).toBe(true)
      expect(result.status).toBe('healthy')
      expect(result.version).toBe('2.0.0')
      expect(result.latency).toBeGreaterThan(0)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/health',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(Object),
        })
      )
    })

    it('should handle HTTP error responses in ping', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      })

      const result = await hubClient.ping()

      expect(result.success).toBe(false)
      expect(result.status).toBe('unhealthy')
      expect(result.error).toBe('HTTP 503')
    })

    it('should handle network errors in ping', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.ping()

      expect(result.success).toBe(false)
      expect(result.status).toBe('unreachable')
      expect(result.error).toBe('Network error')
    })
  })

  describe('Blueprint Synchronization', () => {
    it('should sync blueprints successfully', async () => {
      const mockResponse = {
        blueprints: [
          { id: 'bp1', title: 'Blueprint 1' },
          { id: 'bp2', title: 'Blueprint 2' },
        ],
        lastSyncTime: '2024-01-01T00:00:00Z',
        totalBlueprints: 2,
        changes: { added: ['bp1'], updated: [], removed: [] },
        metadata: { syncType: 'incremental' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.syncBlueprints('2023-12-01T00:00:00Z', {
        limit: 50,
        category: 'frontend',
      })

      expect(result.blueprints).toHaveLength(2)
      expect(result.totalBlueprints).toBe(2)
      expect(result.changes.added).toContain('bp1')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/cli/sync/blueprints?since=2023-12-01T00%3A00%3A00Z&limit=50&category=frontend'),
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should handle sync failures gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await hubClient.syncBlueprints()

      expect(result.blueprints).toEqual([])
      expect(result.totalBlueprints).toBe(0)
      expect(result.metadata.syncType).toBe('failed')
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Blueprint sync failed'))
    })

    it('should enforce limit bounds', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ blueprints: [] }),
      })

      await hubClient.syncBlueprints(null, { limit: 1000 })

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=500'), expect.any(Object))
    })
  })

  describe('Package Generation and Download', () => {
    it('should generate package successfully', async () => {
      const mockRequest = {
        projectContext: { framework: 'react', language: 'typescript' },
        requirements: ['performance', 'accessibility'],
      }

      const mockResponse = {
        packageId: 'pkg-123',
        downloadUrl: 'https://example.com/download/pkg-123',
        packageType: 'zip',
        ruleCount: 5,
        fileSize: 2048,
        expiresAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        metadata: { format: 'universal' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.generatePackage(mockRequest)

      expect(result.packageId).toBe('pkg-123')
      expect(result.ruleCount).toBe(5)
      expect(result.fileSize).toBe(2048)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/cli/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockRequest),
        })
      )
    })

    it('should handle package generation errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      })

      await expect(hubClient.generatePackage({})).rejects.toThrow(VDKHubError)
    })

    it('should download package as zip', async () => {
      const mockPackageData = new ArrayBuffer(1024)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi
            .fn()
            .mockReturnValueOnce('application/zip')
            .mockReturnValueOnce('attachment; filename="package.zip"')
            .mockReturnValueOnce('zip')
            .mockReturnValueOnce('5'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockPackageData),
      })

      const result = await hubClient.downloadPackage('pkg-123')

      expect(result.content).toBe(mockPackageData)
      expect(result.contentType).toBe('application/zip')
      expect(result.packageType).toBe('zip')
      expect(result.ruleCount).toBe(5)
      expect(result.fileName).toBe('package.zip')
    })

    it('should download package as JSON', async () => {
      const mockData = { rules: ['rule1', 'rule2'] }

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi
            .fn()
            .mockReturnValueOnce('application/json')
            .mockReturnValueOnce(null)
            .mockReturnValueOnce('json')
            .mockReturnValueOnce('2'),
        },
        json: vi.fn().mockResolvedValue(mockData),
      })

      const result = await hubClient.downloadPackage('pkg-456')

      expect(result.content).toEqual(mockData)
      expect(result.contentType).toBe('application/json')
      expect(result.packageType).toBe('json')
    })

    it('should handle package not found error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      await expect(hubClient.downloadPackage('nonexistent')).rejects.toThrow('Package not found')
    })

    it('should handle package expired error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
      })

      await expect(hubClient.downloadPackage('expired')).rejects.toThrow('Package expired')
    })
  })

  describe('Telemetry Collection', () => {
    it('should send usage telemetry successfully', async () => {
      const mockEvents = [
        {
          cli_version: '2.0.0',
          command: 'generate',
          success: true,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ]

      const mockResponse = {
        message: 'Telemetry recorded',
        processed: 1,
        successful: 1,
        failed: 0,
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.sendUsageTelemetry(mockEvents)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(1)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/cli/telemetry/usage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockEvents),
        })
      )
    })

    it('should handle single event telemetry', async () => {
      const mockEvent = {
        cli_version: '2.0.0',
        command: 'scan',
        success: true,
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'OK' }),
      })

      const result = await hubClient.sendUsageTelemetry(mockEvent)

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify([mockEvent]),
        })
      )
    })

    it('should enforce batch size limits', async () => {
      const largeEventArray = Array(51).fill({
        cli_version: '2.0.0',
        command: 'test',
      })

      await expect(hubClient.sendUsageTelemetry(largeEventArray)).rejects.toThrow(
        'Usage telemetry batch size cannot exceed 50 events'
      )
    })

    it('should handle telemetry failures gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await hubClient.sendUsageTelemetry([{ command: 'test' }])

      expect(result.success).toBe(false)
      expect(result.error).toBe('HTTP 500')
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Usage telemetry failed'))
    })

    it('should skip telemetry when disabled', async () => {
      const disabledClient = new VDKHubClient({
        ...mockConfig,
        telemetryEnabled: false,
      })

      const result = await disabledClient.sendUsageTelemetry([{ command: 'test' }])

      expect(result.success).toBe(true)
      expect(result.message).toBe('Telemetry disabled')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should send error telemetry', async () => {
      const errorEvents = [
        {
          error_type: 'validation',
          error_message: 'Invalid blueprint format',
          command: 'generate',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ]

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Error recorded' }),
      })

      const result = await hubClient.sendErrorTelemetry(errorEvents)

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/cli/telemetry/errors',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(errorEvents),
        })
      )
    })

    it('should enforce error telemetry batch limits', async () => {
      const largeErrorArray = Array(21).fill({ error_type: 'test' })

      await expect(hubClient.sendErrorTelemetry(largeErrorArray)).rejects.toThrow(
        'Error telemetry batch size cannot exceed 20 events'
      )
    })

    it('should send integration telemetry', async () => {
      const integrationEvents = [
        {
          integration_type: 'claude-code',
          action: 'deploy',
          success: true,
          timestamp: '2024-01-01T00:00:00Z',
        },
      ]

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ message: 'Integration tracked' }),
      })

      const result = await hubClient.sendIntegrationTelemetry(integrationEvents)

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/cli/telemetry/integrations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(integrationEvents),
        })
      )
    })

    it('should enforce integration telemetry batch limits', async () => {
      const largeIntegrationArray = Array(31).fill({ integration_type: 'test' })

      await expect(hubClient.sendIntegrationTelemetry(largeIntegrationArray)).rejects.toThrow(
        'Integration telemetry batch size cannot exceed 30 events'
      )
    })
  })

  describe('Version Compatibility', () => {
    it('should check version compatibility successfully', async () => {
      const versionInfo = {
        cliVersion: '2.0.0',
        platform: 'darwin',
        nodeVersion: 'v18.0.0',
      }

      const mockResponse = {
        success: true,
        compatibility: {
          compatible: true,
          upgradeRecommended: false,
        },
        versions: {
          cli: '2.0.0',
          hub: '2.1.0',
        },
        updates: [],
        environment: { supported: true },
        recommendations: [],
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.checkVersionCompatibility(versionInfo)

      expect(result.success).toBe(true)
      expect(result.compatibility.compatible).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/v1/version/check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(versionInfo),
        })
      )
    })

    it('should handle version check failures gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.checkVersionCompatibility({})

      expect(result.success).toBe(false)
      expect(result.compatibility.compatible).toBe(true) // Fallback assumes compatible
      expect(result.error).toBe('Network error')
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Version check failed'))
    })
  })

  describe('Community Operations', () => {
    it('should get community blueprint successfully', async () => {
      const mockBlueprint = {
        id: 'react-hooks',
        slug: 'react-hooks',
        title: 'React Hooks Best Practices',
        description: 'Modern React hooks patterns',
        content: '# React Hooks...',
        author: { username: 'react-expert' },
        metadata: { framework: 'React' },
        stats: { downloads: 1500 },
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockBlueprint),
      })

      const result = await hubClient.getCommunityBlueprint('react-hooks')

      expect(result.id).toBe('react-hooks')
      expect(result.title).toBe('React Hooks Best Practices')
      expect(result.author).toEqual({ username: 'react-expert' })
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/blueprints/react-hooks',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should return null for non-existent community blueprint', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await hubClient.getCommunityBlueprint('nonexistent')

      expect(result).toBeNull()
    })

    it('should search community blueprints', async () => {
      const mockResponse = {
        blueprints: [
          { id: 'bp1', title: 'Blueprint 1' },
          { id: 'bp2', title: 'Blueprint 2' },
        ],
        pagination: { total: 2, limit: 20, offset: 0 },
        filters: { category: 'frontend' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const criteria = {
        search: 'react',
        category: 'frontend',
        framework: 'react',
        language: 'typescript',
        tags: ['hooks', 'performance'],
        sort: 'popularity',
        limit: 10,
      }

      const result = await hubClient.searchCommunityBlueprints(criteria)

      expect(result.blueprints).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=react'),
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should handle search failures gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.searchCommunityBlueprints({})

      expect(result.blueprints).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Community blueprint search failed'))
    })

    it('should get trending blueprints', async () => {
      const mockResponse = {
        blueprints: [
          { id: 'trending1', title: 'Trending Blueprint 1' },
          { id: 'trending2', title: 'Trending Blueprint 2' },
        ],
        timeframe: '7d',
        generatedAt: '2024-01-01T00:00:00Z',
        meta: { algorithm: 'engagement-based' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.getTrendingBlueprints({
        timeframe: '7d',
        category: 'frontend',
        limit: 5,
      })

      expect(result.blueprints).toHaveLength(2)
      expect(result.timeframe).toBe('7d')
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('timeframe=7d&category=frontend&limit=5'),
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should track community blueprint usage', async () => {
      const usageData = {
        sessionId: 'session-123',
        projectContext: { framework: 'react' },
        deploymentResult: { success: true },
      }

      const mockResponse = {
        usageId: 'usage-456',
        message: 'Usage tracked',
        stats: { total_uses: 1501 },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.trackCommunityBlueprintUsage('react-hooks', usageData)

      expect(result.success).toBe(true)
      expect(result.usageId).toBe('usage-456')
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/blueprints/react-hooks/usage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(usageData),
        })
      )
    })

    it('should get community categories', async () => {
      const mockResponse = {
        categories: [
          { id: 'frontend', name: 'Frontend', count: 250 },
          { id: 'backend', name: 'Backend', count: 180 },
        ],
        stats: { total_categories: 2 },
        meta: { last_updated: '2024-01-01T00:00:00Z' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.getCommunityCategories()

      expect(result.categories).toHaveLength(2)
      expect(result.stats.total_categories).toBe(2)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/categories',
        expect.objectContaining({
          method: 'GET',
        })
      )
    })
  })

  describe('Authentication Management', () => {
    beforeEach(() => {
      fs.readFile.mockClear()
      fs.writeFile.mockClear()
      fs.unlink.mockClear()
    })

    it('should check authentication status with valid token', async () => {
      fs.readFile.mockResolvedValueOnce('valid-token-123')

      const mockResponse = {
        user: 'testuser',
        email: 'test@example.com',
      }

      fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.checkAuth()

      expect(result.authenticated).toBe(true)
      expect(result.user).toBe('testuser')
      expect(result.email).toBe('test@example.com')
    })

    it('should handle authentication check failure', async () => {
      fs.readFile.mockResolvedValueOnce('invalid-token')
      fetch.mockRejectedValueOnce(new Error('Unauthorized'))
      fs.unlink.mockResolvedValueOnce()

      const result = await hubClient.checkAuth()

      expect(result.authenticated).toBe(false)
      expect(fs.unlink).toHaveBeenCalled()
    })

    it('should handle missing auth token', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('File not found'))

      const result = await hubClient.checkAuth()

      expect(result.authenticated).toBe(false)
    })

    it('should save auth token', async () => {
      fs.writeFile.mockResolvedValueOnce()

      await hubClient.saveAuthToken('new-token-456')

      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('.vdk-hub-auth'), 'new-token-456', {
        mode: 0o600,
      })
    })

    it('should clear auth token', async () => {
      fs.unlink.mockResolvedValueOnce()

      await hubClient.clearAuthToken()

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.vdk-hub-auth'))
      expect(hubClient.authToken).toBeNull()
    })

    it('should handle auth token file errors gracefully', async () => {
      fs.writeFile.mockRejectedValueOnce(new Error('Permission denied'))

      await hubClient.saveAuthToken('token')

      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to save auth token'))
    })
  })

  describe('HTTP Client and Error Handling', () => {
    it('should make successful HTTP request', async () => {
      const mockResponse = { success: true }
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: vi.fn().mockResolvedValue(mockResponse),
      })

      const result = await hubClient.makeRequest('/test')

      expect(result).toEqual(mockResponse)
      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-VDK-Version': '2.0.0',
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should handle 401 unauthorized errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
      })

      await expect(hubClient.makeRequest('/protected')).rejects.toThrow('Authentication failed')
    })

    it('should handle 429 rate limit errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ error: 'Rate limited' }),
      })

      await expect(hubClient.makeRequest('/test')).rejects.toThrow('Rate limit exceeded')
    })

    it('should retry failed requests', async () => {
      // First request fails, second succeeds
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: vi.fn().mockResolvedValue({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: vi.fn().mockReturnValue('application/json') },
          json: vi.fn().mockResolvedValue({ success: true }),
        })

      const result = await hubClient.makeRequest('/test')

      expect(result).toEqual({ success: true })
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry when skipRetry is true', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: 'Server error' }),
      })

      await expect(hubClient.makeRequest('/test', { skipRetry: true })).rejects.toThrow(VDKHubError)

      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle non-JSON responses', async () => {
      const mockResponse = {
        ok: true,
        headers: { get: vi.fn().mockReturnValue('text/plain') },
      }

      fetch.mockResolvedValueOnce(mockResponse)

      const result = await hubClient.makeRequest('/text')

      expect(result).toBe(mockResponse)
    })
  })

  describe('Utility Methods', () => {
    it('should extract filename from Content-Disposition header', () => {
      const tests = [
        {
          header: 'attachment; filename="test.zip"',
          expected: 'test.zip',
        },
        {
          header: "attachment; filename='blueprint.json'",
          expected: 'blueprint.json',
        },
        {
          header: 'attachment; filename=package.tar.gz',
          expected: 'package.tar.gz',
        },
        {
          header: null,
          expected: null,
        },
      ]

      tests.forEach(({ header, expected }) => {
        const result = hubClient.extractFileName(header)
        expect(result).toBe(expected)
      })
    })

    it('should generate session ID', () => {
      const sessionId = hubClient.generateSessionId()

      expect(sessionId).toMatch(/^cli_\d+_[a-z0-9]+$/)

      // Should generate different IDs
      const sessionId2 = hubClient.generateSessionId()
      expect(sessionId).not.toBe(sessionId2)
    })

    it('should check telemetry status', () => {
      expect(hubClient.isTelemetryEnabled()).toBe(true)

      const disabledClient = new VDKHubClient({ telemetryEnabled: false })
      expect(disabledClient.isTelemetryEnabled()).toBe(false)
    })

    it('should create mock upload result', () => {
      const blueprint = { title: 'Test Blueprint' }
      const metadata = { author: 'testuser' }

      const result = hubClient.createMockUploadResult(blueprint, metadata)

      expect(result.blueprintId).toMatch(/^mock-[a-z0-9]+$/)
      expect(result.tempUrl).toContain('https://vdk.tools/temp/')
      expect(result.confirmationRequired).toBe(true)
      expect(new Date(result.expiresAt)).toBeInstanceOf(Date)
    })
  })

  describe('VDKHubError Class', () => {
    it('should create error with all properties', () => {
      const error = new VDKHubError('Test error', 404, 'NOT_FOUND', true)

      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(404)
      expect(error.errorCode).toBe('NOT_FOUND')
      expect(error.retryable).toBe(true)
      expect(error.name).toBe('VDKHubError')
      expect(error).toBeInstanceOf(Error)
    })

    it('should have default retryable value', () => {
      const error = new VDKHubError('Test error', 500, 'SERVER_ERROR')

      expect(error.retryable).toBe(false)
    })
  })

  describe('Factory Function', () => {
    it('should create VDKHubClient instance', async () => {
      const { createVDKHubClient } = await import('../src/hub/VDKHubClient.js')
      const client = createVDKHubClient(mockConfig)

      expect(client).toBeInstanceOf(VDKHubClient)
      expect(client.baseUrl).toBe(mockConfig.hubUrl)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete blueprint deployment workflow', async () => {
      // Mock successful responses for each step
      const pingResponse = { status: 'healthy', version: '2.0.0', timestamp: Date.now() }
      const authResponse = { user: 'testuser', email: 'test@example.com' }
      const uploadResponse = {
        blueprint_id: 'bp-123',
        temp_url: 'https://vdk.tools/temp/bp-123',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        confirmation_required: true,
      }

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(pingResponse),
        })
        .mockResolvedValueOnce({
          json: vi.fn().mockResolvedValue(authResponse),
        })
        .mockResolvedValueOnce({
          json: vi.fn().mockResolvedValue(uploadResponse),
        })

      fs.readFile.mockResolvedValueOnce('valid-token')

      // Test the workflow
      const pingResult = await hubClient.ping()
      expect(pingResult.success).toBe(true)

      const authResult = await hubClient.checkAuth()
      expect(authResult.authenticated).toBe(true)

      const uploadResult = await hubClient.uploadBlueprint({
        blueprint: { title: 'Test Blueprint', content: 'Test content' },
        status: 'pending_confirmation',
        metadata: { source: 'test' },
      })
      expect(uploadResult.blueprintId).toBe('bp-123')
    })

    it('should handle network failures and provide fallbacks', async () => {
      // Simulate network failure
      fetch.mockRejectedValue(new Error('Network unreachable'))

      // Operations should handle failures gracefully
      const pingResult = await hubClient.ping()
      expect(pingResult.success).toBe(false)
      expect(pingResult.error).toBe('Network unreachable')

      const syncResult = await hubClient.syncBlueprints()
      expect(syncResult.blueprints).toEqual([])
      expect(syncResult.metadata.syncType).toBe('failed')

      const telemetryResult = await hubClient.sendUsageTelemetry([{ command: 'test' }])
      expect(telemetryResult.success).toBe(false)
    })
  })
})
