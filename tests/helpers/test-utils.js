/**
 * Test Utilities
 *
 * Utility functions and helpers for VDK-CLI tests.
 * Provides common testing patterns, assertion helpers, and test data generators.
 */

import { vi } from 'vitest'
import path from 'path'

/**
 * Assertion Helpers
 * Custom assertion functions for common test patterns
 */
export const assertions = {
  /**
   * Assert that a function was called with specific partial arguments
   */
  toHaveBeenCalledWithPartial: (mockFn, partialArgs) => {
    const calls = mockFn.mock.calls
    const hasMatchingCall = calls.some((call) => {
      return Object.entries(partialArgs).every(([key, expectedValue]) => {
        const actualValue = call[0] && call[0][key]
        return JSON.stringify(actualValue) === JSON.stringify(expectedValue)
      })
    })

    if (!hasMatchingCall) {
      throw new Error(
        `Expected function to be called with partial args ${JSON.stringify(partialArgs)}, ` +
          `but it was called with: ${JSON.stringify(calls)}`
      )
    }
  },

  /**
   * Assert that an object contains specific nested properties
   */
  toContainNestedProperty: (obj, path, expectedValue) => {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        throw new Error(`Property path "${path}" not found in object`)
      }
      current = current[key]
    }

    if (expectedValue !== undefined && current !== expectedValue) {
      throw new Error(`Expected property "${path}" to equal ${expectedValue}, but got ${current}`)
    }
  },

  /**
   * Assert that a string contains all specified substrings
   */
  toContainAllStrings: (str, substrings) => {
    const missing = substrings.filter((substring) => !str.includes(substring))

    if (missing.length > 0) {
      throw new Error(`String "${str}" is missing substrings: ${missing.join(', ')}`)
    }
  },

  /**
   * Assert that an array contains objects with specific properties
   */
  toContainObjectsWithProperties: (array, properties) => {
    const matches = array.filter((item) => Object.entries(properties).every(([key, value]) => item[key] === value))

    if (matches.length === 0) {
      throw new Error(`Array does not contain any objects with properties: ${JSON.stringify(properties)}`)
    }

    return matches
  },
}

/**
 * Async Testing Helpers
 * Utilities for testing asynchronous operations
 */
export const asyncHelpers = {
  /**
   * Wait for a condition to become true
   */
  waitForCondition: async (condition, timeout = 5000, interval = 100) => {
    const start = Date.now()

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw new Error(`Condition not met within ${timeout}ms`)
  },

  /**
   * Wait for all pending promises to resolve
   */
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),

  /**
   * Create a promise that resolves after a delay
   */
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Test that a promise rejects with a specific error
   */
  expectToReject: async (promiseFactory, expectedError) => {
    try {
      await promiseFactory()
      throw new Error('Expected promise to reject, but it resolved')
    } catch (error) {
      if (expectedError && !error.message.includes(expectedError)) {
        throw new Error(`Expected error to contain "${expectedError}", but got: ${error.message}`)
      }
      return error
    }
  },
}

/**
 * Mock Verification Helpers
 * Utilities for verifying mock function calls and behavior
 */
export const mockHelpers = {
  /**
   * Get the last call arguments for a mock function
   */
  getLastCallArgs: (mockFn) => {
    const calls = mockFn.mock.calls
    if (calls.length === 0) {
      throw new Error('Mock function was never called')
    }
    return calls[calls.length - 1]
  },

  /**
   * Get the first call arguments for a mock function
   */
  getFirstCallArgs: (mockFn) => {
    const calls = mockFn.mock.calls
    if (calls.length === 0) {
      throw new Error('Mock function was never called')
    }
    return calls[0]
  },

  /**
   * Reset all mocks in an object
   */
  resetAllMocks: (obj) => {
    Object.values(obj).forEach((value) => {
      if (vi.isMockFunction(value)) {
        value.mockReset()
      } else if (typeof value === 'object' && value !== null) {
        mockHelpers.resetAllMocks(value)
      }
    })
  },

  /**
   * Create a mock function that resolves after a delay
   */
  createDelayedMock: (returnValue, delay = 100) => {
    return vi.fn().mockImplementation(async (...args) => {
      await asyncHelpers.delay(delay)
      return typeof returnValue === 'function' ? returnValue(...args) : returnValue
    })
  },

  /**
   * Create a mock that succeeds after failing N times
   */
  createRetryMock: (successValue, failureCount = 2, failureError = new Error('Mock failure')) => {
    let attempts = 0
    return vi.fn().mockImplementation(() => {
      attempts++
      if (attempts <= failureCount) {
        throw failureError
      }
      return successValue
    })
  },
}

