/**
 * PublishManager - Community Rule Publishing System
 *
 * Handles the publication of VDK rules to the community through two pathways:
 * 1. VDK Hub - Instant sharing with temporary links and analytics
 * 2. GitHub PR - Community review process for permanent inclusion
 *
 * Features:
 * - Dual publishing pathways (Hub vs GitHub)
 * - Rule validation and quality scoring
 * - Security scanning for safety
 * - Universal format conversion
 * - Project context extraction
 */

import fs from 'fs/promises'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import matter from 'gray-matter'

import { ProjectScanner } from '../scanner/core/ProjectScanner.js'
import { validateBlueprint } from '../utils/schema-validator.js'

export class PublishManager {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.projectScanner = new ProjectScanner({ projectPath })

    // Initialize clients (will be created when needed)
    this.hubClient = null
    this.githubClient = null
    this.formatConverter = null
  }

  /**
   * Main publishing method - handles both Hub and GitHub pathways
   */
  async publish(rulePath, options = {}) {
    const spinner = ora('Preparing rule for publication...').start()

    try {
      // Validate rule file exists and is readable
      await fs.access(rulePath)

      // Validate rule for publishing
      spinner.text = 'Validating rule quality and security...'
      const ruleValidation = await this.validateRuleForPublishing(rulePath)

      if (!ruleValidation.valid) {
        spinner.fail('Rule validation failed')
        console.error(chalk.red('❌ Validation errors:'))
        ruleValidation.errors.forEach((error) => {
          console.error(chalk.red(`   • ${error}`))
        })

        if (ruleValidation.warnings.length > 0) {
          console.warn(chalk.yellow('⚠️  Warnings:'))
          ruleValidation.warnings.forEach((warning) => {
            console.warn(chalk.yellow(`   • ${warning}`))
          })
        }

        throw new Error('Rule validation failed')
      }

      spinner.succeed(`Rule validated (Quality Score: ${ruleValidation.qualityScore}/10)`)

      // Show validation warnings if any
      if (ruleValidation.warnings.length > 0) {
        console.warn(chalk.yellow('⚠️  Warnings:'))
        ruleValidation.warnings.forEach((warning) => {
          console.warn(chalk.yellow(`   • ${warning}`))
        })
      }

      // Choose publishing pathway
      if (options.github) {
        return await this.publishViaGitHub(rulePath, ruleValidation, options)
      } else {
        return await this.publishViaHub(rulePath, ruleValidation, options)
      }
    } catch (error) {
      spinner.fail(`Publishing failed: ${error.message}`)
      throw error
    }
  }

  /**
   * Preview what would be published without actually publishing
   */
  async previewPublication(rulePath) {
    try {
      const ruleValidation = await this.validateRuleForPublishing(rulePath)
      const projectContext = await this.extractProjectContext()

      // Create universal format preview
      const formatConverter = await this.getFormatConverter()
      const universalPreview = await formatConverter.previewConversion({
        content: ruleValidation.content,
        format: ruleValidation.detectedFormat,
        projectContext: projectContext,
      })

      return {
        summary: this.generatePublishPreviewSummary(ruleValidation, projectContext),
        validation: ruleValidation,
        universalFormat: universalPreview,
        projectContext: projectContext,
        recommendations: this.generatePublishingRecommendations(ruleValidation, projectContext),
      }
    } catch (error) {
      throw new Error(`Preview generation failed: ${error.message}`)
    }
  }

  /**
   * Publish via VDK Hub - instant sharing with temporary links
   */
  async publishViaHub(rulePath, ruleValidation, options = {}) {
    const spinner = ora('Publishing to VDK Hub...').start()

    try {
      const hubClient = await this.getHubClient()

      // Check authentication
      spinner.text = 'Checking Hub authentication...'
      const authStatus = await hubClient.checkAuth()

      if (!authStatus.authenticated) {
        spinner.info('Hub authentication required for instant publishing')
        console.log(chalk.cyan('🔐 VDK Hub provides:'))
        console.log(chalk.gray('   • Instant temporary share links (24h)'))
        console.log(chalk.gray('   • Usage analytics and community stats'))
        console.log(chalk.gray('   • Email confirmation for permanent links'))
        console.log('')
        console.log(chalk.yellow('💡 Alternative: Use --github flag for no-registration publishing'))

        const shouldAuth = await hubClient.promptForAuth()
        if (!shouldAuth) {
          throw new Error('Hub authentication required for Hub publishing')
        }
      }

      spinner.text = 'Extracting project context...'
      const projectContext = await this.extractProjectContext()

      spinner.text = 'Converting to universal format...'
      const formatConverter = await this.getFormatConverter()
      const universalRule = await formatConverter.convertToUniversal({
        content: ruleValidation.content,
        format: ruleValidation.detectedFormat,
        projectContext: projectContext,
        originalFile: path.basename(rulePath),
      })

      // Upload with temporary status
      spinner.text = 'Uploading to Hub...'
      const uploadResult = await hubClient.uploadBlueprint({
        blueprint: universalRule,
        status: options.private ? 'private' : 'pending_confirmation',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        metadata: {
          source_file: path.basename(rulePath),
          project_context: projectContext,
          quality_score: ruleValidation.qualityScore,
          original_format: ruleValidation.detectedFormat,
        },
      })

      spinner.succeed('Published to VDK Hub successfully!')

      console.log('')
      console.log(chalk.green('✅ Publication Details:'))
      console.log(chalk.gray(`   📝 Blueprint ID: ${uploadResult.blueprintId}`))
      console.log(chalk.gray(`   🔗 Share URL: ${uploadResult.tempUrl}`))
      console.log(chalk.gray(`   ⏰ Valid until: ${new Date(uploadResult.expiresAt).toLocaleString()}`))
      console.log(chalk.gray(`   📊 Quality Score: ${ruleValidation.qualityScore}/10`))

      if (!options.private) {
        console.log('')
        console.log(chalk.cyan('📧 Confirmation email sent to activate permanent sharing'))
        console.log(chalk.cyan('💡 After confirmation, deploy with:'))
        console.log(chalk.gray(`   vdk deploy ${uploadResult.blueprintId}`))
      }

      return {
        success: true,
        platform: 'hub',
        blueprintId: uploadResult.blueprintId,
        shareUrl: uploadResult.tempUrl,
        expiresAt: uploadResult.expiresAt,
        qualityScore: ruleValidation.qualityScore,
      }
    } catch (error) {
      spinner.fail('Hub publishing failed')
      throw error
    }
  }

  /**
   * Publish via GitHub PR - community review process
   */
  async publishViaGitHub(rulePath, ruleValidation, options = {}) {
    const spinner = ora('Publishing via GitHub PR...').start()

    try {
      console.log('')
      console.log(chalk.cyan('🔧 GitHub Publishing Pathway:'))
      console.log(chalk.gray('   • Creates PR in VDK-Blueprints repository'))
      console.log(chalk.gray('   • Community review process'))
      console.log(chalk.gray('   • Permanent inclusion after merge'))
      console.log(chalk.gray('   • No registration required'))
      console.log('')

      spinner.text = 'Extracting project context...'
      const projectContext = await this.extractProjectContext()

      spinner.text = 'Converting to universal format...'
      const formatConverter = await this.getFormatConverter()
      const universalRule = await formatConverter.convertToUniversal({
        content: ruleValidation.content,
        format: ruleValidation.detectedFormat,
        projectContext: projectContext,
        originalFile: path.basename(rulePath),
      })

      spinner.text = 'Creating GitHub PR...'
      const githubClient = await this.getGitHubClient()
      const prResult = await githubClient.createCommunityBlueprintPR({
        blueprint: universalRule,
        originalPath: rulePath,
        projectContext: projectContext,
        qualityScore: ruleValidation.qualityScore,
        customName: options.name,
      })

      spinner.succeed('GitHub PR created successfully!')

      console.log('')
      console.log(chalk.green('✅ GitHub PR Details:'))
      console.log(chalk.gray(`   📝 PR URL: ${prResult.prUrl}`))
      console.log(chalk.gray(`   🏷️  Blueprint ID: ${prResult.blueprintId}`))
      console.log(chalk.gray(`   📊 Quality Score: ${ruleValidation.qualityScore}/10`))
      console.log('')
      console.log(chalk.cyan('⏳ Next steps:'))
      console.log(chalk.gray(`   • Community will review your contribution`))
      console.log(chalk.gray(`   • After merge, deploy with: vdk deploy ${prResult.blueprintId}`))
      console.log('')
      console.log(chalk.yellow('💡 Want instant sharing? Try: vdk publish (requires free Hub account)'))

      return {
        success: true,
        platform: 'github',
        prUrl: prResult.prUrl,
        blueprintId: prResult.blueprintId,
        qualityScore: ruleValidation.qualityScore,
      }
    } catch (error) {
      spinner.fail('GitHub PR creation failed')
      throw error
    }
  }

  /**
   * Validate rule for publishing - quality, security, and format checks
   */
  async validateRuleForPublishing(rulePath) {
    const content = await fs.readFile(rulePath, 'utf8')
    const detectedFormat = this.detectRuleFormat(rulePath, content)

    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      content: content,
      detectedFormat: detectedFormat,
      qualityScore: 0,
    }

    // Basic validation
    if (content.length < 100) {
      validation.errors.push('Rule content too short (minimum 100 characters)')
    }

    if (content.length > 50000) {
      validation.warnings.push('Rule content very large (>50KB), consider splitting')
    }

    // Format-specific validation
    try {
      await this.validateRuleFormat(content, detectedFormat, validation)
    } catch (error) {
      validation.errors.push(`Format validation failed: ${error.message}`)
    }

    // Security scanning
    try {
      const securityScan = await this.scanForSecurity(content)
      if (securityScan.issues.length > 0) {
        validation.errors.push(...securityScan.issues.map((i) => `Security: ${i}`))
      }
    } catch (error) {
      validation.warnings.push(`Security scan failed: ${error.message}`)
    }

    // Quality scoring
    validation.qualityScore = this.calculateQualityScore({
      length: content.length,
      structure: this.analyzeStructure(content),
      examples: this.countExamples(content),
      clarity: this.assessClarity(content),
      format: detectedFormat,
    })

    validation.valid = validation.errors.length === 0
    return validation
  }

  /**
   * Detect the format of the rule file
   */
  detectRuleFormat(filePath, content) {
    const filename = path.basename(filePath).toLowerCase()

    // VDK Blueprint format (MDC with YAML frontmatter)
    if (filename.endsWith('.mdc') || (content.includes('---') && content.match(/^---\s*\n[\s\S]*?\n---\s*\n/))) {
      return 'vdk-blueprint'
    }

    // Claude memory format
    if (filename.includes('claude') || filename.includes('memory') || filename === 'claude.md') {
      return 'claude-memory'
    }

    // Cursor rules
    if (filename === '.cursorrules' || filename.includes('cursor')) {
      return 'cursor-rules'
    }

    // GitHub Copilot
    if (filename.includes('copilot') && (filename.endsWith('.json') || content.trim().startsWith('{'))) {
      return 'copilot-config'
    }

    // Windsurf
    if (filename.includes('windsurf') || content.includes('<windsurf') || filename.endsWith('.xml')) {
      return 'windsurf-rules'
    }

    // Generic markdown
    if (filename.endsWith('.md')) {
      return 'markdown'
    }

    // Generic text
    return 'text'
  }

  /**
   * Validate rule format specific requirements
   */
  async validateRuleFormat(content, format, validation) {
    switch (format) {
      case 'vdk-blueprint':
        try {
          const parsed = matter(content)
          const blueprintValidation = await validateBlueprint(parsed.data)
          if (!blueprintValidation.valid) {
            validation.errors.push(...blueprintValidation.errors.map((e) => `Blueprint: ${e}`))
          }
        } catch (error) {
          validation.errors.push(`VDK Blueprint parsing failed: ${error.message}`)
        }
        break

      case 'copilot-config':
        try {
          JSON.parse(content)
        } catch (error) {
          validation.errors.push('Invalid JSON format for Copilot configuration')
        }
        break

      case 'windsurf-rules':
        if (!(content.includes('<') || content.includes('>'))) {
          validation.warnings.push('Windsurf rules typically use XML tags for better structure')
        }
        break
    }
  }

  /**
   * Security scanning to prevent malicious content
   */
  async scanForSecurity(content) {
    const issues = []
    const lowercaseContent = content.toLowerCase()

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"]\w+['"]/, message: 'Potential API key detected' },
      { pattern: /secret\s*[:=]\s*['"]\w+['"]/, message: 'Potential secret detected' },
      { pattern: /password\s*[:=]\s*['"]\w+['"]/, message: 'Potential password detected' },
      { pattern: /token\s*[:=]\s*['"]\w+['"]/, message: 'Potential token detected' },
    ]

    for (const { pattern, message } of secretPatterns) {
      if (pattern.test(lowercaseContent)) {
        issues.push(message)
      }
    }

    // Check for suspicious code execution
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'Use of eval() detected - potential security risk' },
      { pattern: /exec\s*\(/, message: 'Use of exec() detected - potential security risk' },
      { pattern: /system\s*\(/, message: 'Use of system() detected - potential security risk' },
      { pattern: /shell_exec/, message: 'Use of shell_exec detected - potential security risk' },
      { pattern: /\$\{[^}]*`/, message: 'Template literal with command execution detected' },
    ]

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(content)) {
        issues.push(message)
      }
    }

    // Check for suspicious URLs
    const suspiciousUrlPatterns = [
      { pattern: /https?:\/\/[^/]*\.tk\//i, message: 'Suspicious .tk domain detected' },
      {
        pattern: /https?:\/\/bit\.ly\//i,
        message: 'Shortened URL detected - please use full URLs',
      },
      {
        pattern: /https?:\/\/tinyurl\./i,
        message: 'Shortened URL detected - please use full URLs',
      },
    ]

    for (const { pattern, message } of suspiciousUrlPatterns) {
      if (pattern.test(content)) {
        issues.push(message)
      }
    }

    return { issues }
  }

  /**
   * Calculate quality score for the rule
   */
  calculateQualityScore(metrics) {
    let score = 0

    // Length scoring (0-2 points)
    if (metrics.length > 200) score += 1
    if (metrics.length > 1000) score += 1

    // Structure scoring (0-2 points)
    if (metrics.structure.hasHeadings) score += 1
    if (metrics.structure.hasLists) score += 1

    // Examples scoring (0-3 points)
    if (metrics.examples > 0) score += 1
    if (metrics.examples > 2) score += 1
    if (metrics.examples > 5) score += 1

    // Clarity scoring (0-2 points)
    if (metrics.clarity.readabilityScore > 0.5) score += 1
    if (metrics.clarity.readabilityScore > 0.8) score += 1

    // Format bonus (0-1 point)
    if (metrics.format === 'vdk-blueprint') score += 1

    return Math.min(score, 10)
  }

  /**
   * Analyze content structure
   */
  analyzeStructure(content) {
    return {
      hasHeadings: /^#{1,6}\s+/m.test(content),
      hasLists: /^[\s]*[-*+]\s+/m.test(content) || /^[\s]*\d+\.\s+/m.test(content),
      hasCodeBlocks: /```/.test(content),
      hasTables: /\|.*\|/.test(content),
      lineCount: content.split('\n').length,
    }
  }

  /**
   * Count code examples in content
   */
  countExamples(content) {
    const codeBlockMatches = content.match(/```[\s\S]*?```/g) || []
    const inlineCodeMatches = content.match(/`[^`]+`/g) || []
    return codeBlockMatches.length + Math.floor(inlineCodeMatches.length / 3)
  }

  /**
   * Assess content clarity
   */
  assessClarity(content) {
    const words = content.toLowerCase().match(/\b\w+\b/g) || []
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1)

    // Simple readability heuristic
    const readabilityScore = Math.max(0, Math.min(1, (20 - avgWordsPerSentence) / 20))

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgWordsPerSentence: avgWordsPerSentence,
      readabilityScore: readabilityScore,
    }
  }

  /**
   * Extract project context for metadata
   */
  async extractProjectContext() {
    try {
      const projectData = await this.projectScanner.scanProject()

      // Basic project context - simplified for reliability
      return {
        name: path.basename(this.projectPath),
        framework: this.detectFrameworkFromPackageJson() || 'generic',
        language: this.detectPrimaryLanguage(projectData) || 'javascript',
        hasPackageJson: projectData.files?.some((f) => f.name === 'package.json'),
        technologies: this.extractTechnologies(projectData) || [],
        structure: this.summarizeStructure(projectData),
      }
    } catch (error) {
      // Fallback context
      return {
        name: path.basename(this.projectPath),
        framework: 'generic',
        language: 'javascript',
        hasPackageJson: false,
        technologies: [],
        structure: {},
      }
    }
  }

  /**
   * Detect framework from package.json
   */
  detectFrameworkFromPackageJson() {
    try {
      const packagePath = path.join(this.projectPath, 'package.json')
      // We'll implement this by reading package.json if it exists
      // For now, return null to avoid file system errors
      return null
    } catch {
      return null
    }
  }

  /**
   * Detect primary language from project data
   */
  detectPrimaryLanguage(projectData) {
    if (!projectData.files) return 'javascript'

    const extensions = projectData.files.map((f) => path.extname(f.name).toLowerCase())
    const counts = {}

    extensions.forEach((ext) => {
      counts[ext] = (counts[ext] || 0) + 1
    })

    const langMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
    }

    const mostCommonExt = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), '.js')
    return langMap[mostCommonExt] || 'javascript'
  }

  /**
   * Extract technologies from project data
   */
  extractTechnologies(projectData) {
    const technologies = []

    if (!projectData.files) return technologies

    // Check for common technology indicators
    const indicators = {
      react: ['jsx', 'tsx', 'package.json'],
      vue: ['vue', 'package.json'],
      angular: ['component.ts', 'module.ts'],
      nodejs: ['package.json', 'js', 'ts'],
      python: ['py', 'requirements.txt'],
      docker: ['Dockerfile', 'docker-compose.yml'],
    }

    for (const [tech, patterns] of Object.entries(indicators)) {
      if (
        patterns.some((pattern) => projectData.files.some((f) => f.name.includes(pattern) || f.name.endsWith(pattern)))
      ) {
        technologies.push(tech)
      }
    }

    return technologies
  }

  /**
   * Summarize project structure
   */
  summarizeStructure(projectData) {
    return {
      fileCount: projectData.files?.length || 0,
      directories: projectData.directories?.length || 0,
      hasTests: projectData.files?.some((f) => f.name.includes('test') || f.name.includes('spec')),
      hasConfig: projectData.files?.some((f) => f.name.includes('config')),
    }
  }

  // Helper methods to get initialized clients (lazy loading)
  async getHubClient() {
    if (!this.hubClient) {
      const { VDKHubClient } = await import('./clients/VDKHubClient.js')
      this.hubClient = new VDKHubClient()
    }
    return this.hubClient
  }

  async getGitHubClient() {
    if (!this.githubClient) {
      const { GitHubPRClient } = await import('./clients/GitHubPRClient.js')
      this.githubClient = new GitHubPRClient()
    }
    return this.githubClient
  }

  async getFormatConverter() {
    if (!this.formatConverter) {
      const { UniversalFormatConverter } = await import('./UniversalFormatConverter.js')
      this.formatConverter = new UniversalFormatConverter()
    }
    return this.formatConverter
  }

  // UI Helper methods
  generatePublishPreviewSummary(validation, context) {
    return `Will publish ${validation.detectedFormat} rule (${validation.content.length} chars, Quality: ${validation.qualityScore}/10) for ${context.framework} project`
  }

  generatePublishingRecommendations(validation, context) {
    const recommendations = []

    if (validation.qualityScore < 6) {
      recommendations.push('Consider adding more examples and documentation')
    }

    if (validation.content.length < 500) {
      recommendations.push('Rule content is quite brief - consider adding more detail')
    }

    if (context.framework === 'generic') {
      recommendations.push('Consider adding technology-specific context for better adaptation')
    }

    return recommendations
  }
}
