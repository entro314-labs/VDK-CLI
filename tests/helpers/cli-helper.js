/**
 * CLI Test Helper
 * Shared utilities for testing CLI functionality
 */
import { spawn } from 'node:child_process'
import path from 'node:path'

const cliPath = path.join(global.TEST_ROOT, 'cli-new.js')

/**
 * Execute CLI command with arguments
 */
export function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: options.cwd || global.TEST_ROOT,
      stdio: 'pipe',
      timeout: options.timeout || 30000,
      env: { ...process.env, ...options.env },
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
        success: code === 0,
      })
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Create temporary test directory
 */
export async function createTempDir(name = 'test-temp') {
  const fs = await import('node:fs/promises')
  const tempPath = path.join(global.TEST_ROOT, name)

  try {
    await fs.mkdir(tempPath, { recursive: true })
    return tempPath
  } catch (error) {
    throw new Error(`Failed to create temp directory: ${error.message}`)
  }
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dirPath) {
  const fs = await import('node:fs/promises')

  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch (_error) {
    // Ignore cleanup errors
  }
}
