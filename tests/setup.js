/**
 * Test Setup - Global configuration for all tests
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Set up global test environment
global.TEST_ROOT = path.dirname(__dirname)
global.TEST_TIMEOUT = 30000

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test'
process.env.VDK_TEST_MODE = 'true'

// Cleanup helper for temp files
global.afterEach(() => {
  // Clear any test-specific environment variables
  process.env.TEST_PROJECT_PATH = undefined
})
