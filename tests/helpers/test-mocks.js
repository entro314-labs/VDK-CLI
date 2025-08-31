/**
 * Test Mocks and Utilities
 *
 * Comprehensive mock implementations for external dependencies used across
 * the VDK-CLI test suites. Provides consistent, reusable mocks for:
 * - File system operations
 * - HTTP/API calls
 * - Integration managers
 * - Project scanners
 * - External services
 * - Console and UI interactions
 */

import { vi } from 'vitest'

/**
 * File System Mocks
 * Mock implementations for fs/promises and fs modules
 */
export const createFileSystemMocks = () => {
  const mockFiles = new Map()
  const mockDirectories = new Set()

  const fsMocks = {
    // fs/promises mocks
    readFile: vi.fn().mockImplementation(async (path) => {
      if (mockFiles.has(path)) {
        return mockFiles.get(path)
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`)
    }),

    writeFile: vi.fn().mockImplementation(async (path, content, options) => {
      mockFiles.set(path, content)
      return Promise.resolve()
    }),

    access: vi.fn().mockImplementation(async (path) => {
      if (mockFiles.has(path) || mockDirectories.has(path)) {
        return Promise.resolve()
      }
      throw new Error(`ENOENT: no such file or directory, access '${path}'`)
    }),

    readdir: vi.fn().mockImplementation(async (path, options) => {
      const entries = []
      const pathPrefix = path.endsWith('/') ? path : `${path}/`

      for (const filePath of mockFiles.keys()) {
        if (filePath.startsWith(pathPrefix)) {
          const relativePath = filePath.substring(pathPrefix.length)
          const name = relativePath.split('/')[0]
          if (name && !entries.some((e) => e.name === name || e === name)) {
            if (options?.withFileTypes) {
              entries.push({
                name,
                isFile: () => !relativePath.includes('/'),
                isDirectory: () => relativePath.includes('/'),
              })
            } else {
              entries.push(name)
            }
          }
        }
      }

      return entries
    }),

    unlink: vi.fn().mockImplementation(async (path) => {
      if (mockFiles.has(path)) {
        mockFiles.delete(path)
        return Promise.resolve()
      }
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`)
    }),

    rmdir: vi.fn().mockImplementation(async (path) => {
      if (mockDirectories.has(path)) {
        mockDirectories.delete(path)
        return Promise.resolve()
      }
      throw new Error(`ENOENT: no such file or directory, rmdir '${path}'`)
    }),

    // fs (sync) mocks
    readFileSync: vi.fn().mockImplementation((path, encoding) => {
      if (mockFiles.has(path)) {
        return mockFiles.get(path)
      }
      throw new Error(`ENOENT: no such file or directory, open '${path}'`)
    }),
  }

  // Helper methods for test setup
  const helpers = {
    setFile: (path, content) => {
      mockFiles.set(path, content)
    },

    setDirectory: (path) => {
      mockDirectories.add(path)
    },

    clear: () => {
      mockFiles.clear()
      mockDirectories.clear()
    },

    hasFile: (path) => mockFiles.has(path),
    hasDirectory: (path) => mockDirectories.has(path),

    getFile: (path) => mockFiles.get(path),
    getAllFiles: () => Array.from(mockFiles.entries()),
    getAllDirectories: () => Array.from(mockDirectories),
  }

  return { mocks: fsMocks, helpers }
}

/**
 * HTTP/Fetch Mocks
 * Mock implementations for network requests
 */
export const createHttpMocks = () => {
  const responseQueue = []
  const requestHistory = []

  const fetchMock = vi.fn().mockImplementation(async (url, options) => {
    requestHistory.push({ url, options })

    if (responseQueue.length > 0) {
      return responseQueue.shift()
    }

    // Default successful response
    return {
      ok: true,
      status: 200,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      },
      json: vi.fn().mockResolvedValue({ success: true }),
    }
  })

  const helpers = {
    queueResponse: (response) => {
      responseQueue.push(response)
    },

    queueResponses: (responses) => {
      responseQueue.push(...responses)
    },

    getRequestHistory: () => [...requestHistory],

    getLastRequest: () => requestHistory[requestHistory.length - 1],

    clearHistory: () => {
      requestHistory.length = 0
    },

    clearQueue: () => {
      responseQueue.length = 0
    },

    createResponse: (data, status = 200, headers = {}) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: vi.fn().mockImplementation((name) => headers[name.toLowerCase()] || null),
      },
      json: vi.fn().mockResolvedValue(data),
      text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    }),

    createErrorResponse: (status = 500, message = 'Server Error') => ({
      ok: false,
      status,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      },
      json: vi.fn().mockResolvedValue({ error: message }),
    }),
  }

  return { mock: fetchMock, helpers }
}