/**
 * Test Data Generators
 * Functions to generate realistic test data
 */
export const dataGenerators = {
  /**
   * Generate a mock package.json content
   */
  generatePackageJson: (overrides = {}) => {
    const defaults = {
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project for VDK-CLI',
      scripts: {
        test: 'jest',
        build: 'npm run build',
        dev: 'npm run dev',
      },
      dependencies: {
        react: '^18.0.0',
        typescript: '^4.9.0',
      },
      devDependencies: {
        jest: '^29.0.0',
        '@types/react': '^18.0.0',
      },
    }

    return JSON.stringify({ ...defaults, ...overrides }, null, 2)
  },

  /**
   * Generate mock project files structure
   */
  generateProjectFiles: (framework = 'react', language = 'typescript') => {
    const baseFiles = [
      { name: 'package.json', path: '/project/package.json', type: 'json' },
      { name: 'README.md', path: '/project/README.md', type: 'markdown' },
    ]

    const frameworkFiles = {
      react: [
        { name: 'src/index.tsx', path: '/project/src/index.tsx', type: 'typescript' },
        { name: 'src/App.tsx', path: '/project/src/App.tsx', type: 'typescript' },
        {
          name: 'src/components/Button.tsx',
          path: '/project/src/components/Button.tsx',
          type: 'typescript',
        },
      ],
      nextjs: [
        { name: 'app/page.tsx', path: '/project/app/page.tsx', type: 'typescript' },
        { name: 'app/layout.tsx', path: '/project/app/layout.tsx', type: 'typescript' },
        {
          name: 'components/Navigation.tsx',
          path: '/project/components/Navigation.tsx',
          type: 'typescript',
        },
      ],
      vue: [
        { name: 'src/main.ts', path: '/project/src/main.ts', type: 'typescript' },
        { name: 'src/App.vue', path: '/project/src/App.vue', type: 'vue' },
        {
          name: 'src/components/HelloWorld.vue',
          path: '/project/src/components/HelloWorld.vue',
          type: 'vue',
        },
      ],
    }

    return [...baseFiles, ...(frameworkFiles[framework] || frameworkFiles.react)]
  },

  /**
   * Generate mock telemetry event
   */
  generateTelemetryEvent: (overrides = {}) => {
    const defaults = {
      cli_version: '2.0.0',
      command: 'generate',
      platform: process.platform,
      success: true,
      timestamp: new Date().toISOString(),
      session_id: `test_${Date.now()}`,
      metadata: {},
    }

    return { ...defaults, ...overrides }
  },

  /**
   * Generate mock blueprint metadata
   */
  generateBlueprintMetadata: (overrides = {}) => {
    const defaults = {
      id: `blueprint-${Date.now()}`,
      title: 'Test Blueprint',
      description: 'A test blueprint for validation',
      version: '1.0.0',
      category: 'testing',
      author: 'Test Author',
      tags: ['test', 'validation'],
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }

    return { ...defaults, ...overrides }
  },

  /**
   * Generate random string
   */
  generateRandomString: (length = 10, charset = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
  },
}

/**
 * File System Test Helpers
 * Utilities for testing file system operations
 */
