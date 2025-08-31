/**
 * CLI Schema Migrate Command Tests
 * Tests blueprint schema migration functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('CLI Schema Migrate Command', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `schema-migrate-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('V1 to V2.1.0 Schema Migration', () => {
    it('should migrate single v1 blueprint to v2.1.0 schema', async () => {
      await setupV1Blueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--from', '1.0', '--to', '2.1.0'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Successfully migrated 1 blueprint/)
      expect(result.stdout).toMatch(/Updated schema version: 2\.1\.0/)

      // Verify the migrated blueprint
      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'test-blueprint.json'), 'utf-8')
      )
      expect(blueprint.schema_version).toBe('2.1.0')
      expect(blueprint.platforms).toBeDefined()
      expect(blueprint.platforms['claude-code']).toBeDefined()
    })

    it('should migrate multiple v1 blueprints in batch', async () => {
      await setupMultipleV1Blueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--batch', '--to', '2.1.0'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Successfully migrated 3 blueprints/)

      // Verify all blueprints were migrated
      const blueprintFiles = await fs.readdir(path.join(tempDir, '.vdk', 'blueprints'))
      expect(blueprintFiles).toHaveLength(3)

      for (const file of blueprintFiles) {
        const blueprint = JSON.parse(await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', file), 'utf-8'))
        expect(blueprint.schema_version).toBe('2.1.0')
      }
    })

    it('should migrate legacy platform configurations', async () => {
      await setupLegacyPlatformBlueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--preserve-legacy'])

      expect(result.exitCode).toBe(0)

      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'legacy-blueprint.json'), 'utf-8')
      )

      // Check that legacy platforms were properly migrated
      expect(blueprint.platforms.cursor).toBeDefined()
      expect(blueprint.platforms.cursor.compatible).toBe(true)
      expect(blueprint.platforms.cursor.activation).toBe('auto-attached')

      expect(blueprint.platforms.vscode).toBeDefined()
      expect(blueprint.platforms.vscode.compatible).toBe(true)
      expect(blueprint.platforms.vscode.extension).toBeDefined()
    })

    it('should handle complex nested schema transformations', async () => {
      await setupComplexV1Blueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--validate-output'])

      expect(result.exitCode).toBe(0)

      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'complex-blueprint.json'), 'utf-8')
      )

      // Verify complex transformations
      expect(blueprint.metadata).toBeDefined()
      expect(blueprint.metadata.tags).toContain('migrated')
      expect(blueprint.metadata.compatibility).toBeDefined()
      expect(blueprint.dependencies).toBeDefined()
      expect(blueprint.hooks).toBeDefined()
    })
  })

  describe('Backup and Rollback Functionality', () => {
    it('should create backup before migration', async () => {
      await setupV1Blueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--backup'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Backup created:/)

      // Verify backup exists
      const backupDir = path.join(tempDir, '.vdk', 'backups', 'schema-migration')
      const backupExists = await fs
        .access(backupDir)
        .then(() => true)
        .catch(() => false)
      expect(backupExists).toBe(true)

      const backupFiles = await fs.readdir(backupDir)
      expect(backupFiles.length).toBeGreaterThan(0)
      expect(backupFiles.some((f) => f.includes('test-blueprint'))).toBe(true)
    })

    it('should rollback migration on validation failure', async () => {
      await setupInvalidV1Blueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--validate', '--auto-rollback'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Validation failed/)
      expect(result.stdout).toMatch(/Rolling back changes/)

      // Verify original file is restored
      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'invalid-blueprint.json'), 'utf-8')
      )
      expect(blueprint.schema_version).toBe('1.0') // Should be back to original
    })

    it('should allow manual rollback to specific backup', async () => {
      await setupV1Blueprint(tempDir)

      // Create migration with backup
      await runCliCommand(['schema-migrate', '--backup'])

      // Get backup ID
      const backups = await runCliCommand(['schema-migrate', '--list-backups'])
      const backupId = extractBackupId(backups.stdout)

      // Rollback to specific backup
      const rollback = await runCliCommand(['schema-migrate', '--rollback', backupId])

      expect(rollback.exitCode).toBe(0)
      expect(rollback.stdout).toMatch(/Successfully rolled back to backup/)

      // Verify rollback worked
      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'test-blueprint.json'), 'utf-8')
      )
      expect(blueprint.schema_version).toBe('1.0')
    })
  })

  describe('Migration Error Handling', () => {
    it('should handle corrupted blueprint files gracefully', async () => {
      await setupCorruptedBlueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--skip-errors'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Skipped \d+ corrupted files/)
      expect(result.stderr).toMatch(/Warning: Could not parse/)

      // Verify good files were still processed
      expect(result.stdout).toMatch(/Successfully migrated \d+ blueprints/)
    })

    it('should validate schema compliance during migration', async () => {
      await setupV1Blueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--strict-validation'])

      expect(result.exitCode).toBe(0)

      // Run validation after migration
      const validation = await runCliCommand(['validate', '--schema', '2.1.0'])
      expect(validation.exitCode).toBe(0)
      expect(validation.stdout).toMatch(/All blueprints are schema-compliant/)
    })

    it('should handle partial migration failures', async () => {
      await setupMixedValidityBlueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--partial-ok'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Partial migration completed/)
      expect(result.stdout).toMatch(/Success: \d+, Failed: \d+/)

      // Verify migration log
      const logFile = path.join(tempDir, '.vdk', 'migration.log')
      const logContent = await fs.readFile(logFile, 'utf-8')
      expect(logContent).toMatch(/PARTIAL_SUCCESS/)
      expect(logContent).toMatch(/Failed files:/)
    })

    it('should handle schema version conflicts', async () => {
      await setupConflictingSchemaVersions(tempDir)

      const result = await runCliCommand(['schema-migrate', '--resolve-conflicts', 'prompt'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Conflicts resolved/)

      // All blueprints should now have consistent schema version
      const blueprintFiles = await fs.readdir(path.join(tempDir, '.vdk', 'blueprints'))
      for (const file of blueprintFiles) {
        const blueprint = JSON.parse(await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', file), 'utf-8'))
        expect(blueprint.schema_version).toBe('2.1.0')
      }
    })
  })

  describe('Advanced Migration Features', () => {
    it('should perform incremental schema migrations', async () => {
      await setupMultiVersionBlueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--incremental', '--target', '2.1.0'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Incremental migration path:/)
      expect(result.stdout).toMatch(/1\.0 → 1\.5 → 2\.0 → 2\.1\.0/)

      // Verify all intermediate transformations were applied
      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'multi-version.json'), 'utf-8')
      )
      expect(blueprint.schema_version).toBe('2.1.0')
      expect(blueprint.migration_history).toBeDefined()
      expect(blueprint.migration_history).toHaveLength(3) // Three migration steps
    })

    it('should support custom migration rules', async () => {
      await setupCustomMigrationRules(tempDir)
      await setupV1Blueprint(tempDir)

      const result = await runCliCommand(['schema-migrate', '--custom-rules', '.vdk/migration-rules.json'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Applied custom migration rules/)

      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'test-blueprint.json'), 'utf-8')
      )
      expect(blueprint.custom_field).toBe('custom_value') // Custom rule applied
      expect(blueprint.platforms['custom-platform']).toBeDefined()
    })

    it('should generate migration reports', async () => {
      await setupMultipleV1Blueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--generate-report', '--format', 'json'])

      expect(result.exitCode).toBe(0)

      const reportFile = path.join(tempDir, '.vdk', 'migration-report.json')
      const reportExists = await fs
        .access(reportFile)
        .then(() => true)
        .catch(() => false)
      expect(reportExists).toBe(true)

      const report = JSON.parse(await fs.readFile(reportFile, 'utf-8'))
      expect(report.summary).toBeDefined()
      expect(report.summary.total_blueprints).toBe(3)
      expect(report.summary.successful_migrations).toBe(3)
      expect(report.detailed_results).toHaveLength(3)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large numbers of blueprints efficiently', async () => {
      await setupLargeNumberOfBlueprints(tempDir, 50)

      const startTime = Date.now()
      const result = await runCliCommand(['schema-migrate', '--parallel', '5'])
      const duration = Date.now() - startTime

      expect(result.exitCode).toBe(0)
      expect(duration).toBeLessThan(20000) // Should complete in under 20 seconds
      expect(result.stdout).toMatch(/Successfully migrated 50 blueprints/)
      expect(result.stdout).toMatch(/Parallel processing: 5 workers/)
    })

    it('should handle memory-intensive migrations', async () => {
      await setupLargeBlueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--memory-limit', '256MB'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Memory usage within limits/)
    })

    it('should support streaming migration for very large datasets', async () => {
      await setupVeryLargeDataset(tempDir, 200)

      const result = await runCliCommand(['schema-migrate', '--stream', '--chunk-size', '10'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Streaming migration completed/)
      expect(result.stdout).toMatch(/Processed in \d+ chunks/)
    })
  })

  describe('Schema Version Detection and Compatibility', () => {
    it('should auto-detect schema versions in mixed environments', async () => {
      await setupMixedSchemaVersions(tempDir)

      const result = await runCliCommand(['schema-migrate', '--auto-detect', '--dry-run'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Detected schema versions:/)
      expect(result.stdout).toMatch(/v1\.0: \d+ blueprints/)
      expect(result.stdout).toMatch(/v1\.5: \d+ blueprints/)
      expect(result.stdout).toMatch(/v2\.0: \d+ blueprints/)
    })

    it('should validate cross-platform compatibility after migration', async () => {
      await setupCrossPlatformBlueprints(tempDir)

      const result = await runCliCommand(['schema-migrate', '--validate-platforms'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Platform compatibility validated/)

      // Check that all platforms are properly configured
      const blueprint = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'blueprints', 'cross-platform.json'), 'utf-8')
      )
      expect(Object.keys(blueprint.platforms)).toHaveLength(5)

      for (const platform of Object.values(blueprint.platforms)) {
        expect(platform.compatible).toBeDefined()
        expect(typeof platform.compatible).toBe('boolean')
      }
    })
  })
})

// Helper functions for test setup

async function setupV1Blueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const v1Blueprint = {
    schema_version: '1.0',
    id: 'test-blueprint',
    title: 'Test Blueprint',
    description: 'A test blueprint for migration',
    target_ides: ['cursor', 'vscode'],
    rules: ['Use TypeScript', 'Prefer functional components'],
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'test-blueprint.json'), JSON.stringify(v1Blueprint, null, 2))
}

async function setupMultipleV1Blueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  for (let i = 1; i <= 3; i++) {
    const blueprint = {
      schema_version: '1.0',
      id: `blueprint-${i}`,
      title: `Blueprint ${i}`,
      description: `Test blueprint ${i}`,
      target_ides: ['cursor'],
      rules: [`Rule ${i}`],
      version: '1.0.0',
    }

    await fs.writeFile(path.join(blueprintsDir, `blueprint-${i}.json`), JSON.stringify(blueprint, null, 2))
  }
}

async function setupLegacyPlatformBlueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const legacyBlueprint = {
    schema_version: '1.0',
    id: 'legacy-blueprint',
    title: 'Legacy Platform Blueprint',
    description: 'Blueprint with legacy platform configurations',
    target_ides: ['cursor', 'vscode', 'jetbrains'],
    cursor_config: {
      activation: 'auto-attached',
      priority: 'high',
    },
    vscode_config: {
      extension: 'ai-assistant',
      workspace: true,
    },
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'legacy-blueprint.json'), JSON.stringify(legacyBlueprint, null, 2))
}

async function setupComplexV1Blueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const complexBlueprint = {
    schema_version: '1.0',
    id: 'complex-blueprint',
    title: 'Complex Blueprint',
    description: 'Complex blueprint with nested structures',
    target_ides: ['cursor', 'claude'],
    nested_config: {
      deep: {
        structure: {
          value: 'test',
        },
      },
    },
    array_config: [
      { type: 'rule', value: 'Use TypeScript' },
      { type: 'setting', value: 'strict mode' },
    ],
    conditional_rules: {
      if_react: ['Use hooks', 'Prefer functional components'],
      if_node: ['Use Express', 'Handle errors properly'],
    },
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'complex-blueprint.json'), JSON.stringify(complexBlueprint, null, 2))
}

async function setupInvalidV1Blueprint(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const invalidBlueprint = {
    schema_version: '1.0',
    // Missing required fields
    id: 'invalid-blueprint',
    // Invalid field type
    target_ides: 'should-be-array',
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'invalid-blueprint.json'), JSON.stringify(invalidBlueprint, null, 2))
}

async function setupCorruptedBlueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  // Good blueprint
  await setupV1Blueprint(tempDir)

  // Corrupted JSON
  await fs.writeFile(path.join(blueprintsDir, 'corrupted.json'), '{ invalid json }')

  // Binary file
  await fs.writeFile(path.join(blueprintsDir, 'binary.json'), Buffer.from([0x00, 0x01, 0x02]))
}

async function setupMixedValidityBlueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  // Valid blueprint
  await setupV1Blueprint(tempDir)

  // Invalid blueprint
  await setupInvalidV1Blueprint(tempDir)

  // Another valid blueprint
  const validBlueprint = {
    schema_version: '1.0',
    id: 'valid-blueprint-2',
    title: 'Valid Blueprint 2',
    description: 'Another valid blueprint',
    target_ides: ['cursor'],
    rules: ['Valid rule'],
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'valid-blueprint-2.json'), JSON.stringify(validBlueprint, null, 2))
}

async function setupConflictingSchemaVersions(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const versions = ['1.0', '1.5', '2.0']
  for (let i = 0; i < versions.length; i++) {
    const blueprint = {
      schema_version: versions[i],
      id: `blueprint-${versions[i]}`,
      title: `Blueprint ${versions[i]}`,
      description: `Blueprint with schema ${versions[i]}`,
      target_ides: ['cursor'],
      version: '1.0.0',
    }

    await fs.writeFile(path.join(blueprintsDir, `blueprint-${versions[i]}.json`), JSON.stringify(blueprint, null, 2))
  }
}

async function setupMultiVersionBlueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const multiVersionBlueprint = {
    schema_version: '1.0',
    id: 'multi-version',
    title: 'Multi Version Blueprint',
    description: 'Blueprint that needs multiple migration steps',
    target_ides: ['cursor'],
    legacy_fields: {
      old_config: 'value',
      deprecated_setting: true,
    },
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'multi-version.json'), JSON.stringify(multiVersionBlueprint, null, 2))
}

async function setupCustomMigrationRules(tempDir) {
  const vdkDir = path.join(tempDir, '.vdk')
  await fs.mkdir(vdkDir, { recursive: true })

  const customRules = {
    version: '1.0',
    rules: [
      {
        from_version: '1.0',
        to_version: '2.1.0',
        transformations: [
          {
            action: 'add_field',
            field: 'custom_field',
            value: 'custom_value',
          },
          {
            action: 'add_platform',
            platform: 'custom-platform',
            config: { compatible: true },
          },
        ],
      },
    ],
  }

  await fs.writeFile(path.join(vdkDir, 'migration-rules.json'), JSON.stringify(customRules, null, 2))
}

async function setupLargeNumberOfBlueprints(tempDir, count) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  for (let i = 1; i <= count; i++) {
    const blueprint = {
      schema_version: '1.0',
      id: `blueprint-${i}`,
      title: `Blueprint ${i}`,
      description: `Test blueprint ${i}`,
      target_ides: ['cursor'],
      rules: [`Rule ${i}`],
      version: '1.0.0',
    }

    await fs.writeFile(path.join(blueprintsDir, `blueprint-${i}.json`), JSON.stringify(blueprint, null, 2))
  }
}

async function setupLargeBlueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const largeBlueprint = {
    schema_version: '1.0',
    id: 'large-blueprint',
    title: 'Large Blueprint',
    description: 'Blueprint with large amount of data',
    target_ides: ['cursor'],
    rules: Array.from({ length: 1000 }, (_, i) => `Rule ${i}`),
    large_config: Array.from({ length: 500 }, (_, i) => ({
      key: `key-${i}`,
      value: `value-${i}`,
      nested: { deep: `deep-value-${i}` },
    })),
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'large-blueprint.json'), JSON.stringify(largeBlueprint, null, 2))
}

async function setupVeryLargeDataset(tempDir, count) {
  await setupLargeNumberOfBlueprints(tempDir, count)
}

async function setupMixedSchemaVersions(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const versions = [
    { version: '1.0', count: 3 },
    { version: '1.5', count: 2 },
    { version: '2.0', count: 1 },
  ]

  for (const { version, count } of versions) {
    for (let i = 1; i <= count; i++) {
      const blueprint = {
        schema_version: version,
        id: `blueprint-${version}-${i}`,
        title: `Blueprint ${version} ${i}`,
        description: `Blueprint with schema ${version}`,
        target_ides: ['cursor'],
        version: '1.0.0',
      }

      await fs.writeFile(path.join(blueprintsDir, `blueprint-${version}-${i}.json`), JSON.stringify(blueprint, null, 2))
    }
  }
}

async function setupCrossPlatformBlueprints(tempDir) {
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const crossPlatformBlueprint = {
    schema_version: '1.0',
    id: 'cross-platform',
    title: 'Cross Platform Blueprint',
    description: 'Blueprint for multiple platforms',
    target_ides: ['cursor', 'vscode', 'jetbrains', 'claude', 'windsurf'],
    platform_specific: {
      cursor: { priority: 'high' },
      vscode: { extension: 'ai-assistant' },
      jetbrains: { plugin: 'ai-plugin' },
      claude: { memory: true },
      windsurf: { mode: 'workspace' },
    },
    version: '1.0.0',
  }

  await fs.writeFile(path.join(blueprintsDir, 'cross-platform.json'), JSON.stringify(crossPlatformBlueprint, null, 2))
}

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli-new.js')

  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
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
  })
}

function extractBackupId(output) {
  const match = output.match(/Backup ID: ([a-f0-9-]+)/)
  return match ? match[1] : null
}
