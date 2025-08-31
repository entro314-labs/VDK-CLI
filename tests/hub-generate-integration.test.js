/**
 * Hub Generate Command Integration Tests
 * Tests custom package generation and hub integration workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Hub Generate Command Integration', () => {
  let tempDir
  let originalCwd

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempDir = path.join(__dirname, 'temp', `hub-generate-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Custom Package Generation', () => {
    it('should generate custom package with basic tech stack', async () => {
      const requirements = 'React TypeScript project with testing setup'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'react,typescript,jest',
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Custom package generated successfully/)
      expect(result.stdout).toMatch(/Technology stack: React, TypeScript, Jest/)

      // Verify output files were created
      const outputDir = path.join(tempDir, '.vdk', 'generated')
      const outputExists = await fs
        .access(outputDir)
        .then(() => true)
        .catch(() => false)
      expect(outputExists).toBe(true)

      const files = await fs.readdir(outputDir)
      expect(files.some((f) => f.includes('react-typescript'))).toBe(true)
    })

    it('should generate package with complex tech stack parameters', async () => {
      const requirements = `
        Full-stack web application with:
        - React frontend with Material-UI
        - Node.js Express backend
        - PostgreSQL database
        - JWT authentication
        - Docker deployment
      `

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements.trim(),
        '--tech-stack',
        'react,nodejs,express,postgresql,docker,jwt',
        '--complexity',
        'high',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/High complexity package generated/)

      // Verify comprehensive configuration was created
      const configFile = path.join(tempDir, '.vdk', 'generated', 'package-config.json')
      const configExists = await fs
        .access(configFile)
        .then(() => true)
        .catch(() => false)
      expect(configExists).toBe(true)

      const config = JSON.parse(await fs.readFile(configFile, 'utf-8'))
      expect(config.tech_stack).toContain('react')
      expect(config.tech_stack).toContain('postgresql')
      expect(config.components).toHaveProperty('frontend')
      expect(config.components).toHaveProperty('backend')
      expect(config.components).toHaveProperty('database')
    })

    it('should handle mobile development tech stacks', async () => {
      const requirements = 'Cross-platform mobile app with React Native and Firebase'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'react-native,firebase,expo',
        '--platform',
        'mobile',
        '--output',
        'zip',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Mobile package generated/)
      expect(result.stdout).toMatch(/Platform: Mobile/)

      // Verify zip file was created
      const zipFile = path.join(tempDir, '.vdk', 'generated', 'mobile-package.zip')
      const zipExists = await fs
        .access(zipFile)
        .then(() => true)
        .catch(() => false)
      expect(zipExists).toBe(true)
    })

    it('should generate packages for specialized domains', async () => {
      const requirements = 'Machine learning pipeline with Python, TensorFlow, and MLflow'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'python,tensorflow,mlflow,jupyter',
        '--domain',
        'ml',
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/ML domain package generated/)

      // Verify ML-specific configurations
      const bashScript = path.join(tempDir, '.vdk', 'generated', 'setup.sh')
      const bashExists = await fs
        .access(bashScript)
        .then(() => true)
        .catch(() => false)
      expect(bashExists).toBe(true)

      const bashContent = await fs.readFile(bashScript, 'utf-8')
      expect(bashContent).toContain('pip install tensorflow')
      expect(bashContent).toContain('mlflow')
      expect(bashContent).toContain('jupyter')
    })
  })

  describe('Output Format Testing', () => {
    it('should generate bash script output format', async () => {
      const requirements = 'Simple Node.js API server'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'nodejs,express',
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(0)

      const bashScript = path.join(tempDir, '.vdk', 'generated', 'setup.sh')
      const bashContent = await fs.readFile(bashScript, 'utf-8')

      expect(bashContent).toContain('#!/bin/bash')
      expect(bashContent).toContain('npm init')
      expect(bashContent).toContain('npm install express')
      expect(bashContent).toMatch(/mkdir -p.*src/)

      // Verify script is executable
      const stats = await fs.stat(bashScript)
      expect(stats.mode & 0o111).toBeTruthy() // Check execute permissions
    })

    it('should generate zip archive output format', async () => {
      const requirements = 'Python Django web application'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'python,django,postgresql',
        '--output',
        'zip',
      ])

      expect(result.exitCode).toBe(0)

      const zipFile = path.join(tempDir, '.vdk', 'generated', 'django-package.zip')
      const zipExists = await fs
        .access(zipFile)
        .then(() => true)
        .catch(() => false)
      expect(zipExists).toBe(true)

      // Verify zip contains expected files
      const unzipResult = await runCliCommand(['unzip', '-l', zipFile])
      expect(unzipResult.stdout).toContain('requirements.txt')
      expect(unzipResult.stdout).toContain('manage.py')
      expect(unzipResult.stdout).toContain('settings.py')
    })

    it('should generate structured config output format', async () => {
      const requirements = 'Microservices architecture with Docker and Kubernetes'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'docker,kubernetes,nodejs,redis',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)

      const configFile = path.join(tempDir, '.vdk', 'generated', 'package-config.json')
      const config = JSON.parse(await fs.readFile(configFile, 'utf-8'))

      expect(config.architecture).toBe('microservices')
      expect(config.containers).toBeDefined()
      expect(config.orchestration).toHaveProperty('kubernetes')
      expect(config.services).toBeInstanceOf(Array)
      expect(config.dependencies).toHaveProperty('redis')
    })

    it('should generate multiple output formats simultaneously', async () => {
      const requirements = 'Full-stack TypeScript application'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'typescript,react,nodejs',
        '--output',
        'bash,zip,config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Generated in 3 formats/)

      // Verify all formats were created
      const generatedDir = path.join(tempDir, '.vdk', 'generated')
      const files = await fs.readdir(generatedDir)

      expect(files.some((f) => f.endsWith('.sh'))).toBe(true)
      expect(files.some((f) => f.endsWith('.zip'))).toBe(true)
      expect(files.some((f) => f.endsWith('.json'))).toBe(true)
    })
  })

  describe('Complex Requirements Processing', () => {
    it('should handle natural language requirements', async () => {
      const requirements = `
        I need to build a social media platform where users can:
        - Create accounts and authenticate securely
        - Post photos and videos with captions
        - Follow other users and see their posts in a feed
        - Like and comment on posts
        - Get real-time notifications
        
        The platform should be scalable and handle thousands of users.
        I prefer using React for the frontend and Node.js for the backend.
      `

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements.trim(),
        '--analyze-requirements',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Natural language processing completed/)
      expect(result.stdout).toMatch(/Detected requirements:/)
      expect(result.stdout).toMatch(/- Authentication system/)
      expect(result.stdout).toMatch(/- Media upload/)
      expect(result.stdout).toMatch(/- Real-time notifications/)

      const config = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'generated', 'package-config.json'), 'utf-8')
      )
      expect(config.features).toContain('authentication')
      expect(config.features).toContain('media_upload')
      expect(config.features).toContain('real_time_notifications')
    })

    it('should extract tech stack from requirements text', async () => {
      const requirements = `
        Build a data analytics dashboard using Python with Flask,
        connect to a PostgreSQL database, use Redis for caching,
        and deploy with Docker containers on AWS.
      `

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements.trim(),
        '--auto-detect-stack',
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Auto-detected tech stack:/)
      expect(result.stdout).toMatch(/Python, Flask, PostgreSQL, Redis, Docker/)

      const bashScript = await fs.readFile(path.join(tempDir, '.vdk', 'generated', 'setup.sh'), 'utf-8')
      expect(bashScript).toContain('pip install flask')
      expect(bashScript).toContain('postgresql')
      expect(bashScript).toContain('redis')
      expect(bashScript).toContain('docker')
    })

    it('should handle conflicting requirements gracefully', async () => {
      const requirements = `
        I want to use both React and Vue.js for the frontend,
        with both MongoDB and PostgreSQL databases,
        and deploy on both AWS and Google Cloud.
      `

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--resolve-conflicts',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Conflicts detected and resolved/)
      expect(result.stdout).toMatch(/Recommendation: React/)
      expect(result.stdout).toMatch(/Recommendation: PostgreSQL/)

      const config = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'generated', 'package-config.json'), 'utf-8')
      )
      expect(config.conflicts_resolved).toBeDefined()
      expect(config.recommendations).toBeDefined()
    })

    it('should validate feasibility of complex requirements', async () => {
      const requirements = `
        Build a real-time multiplayer game with 10,000 concurrent users,
        using PHP for the backend with MySQL database,
        and deploy on a single Raspberry Pi.
      `

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--validate-feasibility',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Feasibility analysis completed/)
      expect(result.stderr).toMatch(/Warning: Performance concerns detected/)
      expect(result.stderr).toMatch(/10,000 concurrent users.*single Raspberry Pi/)

      const config = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'generated', 'package-config.json'), 'utf-8')
      )
      expect(config.feasibility_warnings).toBeDefined()
      expect(config.performance_recommendations).toBeDefined()
    })
  })

  describe('Hub Integration and Caching', () => {
    it('should cache generated packages for reuse', async () => {
      const requirements = 'React TypeScript application'

      // First generation
      const first = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'react,typescript',
        '--cache',
        '--output',
        'bash',
      ])

      expect(first.exitCode).toBe(0)
      expect(first.stdout).toMatch(/Package generated and cached/)

      // Second generation should use cache
      const second = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'react,typescript',
        '--use-cache',
        '--output',
        'bash',
      ])

      expect(second.exitCode).toBe(0)
      expect(second.stdout).toMatch(/Using cached package/)

      // Verify cache directory exists
      const cacheDir = path.join(tempDir, '.vdk', 'cache', 'generated')
      const cacheExists = await fs
        .access(cacheDir)
        .then(() => true)
        .catch(() => false)
      expect(cacheExists).toBe(true)
    })

    it('should integrate with community hub for package sharing', async () => {
      const requirements = 'Vue.js application with Vuetify'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'vuejs,vuetify',
        '--share-to-hub',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Package shared to community hub/)
      expect(result.stdout).toMatch(/Hub URL:/)

      // Verify sharing metadata was created
      const metadataFile = path.join(tempDir, '.vdk', 'generated', 'hub-metadata.json')
      const metadataExists = await fs
        .access(metadataFile)
        .then(() => true)
        .catch(() => false)
      expect(metadataExists).toBe(true)
    })

    it('should download and customize community packages', async () => {
      const result = await runCliCommand([
        'hub',
        'generate',
        '--from-community',
        'react-dashboard-template',
        '--customize',
        '--requirements',
        'Add user authentication',
        '--output',
        'zip',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Community package downloaded/)
      expect(result.stdout).toMatch(/Customization applied/)

      // Verify customized package
      const zipFile = path.join(tempDir, '.vdk', 'generated', 'customized-package.zip')
      const zipExists = await fs
        .access(zipFile)
        .then(() => true)
        .catch(() => false)
      expect(zipExists).toBe(true)
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle large-scale project generation efficiently', async () => {
      const requirements = `
        Enterprise-scale microservices platform with:
        - 20 microservices
        - API Gateway
        - Service mesh
        - Monitoring and logging
        - CI/CD pipelines
        - Database per service
      `

      const startTime = Date.now()
      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements.trim(),
        '--tech-stack',
        'kubernetes,docker,nodejs,postgresql,redis,prometheus',
        '--scale',
        'enterprise',
        '--output',
        'config',
      ])
      const duration = Date.now() - startTime

      expect(result.exitCode).toBe(0)
      expect(duration).toBeLessThan(30000) // Should complete in under 30 seconds
      expect(result.stdout).toMatch(/Enterprise-scale package generated/)

      const config = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'generated', 'package-config.json'), 'utf-8')
      )
      expect(config.services).toHaveLength(20)
      expect(config.infrastructure).toHaveProperty('api_gateway')
      expect(config.infrastructure).toHaveProperty('service_mesh')
    })

    it('should optimize generated configurations for performance', async () => {
      const requirements = 'High-performance web API with caching and load balancing'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'nodejs,redis,nginx',
        '--optimize-for',
        'performance',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Performance optimizations applied/)

      const config = JSON.parse(
        await fs.readFile(path.join(tempDir, '.vdk', 'generated', 'package-config.json'), 'utf-8')
      )
      expect(config.optimizations).toHaveProperty('caching')
      expect(config.optimizations).toHaveProperty('load_balancing')
      expect(config.performance_settings).toBeDefined()
    })

    it('should provide generation analytics and insights', async () => {
      const requirements = 'React Native mobile app'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'react-native,expo',
        '--analytics',
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Generation Analytics:/)
      expect(result.stdout).toMatch(/Estimated development time:/)
      expect(result.stdout).toMatch(/Complexity score:/)
      expect(result.stdout).toMatch(/Resource requirements:/)

      // Verify analytics file was created
      const analyticsFile = path.join(tempDir, '.vdk', 'generated', 'analytics.json')
      const analyticsExists = await fs
        .access(analyticsFile)
        .then(() => true)
        .catch(() => false)
      expect(analyticsExists).toBe(true)
    })
  })

  describe('Error Handling and Validation', () => {
    it('should handle invalid tech stack combinations', async () => {
      const requirements = 'Web application'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--tech-stack',
        'react,vue,angular', // Conflicting frontend frameworks
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Invalid tech stack combination/)
      expect(result.stderr).toMatch(/Conflicting frontend frameworks/)
    })

    it('should validate requirements completeness', async () => {
      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        '', // Empty requirements
        '--tech-stack',
        'nodejs',
        '--output',
        'bash',
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Requirements cannot be empty/)
    })

    it('should provide helpful suggestions for unclear requirements', async () => {
      const requirements = 'I want to build an app'

      const result = await runCliCommand([
        'hub',
        'generate',
        '--requirements',
        requirements,
        '--suggest-improvements',
        '--output',
        'config',
      ])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/Requirements need clarification/)
      expect(result.stdout).toMatch(/Suggestions:/)
      expect(result.stdout).toMatch(/- Specify platform/)
      expect(result.stdout).toMatch(/- Define key features/)
    })
  })
})

// Helper functions

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

    // Handle timeout
    setTimeout(() => {
      child.kill('SIGTERM')
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTest timeout',
      })
    }, 60000) // 60 second timeout
  })
}
