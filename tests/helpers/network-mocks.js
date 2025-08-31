/**
 * Network Mock Utilities for VDK CLI Tests
 * -----------------------------------------
 * Provides consistent mocking for network requests, hub operations,
 * and external service integrations to prevent test flakiness and timeouts.
 */

import { vi } from 'vitest'

/**
 * Mock fetch responses for different scenarios
 */
export const mockFetchResponses = {
  // Hub API responses
  hubSuccess: (data) => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (name === 'content-type' ? 'application/json' : null),
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }),

  hubError: (status = 500, message = 'Internal Server Error') => ({
    ok: false,
    status,
    statusText: message,
    headers: {
      get: (name) => (name === 'content-type' ? 'application/json' : null),
    },
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  }),

  networkError: () => Promise.reject(new Error('Network error')),

  timeout: () =>
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 100)
    }),

  // Blueprint repository responses
  blueprintsSuccess: (blueprints = []) => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (name === 'content-type' ? 'application/json' : null),
    },
    json: () => Promise.resolve(blueprints),
  }),

  // GitHub API responses
  githubSuccess: (data) => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (name === 'content-type' ? 'application/json' : null),
    },
    json: () => Promise.resolve(data),
  }),
}

/**
 * Mock data generators
 */
export const mockData = {
  blueprint: (overrides = {}) => ({
    id: 'test-blueprint',
    title: 'Test Blueprint',
    description: 'A test blueprint',
    content: '# Test Blueprint\nTest content',
    author: { username: 'testuser', verified: true },
    metadata: {
      framework: 'React',
      language: 'TypeScript',
      category: 'frontend',
      tags: ['react', 'test'],
    },
    stats: {
      usageCount: 10,
      rating: 4.5,
      voteCount: 5,
    },
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-02T00:00:00Z',
    ...overrides,
  }),

  blueprintList: (count = 3) =>
    Array.from({ length: count }, (_, i) =>
      mockData.blueprint({
        id: `test-blueprint-${i + 1}`,
        title: `Test Blueprint ${i + 1}`,
      })
    ),

  hubConfig: (overrides = {}) => ({
    hubUrl: 'https://test-hub.example.com',
    apiKey: 'test-api-key',
    timeout: 5000,
    retryAttempts: 1,
    telemetryEnabled: false,
    ...overrides,
  }),

  searchResults: (blueprints = [], overrides = {}) => ({
    blueprints,
    totalCount: blueprints.length,
    page: 1,
    pageSize: 20,
    hasMore: false,
    filters: {
      category: null,
      framework: null,
      language: null,
      tags: [],
    },
    ...overrides,
  }),
}

/**
 * Setup global fetch mock with predefined scenarios
 */
export function setupFetchMock() {
  global.fetch = vi.fn()
  return global.fetch
}

/**
 * Setup hub client mocks for testing
 */
export function setupHubMocks() {
  // Mock the hub availability check
  vi.mock('../src/hub/index.js', () => ({
    isHubAvailable: vi.fn().mockResolvedValue(false),
    quickHubOperations: vi.fn().mockResolvedValue(null),
  }))

  // Mock VDK Hub Client
  vi.mock('../src/hub/VDKHubClient.js', () => ({
    VDKHubClient: vi.fn().mockImplementation(() => ({
      getCommunityBlueprint: vi.fn().mockResolvedValue(null),
      searchCommunityBlueprints: vi.fn().mockResolvedValue(mockData.searchResults([])),
      getTrendingBlueprints: vi.fn().mockResolvedValue([]),
      trackCommunityBlueprintUsage: vi.fn().mockResolvedValue(true),
      getCommunityCategories: vi.fn().mockResolvedValue([]),
      isAvailable: vi.fn().mockResolvedValue(false),
      healthCheck: vi.fn().mockResolvedValue({ status: 'offline' }),
    })),
    VDKHubError: class extends Error {
      constructor(message) {
        super(message)
        this.name = 'VDKHubError'
      }
    },
  }))
}