/**
 * Project Scanner Mocks
 * Mock implementations for project analysis
 */
export const createProjectScannerMocks = () => {
  const defaultProjectData = {
    files: [
      { name: 'package.json', path: '/project/package.json', type: 'json' },
      { name: 'src/index.js', path: '/project/src/index.js', type: 'javascript' },
      { name: 'src/utils.js', path: '/project/src/utils.js', type: 'javascript' },
    ],
    directories: ['src', 'tests'],
    structure: {
      directories: ['src', 'tests'],
      files: ['package.json', 'src/index.js', 'src/utils.js'],
    },
    dependencies: ['react', 'typescript'],
    technologies: ['javascript', 'react'],
    patterns: ['modular', 'component-based'],
  }

  const ProjectScannerMock = vi.fn().mockImplementation(() => ({
    scanProject: vi.fn().mockResolvedValue(defaultProjectData),
  }))

  const helpers = {
    setProjectData: (data) => {
      ProjectScannerMock.mockImplementation(() => ({
        scanProject: vi.fn().mockResolvedValue({ ...defaultProjectData, ...data }),
      }))
    },

    setScanError: (error) => {
      ProjectScannerMock.mockImplementation(() => ({
        scanProject: vi.fn().mockRejectedValue(error),
      }))
    },
  }

  return { mock: ProjectScannerMock, helpers }
}

/**
 * Integration Manager Mocks
 * Mock implementations for platform integrations
 */
export const createIntegrationManagerMocks = () => {
  const defaultIntegrations = [
    { name: 'claude-code', active: true },
    { name: 'cursor', active: true },
    { name: 'windsurf', active: false },
  ]

  const integrationManagerMock = {
    discoverIntegrations: vi.fn().mockResolvedValue({
      found: defaultIntegrations.length,
    }),

    scanAll: vi.fn().mockResolvedValue({
      scanned: defaultIntegrations.length,
    }),

    initializeActive: vi.fn().mockResolvedValue({
      success: true,
      deployed: defaultIntegrations.filter((i) => i.active).length,
      errors: [],
    }),

    getActiveIntegrations: vi.fn().mockReturnValue(defaultIntegrations.filter((i) => i.active)),

    getAllIntegrations: vi.fn().mockReturnValue(defaultIntegrations),
  }

  const createIntegrationManagerMock = vi.fn().mockReturnValue(integrationManagerMock)

  const helpers = {
    setIntegrations: (integrations) => {
      integrationManagerMock.getAllIntegrations.mockReturnValue(integrations)
      integrationManagerMock.getActiveIntegrations.mockReturnValue(integrations.filter((i) => i.active))
    },

    setDeploymentError: (error) => {
      integrationManagerMock.initializeActive.mockRejectedValue(error)
    },

    setDeploymentResult: (result) => {
      integrationManagerMock.initializeActive.mockResolvedValue(result)
    },
  }

  return {
    mock: integrationManagerMock,
    factory: createIntegrationManagerMock,
    helpers,
  }
}

/**
 * VDK Hub Client Mocks
 * Mock implementations for Hub API interactions
 */
