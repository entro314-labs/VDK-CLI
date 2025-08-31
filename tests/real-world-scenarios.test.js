/**
 * Real World CLI Scenarios Tests
 * Tests complex real-world usage patterns and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Real World CLI Scenarios', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `real-world-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Complex Multi-IDE Project Migration', () => {
    it('should migrate enterprise project with multiple IDE configurations', async () => {
      await setupEnterpriseProject(tempDir)

      const result = await runCliCommand([
        'migrate',
        '--detect-all',
        '--enterprise-mode',
        '--preserve-team-configs',
        '--backup',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Enterprise migration completed/)
      expect(result.stdout).toMatch(/Detected configurations:/)
      expect(result.stdout).toMatch(/- Cursor: 15 rules/)
      expect(result.stdout).toMatch(/- VS Code: 8 workspace configs/)
      expect(result.stdout).toMatch(/- JetBrains: 12 templates/)
      expect(result.stdout).toMatch(/- Claude Code CLI: 5 memory files/)

      // Verify enterprise-specific outputs
      const teamConfig = await fs.readFile(path.join(tempDir, '.claude', 'TEAM.md'), 'utf-8')
      expect(teamConfig).toContain('Team Development Standards')
      expect(teamConfig).toContain('Enterprise Security Guidelines')

      const individualConfig = await fs.readFile(path.join(tempDir, '.claude', 'CLAUDE.md'), 'utf-8')
      expect(individualConfig).toContain('Personal AI Assistant Configuration')
    })

    it('should handle legacy project with deprecated IDE configurations', async () => {
      await setupLegacyProject(tempDir)

      const result = await runCliCommand([
        'migrate',
        '--from-legacy',
        '--update-deprecated',
        '--compatibility-mode',
        'strict',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Legacy migration completed/)
      expect(result.stdout).toMatch(/Deprecated configurations updated:/)
      expect(result.stdout).toMatch(/- Old Cursor format → New format/)
      expect(result.stdout).toMatch(/- Legacy VS Code settings → Modern workspace/)
      expect(result.stdout).toMatch(/- Outdated Claude Code CLI rules → Current schema/)

      // Verify compatibility warnings
      expect(result.stderr).toMatch(/Warning: Some configurations may need manual review/)
    })

    it('should migrate complex monorepo with per-package configurations', async () => {
      await setupMonorepoProject(tempDir)

      const result = await runCliCommand([
        'migrate',
        '--monorepo-mode',
        '--per-package-config',
        '--merge-strategy',
        'smart',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Monorepo migration completed/)
      expect(result.stdout).toMatch(/Packages processed: 8/)

      // Verify per-package configurations
      const frontendConfig = await fs.readFile(
        path.join(tempDir, 'packages', 'frontend', '.claude', 'CLAUDE.md'),
        'utf-8'
      )
      expect(frontendConfig).toContain('React Frontend Configuration')

      const backendConfig = await fs.readFile(
        path.join(tempDir, 'packages', 'backend', '.claude', 'CLAUDE.md'),
        'utf-8'
      )
      expect(backendConfig).toContain('Node.js Backend Configuration')

      // Verify root configuration merges package-specific rules
      const rootConfig = await fs.readFile(path.join(tempDir, '.claude', 'CLAUDE.md'), 'utf-8')
      expect(rootConfig).toContain('Monorepo Development Guidelines')
      expect(rootConfig).toContain('Cross-package Dependencies')
    })

    it('should handle conflicting team member IDE preferences', async () => {
      await setupTeamConflictProject(tempDir)

      const result = await runCliCommand([
        'migrate',
        '--team-mode',
        '--resolve-conflicts',
        'democratic',
        '--generate-team-report',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Team migration completed/)
      expect(result.stdout).toMatch(/Conflict resolution: Democratic voting/)
      expect(result.stdout).toMatch(/Team preferences applied:/)
      expect(result.stdout).toMatch(/- Code style: Prettier \(3 votes\)/)
      expect(result.stdout).toMatch(/- Test framework: Jest \(4 votes\)/)
      expect(result.stdout).toMatch(/- Indentation: 2 spaces \(5 votes\)/)

      // Verify team report was generated
      const teamReport = await fs.readFile(path.join(tempDir, '.vdk', 'team-migration-report.md'), 'utf-8')
      expect(teamReport).toContain('## Team Migration Summary')
      expect(teamReport).toContain('## Individual Preferences')
      expect(teamReport).toContain('## Final Consensus')
    })
  })

  describe('Community Blueprint Deployment and Customization', () => {
    it('should deploy and customize community blueprint for specific tech stack', async () => {
      await setupProjectWithTechStack(tempDir, 'react-typescript')

      const result = await runCliCommand([
        'deploy',
        '--blueprint',
        'react-dashboard-pro',
        '--customize-for-project',
        '--auto-adapt',
        '--install-dependencies',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Community blueprint deployed/)
      expect(result.stdout).toMatch(/Customization applied for React TypeScript/)
      expect(result.stdout).toMatch(/Dependencies installed: 12 packages/)

      // Verify customized configuration
      const claudeConfig = await fs.readFile(path.join(tempDir, '.claude', 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('React Dashboard Development')
      expect(claudeConfig).toContain('TypeScript best practices')
      expect(claudeConfig).toContain('Dashboard-specific patterns')

      // Verify project-specific adaptations
      expect(claudeConfig).toContain('Existing React version: 18.2.0')
      expect(claudeConfig).toContain('TypeScript strict mode: enabled')
    })

    it('should handle blueprint deployment with dependency conflicts', async () => {
      await setupProjectWithConflictingDeps(tempDir)

      const result = await runCliCommand([
        'deploy',
        '--blueprint',
        'node-api-starter',
        '--resolve-dependencies',
        '--conflict-strategy',
        'latest-compatible',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Blueprint deployed with dependency resolution/)
      expect(result.stdout).toMatch(/Conflicts resolved:/)
      expect(result.stdout).toMatch(/- express: 4\.17\.1 → 4\.18\.2 \(latest compatible\)/)
      expect(result.stdout).toMatch(/- lodash: 4\.17\.20 → 4\.17\.21 \(security update\)/)

      // Verify updated package.json
      const packageJson = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8'))
      expect(packageJson.dependencies.express).toBe('^4.18.2')
      expect(packageJson.dependencies.lodash).toBe('^4.17.21')
    })

    it('should customize blueprint for multiple team members', async () => {
      await setupTeamProject(tempDir)

      const result = await runCliCommand([
        'deploy',
        '--blueprint',
        'fullstack-team-template',
        '--team-customization',
        '--role-based-config',
        '--members',
        'frontend-dev,backend-dev,devops,tester',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Team customization completed/)
      expect(result.stdout).toMatch(/Role-based configurations created:/)

      // Verify role-specific configurations
      const frontendConfig = await fs.readFile(path.join(tempDir, '.claude', 'roles', 'frontend-dev.md'), 'utf-8')
      expect(frontendConfig).toContain('Frontend Development Guidelines')
      expect(frontendConfig).toContain('React component patterns')

      const backendConfig = await fs.readFile(path.join(tempDir, '.claude', 'roles', 'backend-dev.md'), 'utf-8')
      expect(backendConfig).toContain('Backend API Development')
      expect(backendConfig).toContain('Database design patterns')

      const devopsConfig = await fs.readFile(path.join(tempDir, '.claude', 'roles', 'devops.md'), 'utf-8')
      expect(devopsConfig).toContain('Infrastructure and Deployment')
      expect(devopsConfig).toContain('CI/CD pipeline management')
    })

    it('should deploy blueprint with environment-specific configurations', async () => {
      await setupMultiEnvironmentProject(tempDir)

      const result = await runCliCommand([
        'deploy',
        '--blueprint',
        'microservices-platform',
        '--environments',
        'development,staging,production',
        '--config-per-env',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Multi-environment deployment completed/)

      // Verify environment-specific configs
      const devConfig = await fs.readFile(path.join(tempDir, '.claude', 'environments', 'development.md'), 'utf-8')
      expect(devConfig).toContain('Development Environment')
      expect(devConfig).toContain('Debug logging enabled')
      expect(devConfig).toContain('Hot reload configuration')

      const prodConfig = await fs.readFile(path.join(tempDir, '.claude', 'environments', 'production.md'), 'utf-8')
      expect(prodConfig).toContain('Production Environment')
      expect(prodConfig).toContain('Performance monitoring')
      expect(prodConfig).toContain('Error tracking and alerts')
    })
  })

  describe('Hub Offline Scenarios and Resilience', () => {
    it('should handle complete hub offline scenario gracefully', async () => {
      await setupOfflineScenario(tempDir)

      const result = await runCliCommand([
        'hub',
        'deploy',
        '--blueprint',
        'react-starter',
        '--offline-mode',
        '--use-cache',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Hub offline - using cached resources/)
      expect(result.stdout).toMatch(/Cached blueprint found: react-starter/)
      expect(result.stdout).toMatch(/Deployment completed in offline mode/)

      // Verify offline deployment worked
      const claudeConfig = await fs.readFile(path.join(tempDir, '.claude', 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).toContain('React Starter Template')
      expect(claudeConfig).toContain('Deployed from cache')
    })

    it('should sync changes when hub comes back online', async () => {
      await setupOfflineChanges(tempDir)

      const result = await runCliCommand(['hub', 'sync', '--when-online', '--upload-pending', '--download-updates'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Hub connection restored/)
      expect(result.stdout).toMatch(/Syncing offline changes.../)
      expect(result.stdout).toMatch(/Uploaded: 3 pending deployments/)
      expect(result.stdout).toMatch(/Downloaded: 2 blueprint updates/)
      expect(result.stdout).toMatch(/Sync completed successfully/)
    })

    it('should handle partial hub connectivity with degraded features', async () => {
      await setupPartialConnectivityScenario(tempDir)

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        'Simple React app',
        '--degraded-mode',
        '--local-fallback',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Hub partially available - using degraded mode/)
      expect(result.stdout).toMatch(/AI generation service: Offline/)
      expect(result.stdout).toMatch(/Blueprint repository: Online/)
      expect(result.stdout).toMatch(/Falling back to local template generation/)

      // Should still produce output, just with limited features
      expect(result.stdout).toMatch(/Package generated with basic template/)
    })

    it('should queue operations for later sync when hub is unavailable', async () => {
      await setupOperationQueueScenario(tempDir)

      const result = await runCliCommand([
        'publish',
        '--blueprint',
        'my-custom-blueprint',
        '--queue-when-offline',
        '--auto-retry',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Hub unavailable - operation queued/)
      expect(result.stdout).toMatch(/Queue position: 1/)
      expect(result.stdout).toMatch(/Will retry automatically when online/)

      // Verify queue file was created
      const queueFile = path.join(tempDir, '.vdk', 'queue', 'pending-operations.json')
      const queueExists = await fs
        .access(queueFile)
        .then(() => true)
        .catch(() => false)
      expect(queueExists).toBe(true)

      const queue = JSON.parse(await fs.readFile(queueFile, 'utf-8'))
      expect(queue.operations).toHaveLength(1)
      expect(queue.operations[0].operation).toBe('publish')
      expect(queue.operations[0].blueprint).toBe('my-custom-blueprint')
    })
  })

  describe('Data Integrity and State Management', () => {
    it('should maintain data integrity during complex workflow', async () => {
      await setupComplexWorkflow(tempDir)

      const result = await runCliCommand([
        'workflow',
        '--migrate-from',
        'cursor',
        '--deploy-blueprint',
        'enterprise-template',
        '--customize',
        '--publish-custom',
        '--integrity-checks',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Complex workflow completed/)
      expect(result.stdout).toMatch(/Integrity checks: All passed/)

      // Verify each step maintained integrity
      expect(result.stdout).toMatch(/✓ Migration integrity verified/)
      expect(result.stdout).toMatch(/✓ Deployment integrity verified/)
      expect(result.stdout).toMatch(/✓ Customization integrity verified/)
      expect(result.stdout).toMatch(/✓ Publication integrity verified/)

      // Verify final state is consistent
      const integrityReport = await fs.readFile(path.join(tempDir, '.vdk', 'integrity-report.json'), 'utf-8')
      const report = JSON.parse(integrityReport)
      expect(report.overall_status).toBe('PASSED')
      expect(report.step_results.every((step) => step.status === 'PASSED')).toBe(true)
    })

    it('should recover gracefully from interrupted operations', async () => {
      await setupInterruptedOperation(tempDir)

      const result = await runCliCommand([
        'recover',
        '--from-checkpoint',
        '--operation-id',
        'interrupted-deploy-12345',
        '--continue',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Recovery initiated from checkpoint/)
      expect(result.stdout).toMatch(/Resuming at step: Blueprint customization/)
      expect(result.stdout).toMatch(/Operation completed successfully/)

      // Verify operation was completed
      const operationLog = await fs.readFile(
        path.join(tempDir, '.vdk', 'operations', 'interrupted-deploy-12345.log'),
        'utf-8'
      )
      expect(operationLog).toMatch(/COMPLETED/)
      expect(operationLog).toMatch(/Recovered from interruption/)
    })

    it('should handle concurrent operations safely', async () => {
      await setupConcurrentOperations(tempDir)

      // Start multiple operations concurrently
      const operations = [
        runCliCommand(['migrate', '--from', 'cursor', '--id', 'op1']),
        runCliCommand(['deploy', '--blueprint', 'template1', '--id', 'op2']),
        runCliCommand(['publish', '--blueprint', 'custom1', '--id', 'op3']),
      ]

      const results = await Promise.all(operations)

      // All operations should complete successfully
      results.forEach((result, index) => {
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toMatch(/Operation completed/)
        expect(result.stdout).toMatch(new RegExp(`Operation ID: op${index + 1}`))
      })

      // Verify no data corruption occurred
      const stateFile = await fs.readFile(path.join(tempDir, '.vdk', 'state.json'), 'utf-8')
      const state = JSON.parse(stateFile)
      expect(state.concurrent_operations_completed).toBe(3)
      expect(state.integrity_maintained).toBe(true)
    })

    it('should validate and repair corrupted configurations', async () => {
      await setupCorruptedConfigurations(tempDir)

      const result = await runCliCommand(['repair', '--scan-corruption', '--auto-fix', '--create-backup'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Configuration scan completed/)
      expect(result.stdout).toMatch(/Corruption detected in 3 files/)
      expect(result.stdout).toMatch(/Auto-repair completed for 2 files/)
      expect(result.stdout).toMatch(/Manual review required for 1 file/)

      // Verify repairs were made
      const claudeConfig = await fs.readFile(path.join(tempDir, '.claude', 'CLAUDE.md'), 'utf-8')
      expect(claudeConfig).not.toContain('\x00') // No null bytes
      expect(claudeConfig).toMatch(/^# .+ Claude Code CLI Memory$/) // Valid header

      // Verify backup was created
      const backupExists = await fs
        .access(path.join(tempDir, '.vdk', 'repair-backups'))
        .then(() => true)
        .catch(() => false)
      expect(backupExists).toBe(true)
    })
  })

  describe('Performance Under Load and Scale', () => {
    it('should handle large-scale enterprise deployment efficiently', async () => {
      await setupLargeScaleProject(tempDir)

      const startTime = Date.now()
      const result = await runCliCommand([
        'deploy',
        '--blueprint',
        'enterprise-microservices',
        '--scale',
        'large',
        '--services',
        '50',
        '--parallel-processing',
      ])
      const duration = Date.now() - startTime

      expect(result.exitCode).toBe(0)
      expect(duration).toBeLessThan(60000) // Should complete in under 60 seconds
      expect(result.stdout).toMatch(/Large-scale deployment completed/)
      expect(result.stdout).toMatch(/Services deployed: 50/)
      expect(result.stdout).toMatch(/Parallel workers: \d+/)
      expect(result.stdout).toMatch(/Total processing time: \d+\.\d+s/)
    })

    it('should manage memory efficiently during bulk operations', async () => {
      await setupBulkOperationData(tempDir)

      const result = await runCliCommand([
        'bulk-migrate',
        '--source-dir',
        'legacy-configs',
        '--batch-size',
        '20',
        '--memory-limit',
        '512MB',
        '--streaming',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Bulk migration completed/)
      expect(result.stdout).toMatch(/Files processed: 200/)
      expect(result.stdout).toMatch(/Memory usage stayed within limits/)
      expect(result.stdout).toMatch(/Peak memory: \d+MB \(< 512MB\)/)
    })

    it('should optimize performance for frequently accessed operations', async () => {
      await setupPerformanceTestData(tempDir)

      // Run the same operation multiple times to test caching
      const runs = []
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now()
        const result = await runCliCommand(['deploy', '--blueprint', 'cached-template', '--use-cache'])
        const duration = Date.now() - startTime
        runs.push({ result, duration })
      }

      // First run should be slower, subsequent runs should be much faster
      expect(runs[0].duration).toBeGreaterThan(1000) // First run > 1 second
      expect(runs[4].duration).toBeLessThan(200) // Last run < 200ms

      // All runs should succeed
      runs.forEach((run) => {
        expect(run.result.exitCode).toBe(0)
        expect(run.result.stdout).toMatch(/Deployment completed/)
      })
    })
  })
})

// Helper functions for test setup

async function setupEnterpriseProject(tempDir) {
  // Create complex enterprise project structure
  await fs.mkdir(path.join(tempDir, '.cursor', 'rules'), { recursive: true })
  await fs.mkdir(path.join(tempDir, '.vscode'), { recursive: true })
  await fs.mkdir(path.join(tempDir, '.idea'), { recursive: true })
  await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true })

  // Cursor configurations
  for (let i = 1; i <= 15; i++) {
    await fs.writeFile(
      path.join(tempDir, '.cursor', 'rules', `rule-${i}.md`),
      `# Enterprise Rule ${i}\nRule content for ${i}`
    )
  }

  // VS Code workspace settings
  for (let i = 1; i <= 8; i++) {
    await fs.writeFile(
      path.join(tempDir, '.vscode', `workspace-${i}.json`),
      JSON.stringify({ settings: { [`config${i}`]: `value${i}` } }, null, 2)
    )
  }

  // JetBrains templates
  await fs.mkdir(path.join(tempDir, '.idea', 'fileTemplates'), { recursive: true })
  for (let i = 1; i <= 12; i++) {
    await fs.writeFile(
      path.join(tempDir, '.idea', 'fileTemplates', `template-${i}.java`),
      `// Template ${i}\npublic class Template${i} {}`
    )
  }

  // Claude Code CLI memory files
  for (let i = 1; i <= 5; i++) {
    await fs.writeFile(
      path.join(tempDir, '.claude', `memory-${i}.md`),
      `# Memory ${i}\nClaude Code CLI memory content ${i}`
    )
  }
}

async function setupLegacyProject(tempDir) {
  // Old format Cursor rules
  await fs.mkdir(path.join(tempDir, '.cursor'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.cursor', 'rules.txt'), 'Old format cursor rules')

  // Deprecated VS Code settings
  await fs.mkdir(path.join(tempDir, '.vscode'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.vscode', 'settings.json'), '{"deprecated.setting": true}')

  // Outdated Claude Code CLI configuration
  await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.claude', 'old-config.md'), '# Old Claude Code CLI Config\nOutdated format')
}

async function setupMonorepoProject(tempDir) {
  // Root package.json
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'monorepo-project',
        workspaces: ['packages/*'],
      },
      null,
      2
    )
  )

  // Create packages
  const packages = ['frontend', 'backend', 'shared', 'api', 'auth', 'database', 'utils', 'types']

  for (const pkg of packages) {
    const pkgDir = path.join(tempDir, 'packages', pkg)
    await fs.mkdir(pkgDir, { recursive: true })

    await fs.writeFile(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(
        {
          name: `@monorepo/${pkg}`,
          version: '1.0.0',
        },
        null,
        2
      )
    )

    // Package-specific IDE configs
    await fs.mkdir(path.join(pkgDir, '.cursor', 'rules'), { recursive: true })
    await fs.writeFile(
      path.join(pkgDir, '.cursor', 'rules', 'package-rules.md'),
      `# ${pkg} Package Rules\nSpecific rules for ${pkg} package`
    )
  }
}

async function setupTeamConflictProject(tempDir) {
  // Different team member configurations
  const teamMembers = [
    { name: 'alice', preferences: { style: 'prettier', test: 'jest', indent: 2 } },
    { name: 'bob', preferences: { style: 'eslint', test: 'jest', indent: 4 } },
    { name: 'carol', preferences: { style: 'prettier', test: 'vitest', indent: 2 } },
    { name: 'dave', preferences: { style: 'prettier', test: 'jest', indent: 2 } },
    { name: 'eve', preferences: { style: 'eslint', test: 'jest', indent: 2 } },
  ]

  for (const member of teamMembers) {
    const memberDir = path.join(tempDir, '.team-configs', member.name)
    await fs.mkdir(memberDir, { recursive: true })

    await fs.writeFile(path.join(memberDir, 'preferences.json'), JSON.stringify(member.preferences, null, 2))

    await fs.writeFile(
      path.join(memberDir, 'rules.md'),
      `# ${member.name}'s Preferences\nCode style: ${member.preferences.style}`
    )
  }
}

async function setupProjectWithTechStack(tempDir, stack) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'project-with-stack',
        dependencies: {
          react: '^18.2.0',
          typescript: '^5.0.0',
          '@types/react': '^18.0.0',
        },
      },
      null,
      2
    )
  )

  await fs.writeFile(
    path.join(tempDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          jsx: 'react-jsx',
        },
      },
      null,
      2
    )
  )
}

async function setupProjectWithConflictingDeps(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'conflicting-deps-project',
        dependencies: {
          express: '^4.17.1', // Older version
          lodash: '^4.17.20', // Security vulnerability
          react: '^17.0.0', // Major version behind
        },
      },
      null,
      2
    )
  )
}

async function setupTeamProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'team-project',
        scripts: {
          'dev:frontend': 'npm run dev --workspace=frontend',
          'dev:backend': 'npm run dev --workspace=backend',
        },
        workspaces: ['frontend', 'backend'],
      },
      null,
      2
    )
  )

  // Create team configuration
  const teamConfig = {
    team_name: 'Development Team',
    members: [
      { name: 'Alice', role: 'frontend-dev', experience: 'senior' },
      { name: 'Bob', role: 'backend-dev', experience: 'mid' },
      { name: 'Carol', role: 'devops', experience: 'senior' },
      { name: 'Dave', role: 'tester', experience: 'junior' },
    ],
  }

  await fs.mkdir(path.join(tempDir, '.team'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.team', 'config.json'), JSON.stringify(teamConfig, null, 2))
}

async function setupMultiEnvironmentProject(tempDir) {
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(
      {
        name: 'multi-env-project',
        scripts: {
          dev: 'NODE_ENV=development node server.js',
          staging: 'NODE_ENV=staging node server.js',
          prod: 'NODE_ENV=production node server.js',
        },
      },
      null,
      2
    )
  )

  // Environment-specific configurations
  const environments = ['development', 'staging', 'production']

  for (const env of environments) {
    await fs.mkdir(path.join(tempDir, 'config', env), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'config', env, 'config.json'),
      JSON.stringify(
        {
          environment: env,
          debug: env === 'development',
          logging: env === 'production' ? 'error' : 'debug',
        },
        null,
        2
      )
    )
  }
}

async function setupOfflineScenario(tempDir) {
  // Create cache directory with cached blueprint
  const cacheDir = path.join(tempDir, '.vdk', 'cache', 'blueprints')
  await fs.mkdir(cacheDir, { recursive: true })

  const cachedBlueprint = {
    id: 'react-starter',
    title: 'React Starter Template',
    cached_at: new Date().toISOString(),
    content: 'Cached blueprint content',
  }

  await fs.writeFile(path.join(cacheDir, 'react-starter.json'), JSON.stringify(cachedBlueprint, null, 2))

  // Set offline mode flag
  await fs.mkdir(path.join(tempDir, '.vdk'), { recursive: true })
  await fs.writeFile(path.join(tempDir, '.vdk', 'offline-mode'), 'Hub offline - using cache')
}

async function setupOfflineChanges(tempDir) {
  // Create pending changes that need to sync
  const pendingDir = path.join(tempDir, '.vdk', 'pending-sync')
  await fs.mkdir(pendingDir, { recursive: true })

  const pendingChanges = [
    { operation: 'deploy', blueprint: 'blueprint1', timestamp: new Date().toISOString() },
    { operation: 'publish', blueprint: 'custom-blueprint', timestamp: new Date().toISOString() },
    { operation: 'migrate', from: 'cursor', timestamp: new Date().toISOString() },
  ]

  await fs.writeFile(path.join(pendingDir, 'changes.json'), JSON.stringify(pendingChanges, null, 2))
}

async function setupPartialConnectivityScenario(tempDir) {
  const configDir = path.join(tempDir, '.vdk', 'test-config')
  await fs.mkdir(configDir, { recursive: true })

  const connectivityConfig = {
    hub_api: 'online',
    ai_generation: 'offline',
    blueprint_repo: 'online',
    analytics: 'offline',
  }

  await fs.writeFile(path.join(configDir, 'connectivity.json'), JSON.stringify(connectivityConfig, null, 2))
}

async function setupOperationQueueScenario(tempDir) {
  // Create a blueprint to publish
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.mkdir(blueprintsDir, { recursive: true })

  const blueprint = {
    id: 'my-custom-blueprint',
    title: 'My Custom Blueprint',
    schema_version: '2.1.0',
    platforms: { 'claude-code-cli': { compatible: true } },
  }

  await fs.writeFile(path.join(blueprintsDir, 'my-custom-blueprint.json'), JSON.stringify(blueprint, null, 2))

  // Set offline mode
  await fs.writeFile(path.join(tempDir, '.vdk', 'hub-offline'), 'Hub temporarily unavailable')
}

async function setupComplexWorkflow(tempDir) {
  // Setup for complex workflow test
  await setupEnterpriseProject(tempDir)

  // Add workflow configuration
  const workflowConfig = {
    steps: [
      { step: 'migrate', source: 'cursor' },
      { step: 'deploy', blueprint: 'enterprise-template' },
      { step: 'customize', adaptToProject: true },
      { step: 'publish', visibility: 'private' },
    ],
    integrity_checks: true,
    rollback_on_failure: true,
  }

  await fs.mkdir(path.join(tempDir, '.vdk', 'workflows'), { recursive: true })
  await fs.writeFile(
    path.join(tempDir, '.vdk', 'workflows', 'complex-workflow.json'),
    JSON.stringify(workflowConfig, null, 2)
  )
}

async function setupInterruptedOperation(tempDir) {
  // Create operation state showing interruption
  const operationsDir = path.join(tempDir, '.vdk', 'operations')
  await fs.mkdir(operationsDir, { recursive: true })

  const operationState = {
    operation_id: 'interrupted-deploy-12345',
    operation: 'deploy',
    blueprint: 'large-template',
    status: 'interrupted',
    current_step: 'customization',
    completed_steps: ['validation', 'download', 'extraction'],
    remaining_steps: ['customization', 'installation', 'verification'],
    checkpoint_data: { customization_progress: 45 },
  }

  await fs.writeFile(path.join(operationsDir, 'interrupted-deploy-12345.json'), JSON.stringify(operationState, null, 2))
}

async function setupConcurrentOperations(tempDir) {
  // Setup state management for concurrent operations
  const stateDir = path.join(tempDir, '.vdk')
  await fs.mkdir(stateDir, { recursive: true })

  const initialState = {
    concurrent_operations_completed: 0,
    integrity_maintained: true,
    active_locks: [],
  }

  await fs.writeFile(path.join(stateDir, 'state.json'), JSON.stringify(initialState, null, 2))

  // Create test data for each operation
  await setupValidBlueprint(tempDir) // For migrate test

  // For deploy test
  const cacheDir = path.join(tempDir, '.vdk', 'cache', 'blueprints')
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(
    path.join(cacheDir, 'template1.json'),
    JSON.stringify({ id: 'template1', content: 'template' }, null, 2)
  )

  // For publish test
  const blueprintsDir = path.join(tempDir, '.vdk', 'blueprints')
  await fs.writeFile(
    path.join(blueprintsDir, 'custom1.json'),
    JSON.stringify({ id: 'custom1', schema_version: '2.1.0', platforms: {} }, null, 2)
  )
}

async function setupCorruptedConfigurations(tempDir) {
  const claudeDir = path.join(tempDir, '.claude')
  await fs.mkdir(claudeDir, { recursive: true })

  // Corrupted file with null bytes
  await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# Claude Code CLI Config\x00\x01\x02Invalid content')

  // File with wrong encoding
  await fs.writeFile(path.join(claudeDir, 'corrupted.md'), Buffer.from('Invalid UTF-8: \xFF\xFE\xFD', 'binary'))

  // File with malformed structure
  await fs.writeFile(path.join(claudeDir, 'malformed.md'), '# Incomplete file without proper')
}

async function setupLargeScaleProject(tempDir) {
  // Create enterprise microservices blueprint cache
  const cacheDir = path.join(tempDir, '.vdk', 'cache', 'blueprints')
  await fs.mkdir(cacheDir, { recursive: true })

  const enterpriseBlueprint = {
    id: 'enterprise-microservices',
    title: 'Enterprise Microservices Platform',
    services: Array.from({ length: 50 }, (_, i) => ({
      name: `service-${i + 1}`,
      type: 'microservice',
      dependencies: [`service-${Math.max(1, i)}`],
    })),
    infrastructure: {
      kubernetes: true,
      service_mesh: true,
      monitoring: true,
    },
  }

  await fs.writeFile(path.join(cacheDir, 'enterprise-microservices.json'), JSON.stringify(enterpriseBlueprint, null, 2))
}

async function setupBulkOperationData(tempDir) {
  // Create 200 legacy config files for bulk migration
  const legacyDir = path.join(tempDir, 'legacy-configs')
  await fs.mkdir(legacyDir, { recursive: true })

  for (let i = 1; i <= 200; i++) {
    await fs.writeFile(path.join(legacyDir, `config-${i}.md`), `# Legacy Config ${i}\nContent for config ${i}`)
  }
}

async function setupPerformanceTestData(tempDir) {
  // Create cached template for performance testing
  const cacheDir = path.join(tempDir, '.vdk', 'cache', 'blueprints')
  await fs.mkdir(cacheDir, { recursive: true })

  const cachedTemplate = {
    id: 'cached-template',
    title: 'Cached Template',
    content: 'Template content for caching test',
    cached_at: new Date().toISOString(),
  }

  await fs.writeFile(path.join(cacheDir, 'cached-template.json'), JSON.stringify(cachedTemplate, null, 2))
}

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli-new.js')

  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
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

    // Handle timeout for long-running tests
    setTimeout(() => {
      child.kill('SIGTERM')
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTest timeout (120s)',
      })
    }, 120000) // 2 minute timeout for complex scenarios
  })
}