export const fsHelpers = {
  /**
   * Create a temporary test directory structure
   */
  createTempStructure: (structure, basePath = '/temp') => {
    const files = new Map()
    const directories = new Set()

    const processStructure = (obj, currentPath = basePath) => {
      Object.entries(obj).forEach(([name, content]) => {
        const fullPath = path.join(currentPath, name)

        if (typeof content === 'string') {
          // It's a file
          files.set(fullPath, content)
        } else if (content === null) {
          // It's an empty directory
          directories.add(fullPath)
        } else {
          // It's a directory with contents
          directories.add(fullPath)
          processStructure(content, fullPath)
        }
      })
    }

    processStructure(structure)
    return { files, directories }
  },

  /**
   * Generate file paths for testing
   */
  generatePaths: (basePath, extensions) => {
    return extensions.map((ext) => ({
      full: path.join(basePath, `test${ext}`),
      relative: `test${ext}`,
      extension: ext,
    }))
  },
}

/**
 * Test Environment Helpers
 * Utilities for setting up and managing test environments
 */
export const environmentHelpers = {
  /**
   * Set environment variables for testing
   */
  withEnv: (envVars, testFunction) => {
    return async () => {
      const originalEnv = { ...process.env }

      // Set test environment variables
      Object.assign(process.env, envVars)

      try {
        await testFunction()
      } finally {
        // Restore original environment
        process.env = originalEnv
      }
    }
  },

  /**
   * Mock the current working directory
   */
  withCwd: (cwd, testFunction) => {
    return async () => {
      const originalCwd = process.cwd()
      const mockCwd = vi.spyOn(process, 'cwd').mockReturnValue(cwd)

      try {
        await testFunction()
      } finally {
        mockCwd.mockRestore()
      }
    }
  },

  /**
   * Set up a complete isolated test environment
   */
  isolatedTest: (setup, testFunction, cleanup) => {
    return async () => {
      const testContext = {}

      if (setup) {
        await setup(testContext)
      }

      try {
        await testFunction(testContext)
      } finally {
        if (cleanup) {
          await cleanup(testContext)
        }
      }
    }
  },
}

/**
 * Performance Testing Helpers
 * Utilities for performance and timing tests
 */
export const performanceHelpers = {
  /**
   * Measure execution time
   */
  measureTime: async (fn) => {
    const start = process.hrtime.bigint()
    const result = await fn()
    const end = process.hrtime.bigint()
    const duration = Number(end - start) / 1000000 // Convert to milliseconds

    return { result, duration }
  },

  /**
   * Assert that a function completes within a time limit
   */
  expectToCompleteWithin: async (fn, maxDuration) => {
    const { result, duration } = await performanceHelpers.measureTime(fn)

    if (duration > maxDuration) {
      throw new Error(`Function took ${duration.toFixed(2)}ms, expected less than ${maxDuration}ms`)
    }

    return result
  },
}

/**
 * Common Test Patterns
 * Pre-built test pattern functions
 */
export const testPatterns = {
  /**
   * Test error handling pattern
   */
  testErrorHandling: (functionUnderTest, errorConditions) => {
    return errorConditions.map(({ name, setup, expectedError }) => ({
      name: `should handle ${name}`,
      test: async () => {
        if (setup) await setup()
        await asyncHelpers.expectToReject(functionUnderTest, expectedError)
      },
    }))
  },

  /**
   * Test retry mechanism pattern
   */
  testRetryMechanism: (functionUnderTest, maxRetries = 3) => {
    return {
      name: 'should retry failed operations',
      test: async () => {
        const mockFn = mockHelpers.createRetryMock('success', maxRetries - 1)
        const result = await functionUnderTest(mockFn)

        expect(result).toBe('success')
        expect(mockFn).toHaveBeenCalledTimes(maxRetries)
      },
    }
  },

  /**
   * Test configuration merging pattern
   */
  testConfigMerging: (configFunction, defaultConfig, customConfig, expectedResult) => {
    return {
      name: 'should merge configurations correctly',
      test: () => {
        const result = configFunction(defaultConfig, customConfig)
        expect(result).toEqual(expectedResult)
      },
    }
  },
}

export default {
  assertions,
  asyncHelpers,
  mockHelpers,
  dataGenerators,
  fsHelpers,
  environmentHelpers,
  performanceHelpers,
  testPatterns,
}