export const createVDKHubClientMocks = () => {
  const hubClientMock = {
    ping: vi.fn().mockResolvedValue({
      success: true,
      status: 'healthy',
      version: '2.0.0',
      latency: 100,
    }),

    syncBlueprints: vi.fn().mockResolvedValue({
      blueprints: [],
      lastSyncTime: new Date().toISOString(),
      totalBlueprints: 0,
      changes: { added: [], updated: [], removed: [] },
    }),

    generatePackage: vi.fn().mockResolvedValue({
      packageId: 'pkg-123',
      downloadUrl: 'https://example.com/download/pkg-123',
      packageType: 'zip',
      ruleCount: 5,
      fileSize: 2048,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),

    downloadPackage: vi.fn().mockResolvedValue({
      content: new ArrayBuffer(1024),
      contentType: 'application/zip',
      packageType: 'zip',
      ruleCount: 5,
      fileName: 'package.zip',
    }),

    sendUsageTelemetry: vi.fn().mockResolvedValue({
      success: true,
      message: 'Telemetry recorded',
    }),

    sendErrorTelemetry: vi.fn().mockResolvedValue({
      success: true,
      message: 'Error telemetry recorded',
    }),

    sendIntegrationTelemetry: vi.fn().mockResolvedValue({
      success: true,
      message: 'Integration telemetry recorded',
    }),

    checkVersionCompatibility: vi.fn().mockResolvedValue({
      success: true,
      compatibility: { compatible: true, upgradeRecommended: false },
    }),

    getCommunityBlueprint: vi.fn().mockResolvedValue({
      id: 'test-blueprint',
      title: 'Test Blueprint',
      content: '# Test Blueprint\n\nTest content',
      author: { username: 'test-author' },
    }),

    searchCommunityBlueprints: vi.fn().mockResolvedValue({
      blueprints: [],
      pagination: { total: 0, limit: 20, offset: 0 },
    }),

    trackCommunityBlueprintUsage: vi.fn().mockResolvedValue({
      success: true,
      usageId: 'usage-123',
    }),

    checkAuth: vi.fn().mockResolvedValue({
      authenticated: false,
    }),

    uploadBlueprint: vi.fn().mockResolvedValue({
      blueprintId: 'bp-123',
      tempUrl: 'https://vdk.tools/temp/bp-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      confirmationRequired: true,
    }),
  }

  const VDKHubClientMock = vi.fn().mockImplementation(() => hubClientMock)

  const helpers = {
    setAuthenticated: (authenticated) => {
      hubClientMock.checkAuth.mockResolvedValue({ authenticated })
    },

    setTelemetryDisabled: () => {
      hubClientMock.sendUsageTelemetry.mockResolvedValue({
        success: true,
        message: 'Telemetry disabled',
      })
    },

    setError: (method, error) => {
      hubClientMock[method].mockRejectedValue(error)
    },

    setBlueprintNotFound: () => {
      hubClientMock.getCommunityBlueprint.mockResolvedValue(null)
    },
  }

  return { mock: hubClientMock, factory: VDKHubClientMock, helpers }
}

/**
 * Console and UI Mocks
 * Mock implementations for console output and user interaction
 */
export const createConsoleMocks = () => {
  const consoleMocks = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }

  const oraMock = vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    set text(value) {},
  }))

  const chalkMocks = {
    yellow: vi.fn().mockImplementation((str) => str),
    green: vi.fn().mockImplementation((str) => str),
    red: vi.fn().mockImplementation((str) => str),
    cyan: vi.fn().mockImplementation((str) => str),
    gray: vi.fn().mockImplementation((str) => str),
    blue: vi.fn().mockImplementation((str) => str),
    magenta: vi.fn().mockImplementation((str) => str),
    white: vi.fn().mockImplementation((str) => str),
  }

  const helpers = {
    getLogCalls: () => consoleMocks.log.mock.calls,
    getWarnCalls: () => consoleMocks.warn.mock.calls,
    getErrorCalls: () => consoleMocks.error.mock.calls,

    clearAll: () => {
      Object.values(consoleMocks).forEach((mock) => mock.mockClear())
    },

    hasLoggedMessage: (message) => {
      return consoleMocks.log.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes(message))
      )
    },

    hasWarnedMessage: (message) => {
      return consoleMocks.warn.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes(message))
      )
    },
  }

  return {
    console: consoleMocks,
    ora: oraMock,
    chalk: chalkMocks,
    helpers,
  }
}

/**
 * Common Test Data
 * Reusable test data structures
 */
export const testData = {
  // Valid blueprint structure
  validBlueprint: {
    id: 'test-blueprint-123',
    title: 'Test Blueprint',
    description: 'A comprehensive test blueprint for validation',
    version: '1.0.0',
    category: 'testing',
    created: '2024-01-01T00:00:00Z',
    lastUpdated: '2024-01-01T00:00:00Z',
    author: 'Test Author',
    tags: ['testing', 'validation', 'comprehensive'],
    complexity: 'medium',
    scope: 'project',
    audience: 'developer',
    maturity: 'stable',
    platforms: {
      'claude-code': { compatible: true, memory: true, priority: 5 },
      cursor: { compatible: true, activation: 'auto-attached', priority: 'medium' },
      windsurf: { compatible: true, mode: 'workspace', priority: 7 },
      'github-copilot': { compatible: true, priority: 8 },
    },
    content: '# Test Blueprint\n\nThis is comprehensive test content for blueprint validation.',
  },

  // Project structure examples
  reactProject: {
    files: [
      { name: 'package.json', path: '/project/package.json' },
      { name: 'src/index.tsx', path: '/project/src/index.tsx' },
      { name: 'src/App.tsx', path: '/project/src/App.tsx' },
      { name: 'src/components/Button.tsx', path: '/project/src/components/Button.tsx' },
      { name: '__tests__/App.test.tsx', path: '/project/__tests__/App.test.tsx' },
    ],
    dependencies: { react: '^18.0.0', typescript: '^4.9.0' },
    framework: 'react',
    language: 'typescript',
  },

  nextjsProject: {
    files: [
      { name: 'package.json', path: '/project/package.json' },
      { name: 'app/page.tsx', path: '/project/app/page.tsx' },
      { name: 'app/layout.tsx', path: '/project/app/layout.tsx' },
      { name: 'components/Navigation.tsx', path: '/project/components/Navigation.tsx' },
      { name: 'tailwind.config.js', path: '/project/tailwind.config.js' },
    ],
    dependencies: { react: '^18.0.0', next: '^13.0.0', typescript: '^4.9.0' },
    framework: 'nextjs',
    language: 'typescript',
  },

  // Rule examples for testing
  cursorRules: `# Cursor Rules

Use TypeScript for all new code.
Follow React best practices.
Implement proper error handling.

## Code Style
- Use 2-space indentation
- Prefer const over let
- Use descriptive variable names

## Testing
- Write tests for all business logic
- Use Jest and React Testing Library
- Maintain high test coverage`,

  claudeMemory: `# Claude Memory

## Project Context
This is a React TypeScript project using modern development practices.

## Coding Preferences
- Use functional components with hooks
- Implement strict TypeScript types
- Follow accessibility guidelines
- Use Tailwind CSS for styling

## Architecture
- Feature-based folder structure
- Separate business logic from UI components
- Use custom hooks for shared logic`,

  copilotConfig: {
    guidelines: [
      { title: 'Code Quality', content: 'Write clean, maintainable code' },
      { title: 'TypeScript', content: 'Use strict type checking' },
    ],
    rules: [
      'Prefer functional programming patterns',
      'Use meaningful variable names',
      'Add JSDoc comments for complex functions',
    ],
  },

  windsurfRules: `<windsurf:context project="test-project">
  <windsurf:rules>
    Use modern JavaScript patterns
    Implement proper error handling
    Follow component-based architecture
  </windsurf:rules>
  <windsurf:tech name="react">Use React 18 features</windsurf:tech>
  <windsurf:tech name="typescript">Enable strict mode</windsurf:tech>
</windsurf:context>`,
}

