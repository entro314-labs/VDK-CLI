/**
 * AutoMigrator - Automatic detection and migration of existing AI rules
 *
 * This class handles the automatic detection of legacy AI assistant configurations
 * and migrates them to the VDK universal format, adapting them to the current
 * project context for optimal results.
 */

import fs from 'fs/promises'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import matter from 'gray-matter'

import { ProjectScanner } from '../scanner/core/ProjectScanner.js'
import { TechnologyAnalyzer } from '../scanner/core/TechnologyAnalyzer.js'
import { PatternDetector } from '../scanner/core/PatternDetector.js'
import { RuleGenerator } from '../scanner/core/RuleGenerator.js'
import { createIntegrationManager } from '../integrations/index.js'

export class AutoMigrator {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.importPath = path.join(projectPath, '.vdk', 'import')
    this.projectScanner = new ProjectScanner({ projectPath: projectPath })
    this.technologyAnalyzer = new TechnologyAnalyzer({ verbose: false })
    this.patternDetector = new PatternDetector({ verbose: false })
    this.integrationManager = null

    // Rule format adapters
    this.ruleAdapters = new Map([
      ['cursor', new CursorRuleAdapter()],
      ['claude', new ClaudeMemoryAdapter()],
      ['copilot', new CopilotConfigAdapter()],
      ['windsurf', new WindsurfRuleAdapter()],
    ])
  }

  /**
   * Main migration method - detects, adapts, and deploys rules
   */
  async migrate(options = {}) {
    const spinner = ora('Starting auto-migration...').start()

    try {
      // 1. Scan import directory for old rules
      spinner.text = 'Scanning .vdk/import/ for AI rules...'
      const detectedRules = await this.detectImportedRules()

      if (detectedRules.length === 0) {
        spinner.info('No rules found in .vdk/import/')
        this.showImportInstructions()
        return { success: false, reason: 'no_rules_found' }
      }

      spinner.succeed(`Found ${detectedRules.length} rule files`)
      this.logDetectedRules(detectedRules)

      // 2. Analyze current project context
      spinner.start('Analyzing current project context...')
      const projectContext = await this.analyzeCurrentProject()
      spinner.succeed('Project analysis complete')
      this.logProjectContext(projectContext)

      // 3. Preview mode - show what would be done
      if (options.preview) {
        const preview = await this.createMigrationPreview(detectedRules, projectContext)
        this.displayPreview(preview)
        return { success: true, preview }
      }

      // 4. Adapt each rule set to current project
      spinner.start('Adapting rules to current project...')
      const adaptedRules = await this.adaptRulesToProject(detectedRules, projectContext, options)
      spinner.succeed('Rule adaptation complete')

      // 5. Deploy using existing integration system
      spinner.start('Deploying to detected platforms...')
      const deployResult = await this.deployAdaptedRules(adaptedRules, options)
      spinner.succeed('Deployment complete')

      // 6. Clean up import directory (optional)
      if (options.clean && deployResult.success) {
        await this.cleanImportDirectory()
        console.log(chalk.gray('✓ Cleaned import directory'))
      }

      // 7. Show completion message with suggestions
      this.showCompletionMessage(deployResult)

      return {
        success: true,
        rulesProcessed: detectedRules.length,
        platformsDeployed: deployResult.platforms,
        suggestions: this.generateSuggestions(adaptedRules, projectContext),
      }
    } catch (error) {
      spinner.fail(`Migration failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Preview what would be migrated without applying changes
   */
  async previewMigration() {
    const detectedRules = await this.detectImportedRules()
    const projectContext = await this.analyzeCurrentProject()

    return this.createMigrationPreview(detectedRules, projectContext)
  }

  /**
   * Scan the import directory for existing AI rules
   */
  async detectImportedRules() {
    const rules = []

    try {
      await fs.access(this.importPath)
    } catch {
      // Import directory doesn't exist
      return rules
    }

    try {
      const importFiles = await fs.readdir(this.importPath, { withFileTypes: true })

      for (const entry of importFiles) {
        if (entry.isFile()) {
          const filePath = path.join(this.importPath, entry.name)
          const detectedRule = await this.detectRuleType(filePath)
          if (detectedRule) {
            rules.push(detectedRule)
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not read import directory: ${error.message}`))
    }

    return rules
  }

  /**
   * Detect the type and format of a rule file
   */
  async detectRuleType(filePath) {
    try {
      const filename = path.basename(filePath)
      const content = await fs.readFile(filePath, 'utf8')

      // Skip empty files
      if (content.trim().length === 0) {
        return null
      }

      // Cursor rules detection
      if (filename === '.cursorrules' || filename.endsWith('.cursorrules') || filename === 'cursor-rules') {
        return {
          type: 'cursor',
          format: 'cursorrules',
          content: content,
          originalFile: filename,
          filePath: filePath,
          confidence: 'high',
        }
      }

      // Claude memory detection
      if (
        filename.toLowerCase().includes('claude') ||
        filename.toLowerCase().includes('memory') ||
        content.includes('# Claude') ||
        content.includes('CLAUDE.md')
      ) {
        return {
          type: 'claude',
          format: 'memory',
          content: content,
          originalFile: filename,
          filePath: filePath,
          confidence: filename.toLowerCase().includes('claude') ? 'high' : 'medium',
        }
      }

      // GitHub Copilot detection
      if (
        (filename.toLowerCase().includes('copilot') && filename.endsWith('.json')) ||
        filename === 'guidelines.json'
      ) {
        try {
          const parsed = JSON.parse(content)
          // Look for Copilot-specific structure
          if (parsed.guidelines || parsed.rules || parsed.instructions) {
            return {
              type: 'copilot',
              format: 'json',
              content: content,
              parsed: parsed,
              originalFile: filename,
              filePath: filePath,
              confidence: 'high',
            }
          }
        } catch {
          // Not valid JSON, continue checking other formats
        }
      }

      // Windsurf detection
      if (
        filename.toLowerCase().includes('windsurf') ||
        content.includes('<windsurf') ||
        content.includes('windsurf:') ||
        filename.endsWith('.xml')
      ) {
        return {
          type: 'windsurf',
          format: 'xml',
          content: content,
          originalFile: filename,
          filePath: filePath,
          confidence: content.includes('<windsurf') ? 'high' : 'medium',
        }
      }

      // Generic AI rules detection (fallback)
      const aiKeywords = ['assistant', 'ai', 'rules', 'instructions', 'guidelines', 'context']
      const hasAIKeywords = aiKeywords.some(
        (keyword) => content.toLowerCase().includes(keyword) || filename.toLowerCase().includes(keyword)
      )

      if (hasAIKeywords && content.length > 50) {
        return {
          type: 'generic',
          format: 'text',
          content: content,
          originalFile: filename,
          filePath: filePath,
          confidence: 'low',
        }
      }

      return null
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not process ${path.basename(filePath)}: ${error.message}`))
      return null
    }
  }

  /**
   * Analyze the current project to understand its context and requirements
   */
  async analyzeCurrentProject() {
    try {
      // Check if project directory exists
      await fs.access(this.projectPath)
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Project directory inaccessible, using fallback context`))
      // Return fallback context
      return {
        name: path.basename(this.projectPath || 'unknown'),
        techStack: ['javascript'],
        primaryFramework: 'generic',
        primaryLanguage: 'javascript',
        architecture: 'standard',
        patterns: [],
        structure: {},
        dependencies: [],
        packageManager: 'npm',
        buildTools: [],
        databases: [],
        deployment: [],
      }
    }

    try {
      const projectData = await this.projectScanner.scanProject(this.projectPath)

      // Simplified analysis for now - we can enhance this later
      return {
        name: path.basename(this.projectPath),
        techStack: ['javascript', 'nodejs'], // Basic detection
        primaryFramework: 'nodejs',
        primaryLanguage: 'javascript',
        architecture: 'standard',
        patterns: ['modular'],
        structure: projectData.structure || {},
        dependencies: projectData.dependencies || [],
        packageManager: 'npm',
        buildTools: [],
        databases: [],
        deployment: [],
      }
    } catch (error) {
      console.error(chalk.red(`❌ Project analysis failed: ${error.message}`))
      // Fallback to basic context
      return {
        name: path.basename(this.projectPath),
        techStack: ['javascript'],
        primaryFramework: 'generic',
        primaryLanguage: 'javascript',
        architecture: 'standard',
        patterns: [],
        structure: {},
        dependencies: [],
        packageManager: 'npm',
        buildTools: [],
        databases: [],
        deployment: [],
      }
    }
  }

  /**
   * Create a preview of what would be migrated
   */
  async createMigrationPreview(detectedRules, projectContext) {
    const preview = {
      summary: '',
      rules: [],
      adaptations: [],
      platforms: [],
      warnings: [],
    }

    for (const rule of detectedRules) {
      const adapter = this.ruleAdapters.get(rule.type)
      if (!adapter) {
        preview.warnings.push(`No adapter available for ${rule.type} rules`)
        continue
      }

      const rulePreview = await adapter.previewAdaptation({
        sourceContent: rule.content,
        sourceFormat: rule.format,
        targetContext: projectContext,
        originalFile: rule.originalFile,
      })

      preview.rules.push({
        type: rule.type,
        file: rule.originalFile,
        confidence: rule.confidence,
        adaptations: rulePreview.adaptations,
      })

      preview.adaptations.push(...rulePreview.adaptations)
    }

    // Determine target platforms - simplified for now
    preview.platforms = ['claude-code', 'cursor', 'windsurf', 'github-copilot']

    preview.summary = this.generatePreviewSummary(preview)
    return preview
  }

  /**
   * Adapt detected rules to the current project context
   */
  async adaptRulesToProject(detectedRules, projectContext, options) {
    const adaptedRules = []

    console.log(chalk.cyan('\n🔄 Adapting rules to current project:'))

    for (const ruleSet of detectedRules) {
      const adapter = this.ruleAdapters.get(ruleSet.type)
      if (!adapter) {
        console.warn(chalk.yellow(`⚠️  No adapter found for ${ruleSet.type}, skipping...`))
        continue
      }

      try {
        console.log(chalk.gray(`  • Processing ${ruleSet.type} rules (${ruleSet.originalFile})`))

        const adapted = await adapter.adapt({
          sourceContent: ruleSet.content,
          sourceFormat: ruleSet.format,
          targetContext: projectContext,
          preservePersonalPreferences: !options.overridePersonal,
          originalFile: ruleSet.originalFile,
        })

        // Show adaptations made
        if (adapted.adaptations && adapted.adaptations.length > 0) {
          adapted.adaptations.forEach((adaptation) => {
            console.log(chalk.gray(`    → ${adaptation}`))
          })
        }

        adaptedRules.push({
          source: ruleSet.type,
          originalFile: ruleSet.originalFile,
          adapted: adapted,
          quality: this.calculateAdaptationQuality(adapted, projectContext),
        })
      } catch (error) {
        console.error(chalk.red(`    ✗ Failed to adapt ${ruleSet.type} rules: ${error.message}`))
      }
    }

    return adaptedRules
  }

  /**
   * Deploy adapted rules using the existing integration system
   */
  async deployAdaptedRules(adaptedRules, options) {
    const deploymentResults = {
      success: false,
      platforms: [],
      errors: [],
    }

    // Convert adapted rules to VDK blueprint format
    const blueprint = this.convertToBlueprint(adaptedRules)

    try {
      // Initialize integration manager if not already done
      if (!this.integrationManager) {
        this.integrationManager = createIntegrationManager(this.projectPath)
        await this.integrationManager.discoverIntegrations({ verbose: options.verbose })
        await this.integrationManager.scanAll({ verbose: options.verbose })
      }

      // Use existing integration system to deploy
      const ruleGenerator = new RuleGenerator(this.projectPath)

      // Create analysis data from our blueprint
      const analysisData = {
        projectName: blueprint.title,
        projectPath: this.projectPath,
        technologies: blueprint.tags,
        structure: {},
        dependencies: [],
      }

      const generatedRules = await ruleGenerator.generateIDESpecificRules(analysisData)

      // Deploy to detected platforms
      const integrationResult = await this.integrationManager.initializeActive({
        rules: generatedRules,
        overwrite: options.force,
        verbose: options.verbose,
      })

      deploymentResults.success = true
      deploymentResults.platforms = this.integrationManager.getActiveIntegrations?.()?.map((i) => i.name) || [
        'deployed',
      ]
      deploymentResults.errors = integrationResult.errors || []

      // Log deployment results
      console.log(chalk.cyan('\n🚀 Deploying to detected platforms:'))
      deploymentResults.platforms.forEach((platform) => {
        console.log(chalk.green(`✓ ${platform}`))
      })

      if (deploymentResults.errors.length > 0) {
        console.log(chalk.yellow('\nWarnings:'))
        deploymentResults.errors.forEach((error) => {
          console.log(chalk.yellow(`  ⚠️  ${error}`))
        })
      }
    } catch (error) {
      deploymentResults.errors.push(error.message)
      console.error(chalk.red(`Deployment failed: ${error.message}`))
    }

    return deploymentResults
  }

  /**
   * Convert adapted rules to VDK blueprint format
   */
  convertToBlueprint(adaptedRules) {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]

    // Combine all adapted content
    const combinedContent = adaptedRules
      .map((rule) => rule.adapted.content || rule.adapted)
      .filter(Boolean)
      .join('\n\n---\n\n')

    // Extract project context from the first rule
    const firstRule = adaptedRules[0]
    const projectContext = firstRule?.adapted?.projectContext || {}

    return {
      id: `migrated-rules-${Date.now()}`,
      title: 'Migrated AI Rules',
      description: `Auto-migrated rules from ${adaptedRules.map((r) => r.source).join(', ')}`,
      version: '1.0.0',
      category: 'project',
      created: dateStr,
      lastUpdated: dateStr,
      author: 'VDK Auto-Migration',
      tags: ['migrated', 'auto-generated', ...(projectContext.techStack || [])],
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
      content: combinedContent,
    }
  }

  /**
   * Calculate adaptation quality score
   */
  calculateAdaptationQuality(adapted, projectContext) {
    let score = 5 // Base score

    // Content length
    const contentLength = (adapted.content || adapted).length
    if (contentLength > 500) score += 1
    if (contentLength > 2000) score += 1

    // Project-specific adaptations
    if (adapted.adaptations && adapted.adaptations.length > 0) {
      score += Math.min(adapted.adaptations.length, 3)
    }

    // Technology alignment
    const techStack = projectContext.techStack || []
    if (techStack.length > 0) {
      const content = (adapted.content || adapted).toLowerCase()
      const matches = techStack.filter((tech) => content.includes(tech.toLowerCase()))
      score += Math.min(matches.length, 2)
    }

    return Math.min(score, 10)
  }

  /**
   * Clean up the import directory after successful migration
   */
  async cleanImportDirectory() {
    try {
      const files = await fs.readdir(this.importPath)
      for (const file of files) {
        await fs.unlink(path.join(this.importPath, file))
      }
      await fs.rmdir(this.importPath)
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not clean import directory: ${error.message}`))
    }
  }

  /**
   * Generate suggestions based on migration results
   */
  generateSuggestions(adaptedRules, projectContext) {
    const suggestions = {
      publishWorthy: false,
      improvements: [],
      nextSteps: [],
    }

    // Check if rules are worth publishing
    const avgQuality = adaptedRules.reduce((sum, rule) => sum + rule.quality, 0) / adaptedRules.length
    if (avgQuality >= 7 && adaptedRules.length >= 2) {
      suggestions.publishWorthy = true
      suggestions.nextSteps.push('Consider sharing your adapted rules with the community')
    }

    // Suggest improvements
    if (adaptedRules.some((rule) => rule.quality < 6)) {
      suggestions.improvements.push('Some rules could benefit from additional customization')
    }

    // Technology-specific suggestions
    if (projectContext.primaryFramework) {
      suggestions.nextSteps.push(`Look for ${projectContext.primaryFramework}-specific community rules`)
    }

    return suggestions
  }

  // UI/UX Helper Methods
  logDetectedRules(rules) {
    rules.forEach((rule) => {
      const confidence = rule.confidence === 'high' ? '✓' : rule.confidence === 'medium' ? '~' : '?'
      console.log(chalk.green(`${confidence} Found ${rule.type} rules (${rule.originalFile})`))
    })
  }

  logProjectContext(context) {
    console.log(chalk.green(`✓ Detected: ${context.techStack.join(' + ')}`))
    if (context.architecture) {
      console.log(chalk.green(`✓ Architecture: ${context.architecture}`))
    }
    if (context.patterns && context.patterns.length > 0) {
      console.log(chalk.green(`✓ Patterns: ${context.patterns.join(', ')}`))
    }
  }

  displayPreview(preview) {
    console.log(chalk.cyan('\n📋 Migration Preview:'))
    console.log(preview.summary)

    if (preview.rules.length > 0) {
      console.log(chalk.cyan('\nRules to be migrated:'))
      preview.rules.forEach((rule) => {
        console.log(chalk.gray(`  • ${rule.type} (${rule.file}) - ${rule.confidence} confidence`))
        if (rule.adaptations.length > 0) {
          rule.adaptations.forEach((adaptation) => {
            console.log(chalk.gray(`    → ${adaptation}`))
          })
        }
      })
    }

    if (preview.platforms.length > 0) {
      console.log(chalk.cyan('\nTarget platforms:'))
      preview.platforms.forEach((platform) => {
        console.log(chalk.gray(`  • ${platform}`))
      })
    }

    if (preview.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'))
      preview.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  ⚠️  ${warning}`))
      })
    }
  }

  generatePreviewSummary(preview) {
    const ruleCount = preview.rules.length
    const adaptationCount = preview.adaptations.length
    const platformCount = preview.platforms.length

    return `Will migrate ${ruleCount} rule file${ruleCount !== 1 ? 's' : ''} with ${adaptationCount} adaptation${adaptationCount !== 1 ? 's' : ''} for ${platformCount} platform${platformCount !== 1 ? 's' : ''}`
  }

  showImportInstructions() {
    console.log(chalk.cyan('\n📁 To migrate existing AI rules:'))
    console.log(chalk.gray('1. Create the import directory:'))
    console.log(chalk.gray('   mkdir -p .vdk/import'))
    console.log(chalk.gray('\n2. Copy your existing rule files:'))
    console.log(chalk.gray('   cp .cursorrules .vdk/import/'))
    console.log(chalk.gray('   cp .claude/memory.md .vdk/import/'))
    console.log(chalk.gray('   cp .github/copilot-instructions.json .vdk/import/'))
    console.log(chalk.gray('   cp .windsurf/rules.xml .vdk/import/'))
    console.log(chalk.gray('\n3. Run migration:'))
    console.log(chalk.gray('   vdk migrate'))
  }

  showCompletionMessage(deployResult) {
    console.log(chalk.green('\n🎉 Migration complete! Your AI tools now understand your project.'))

    if (deployResult.platforms.length > 0) {
      console.log(chalk.gray(`\n✓ Deployed to: ${deployResult.platforms.join(', ')}`))
    }
  }
}