/**
 * Setup community client mocks
 */
export function setupCommunityMocks() {
  vi.mock('../src/community/CommunityDeployer.js', () => ({
    CommunityDeployer: vi.fn().mockImplementation(() => ({
      deploy: vi.fn().mockResolvedValue({ success: true, url: 'https://example.com' }),
      validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
      getDeploymentStatus: vi.fn().mockResolvedValue({ status: 'deployed' }),
    })),
  }))
}

/**
 * Setup integration mocks to avoid real file system operations
 */
export function setupIntegrationMocks() {
  vi.mock('../src/integrations/index.js', () => ({
    createIntegrationManager: vi.fn().mockReturnValue({
      discoverIntegrations: vi.fn().mockResolvedValue({
        loaded: [],
        failed: [],
        registered: 0,
      }),
      scanAll: vi.fn().mockResolvedValue({
        active: [],
        inactive: [],
        recommendations: [],
        errors: [],
        summary: {
          totalIntegrations: 0,
          activeIntegrations: 0,
          highConfidenceIntegrations: 0,
          recommendationCount: 0,
          scanTime: new Date().toISOString(),
        },
      }),
      initializeActive: vi.fn().mockResolvedValue({
        successful: [],
        failed: [],
        skipped: [],
        errors: [],
      }),
      getActiveIntegrations: vi.fn().mockReturnValue([]),
      isIntegrationActive: vi.fn().mockReturnValue(false),
    }),
  }))
}

/**
 * Create a mock blueprint client for testing
 */
export function createMockBlueprintClient() {
  return {
    getBlueprintByName: vi.fn().mockResolvedValue(null),
    getBlueprintsByCategory: vi.fn().mockResolvedValue([]),
    searchBlueprints: vi.fn().mockResolvedValue([]),
    getBlueprintMetadata: vi.fn().mockResolvedValue({}),
  }
}

/**
 * Setup file system mocks to avoid test pollution
 */
export function setupFileSystemMocks() {
  vi.mock('node:fs/promises', async () => {
    const actual = await vi.importActual('node:fs/promises')
    return {
      ...actual,
      access: vi.fn().mockRejectedValue(new Error('File not found')),
      readFile: vi.fn().mockResolvedValue('{}'),
      writeFile: vi.fn().mockResolvedValue(),
      mkdir: vi.fn().mockResolvedValue(),
      stat: vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
      }),
      readdir: vi.fn().mockResolvedValue([]),
    }
  })
}

/**
 * Reset all mocks to clean state
 */
export function resetAllMocks() {
  vi.clearAllMocks()
  vi.resetAllMocks()
  if (global.fetch) {
    global.fetch.mockClear()
  }
}

/**
 * Set up consistent test environment
 */
export function setupTestEnvironment() {
  // Set consistent platform
  Object.defineProperty(process, 'platform', {
    value: 'darwin',
    writable: true,
  })

  // Set consistent environment variables
  process.env.HOME = '/Users/testuser'
  process.env.USERPROFILE = process.env.HOME
  process.env.NODE_ENV = 'test'
  
  // Suppress dotenv output in tests
  process.env.DOTENV_CONFIG_PATH = '/dev/null'
}

/**
 * Mock console to avoid test output pollution
 */
export function mockConsole() {
  const originalConsole = { ...console }
  
  console.log = vi.fn()
  console.info = vi.fn()
  console.warn = vi.fn()
  console.error = vi.fn()
  
  return () => {
    Object.assign(console, originalConsole)
  }
}

/**
 * Create timeout-safe promise for async operations
 */
export function createTimeoutSafePromise(operation, timeout = 1000) {
  return Promise.race([
    operation,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    ),
  ])
}

export default {
  mockFetchResponses,
  mockData,
  setupFetchMock,
  setupHubMocks,
  setupCommunityMocks,
  setupIntegrationMocks,
  setupFileSystemMocks,
  createMockBlueprintClient,
  resetAllMocks,
  setupTestEnvironment,
  mockConsole,
  createTimeoutSafePromise,
}