/**
 * Test Environment Setup
 * Helper function to set up a complete test environment
 */
export const setupTestEnvironment = () => {
  const fs = createFileSystemMocks()
  const http = createHttpMocks()
  const scanner = createProjectScannerMocks()
  const integration = createIntegrationManagerMocks()
  const hub = createVDKHubClientMocks()
  const ui = createConsoleMocks()

  // Set up global fetch mock
  global.fetch = http.mock

  // Set up global console mock
  global.console = ui.console

  return {
    mocks: {
      fs: fs.mocks,
      http: http.mock,
      projectScanner: scanner.mock,
      integrationManager: integration.mock,
      hubClient: hub.mock,
      console: ui.console,
      ora: ui.ora,
      chalk: ui.chalk,
    },
    helpers: {
      fs: fs.helpers,
      http: http.helpers,
      scanner: scanner.helpers,
      integration: integration.helpers,
      hub: hub.helpers,
      ui: ui.helpers,
    },
    data: testData,
    cleanup: () => {
      fs.helpers.clear()
      http.helpers.clearHistory()
      http.helpers.clearQueue()
      ui.helpers.clearAll()
    },
  }
}

/**
 * Mock Factory Functions
 * Convenient factory functions for creating specific mock scenarios
 */
export const mockScenarios = {
  // Successful API responses
  successfulHubSync: () => ({
    blueprints: [testData.validBlueprint],
    lastSyncTime: new Date().toISOString(),
    totalBlueprints: 1,
    changes: { added: ['test-blueprint-123'], updated: [], removed: [] },
  }),

  // Network error scenarios
  networkError: () => new Error('Network request failed'),

  hubUnavailable: () => ({
    ok: false,
    status: 503,
    json: vi.fn().mockResolvedValue({ error: 'Service Unavailable' }),
  }),

  // Authentication scenarios
  authenticatedUser: () => ({
    authenticated: true,
    user: 'testuser',
    email: 'test@example.com',
  }),

  unauthenticatedUser: () => ({
    authenticated: false,
  }),

  // Project analysis scenarios
  complexReactProject: () => ({
    files: testData.reactProject.files.concat([
      { name: 'src/hooks/useAuth.ts', path: '/project/src/hooks/useAuth.ts' },
      { name: 'src/contexts/AuthContext.tsx', path: '/project/src/contexts/AuthContext.tsx' },
      { name: 'src/utils/api.ts', path: '/project/src/utils/api.ts' },
      { name: 'src/types/index.ts', path: '/project/src/types/index.ts' },
    ]),
    dependencies: testData.reactProject.dependencies,
    technologies: ['react', 'typescript', 'jest', 'tailwind'],
    patterns: ['component-based', 'hooks-pattern', 'context-pattern', 'testing'],
  }),
}

export default {
  createFileSystemMocks,
  createHttpMocks,
  createProjectScannerMocks,
  createIntegrationManagerMocks,
  createVDKHubClientMocks,
  createConsoleMocks,
  testData,
  setupTestEnvironment,
  mockScenarios,
}