// Rule Format Adapters
class CursorRuleAdapter {
  async adapt({ sourceContent, targetContext }) {
    const adaptations = []
    let content = sourceContent

    // Add project-specific context
    if (targetContext.primaryFramework) {
      const frameworkSection = this.generateFrameworkSection(targetContext.primaryFramework)
      content = `${frameworkSection}\n\n${content}`
      adaptations.push(`Added ${targetContext.primaryFramework} patterns`)
    }

    // Add TypeScript focus if detected
    if (targetContext.techStack.includes('typescript')) {
      content = content.replace(/javascript/gi, 'TypeScript')
      adaptations.push('Enhanced TypeScript support')
    }

    // Add architecture patterns
    if (targetContext.architecture) {
      const archSection = this.generateArchitectureSection(targetContext.architecture)
      content = `${content}\n\n${archSection}`
      adaptations.push(`Added ${targetContext.architecture} patterns`)
    }

    return {
      content,
      adaptations,
      projectContext: targetContext,
    }
  }

  async previewAdaptation({ targetContext }) {
    const adaptations = []

    if (targetContext.primaryFramework) {
      adaptations.push(`Will add ${targetContext.primaryFramework} patterns`)
    }
    if (targetContext.techStack.includes('typescript')) {
      adaptations.push('Will enhance TypeScript support')
    }
    if (targetContext.architecture) {
      adaptations.push(`Will add ${targetContext.architecture} architecture patterns`)
    }

    return { adaptations }
  }

