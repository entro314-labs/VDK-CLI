/**
 * CommunityDeployer - Community Blueprint Deployment System
 *
 * Handles the deployment of community-contributed blueprints to local projects
 * with intelligent adaptation based on project context and technology stack.
 *
 * Features:
 * - Fetches blueprints from Hub and GitHub repository
 * - Analyzes project context for smart adaptation
 * - Cross-framework rule adaptation (e.g., Next.js → React)
 * - Platform-specific deployment using existing integrations
 * - Usage tracking and community analytics
 * - Graceful fallback between Hub and repository sources
 */

import fs from 'fs/promises'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'

import { ProjectScanner } from '../scanner/core/ProjectScanner.js'
import { RuleAdapter } from '../scanner/core/RuleAdapter.js'
import { createIntegrationManager } from '../integrations/index.js'
import { VDKHubClient } from '../hub/VDKHubClient.js'
import { searchBlueprints } from '../blueprints-client.js'

export class CommunityDeployer {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.projectScanner = new ProjectScanner({ projectPath })
    this.ruleAdapter = new RuleAdapter({ projectPath })
    this.integrationManager = null
    this.hubClient = null
  }

  /**
   * Deploy a community blueprint to the current project
   */
  async deploy(blueprintId, options = {}) {
    const spinner = ora(`Fetching community blueprint: ${blueprintId}`).start()

    try {
      // 1. Fetch blueprint from community sources
      const blueprint = await this.fetchCommunityBlueprint(blueprintId)
      if (!blueprint) {
        spinner.fail(`Community blueprint not found: ${blueprintId}`)
        throw new Error(`Blueprint '${blueprintId}' not found in community sources`)
      }

      spinner.succeed(`Found: ${blueprint.title} by ${blueprint.author || 'community'}`)
      console.log(chalk.gray(`   Description: ${blueprint.description || 'No description'}`))
      console.log(chalk.gray(`   Compatibility: ${this.formatPlatformList(blueprint.platforms)}`))

      // 2. Analyze current project context
      spinner.start('Analyzing your project context...')
      const projectContext = await this.analyzeProjectContext()
      spinner.succeed(`Detected: ${projectContext.summary}`)

      // 3. Check compatibility and create adaptation plan
      const adaptationPlan = await this.createAdaptationPlan(blueprint, projectContext)

      if (options.preview) {
        this.displayAdaptationPreview(adaptationPlan)
        return { success: true, preview: adaptationPlan }
      }

      // 4. Adapt blueprint to project context
      spinner.start('Adapting blueprint to your project...')
      const adaptedBlueprint = await this.adaptBlueprintToProject(blueprint, projectContext, adaptationPlan)
      spinner.succeed('Blueprint adaptation complete')

      // 5. Deploy to detected platforms
      spinner.start('Deploying to detected platforms...')
      const deployResult = await this.deployToIntegrations(adaptedBlueprint, projectContext)
      spinner.succeed('Deployment complete')

      // 6. Track usage for community analytics
      await this.trackBlueprintUsage(blueprintId, deployResult, projectContext)

      // 7. Show completion summary
      this.showDeploymentSummary(blueprint, deployResult, adaptationPlan)

      return {
        success: true,
        blueprintId: blueprintId,
        blueprintTitle: blueprint.title,
        compatibilityScore: adaptationPlan.compatibilityScore,
        platforms: deployResult.platforms,
        adaptations: adaptationPlan.changes.length,
      }
    } catch (error) {
      spinner.fail(`Deployment failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Preview what would be deployed without actually deploying
   */
  async previewDeployment(blueprintId) {
    const blueprint = await this.fetchCommunityBlueprint(blueprintId)
    if (!blueprint) {
      throw new Error(`Blueprint '${blueprintId}' not found`)
    }

    const projectContext = await this.analyzeProjectContext()
    const adaptationPlan = await this.createAdaptationPlan(blueprint, projectContext)

    return {
      blueprint: {
        id: blueprintId,
        title: blueprint.title,
        description: blueprint.description,
        author: blueprint.author,
        platforms: blueprint.platforms,
      },
      projectContext: projectContext.summary,
      adaptationPlan: adaptationPlan,
      estimatedFiles: this.estimateOutputFiles(blueprint, projectContext),
    }
  }

  /**
   * Fetch community blueprint from Hub or repository fallback
   */
  async fetchCommunityBlueprint(blueprintId) {
    // Try Hub first (faster and has community analytics)
    try {
      const hubClient = await this.getHubClient()
      const hubBlueprint = await hubClient.getCommunityBlueprint(blueprintId)
      if (hubBlueprint) {
        return this.normalizeHubBlueprint(hubBlueprint)
      }
    } catch (error) {
      console.warn(chalk.yellow(`Hub fetch failed, trying repository: ${error.message}`))
    }

    // Fallback to repository search
    try {
      const searchResults = await searchBlueprints({
        query: blueprintId,
        exactMatch: true,
      })

      if (searchResults.length > 0) {
        return this.normalizeRepositoryBlueprint(searchResults[0])
      }

      // Try fuzzy search if exact match fails
      const fuzzyResults = await searchBlueprints({
        query: blueprintId,
        fuzzy: true,
        limit: 1,
      })

      if (fuzzyResults.length > 0) {
        console.warn(chalk.yellow(`Exact match not found, using similar: ${fuzzyResults[0].metadata.title}`))
        return this.normalizeRepositoryBlueprint(fuzzyResults[0])
      }
    } catch (error) {
      console.warn(chalk.yellow(`Repository fetch failed: ${error.message}`))
    }

    return null
  }

  /**
   * Analyze current project context for adaptation
   */
  async analyzeProjectContext() {
    try {
      const projectData = await this.projectScanner.scanProject()

      // Enhanced project analysis
      const context = {
        name: path.basename(this.projectPath),

        // Technology detection
        framework: this.detectFramework(projectData),
        language: this.detectPrimaryLanguage(projectData),
        technologies: this.detectTechnologies(projectData),

        // Architecture analysis
        architecture: this.detectArchitecture(projectData),
        patterns: this.detectPatterns(projectData),

        // Project structure
        structure: this.analyzeStructure(projectData),
        packageManager: this.detectPackageManager(projectData),

        // Platform detection for deployment
        platforms: this.detectTargetPlatforms(projectData),
      }

      // Generate summary
      context.summary = this.generateProjectSummary(context)

      return context
    } catch (error) {
      // Fallback context for errors
      console.warn(chalk.yellow(`Project analysis failed, using fallback: ${error.message}`))
      return {
        name: path.basename(this.projectPath),
        framework: 'generic',
        language: 'javascript',
        technologies: ['javascript'],
        architecture: 'standard',
        patterns: [],
        structure: { type: 'unknown' },
        packageManager: 'npm',
        platforms: ['claude-code-cli', 'cursor'],
        summary: 'Generic JavaScript project',
      }
    }
  }

  /**
   * Create adaptation plan for community blueprint
   */
  async createAdaptationPlan(blueprint, projectContext) {
    const plan = {
      compatibilityScore: 0,
      changes: [],
      preservations: [],
      additions: [],
      warnings: [],
      confidence: 'high',
    }

    // Framework compatibility
    const frameworkCompatibility = this.assessFrameworkCompatibility(
      blueprint.framework ||
        blueprint.metadata?.tags?.find((t) => ['react', 'vue', 'angular', 'nextjs', 'nuxt'].includes(t)),
      projectContext.framework
    )

    plan.compatibilityScore += frameworkCompatibility.score * 0.4

    if (frameworkCompatibility.needsAdaptation) {
      plan.changes.push({
        type: 'framework',
        description: `Converting: ${frameworkCompatibility.from} → ${frameworkCompatibility.to}`,
        confidence: frameworkCompatibility.confidence,
        impact: 'medium',
      })
    }

    // Language compatibility
    const languageCompatibility = this.assessLanguageCompatibility(
      blueprint.language || 'javascript',
      projectContext.language
    )

    plan.compatibilityScore += languageCompatibility.score * 0.2

    if (languageCompatibility.needsAdaptation) {
      plan.changes.push({
        type: 'language',
        description: `Converting: ${languageCompatibility.from} → ${languageCompatibility.to}`,
        confidence: languageCompatibility.confidence,
        impact: 'low',
      })
    }

    // Architecture patterns
    const archCompatibility = this.assessArchitectureCompatibility(
      blueprint.architecture || 'standard',
      projectContext.architecture
    )

    plan.compatibilityScore += archCompatibility.score * 0.2

    if (archCompatibility.needsAdaptation) {
      plan.changes.push({
        type: 'architecture',
        description: archCompatibility.description,
        confidence: archCompatibility.confidence,
        impact: 'high',
      })
    }

    // Technology stack alignment
    const techScore = this.assessTechnologyAlignment(blueprint.metadata?.tags || [], projectContext.technologies)

    plan.compatibilityScore += techScore * 0.2

    // Preserve universal patterns
    plan.preservations.push({
      type: 'patterns',
      description: 'Preserving: Core development patterns and best practices',
      items: ['coding-standards', 'error-handling', 'testing-patterns'],
    })

    // Add project-specific enhancements
    const projectEnhancements = this.identifyProjectEnhancements(projectContext)
    plan.additions.push(...projectEnhancements)

    // Overall confidence assessment
    if (plan.compatibilityScore < 0.6) {
      plan.confidence = 'low'
      plan.warnings.push('Significant adaptations required - review carefully before applying')
    } else if (plan.compatibilityScore < 0.8) {
      plan.confidence = 'medium'
      plan.warnings.push('Some adaptations required - verify compatibility with your setup')
    }

    // Normalize score to 0-10 scale
    plan.compatibilityScore = Math.round(plan.compatibilityScore * 10)

    return plan
  }

  /**
   * Adapt blueprint content to project context
   */
  async adaptBlueprintToProject(blueprint, projectContext, adaptationPlan) {
    let adaptedContent = blueprint.content

    // Apply framework adaptations
    for (const change of adaptationPlan.changes) {
      switch (change.type) {
        case 'framework':
          adaptedContent = await this.adaptFrameworkContent(adaptedContent, change)
          break
        case 'language':
          adaptedContent = await this.adaptLanguageContent(adaptedContent, change)
          break
        case 'architecture':
          adaptedContent = await this.adaptArchitectureContent(adaptedContent, change)
          break
      }
    }

    // Add project-specific context
    const projectContextSection = this.generateProjectContextSection(projectContext)
    adaptedContent = `${projectContextSection}\n\n${adaptedContent}`

    // Add project enhancements
    for (const addition of adaptationPlan.additions) {
      const enhancementSection = this.generateEnhancementSection(addition, projectContext)
      adaptedContent = `${adaptedContent}\n\n${enhancementSection}`
    }

    return {
      ...blueprint,
      content: adaptedContent,
      adaptedFor: projectContext,
      adaptationPlan: adaptationPlan,
      adaptedAt: new Date().toISOString(),
    }
  }

  /**
   * Deploy adapted blueprint to target platforms
   */
  async deployToIntegrations(adaptedBlueprint, projectContext) {
    const deployResult = {
      success: false,
      platforms: [],
      errors: [],
    }

    try {
      // Initialize integration manager
      if (!this.integrationManager) {
        this.integrationManager = createIntegrationManager(this.projectPath)
        await this.integrationManager.discoverIntegrations({ verbose: false })
        await this.integrationManager.scanAll({ verbose: false })
      }

      // Convert adapted blueprint to rule format
      const rules = this.convertBlueprintToRules(adaptedBlueprint)

      // Deploy using existing integration system
      const integrationResult = await this.integrationManager.initializeActive({
        rules: rules,
        overwrite: true, // Community deployments should overwrite
        verbose: false,
      })

      deployResult.success = true
      deployResult.platforms = this.integrationManager.getActiveIntegrations?.()?.map((i) => i.name) || ['deployed']
      deployResult.errors = integrationResult.errors || []

      // Log platform deployments
      console.log(chalk.cyan('\n🚀 Deployed to platforms:'))
      deployResult.platforms.forEach((platform) => {
        console.log(chalk.green(`✓ ${platform}`))
      })

      if (deployResult.errors.length > 0) {
        console.log(chalk.yellow('\nWarnings:'))
        deployResult.errors.forEach((error) => {
          console.log(chalk.yellow(`  ⚠️  ${error}`))
        })
      }
    } catch (error) {
      deployResult.errors.push(error.message)
      console.error(chalk.red(`Deployment error: ${error.message}`))
    }

    return deployResult
  }

  /**
   * Track blueprint usage for community analytics
   */
  async trackBlueprintUsage(blueprintId, deployResult, projectContext) {
    try {
      const hubClient = await this.getHubClient()

      // Use community-specific tracking for better analytics
      await hubClient.trackCommunityBlueprintUsage(blueprintId, {
        sessionId: `deploy_${Date.now()}`,
        projectContext: {
          framework: projectContext.framework,
          language: projectContext.language,
          platform: process.platform,
          cliVersion: '2.0.0',
        },
        deploymentResult: {
          success: deployResult.success,
          platforms: deployResult.platforms || [],
          adaptations: deployResult.adaptations || 0,
          compatibilityScore: deployResult.compatibilityScore || 0,
        },
        timestamp: new Date().toISOString(),
      })

      // Also send general telemetry for CLI analytics
      await hubClient.sendUsageTelemetry({
        cli_version: '2.0.0',
        command: 'deploy',
        platform: process.platform,
        success: deployResult.success,
        blueprints_generated: 1,
        session_id: `deploy_${Date.now()}`,
        timestamp: new Date().toISOString(),
        metadata: {
          blueprint_id: blueprintId,
          project_framework: projectContext.framework,
          project_language: projectContext.language,
          platforms_deployed: deployResult.platforms,
          adaptation_count: deployResult.adaptations || 0,
        },
      })
    } catch (error) {
      // Telemetry errors shouldn't fail deployment
      console.warn(chalk.yellow(`Analytics tracking failed: ${error.message}`))
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Framework compatibility assessment
   */
  assessFrameworkCompatibility(blueprintFramework, projectFramework) {
    const frameworkMap = {
      nextjs: ['react', 'javascript'],
      react: ['javascript'],
      vue: ['javascript'],
      nuxt: ['vue', 'javascript'],
      angular: ['typescript', 'javascript'],
      svelte: ['javascript'],
      nodejs: ['javascript'],
    }

    const blueprintBase = blueprintFramework?.toLowerCase() || 'generic'
    const projectBase = projectFramework?.toLowerCase() || 'generic'

    if (blueprintBase === projectBase) {
      return { score: 1.0, needsAdaptation: false, confidence: 'high' }
    }

    // Check if frameworks are compatible
    const blueprintFamily = frameworkMap[blueprintBase] || [blueprintBase]
    const projectFamily = frameworkMap[projectBase] || [projectBase]

    const hasCommonBase = blueprintFamily.some((f) => projectFamily.includes(f))

    if (hasCommonBase) {
      return {
        score: 0.8,
        needsAdaptation: true,
        confidence: 'high',
        from: blueprintBase,
        to: projectBase,
      }
    }

    // Different framework families
    return {
      score: 0.4,
      needsAdaptation: true,
      confidence: 'medium',
      from: blueprintBase,
      to: projectBase,
    }
  }

  /**
   * Language compatibility assessment
   */
  assessLanguageCompatibility(blueprintLang, projectLang) {
    const langMap = {
      typescript: ['javascript'],
      javascript: [],
      python: [],
      go: [],
      rust: [],
    }

    const blueprintBase = blueprintLang?.toLowerCase() || 'javascript'
    const projectBase = projectLang?.toLowerCase() || 'javascript'

    if (blueprintBase === projectBase) {
      return { score: 1.0, needsAdaptation: false, confidence: 'high' }
    }

    // Check if languages are compatible
    const compatibleLangs = langMap[projectBase] || []
    if (compatibleLangs.includes(blueprintBase)) {
      return {
        score: 0.9,
        needsAdaptation: true,
        confidence: 'high',
        from: blueprintBase,
        to: projectBase,
      }
    }

    return {
      score: 0.5,
      needsAdaptation: true,
      confidence: 'low',
      from: blueprintBase,
      to: projectBase,
    }
  }

  /**
   * Architecture compatibility assessment
   */
  assessArchitectureCompatibility(blueprintArch, projectArch) {
    const archCompatibility = {
      monolith: ['standard', 'mvc'],
      microservices: ['api', 'distributed'],
      spa: ['client-side', 'frontend'],
      ssr: ['server-side', 'fullstack'],
      jamstack: ['static', 'frontend'],
    }

    const blueprintBase = blueprintArch?.toLowerCase() || 'standard'
    const projectBase = projectArch?.toLowerCase() || 'standard'

    if (blueprintBase === projectBase) {
      return { score: 1.0, needsAdaptation: false, confidence: 'high' }
    }

    // Check architectural compatibility
    const compatibleArchs = archCompatibility[projectBase] || []
    if (compatibleArchs.includes(blueprintBase)) {
      return {
        score: 0.7,
        needsAdaptation: true,
        confidence: 'medium',
        description: `Adapting ${blueprintBase} patterns for ${projectBase} architecture`,
      }
    }

    return {
      score: 0.5,
      needsAdaptation: true,
      confidence: 'low',
      description: `Significant architectural adaptation: ${blueprintBase} → ${projectBase}`,
    }
  }

  /**
   * Technology stack alignment assessment
   */
  assessTechnologyAlignment(blueprintTags, projectTechnologies) {
    if (!(blueprintTags.length && projectTechnologies.length)) {
      return 0.5 // Neutral score for unknown
    }

    const intersection = blueprintTags.filter((tag) =>
      projectTechnologies.some(
        (tech) => tech.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(tech.toLowerCase())
      )
    )

    return Math.min(intersection.length / Math.max(blueprintTags.length, projectTechnologies.length), 1.0)
  }

  /**
   * Identify project-specific enhancements
   */
  identifyProjectEnhancements(projectContext) {
    const enhancements = []

    // Framework-specific enhancements
    if (projectContext.framework === 'nextjs') {
      enhancements.push({
        type: 'framework',
        title: 'Next.js App Router Patterns',
        content: 'Optimize for App Router, Server Components, and Route Handlers',
      })
    }

    // Language-specific enhancements
    if (projectContext.language === 'typescript') {
      enhancements.push({
        type: 'language',
        title: 'TypeScript Best Practices',
        content: 'Use strict type checking and advanced TypeScript features',
      })
    }

    // Technology-specific enhancements
    if (projectContext.technologies.includes('tailwind')) {
      enhancements.push({
        type: 'styling',
        title: 'Tailwind CSS Utilities',
        content: 'Follow utility-first CSS patterns and component composition',
      })
    }

    return enhancements
  }

  // Framework content adaptation methods
  async adaptFrameworkContent(content, change) {
    // Simple framework adaptation - can be enhanced with more sophisticated NLP
    let adapted = content

    const adaptations = {
      'nextjs->react': {
        'App Router': 'React Router',
        'Server Components': 'Client Components',
        'app/': 'src/',
        'useRouter() from next/router': 'useNavigate() from react-router-dom',
        'Image from next/image': 'img tag with optimization',
        'Link from next/link': 'Link from react-router-dom',
      },
      'react->nextjs': {
        'React Router': 'App Router',
        'Client Components': 'Server Components where appropriate',
        'src/': 'app/',
        'useNavigate()': 'useRouter()',
        'react-router-dom': 'next/navigation',
      },
    }

    const adaptationKey = `${change.from}->${change.to}`
    const mappings = adaptations[adaptationKey]

    if (mappings) {
      for (const [from, to] of Object.entries(mappings)) {
        adapted = adapted.replace(new RegExp(from, 'gi'), to)
      }
    }

    return adapted
  }

  async adaptLanguageContent(content, change) {
    // Language-specific adaptations
    let adapted = content

    if (change.from === 'javascript' && change.to === 'typescript') {
      // Add TypeScript-specific guidance
      adapted = `# TypeScript Configuration\n- Use strict type checking\n- Define interfaces for props and state\n- Leverage type inference and generics\n\n${adapted}`
    }

    return adapted
  }

  async adaptArchitectureContent(content, change) {
    // Architecture-specific adaptations
    return content // Placeholder for now
  }

  /**
   * Generate project context section
   */
  generateProjectContextSection(context) {
    return `# Project Context: ${context.name}

## Current Setup
- **Framework**: ${context.framework}
- **Language**: ${context.language}  
- **Architecture**: ${context.architecture}
- **Technologies**: ${context.technologies.join(', ')}
- **Package Manager**: ${context.packageManager}

## Detected Patterns
${context.patterns.map((pattern) => `- ${pattern}`).join('\n') || '- Standard development patterns'}

---`
  }

  /**
   * Generate enhancement section
   */
  generateEnhancementSection(enhancement, context) {
    return `## ${enhancement.title}

${enhancement.content}

*Added based on your ${context.framework} + ${context.language} setup*`
  }

  /**
   * Convert blueprint to rules format for integration system
   */
  convertBlueprintToRules(blueprint) {
    return [
      {
        id: blueprint.metadata?.id || 'community-blueprint',
        title: blueprint.title || 'Community Blueprint',
        content: blueprint.content,
        metadata: {
          source: 'community',
          blueprintId: blueprint.metadata?.id,
          adaptedFor: blueprint.adaptedFor?.name,
          adaptedAt: blueprint.adaptedAt,
        },
      },
    ]
  }

  // Project analysis helper methods
  detectFramework(projectData) {
    const packageJsonPath = path.join(this.projectPath, 'package.json')
    try {
      const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'))
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

      if (deps.next) return 'nextjs'
      if (deps.react) return 'react'
      if (deps.vue) return 'vue'
      if (deps['@angular/core']) return 'angular'
      if (deps.svelte) return 'svelte'
      if (deps.express || deps.fastify) return 'nodejs'
    } catch {
      // Fallback detection
    }

    return 'generic'
  }

  detectPrimaryLanguage(projectData) {
    if (!projectData.files) return 'javascript'

    const extensions = projectData.files.map((f) => path.extname(f.name))
    const counts = extensions.reduce((acc, ext) => {
      acc[ext] = (acc[ext] || 0) + 1
      return acc
    }, {})

    const langMap = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
    }

    const mostCommon = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), '.js')
    return langMap[mostCommon] || 'javascript'
  }

  detectTechnologies(projectData) {
    const technologies = []

    // File-based detection
    const indicators = {
      tailwind: ['tailwind.config.js', 'tailwind.css'],
      prisma: ['prisma/schema.prisma'],
      docker: ['Dockerfile', 'docker-compose.yml'],
      jest: ['jest.config.js'],
      eslint: ['.eslintrc.js', '.eslintrc.json'],
      prettier: ['.prettierrc'],
    }

    for (const [tech, files] of Object.entries(indicators)) {
      if (files.some((file) => projectData.files?.some((f) => f.name.includes(file)))) {
        technologies.push(tech)
      }
    }

    return technologies
  }

  detectArchitecture(projectData) {
    // Simple architecture detection
    if (projectData.files?.some((f) => f.name.includes('microservice'))) return 'microservices'
    if (projectData.files?.some((f) => f.name.includes('api') && f.name.includes('route'))) return 'api'
    return 'standard'
  }

  detectPatterns(projectData) {
    const patterns = []
    if (projectData.files?.some((f) => f.name.includes('component'))) patterns.push('component-based')
    if (projectData.files?.some((f) => f.name.includes('hook'))) patterns.push('hooks-pattern')
    if (projectData.files?.some((f) => f.name.includes('test'))) patterns.push('testing')
    return patterns
  }

  analyzeStructure(projectData) {
    return {
      type: projectData.files?.length > 50 ? 'large' : 'small',
      hasTests: projectData.files?.some((f) => f.name.includes('test')),
      hasConfig: projectData.files?.some((f) => f.name.includes('config')),
    }
  }

  detectPackageManager(projectData) {
    if (projectData.files?.some((f) => f.name === 'pnpm-lock.yaml')) return 'pnpm'
    if (projectData.files?.some((f) => f.name === 'yarn.lock')) return 'yarn'
    if (projectData.files?.some((f) => f.name === 'bun.lockb')) return 'bun'
    return 'npm'
  }

  detectTargetPlatforms(projectData) {
    const platforms = []

    // Default platforms
    platforms.push('claude-code-cli', 'cursor')

    // GitHub Copilot if .github exists
    if (projectData.files?.some((f) => f.name.includes('.github'))) {
      platforms.push('github-copilot')
    }

    // Windsurf detection
    if (projectData.files?.some((f) => f.name.includes('.windsurf'))) {
      platforms.push('windsurf')
    }

    return platforms
  }

  generateProjectSummary(context) {
    const parts = [context.framework]
    if (context.language !== 'javascript') parts.push(context.language)
    if (context.technologies.length > 0) {
      parts.push(context.technologies.slice(0, 2).join(' + '))
    }
    return parts.join(' + ')
  }

  // UI/Display helper methods
  formatPlatformList(platforms) {
    if (!platforms || typeof platforms !== 'object') return 'All platforms'
    return (
      Object.keys(platforms)
        .filter((p) => platforms[p]?.compatible)
        .join(', ') || 'Unknown'
    )
  }

  displayAdaptationPreview(plan) {
    console.log(chalk.cyan('\n📋 Deployment Preview:'))
    console.log(`Compatibility Score: ${plan.compatibilityScore}/10 (${plan.confidence} confidence)`)

    if (plan.changes.length > 0) {
      console.log(chalk.cyan('\nAdaptations:'))
      plan.changes.forEach((change) => {
        console.log(chalk.gray(`  • ${change.description} (${change.confidence} confidence)`))
      })
    }

    if (plan.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'))
      plan.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  ⚠️  ${warning}`))
      })
    }
  }

  showDeploymentSummary(blueprint, deployResult, adaptationPlan) {
    console.log(chalk.green('\n🎉 Community blueprint deployed successfully!'))
    console.log('')
    console.log(chalk.gray(`📝 Blueprint: ${blueprint.title}`))
    console.log(chalk.gray(`🏷️  Author: ${blueprint.author || 'Community'}`))
    console.log(chalk.gray(`🎯 Compatibility: ${adaptationPlan.compatibilityScore}/10`))
    console.log(chalk.gray(`🔧 Adaptations: ${adaptationPlan.changes.length}`))
    console.log(chalk.gray(`🚀 Platforms: ${deployResult.platforms.join(', ')}`))

    if (adaptationPlan.changes.length > 0) {
      console.log('')
      console.log(chalk.cyan('📋 Applied adaptations:'))
      adaptationPlan.changes.forEach((change) => {
        console.log(chalk.gray(`  • ${change.description}`))
      })
    }
  }

  estimateOutputFiles(blueprint, context) {
    return context.platforms.length
  }

  // Normalization methods for different sources
  normalizeHubBlueprint(hubBlueprint) {
    return {
      id: hubBlueprint.id,
      title: hubBlueprint.title,
      description: hubBlueprint.description,
      content: hubBlueprint.content,
      author: hubBlueprint.author,
      platforms: hubBlueprint.platforms || {},
      metadata: hubBlueprint,
    }
  }

  normalizeRepositoryBlueprint(repoBlueprint) {
    return {
      id: repoBlueprint.metadata.id,
      title: repoBlueprint.metadata.title,
      description: repoBlueprint.metadata.description,
      content: repoBlueprint.content,
      author: repoBlueprint.metadata.author,
      platforms: repoBlueprint.platforms || {},
      framework: repoBlueprint.metadata.tags?.find((t) => ['react', 'vue', 'angular', 'nextjs'].includes(t)),
      language: repoBlueprint.metadata.language,
      architecture: repoBlueprint.metadata.architecture,
      metadata: repoBlueprint.metadata,
    }
  }

  // Lazy-loaded client initialization
  async getHubClient() {
    if (!this.hubClient) {
      this.hubClient = new VDKHubClient()
    }
    return this.hubClient
  }
}

/**
 * Factory function to create community deployer
 */
export function createCommunityDeployer(projectPath) {
  return new CommunityDeployer(projectPath)
}
