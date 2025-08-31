/**
 * VDKHubClient Community Methods Test Suite
 *
 * Tests all community-related functionality in the VDKHubClient:
 * - getCommunityBlueprint
 * - searchCommunityBlueprints
 * - getTrendingBlueprints
 * - trackCommunityBlueprintUsage
 * - getCommunityCategories
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { VDKHubClient, VDKHubError } from '../src/hub/VDKHubClient.js'

// Mock fetch globally
global.fetch = vi.fn()

describe('VDKHubClient Community Methods', () => {
  let hubClient

  beforeEach(() => {
    hubClient = new VDKHubClient({
      hubUrl: 'https://test-hub.example.com',
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 1,
      telemetryEnabled: false,
    })

    // Reset fetch mock
    fetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCommunityBlueprint', () => {
    it('should fetch a community blueprint successfully', async () => {
      const mockBlueprint = {
        id: 'react-performance-patterns',
        slug: 'react-performance-patterns',
        title: 'React Performance Patterns',
        description: 'Advanced React optimization patterns',
        content: '# React Performance Patterns...',
        author: { username: 'react-expert', verified: true },
        metadata: {
          framework: 'React',
          language: 'TypeScript',
          category: 'frontend',
          tags: ['react', 'performance'],
        },
        stats: {
          usageCount: 127,
          rating: 4.8,
          voteCount: 45,
        },
        created: '2024-12-15T10:00:00Z',
        updated: '2025-01-10T15:30:00Z',
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockBlueprint),
      })

      const result = await hubClient.getCommunityBlueprint('react-performance-patterns')

      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/blueprints/react-performance-patterns',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )

      expect(result).toEqual({
        id: 'react-performance-patterns',
        slug: 'react-performance-patterns',
        title: 'React Performance Patterns',
        description: 'Advanced React optimization patterns',
        content: '# React Performance Patterns...',
        author: { username: 'react-expert', verified: true },
        metadata: mockBlueprint.metadata,
        stats: mockBlueprint.stats,
        created: '2024-12-15T10:00:00Z',
        updated: '2025-01-10T15:30:00Z',
      })
    })

    it('should return null when blueprint not found', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ error: 'Blueprint not found' }),
      })

      const result = await hubClient.getCommunityBlueprint('non-existent-blueprint')

      expect(result).toBeNull()
    })

    it('should throw VDKHubError for server errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      await expect(hubClient.getCommunityBlueprint('test-id')).rejects.toThrow(VDKHubError)
    })

    it('should handle network errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.getCommunityBlueprint('test-id')

      expect(result).toBeNull()
    })
  })

  describe('searchCommunityBlueprints', () => {
    it('should search blueprints with all criteria', async () => {
      const mockResponse = {
        blueprints: [
          {
            id: 'react-patterns',
            title: 'React Patterns',
            description: 'Modern React patterns',
            author: 'dev-expert',
            stats: { usageCount: 89, rating: 4.6 },
            metadata: { framework: 'React', category: 'frontend' },
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0 },
        filters: { categories: ['frontend'], frameworks: ['React'] },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockResponse),
      })

      const criteria = {
        search: 'react patterns',
        category: 'frontend',
        framework: 'React',
        platform: 'claude-code',
        language: 'TypeScript',
        tags: ['react', 'patterns'],
        author: 'dev-expert',
        sort: 'popular',
        limit: 10,
        offset: 0,
      }

      const result = await hubClient.searchCommunityBlueprints(criteria)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/community/blueprints?'),
        expect.objectContaining({ method: 'GET' })
      )

      const calledUrl = fetch.mock.calls[0][0]
      expect(calledUrl).toContain('search=react%20patterns')
      expect(calledUrl).toContain('category=frontend')
      expect(calledUrl).toContain('framework=React')
      expect(calledUrl).toContain('platform=claude-code')
      expect(calledUrl).toContain('language=TypeScript')
      expect(calledUrl).toContain('tags=react%2Cpatterns')
      expect(calledUrl).toContain('author=dev-expert')
      expect(calledUrl).toContain('sort=popular')
      expect(calledUrl).toContain('limit=10')
      expect(calledUrl).toContain('offset=0')

      expect(result).toEqual(mockResponse)
    })

    it('should handle tags as array', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ blueprints: [], pagination: {}, filters: {} }),
      })

      await hubClient.searchCommunityBlueprints({ tags: ['react', 'typescript'] })

      const calledUrl = fetch.mock.calls[0][0]
      expect(calledUrl).toContain('tags=react%2Ctypescript')
    })

    it('should return empty results on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.searchCommunityBlueprints({})

      expect(result).toEqual({
        blueprints: [],
        pagination: { total: 0, limit: 20, offset: 0 },
        filters: {},
      })
    })
  })

  describe('getTrendingBlueprints', () => {
    it('should fetch trending blueprints successfully', async () => {
      const mockResponse = {
        blueprints: [
          {
            id: 'ai-coding-assistant',
            title: 'AI Coding Assistant Patterns',
            trendingScore: 8.7,
            usageGrowth: '+245%',
            weeklyUses: 89,
            totalUses: 156,
          },
        ],
        timeframe: '7d',
        generatedAt: '2025-01-11T10:00:00Z',
        meta: { totalAnalyzed: 45 },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockResponse),
      })

      const result = await hubClient.getTrendingBlueprints({
        timeframe: '7d',
        category: 'ai-tools',
        limit: 20,
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/community/blueprints/trending?timeframe=7d&category=ai-tools&limit=20'),
        expect.objectContaining({ method: 'GET' })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should return empty results on error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.getTrendingBlueprints({ timeframe: '30d' })

      expect(result).toEqual({
        blueprints: [],
        timeframe: '30d',
        generatedAt: expect.any(String),
        meta: {},
      })
    })
  })

  describe('trackCommunityBlueprintUsage', () => {
    it('should track usage successfully', async () => {
      const mockResponse = {
        success: true,
        usageId: 'usage_1641902400_xyz789',
        message: 'Usage tracked successfully',
        stats: { totalUsage: 1251, deploymentSuccessRate: 0.94 },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockResponse),
      })

      const usageData = {
        sessionId: 'vdk_session_12345',
        projectContext: {
          framework: 'nextjs',
          language: 'typescript',
          platform: 'claude-code',
          cliVersion: '2.0.0',
        },
        deploymentResult: {
          success: true,
          platforms: ['claude-code', 'cursor'],
          adaptations: 2,
          compatibilityScore: 0.95,
        },
        timestamp: '2025-01-11T10:00:00Z',
      }

      const result = await hubClient.trackCommunityBlueprintUsage('test-blueprint', usageData)

      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/blueprints/test-blueprint/usage',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(usageData),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should return success false when telemetry disabled', async () => {
      const disabledClient = new VDKHubClient({ telemetryEnabled: false })

      const result = await disabledClient.trackCommunityBlueprintUsage('test', {})

      expect(result).toEqual({
        success: true,
        message: 'Telemetry disabled',
      })
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should handle tracking errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
      })

      const result = await hubClient.trackCommunityBlueprintUsage('test', {})

      expect(result).toEqual({
        success: false,
        error: 'HTTP 429',
      })
    })
  })

  describe('getCommunityCategories', () => {
    it('should fetch categories successfully', async () => {
      const mockResponse = {
        categories: [
          {
            slug: 'frontend',
            name: 'Frontend Development',
            description: 'UI frameworks and patterns',
            count: 145,
            frameworks: ['React', 'Vue'],
            popularTags: ['typescript', 'styling'],
          },
        ],
        stats: { totalBlueprints: 456, totalCategories: 10 },
        meta: { generatedAt: '2025-01-11T10:00:00Z' },
      }

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve(mockResponse),
      })

      const result = await hubClient.getCommunityCategories()

      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/categories',
        expect.objectContaining({ method: 'GET' })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should return empty categories on error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await hubClient.getCommunityCategories()

      expect(result).toEqual({
        categories: [],
        stats: {},
        meta: {},
      })
    })
  })

  describe('Error handling', () => {
    it('should handle rate limiting properly', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      })

      await expect(hubClient.getCommunityBlueprint('test')).rejects.toThrow(VDKHubError)
    })

    it('should retry on server errors', async () => {
      // First call fails with 503
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      })

      // Second call (retry) succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/json' : null),
        },
        json: () => Promise.resolve({ id: 'test', title: 'Test' }),
      })

      const result = await hubClient.getCommunityBlueprint('test')

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(result.id).toBe('test')
    })
  })

  describe('Configuration', () => {
    it('should use correct base URL and headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ categories: [] }),
      })

      await hubClient.getCommunityCategories()

      expect(fetch).toHaveBeenCalledWith(
        'https://test-hub.example.com/api/community/categories',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-VDK-Version': '2.0.0',
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should work without authentication', async () => {
      const noAuthClient = new VDKHubClient({ hubUrl: 'https://test.com' })

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ categories: [] }),
      })

      await noAuthClient.getCommunityCategories()

      const headers = fetch.mock.calls[0][1].headers
      expect(headers).not.toHaveProperty('Authorization')
    })
  })
})