  generateFrameworkSection(framework) {
    const patterns = {
      nextjs:
        '# Next.js Patterns\n- Use App Router for new features\n- Implement Server Components where possible\n- Follow feature-based component organization',
      react:
        '# React Patterns\n- Use functional components with hooks\n- Implement proper error boundaries\n- Follow component composition patterns',
      vue: '# Vue.js Patterns\n- Use Composition API for complex logic\n- Implement proper reactivity patterns\n- Follow single-file component structure',
    }
    return (
      patterns[framework.toLowerCase()] ||
      `# ${framework} Patterns\n- Follow ${framework} best practices\n- Use framework-specific patterns`
    )
  }

  generateArchitectureSection(architecture) {
    return `\n# Architecture: ${architecture}\n- Maintain architectural consistency\n- Follow established patterns\n- Consider scalability implications`
  }
}

class ClaudeMemoryAdapter {
  async adapt({ sourceContent, targetContext }) {
    const adaptations = []
    let content = sourceContent

    // Add project context section
    const projectSection = this.generateProjectSection(targetContext)
    content = `${projectSection}\n\n${content}`
    adaptations.push('Added current project context')

    // Enhance with technology stack
    if (targetContext.techStack.length > 0) {
      const techSection = this.generateTechStackSection(targetContext.techStack)
      content = `${content}\n\n${techSection}`
      adaptations.push(`Added ${targetContext.techStack.length} technology guidelines`)
    }

    return {
      content,
      adaptations,
      projectContext: targetContext,
    }
  }

