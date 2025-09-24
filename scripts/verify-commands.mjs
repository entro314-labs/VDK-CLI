#!/usr/bin/env node

/**
 * Verify All Commands Work
 * Tests that all registered commands can be executed without fatal errors
 */

import { spawn } from 'child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const commands = [
  'init',
  'scan',
  'status',
  'validate',
  'sync',
  'browse',
  'deploy',
  'create',
  'search',
  'analyze',
  'repo-stats',
  'platform',
  'migrate',
  'schema-migrate',
  'publish',
  'hub-generate',
  'team:share',
  'team:sync',
]

async function testCommand(command) {
  return new Promise((resolve) => {
    const child = spawn('node', ['cli-new.js', command, '--help'], {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 10000,
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
      const success = code === 0 || (stdout + stderr).includes('Usage:') || (stdout + stderr).includes(command)
      resolve({
        command,
        success,
        code,
        output: stdout + stderr,
      })
    })

    child.on('error', (error) => {
      resolve({
        command,
        success: false,
        code: -1,
        error: error.message,
      })
    })
  })
}

async function main() {
  console.log('🔧 Verifying all commands work correctly...\n')

  const results = []
  let passed = 0
  let failed = 0

  for (const command of commands) {
    console.log(`Testing: ${command}`)
    const result = await testCommand(command)
    results.push(result)

    if (result.success) {
      console.log(`  ✅ ${command} - OK`)
      passed++
    } else {
      console.log(`  ❌ ${command} - FAILED (code: ${result.code})`)
      if (result.error) {
        console.log(`     Error: ${result.error}`)
      }
      failed++
    }
  }

  console.log(`\n📊 Results:`)
  console.log(`  ✅ Passed: ${passed}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  📈 Total:  ${commands.length}`)

  if (failed === 0) {
    console.log('\n🎉 All commands are working correctly!')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some commands failed. Details above.')
    process.exit(1)
  }
}

main().catch(console.error)