  async previewAdaptation({ targetContext }) {
    const adaptations = []
    adaptations.push('Will add current project context')
    if (targetContext.techStack.length > 0) {
      adaptations.push(`Will add ${targetContext.techStack.length} technology guidelines`)
    }
    return { adaptations }
  }

  generateProjectSection(context) {
    return `# Current Project Context

## Project: ${context.name}
- **Framework**: ${context.primaryFramework || 'Unknown'}
- **Language**: ${context.primaryLanguage || 'Unknown'}
- **Tech Stack**: ${context.techStack.join(', ')}
- **Architecture**: ${context.architecture || 'Standard'}
- **Package Manager**: ${context.packageManager || 'npm'}`
  }

  generateTechStackSection(techStack) {
    return `\n# Technology Guidelines

${techStack
  .map(
    (tech) => `## ${tech.charAt(0).toUpperCase() + tech.slice(1)}
- Follow ${tech} best practices and conventions
- Use ${tech}-specific patterns and optimizations`
  )
  .join('\n\n')}`
  }
}

class CopilotConfigAdapter {
  async adapt({ sourceContent, targetContext }) {
    const adaptations = []

    try {
      const config = JSON.parse(sourceContent)

      // Enhance guidelines with project-specific ones
      if (!config.guidelines) config.guidelines = []

      // Add framework-specific guidelines
      if (targetContext.primaryFramework) {
        config.guidelines.push({
          title: `${targetContext.primaryFramework} Best Practices`,
          content: `Follow ${targetContext.primaryFramework} conventions and patterns`,
        })
        adaptations.push(`Added ${targetContext.primaryFramework} guidelines`)
      }

      // Add technology-specific guidelines
      targetContext.techStack.forEach((tech) => {
        config.guidelines.push({
          title: `${tech} Guidelines`,
          content: `Use ${tech} best practices and patterns`,
        })
      })

      if (targetContext.techStack.length > 0) {
        adaptations.push(`Added ${targetContext.techStack.length} technology guidelines`)
      }

      return {
        content: JSON.stringify(config, null, 2),
        adaptations,
        projectContext: targetContext,
      }
    } catch (error) {
      // If JSON parsing fails, treat as plain text
      return {
        content: sourceContent + '\n\n' + this.generateTextGuidelines(targetContext),
        adaptations: ['Added project context as text'],
        projectContext: targetContext,
      }
    }
  }

  async previewAdaptation({ targetContext }) {
    const adaptations = []
    if (targetContext.primaryFramework) {
      adaptations.push(`Will add ${targetContext.primaryFramework} guidelines`)
    }
    if (targetContext.techStack.length > 0) {
      adaptations.push(`Will add ${targetContext.techStack.length} technology guidelines`)
    }
    return { adaptations }
  }

  generateTextGuidelines(context) {
    return `\nProject Context:
- Framework: ${context.primaryFramework}
- Technologies: ${context.techStack.join(', ')}
- Architecture: ${context.architecture}`
  }
}

class WindsurfRuleAdapter {
  async adapt({ sourceContent, targetContext }) {
    const adaptations = []
    let content = sourceContent

    // Wrap in project-specific context if not already XML
    if (!content.includes('<windsurf')) {
      content = `<windsurf:context project="${targetContext.name}">
${content}
</windsurf:context>`
      adaptations.push('Added Windsurf XML structure')
    }

    // Add technology-specific sections
    if (targetContext.techStack.length > 0) {
      const techSections = targetContext.techStack
        .map((tech) => `<windsurf:tech name="${tech}">Use ${tech} best practices</windsurf:tech>`)
        .join('\n')

      content = content.replace('</windsurf:context>', `${techSections}\n</windsurf:context>`)
      adaptations.push(`Added ${targetContext.techStack.length} technology sections`)
    }

    return {
      content,
      adaptations,
      projectContext: targetContext,
    }
  }

  async previewAdaptation({ targetContext }) {
    const adaptations = []
    adaptations.push('Will add Windsurf XML structure')
    if (targetContext.techStack.length > 0) {
      adaptations.push(`Will add ${targetContext.techStack.length} technology sections`)
    }
    return { adaptations }
  }
}
