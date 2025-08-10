/**
 * RuleGenerator.js
 *
 * Unified rule generator implementing both local template generation and IDE-aware capabilities.
 * Creates IDE-specific rules with schema validation and remote repository integration.
 *
 * Features:
 * - Local Handlebars template generation (fallback)
 * - Remote .mdc rule fetching from repository (primary)
 * - IDE-specific rule adaptation
 * - YAML frontmatter schema validation (VDK v2.1.0)
 * - Multi-platform AI assistant support
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'
import yaml from 'js-yaml'

import { createIntegrationManager } from '../../integrations/index.js'
import { validateBlueprint } from '../../utils/schema-validator.js'
import { applyLightTemplating, prepareTemplateVariables } from '../utils/light-templating.js'
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js'
import { RuleAdapter } from './RuleAdapter.js'

// Ensure fetch is available (Node.js 18+ has it built-in)
if (typeof globalThis.fetch === 'undefined') {
  // Fallback for older Node.js versions would go here
  console.warn('fetch not available, some features may not work')
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class RuleGenerator {
  constructor(outputPath = './.ai/rules', template = 'default', overwrite = false, options = {}) {
    // Support both (outputPath, template, overwrite) and (options) constructor signatures
    if (typeof outputPath === 'object') {
      options = outputPath
      outputPath = options.outputPath || './.ai/rules'
      template = options.template || 'default'
      overwrite = options.overwrite
    }

    this.verbose = options.verbose
    this.outputPath = outputPath
    this.template = template
    this.overwrite = overwrite
    this.templatesDir = options.templatesDir || path.join(__dirname, '../templates')
    this.generatedFiles = []

    // IDE-aware specific properties
    this.integrationManager = null
    this.detectedIntegrations = []
    this.rulesByIDE = {}
    this.ruleAdapters = {}

    // VDK Ecosystem configuration
    this.ecosystemVersion = '2.1.0'
    this.hubEndpoint = options.hubEndpoint || 'https://vdk.tools'
    this.repositoryEndpoint =
      options.repositoryEndpoint || 'https://api.github.com/repos/entro314-labs/VDK-Blueprints'
    this.enableRemoteFetch = options.enableRemoteFetch !== false
    this.enableAnalytics = options.enableAnalytics !== false
    this.schemaValidation = options.schemaValidation !== false
    this.ideIntegration = options.ideIntegration !== false

    // Initialize rule adapters
    this.initializeRuleAdapters(options)
  }

  /**
   * Initialize VDK-compatible rule adapters for different IDEs
   */
  initializeRuleAdapters(options = {}) {
    const adapterOptions = {
      verbose: options.verbose,
      projectPath: options.projectPath || process.cwd(),
      ecosystemVersion: this.ecosystemVersion,
    }

    // Claude Code adapter with sophisticated memory hierarchy
    this.ruleAdapters.claude = new ClaudeCodeAdapter({ ...adapterOptions, ruleGenerator: this })

    // Generic adapters for other IDEs
    this.ruleAdapters.cursor = new RuleAdapter({ ...adapterOptions, targetIDE: 'cursor' })
    this.ruleAdapters.windsurf = new RuleAdapter({ ...adapterOptions, targetIDE: 'windsurf' })
    this.ruleAdapters.vscode = new RuleAdapter({ ...adapterOptions, targetIDE: 'vscode' })
    this.ruleAdapters.copilot = new RuleAdapter({ ...adapterOptions, targetIDE: 'copilot' })

    // Set default adapter for VDK ecosystem
    this.ruleAdapter = this.ruleAdapters.claude // Claude Code as primary
  }

  /**
   * Enhanced rule generation with IDE-native formats
   * @param {Object} analysisData - Combined analysis results
   * @param {Object} categoryFilter - Category filtering options for command fetching
   * @returns {Object} Generated rules organized by IDE
   */
  async generateIDESpecificRules(analysisData, categoryFilter = null) {
    if (this.verbose) {
      console.log(chalk.gray('Starting IDE-aware rule generation...'))
    }

    // Initialize integration manager
    this.integrationManager = createIntegrationManager(
      analysisData.projectStructure?.root || process.cwd()
    )

    // Detect active integrations
    this.detectedIntegrations = await this.detectActiveIntegrations()

    if (this.verbose) {
      console.log(
        chalk.gray(
          `Detected integrations: ${this.detectedIntegrations.map((i) => i.name).join(', ')}`
        )
      )
    }

    // First, try to fetch remote blueprints
    let standardizedRules = []
    if (this.enableRemoteFetch) {
      standardizedRules = await this.fetchFromRulesRepository(analysisData)
      if (this.verbose && standardizedRules.length > 0) {
        console.log(chalk.gray(`Fetched ${standardizedRules.length} remote blueprints`))
      }
    }

    // Fallback to local rules if remote fetch failed or returned no results
    if (standardizedRules.length === 0) {
      standardizedRules = await this.loadStandardizedRules(analysisData)
      if (this.verbose) {
        console.log(chalk.gray(`Using ${standardizedRules.length} local fallback rules`))
      }
    }

    const results = {
      generatedRules: {},
      summary: {
        totalFiles: 0,
        integrations: this.detectedIntegrations.length,
        formats: [],
      },
    }

    // Generate rules for each detected integration using RuleAdapter
    for (const integration of this.detectedIntegrations) {
      if (this.verbose) {
        console.log(chalk.gray(`Adapting rules for ${integration.name}...`))
      }

      try {
        let adaptedRules

        // For Claude Code, use the enhanced adapter with category filtering support
        if (integration.name === 'Claude Code') {
          adaptedRules = await this.ruleAdapters.claude.adaptForClaude(
            standardizedRules,
            analysisData,
            categoryFilter
          )
        } else {
          // For other IDEs, use the standard adapter
          adaptedRules = await this.ruleAdapter.adaptRules(
            standardizedRules,
            this.mapIntegrationToIDE(integration.name),
            analysisData
          )
        }

        if (this.verbose && process.env.VDK_DEBUG) {
          console.log('Debug adaptedRules structure:', JSON.stringify(adaptedRules, null, 2))
        }

        // Write adapted files to disk
        await this.writeAdaptedRules(adaptedRules)

        results.generatedRules[integration.name] = adaptedRules
        results.summary.totalFiles += adaptedRules.files.length

        // Track unique formats
        const format = this.getIDEFormat(integration.name)
        if (!results.summary.formats.includes(format)) {
          results.summary.formats.push(format)
        }
      } catch (error) {
        console.error(chalk.red(`Failed to adapt rules for ${integration.name}: ${error.message}`))
      }
    }

    // Generate fallback universal rules if no specific integrations detected
    if (this.detectedIntegrations.length === 0) {
      if (this.verbose) {
        console.log(
          chalk.yellow('No specific IDE integrations detected, generating universal rules...')
        )
      }

      const universalRules = await this.generateUniversalRules(analysisData)
      results.generatedRules.Universal = universalRules
      results.summary.totalFiles += universalRules.length
      results.summary.formats.push('md')
    }

    return results
  }

  /**
   * Detect which IDE integrations are actively being used
   * @returns {Array} List of active integrations
   */
  async detectActiveIntegrations() {
    const activeIntegrations = []
    const allIntegrations = this.integrationManager.getAllIntegrations()

    for (const integration of allIntegrations) {
      const detection = integration.detectUsage()

      // Consider integration active if confidence is medium or high
      if (detection.confidence === 'medium' || detection.confidence === 'high') {
        activeIntegrations.push({
          name: integration.name,
          confidence: detection.confidence,
          integration,
        })
      }
    }

    return activeIntegrations
  }

  /**
   * Load standardized rules from the rules directory with light templating
   * @param {Object} analysisData - Analysis data for template variables
   * @returns {Array} Array of rule objects with frontmatter and templated content
   */
  async loadStandardizedRules(analysisData = {}) {
    const rulesDir = path.resolve(__dirname, '../../../.ai/rules')
    const rules = []

    try {
      const ruleFiles = await this.findRuleFiles(rulesDir)

      for (const filePath of ruleFiles) {
        try {
          const rawContent = await fs.readFile(filePath, 'utf8')
          const frontmatter = this.parseFrontmatter(rawContent)

          // Fix framework field if it's 'vdk'
          if (frontmatter.framework === 'vdk') {
            frontmatter.framework = this.inferFrameworkFromFile(filePath, rawContent)
          }

          // Apply light templating to content (replaces ${variable} patterns)
          const templateVariables = prepareTemplateVariables(analysisData)
          const templatedContent = applyLightTemplating(rawContent, templateVariables)

          if (this.verbose && rawContent !== templatedContent) {
            console.log(chalk.gray(`Applied light templating to ${path.basename(filePath)}`))
          }

          rules.push({
            filePath,
            frontmatter,
            content: templatedContent,
          })
        } catch (error) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Failed to load rule file ${filePath}: ${error.message}`))
          }
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Failed to load rules directory: ${error.message}`))
      }
    }

    return rules
  }

  /**
   * Recursively find all .mdc rule files
   * @param {string} dir - Directory to search
   * @returns {Array} Array of file paths
   */
  async findRuleFiles(dir) {
    const files = []

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          files.push(...(await this.findRuleFiles(fullPath)))
        } else if (entry.name.endsWith('.mdc')) {
          files.push(fullPath)
        }
      }
    } catch {
      // Ignore directory access errors
    }

    return files
  }

  /**
   * Parse YAML frontmatter from rule content
   * @param {string} content - File content
   * @returns {Object} Parsed frontmatter
   */
  parseFrontmatter(content) {
    if (!content.startsWith('---')) {
      return {}
    }

    const endIndex = content.indexOf('---', 3)
    if (endIndex === -1) {
      return {}
    }

    const frontmatterText = content.slice(3, endIndex).trim()
    try {
      // Use proper YAML parser for accurate parsing
      const parsed = yaml.load(frontmatterText)
      return parsed || {}
    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Failed to parse frontmatter: ${error.message}`))
      }
      return {}
    }
  }

  /**
   * Infer actual framework from file path and content
   * @param {string} filePath - Path to the rule file
   * @param {string} content - File content
   * @returns {string} Inferred framework
   */
  inferFrameworkFromFile(filePath, content) {
    const fileName = path.basename(filePath, '.mdc').toLowerCase()

    // Check filename for framework indicators
    if (fileName.includes('nextjs') || fileName.includes('next')) {
      return 'nextjs'
    }
    if (fileName.includes('react')) {
      return 'react'
    }
    if (fileName.includes('vue')) {
      return 'vue'
    }
    if (fileName.includes('angular')) {
      return 'angular'
    }
    if (fileName.includes('django')) {
      return 'django'
    }
    if (fileName.includes('node') || fileName.includes('express')) {
      return 'nodejs'
    }
    if (fileName.includes('typescript')) {
      return 'typescript'
    }
    if (fileName.includes('python')) {
      return 'python'
    }
    if (fileName.includes('swift')) {
      return 'swift'
    }
    if (fileName.includes('kotlin')) {
      return 'kotlin'
    }

    // Check content for framework indicators
    const contentLower = content.toLowerCase()
    if (contentLower.includes('next.js') || contentLower.includes('nextjs')) {
      return 'nextjs'
    }
    if (contentLower.includes('react')) {
      return 'react'
    }
    if (contentLower.includes('vue.js') || contentLower.includes('vue 3')) {
      return 'vue'
    }
    if (contentLower.includes('angular')) {
      return 'angular'
    }
    if (contentLower.includes('django')) {
      return 'django'
    }
    if (contentLower.includes('express') || contentLower.includes('node.js')) {
      return 'nodejs'
    }

    return 'general'
  }

  /**
   * Map integration name to IDE identifier for RuleAdapter
   * @param {string} integrationName - Integration name
   * @returns {string} IDE identifier
   */
  mapIntegrationToIDE(integrationName) {
    const mapping = {
      'Cursor AI': 'cursor',
      Windsurf: 'windsurf',
      'Claude Code': 'claude',
      'GitHub Copilot': 'github-copilot',
    }

    return mapping[integrationName] || 'generic'
  }

  /**
   * Write adapted rules to disk
   * @param {Object} adaptedRules - Adapted rules from RuleAdapter
   */
  async writeAdaptedRules(adaptedRules) {
    if (!adaptedRules?.files) {
      console.error(
        chalk.red('No files to write - adaptedRules or adaptedRules.files is undefined')
      )
      return
    }

    // Handle ClaudeCodeAdapter structure (files are already written, just paths returned)
    if (typeof adaptedRules.files[0] === 'string') {
      if (this.verbose) {
        console.log(
          chalk.gray(`Claude Code files already written: ${adaptedRules.files.length} files`)
        )
        adaptedRules.files.forEach((filePath) => {
          console.log(chalk.gray(`  - ${filePath}`))
        })
      }
      return
    }

    // Handle standard RuleAdapter structure (file objects with path and content)
    for (const file of adaptedRules.files) {
      try {
        if (!file.path) {
          console.error(chalk.red('Failed to write file: path is undefined'), file)
          continue
        }

        // Ensure directory exists
        await fs.mkdir(path.dirname(file.path), { recursive: true })

        // Write file
        await fs.writeFile(file.path, file.content, 'utf8')

        if (this.verbose) {
          console.log(chalk.gray(`Written: ${file.path}`))
        }
      } catch (error) {
        console.error(chalk.red(`Failed to write ${file.path || 'undefined'}: ${error.message}`))
      }
    }
  }

  /**
   * Generate universal rules when no specific IDE is detected
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Generated file paths
   */
  async generateUniversalRules(analysisData) {
    // Set output to .ai/rules for universal compatibility
    const originalOutputPath = this.outputPath
    this.outputPath = path.join(
      analysisData.projectStructure?.root || process.cwd(),
      '.ai',
      'rules'
    )

    try {
      // Generate basic fallback rules with standard templates
      return await this.generateBasicUniversalRules(analysisData)
    } finally {
      this.outputPath = originalOutputPath
    }
  }

  /**
   * Get the appropriate output directory for an IDE
   * @param {string} ideName - IDE name
   * @param {Object} configPaths - IDE config paths
   * @param {Object} analysisData - Analysis data
   * @returns {string} Output directory path
   */
  getIDEOutputDirectory(ideName, _configPaths, analysisData) {
    const projectRoot = analysisData.projectStructure?.root || process.cwd()

    switch (ideName) {
      case 'Cursor AI':
        return path.join(projectRoot, '.cursor', 'rules')

      case 'Windsurf':
        return path.join(projectRoot, '.windsurf', 'rules')

      case 'Claude Code':
        // Claude Code uses project root for memory files
        return projectRoot

      case 'GitHub Copilot':
        return path.join(projectRoot, '.github', 'copilot')

      default:
        return path.join(projectRoot, '.ai', 'rules')
    }
  }

  /**
   * Get the file format used by an IDE
   * @param {string} ideName - IDE name
   * @returns {string} File format (md, mdc, etc.)
   */
  getIDEFormat(ideName) {
    switch (ideName) {
      case 'Cursor AI':
        return 'mdc' // MDC format with YAML frontmatter
      case 'Windsurf':
        return 'md' // Markdown with XML tags
      case 'Claude Code':
        return 'md' // Pure markdown for memory
      case 'GitHub Copilot':
        return 'json' // JSON configuration
      default:
        return 'md'
    }
  }

  /**
   * Enhanced rule generation implementing VDK ecosystem architecture
   * Primary workflow: CLI → Rules Repository → IDE/AI Tools → Hub Analytics
   */
  async generateEnhancedRules(analysisData) {
    if (this.verbose) {
      console.log(chalk.blue('🚀 Starting VDK ecosystem-aware rule generation...'))
    }

    try {
      // Step 1: Fetch templates from Rules Repository (CLI ↔ Rules Repository)
      let remoteTemplates = []
      if (this.enableRemoteFetch) {
        remoteTemplates = await this.fetchFromRulesRepository(analysisData)
      }

      // Step 2: Generate base rules using standard process
      const standardRules = await this.generateIDESpecificRules(analysisData)

      // Step 2.5: Convert remote templates to actual rule files
      if (remoteTemplates.length > 0) {
        await this.generateRulesFromRemoteTemplates(remoteTemplates, analysisData)
        if (this.verbose) {
          console.log(
            chalk.green(`📝 Generated ${remoteTemplates.length} rules from remote templates`)
          )
        }
      }

      // Step 3: Apply VDK schema validation (only for remote templates)
      if (this.schemaValidation) {
        await this.validateRulesWithVDKSchema(standardRules, remoteTemplates)
      }

      // Step 4: Generate VDK ecosystem manifest
      await this.generateVDKManifest(analysisData, remoteTemplates, standardRules)

      // Step 5: Send analytics to Hub (CLI → Hub)
      if (this.enableAnalytics) {
        await this.sendAnalyticsToHub(analysisData, standardRules)
      }

      return {
        ...standardRules,
        ecosystem: {
          version: this.ecosystemVersion,
          remoteTemplates: remoteTemplates.length,
          validated: this.schemaValidation,
          analyticsEnabled: this.enableAnalytics,
        },
      }
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red(`❌ VDK ecosystem generation failed: ${error.message}`))
      }
      throw error
    }
  }

  /**
   * Fetch content from VDK Blueprints Repository (GitHub) with light templating
   * @param {Object} analysisData - Project analysis data
   * @param {string} contentType - Type of content to fetch ('rules', 'commands', 'docs', 'schemas')
   * @param {string} platform - Platform/IDE specific directory (for commands)
   * @param {Object} categoryFilter - Category filtering options
   * @returns {Array} Fetched templates/content
   */
  async fetchFromRepository(
    analysisData,
    contentType = 'rules',
    platform = null,
    categoryFilter = null
  ) {
    if (!this.enableRemoteFetch) {
      return []
    }

    try {
      if (this.verbose) {
        console.log(chalk.gray(`📚 Fetching ${contentType} from VDK Blueprints Repository...`))
        console.log(chalk.gray(`   Repository endpoint: ${this.repositoryEndpoint}`))
      }

      const projectSignature = this.generateProjectSignature(analysisData)
      // Include analysisData in signature for templating
      projectSignature.analysisData = analysisData
      const templates = await this.fetchRepositoryContent(
        projectSignature,
        contentType,
        platform,
        categoryFilter
      )

      if (this.verbose) {
        console.log(chalk.green(`📚 Fetched ${templates.length} ${contentType} items`))
      }

      return templates
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`⚠️ Could not fetch remote ${contentType}: ${error.message}`))
      }
      return []
    }
  }

  /**
   * Fetch rules from repository
   */
  async fetchFromRulesRepository(analysisData) {
    return this.fetchFromRepository(analysisData, 'rules')
  }

  /**
   * Generate project signature for template matching
   */
  generateProjectSignature(analysisData) {
    // Handle both techStack and technologyData structure for backward compatibility
    const techData = analysisData.techStack || analysisData.technologyData || {}

    const signature = {
      languages: techData.primaryLanguages || [],
      frameworks: techData.frameworks || [],
      libraries: techData.libraries?.slice(0, 10) || [],
      testingFrameworks: techData.testingFrameworks || [],
      buildTools: techData.buildTools || [],
      patterns: Object.keys(analysisData.patterns?.architecturalPatterns || {}),
      projectSize: this.categorizeProjectSize(analysisData.projectStructure),
      complexity: this.assessComplexity(analysisData),
      ecosystemVersion: this.ecosystemVersion,
    }

    if (this.verbose) {
      console.log(chalk.gray('🎯 Project signature for template matching:'))
      console.log(chalk.gray(`   Languages: ${signature.languages.join(', ')}`))
      console.log(chalk.gray(`   Frameworks: ${signature.frameworks.join(', ')}`))
      console.log(chalk.gray(`   Libraries: ${signature.libraries.slice(0, 5).join(', ')}`))
    }

    return signature
  }

  /**
   * Fetch content from GitHub VDK-Blueprints Repository
   * @param {Object} projectSignature - Project signature for filtering
   * @param {string} contentType - Type of content ('rules', 'commands', 'docs', 'schemas')
   * @param {string} platform - Platform/IDE specific directory (for commands)
   * @param {Object} categoryFilter - Category filtering options
   */
  async fetchRepositoryContent(
    projectSignature,
    contentType = 'rules',
    platform = null,
    categoryFilter = null
  ) {
    try {
      // Build the API URL based on content type
      // For commands, we fetch from .ai/commands/ root and filter by platform later
      const apiUrl = `${this.repositoryEndpoint}/contents/.ai/${contentType}`

      const headers = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': `VDK-CLI/${this.ecosystemVersion}`,
      }

      // Use GitHub token if available to avoid rate limiting
      if (process.env.VDK_GITHUB_TOKEN) {
        headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`
      }

      const response = await fetch(apiUrl, { headers })

      if (!response.ok) {
        if (this.verbose) {
          console.log(chalk.yellow(`⚠️ Repository fetch failed: ${response.status} for ${apiUrl}`))
        }
        throw new Error(`Repository API failed: ${response.status}`)
      }

      if (this.verbose) {
        console.log(chalk.gray(`✅ Repository fetch successful from: ${apiUrl}`))
      }

      const contents = await response.json()

      if (this.verbose) {
        console.log(chalk.gray(`📁 Found ${contents.length} items in repository`))
      }
      if (this.verbose) {
        console.log(
          chalk.gray(
            `📁 Repository contents: ${contents.map((item) => `${item.name}(${item.type})`).join(', ')}`
          )
        )
      }

      // For commands, we need to handle platform-specific directory structure and dynamic categories
      let allTemplates
      if (contentType === 'commands' && platform) {
        allTemplates = await this.expandRepositoryDirectoriesWithCategories(
          contents,
          projectSignature,
          contentType,
          platform,
          categoryFilter
        )
      } else {
        // First expand directories to get all template files
        allTemplates = await this.expandRepositoryDirectories(
          contents,
          projectSignature,
          contentType
        )
      }

      if (this.verbose) {
        console.log(
          chalk.gray(
            `📁 After directory expansion: ${allTemplates.length} ${contentType} files found`
          )
        )
        if (categoryFilter?.categories) {
          console.log(
            chalk.gray(`🎯 Category filter applied: ${categoryFilter.categories.join(', ')}`)
          )
        }
      }

      const relevantTemplates = this.filterRelevantTemplates(
        allTemplates,
        projectSignature,
        contentType
      )

      if (this.verbose) {
        console.log(
          chalk.gray(`🎯 Relevant templates after filtering: ${relevantTemplates.length}`)
        )
        relevantTemplates.slice(0, 3).forEach((template) => {
          console.log(chalk.gray(`   - ${template.name} (${template.path})`))
        })
      }

      const templates = []
      // For commands, allow more templates since they're all potentially useful
      // For rules, allow more templates to include technology-specific rules
      // Increased limits to include more technology-specific rules
      const limit = contentType === 'commands' ? 25 : contentType === 'rules' ? 20 : 10
      for (const template of relevantTemplates.slice(0, limit)) {
        // Allow more rules for better coverage
        try {
          const rawTemplateContent = await this.fetchTemplateContent(template.download_url)

          // Apply light templating to remote content (replaces ${variable} patterns)
          const templateVariables = prepareTemplateVariables(projectSignature.analysisData || {})
          const templatedContent = applyLightTemplating(rawTemplateContent, templateVariables)

          if (this.verbose && rawTemplateContent !== templatedContent) {
            console.log(chalk.gray(`Applied light templating to remote template ${template.name}`))
          }

          templates.push({
            name: template.name,
            content: templatedContent,
            source: 'repository',
            path: template.path,
            relevanceScore: template.relevanceScore,
          })
        } catch (err) {
          if (this.verbose) {
            console.log(chalk.yellow(`Could not fetch template ${template.name}: ${err.message}`))
          }
        }
      }

      return templates
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`Repository fetch failed: ${error.message}`))
      }
      return []
    }
  }

  /**
   * Expand directories to get all template files recursively
   * @param {Array} contents - Directory contents from GitHub API
   * @param {Object} projectSignature - Project signature
   * @param {string} contentType - Type of content being fetched
   * @param {number} maxDepth - Maximum recursion depth
   * @param {number} currentDepth - Current recursion depth
   */
  async expandRepositoryDirectories(
    contents,
    projectSignature,
    contentType = 'rules',
    maxDepth = 2,
    currentDepth = 0
  ) {
    const allTemplates = []

    // Determine file extensions based on content type
    const fileExtensions = this.getFileExtensions(contentType)

    if (this.verbose && currentDepth === 0) {
      console.log(
        chalk.gray(
          `🔍 Looking for ${contentType} files with extensions: ${fileExtensions.join(', ')}`
        )
      )
    }

    for (const item of contents) {
      if (item.type === 'file' && fileExtensions.some((ext) => item.name.endsWith(ext))) {
        // Direct file - add to templates
        allTemplates.push(item)
        if (this.verbose) {
          console.log(chalk.gray(`   ✅ Found ${contentType} file: ${item.name}`))
        }
      } else if (item.type === 'dir' && currentDepth < maxDepth) {
        if (this.verbose) {
          console.log(chalk.gray(`   📁 Exploring directory: ${item.name}`))
        }
        try {
          // Fetch subdirectory contents
          const headers = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': `VDK-CLI/${this.ecosystemVersion}`,
          }

          // Use GitHub token if available
          if (process.env.VDK_GITHUB_TOKEN) {
            headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`
          }

          const subdirResponse = await fetch(item.url, { headers })

          if (subdirResponse.ok) {
            const subdirContents = await subdirResponse.json()
            const subdirTemplates = await this.expandRepositoryDirectories(
              subdirContents,
              projectSignature,
              contentType,
              maxDepth,
              currentDepth + 1
            )
            allTemplates.push(...subdirTemplates)

            if (this.verbose && subdirTemplates.length > 0) {
              console.log(
                chalk.gray(`   📁 Found ${subdirTemplates.length} templates in ${item.name}/`)
              )
            }
          } else if (this.verbose) {
            console.log(
              chalk.yellow(
                `   ⚠️ Failed to fetch ${item.name}: ${subdirResponse.status} ${subdirResponse.statusText}`
              )
            )
          }
        } catch (error) {
          if (this.verbose) {
            console.log(chalk.yellow(`Could not fetch subdirectory ${item.name}: ${error.message}`))
          }
        }
      }
    }

    return allTemplates
  }

  /**
   * Expand repository directories with dynamic category discovery and filtering
   * This method discovers available categories dynamically from the repository
   * @param {Array} contents - Repository contents
   * @param {Object} projectSignature - Project signature for filtering
   * @param {string} contentType - Type of content ('commands')
   * @param {string} platform - Platform directory (e.g., 'claude-code')
   * @param {Object} categoryFilter - Category filtering options
   * @returns {Array} Array of filtered templates
   */
  async expandRepositoryDirectoriesWithCategories(
    contents,
    _projectSignature,
    contentType,
    platform,
    categoryFilter
  ) {
    const allTemplates = []
    const fileExtensions = this.getFileExtensions(contentType)

    // Find the platform directory (e.g., 'claude-code')
    const platformDir = contents.find((item) => item.type === 'dir' && item.name === platform)

    if (!platformDir) {
      if (this.verbose) {
        console.log(chalk.yellow(`⚠️ Platform directory '${platform}' not found`))
      }
      return []
    }

    try {
      // Fetch platform directory contents to discover categories dynamically
      const platformResponse = await this.fetchWithAuth(platformDir.url)
      if (!platformResponse.ok) {
        throw new Error(`Failed to fetch platform directory: ${platformResponse.status}`)
      }

      const platformContents = await platformResponse.json()
      const discoveredCategories = platformContents
        .filter((item) => item.type === 'dir')
        .map((item) => item.name)

      if (this.verbose) {
        console.log(chalk.cyan(`🔍 Discovered categories: ${discoveredCategories.join(', ')}`))
      }

      // Update the static category list with discovered categories
      await this.updateDiscoveredCategories(discoveredCategories)

      // Determine which categories to fetch
      let categoriesToFetch
      if (categoryFilter?.categories && categoryFilter.categories.length > 0) {
        // Use specified categories, but validate they exist
        categoriesToFetch = categoryFilter.categories.filter((cat) =>
          discoveredCategories.includes(cat)
        )

        if (categoriesToFetch.length !== categoryFilter.categories.length) {
          const missing = categoryFilter.categories.filter(
            (cat) => !discoveredCategories.includes(cat)
          )
          if (this.verbose) {
            console.log(chalk.yellow(`⚠️ Categories not found in repository: ${missing.join(', ')}`))
          }
        }
      } else {
        // Fetch all discovered categories
        categoriesToFetch = discoveredCategories
      }

      if (this.verbose && categoriesToFetch.length > 0) {
        console.log(chalk.green(`📂 Fetching from categories: ${categoriesToFetch.join(', ')}`))
      }

      // Fetch commands from each selected category
      for (const category of categoriesToFetch) {
        const categoryDir = platformContents.find(
          (item) => item.name === category && item.type === 'dir'
        )
        if (!categoryDir) {
          continue
        }

        try {
          const categoryResponse = await this.fetchWithAuth(categoryDir.url)
          if (categoryResponse.ok) {
            const categoryContents = await categoryResponse.json()

            // Filter for command files and add category metadata
            const categoryTemplates = categoryContents
              .filter(
                (item) =>
                  item.type === 'file' && fileExtensions.some((ext) => item.name.endsWith(ext))
              )
              .map((template) => ({
                ...template,
                category, // Add category metadata
                path: `${platform}/${category}/${template.name}`, // Add full path
              }))

            allTemplates.push(...categoryTemplates)

            if (this.verbose && categoryTemplates.length > 0) {
              console.log(
                chalk.gray(`   📁 Found ${categoryTemplates.length} commands in ${category}/`)
              )
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.log(chalk.yellow(`Could not fetch category ${category}: ${error.message}`))
          }
        }
      }

      // Apply specific command filtering if provided
      if (categoryFilter?.specificCommands) {
        const filteredTemplates = allTemplates.filter((template) => {
          const commandName = template.name.replace(/\.(md|mdc)$/, '')
          return categoryFilter.specificCommands.includes(commandName)
        })

        if (this.verbose) {
          console.log(
            chalk.cyan(
              `🎯 Filtered to specific commands: ${filteredTemplates.length}/${allTemplates.length}`
            )
          )
        }

        return filteredTemplates
      }
    } catch (error) {
      if (this.verbose) {
        console.log(
          chalk.yellow(`Could not expand platform directory ${platform}: ${error.message}`)
        )
      }
    }

    return allTemplates
  }

  /**
   * Helper method to fetch with authentication headers
   */
  async fetchWithAuth(url) {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': `VDK-CLI/${this.ecosystemVersion}`,
    }

    if (process.env.VDK_GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`
    }

    return fetch(url, { headers })
  }

  /**
   * Update discovered categories in the category selector utility
   * This keeps the static category list in sync with the repository
   */
  async updateDiscoveredCategories(discoveredCategories) {
    // This could update a cache file or configuration for the category selector
    // For now, we'll just log the discovery
    if (this.verbose) {
      const newCategories = discoveredCategories.filter(
        (cat) => !['development', 'quality', 'workflow', 'meta', 'security'].includes(cat)
      )

      if (newCategories.length > 0) {
        console.log(chalk.magenta(`🆕 New categories discovered: ${newCategories.join(', ')}`))
      }
    }
  }

  /**
   * Get file extensions based on content type
   * @param {string} contentType - Type of content ('rules', 'commands', 'docs', 'schemas')
   * @returns {Array} Array of file extensions
   */
  getFileExtensions(contentType) {
    const extensionMap = {
      rules: ['.mdc', '.md'],
      commands: ['.md'],
      docs: ['.md'],
      schemas: ['.json'],
      templates: ['.mdc', '.md', '.hbs'],
    }
    return extensionMap[contentType] || ['.md', '.mdc']
  }

  /**
   * Filter templates based on project relevance
   * @param {Array} contents - Content items to filter
   * @param {Object} projectSignature - Project signature
   * @param {string} contentType - Type of content being filtered
   */
  filterRelevantTemplates(contents, projectSignature, contentType = 'rules') {
    const relevantTemplates = []
    const fileExtensions = this.getFileExtensions(contentType)

    for (const item of contents) {
      if (item.type === 'file' && fileExtensions.some((ext) => item.name.endsWith(ext))) {
        const relevanceScore = this.calculateTemplateRelevance(item, projectSignature, contentType)
        if (this.verbose && relevanceScore > 0.05) {
          console.log(
            chalk.gray(`   💯 ${contentType}: ${item.name} - Score: ${relevanceScore.toFixed(2)}`)
          )
        }

        // For commands, use a lower threshold since they're all generally useful
        const threshold = contentType === 'commands' ? 0.05 : 0.1
        if (relevanceScore > threshold) {
          relevantTemplates.push({
            ...item,
            relevanceScore,
          })
        }
      }
    }

    return relevantTemplates.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * Calculate template relevance score
   * @param {Object} template - Template object from GitHub API
   * @param {Object} projectSignature - Project signature
   * @param {string} contentType - Type of content being scored
   */
  calculateTemplateRelevance(template, projectSignature, contentType = 'rules') {
    let score = 0
    const fileName = template.name.toLowerCase()
    const filePath = (template.path || '').toLowerCase()

    // Content-type specific base scoring
    if (contentType === 'commands') {
      // All commands get a baseline score since they're generally useful
      score += 0.1

      // Commands get higher relevance for development workflows
      if (
        fileName.includes('develop') ||
        fileName.includes('debug') ||
        fileName.includes('review')
      ) {
        score += 0.7
      }
      if (fileName.includes('workflow') || fileName.includes('quality')) {
        score += 0.6
      }
      if (fileName.includes('git') || fileName.includes('commit') || fileName.includes('pr')) {
        score += 0.5
      }
      if (
        fileName.includes('test') ||
        fileName.includes('security') ||
        fileName.includes('audit')
      ) {
        score += 0.4
      }
    } else if (contentType === 'rules') {
      // Core rules always get high relevance
      if (fileName.startsWith('0') && fileName.includes('core')) {
        score += 0.8
      }
    }

    // MCP configuration is relevant but not overwhelming
    if (fileName.includes('mcp')) {
      score += 0.3
    }

    // Common errors and project context are universally relevant
    if (fileName.includes('common-errors') || fileName.includes('project-context')) {
      score += 0.6
    }

    // JavaScript/Node.js related files
    if (fileName.includes('javascript') || fileName.includes('node') || fileName.includes('js')) {
      score += 0.5
    }

    // Framework matching (highest priority for stack-specific rules)
    for (const framework of projectSignature.frameworks || []) {
      const frameworkLower = framework.toLowerCase()
      const normalizedFramework = frameworkLower
        .replace('next.js', 'nextjs')
        .replace('react.js', 'react')
        .replace('vue.js', 'vue')
        .replace('tailwind css', 'tailwind')
        .replace('shadcn/ui', 'shadcnui')
        .replace('-', '')
        .replace('.', '')
        .replace('/', '')
        .replace(' ', '')

      if (
        fileName.includes(normalizedFramework) ||
        filePath.includes(normalizedFramework) ||
        fileName.includes(frameworkLower) ||
        filePath.includes(frameworkLower)
      ) {
        score += 0.8
      }

      // Special matching for technology files with version numbers
      if (frameworkLower.includes('tailwind') && fileName.includes('tailwind')) {
        score += 0.8
      }
      if (frameworkLower.includes('shadcn') && fileName.includes('shadcn')) {
        score += 0.8
      }

      // Special handling for stack combinations
      if (
        frameworkLower.includes('supabase') &&
        (fileName.includes('supabase') || filePath.includes('supabase'))
      ) {
        score += 0.9 // Even higher for specific integrations
      }
      if (frameworkLower.includes('nextjs') && fileName.includes('nextjs')) {
        score += 0.9
      }
      if (frameworkLower.includes('enterprise') && fileName.includes('enterprise')) {
        score += 0.7
      }
    }

    // Apply exclusion rules to prevent irrelevant framework pollution
    const detectedLanguages = projectSignature.languages || []
    const detectedFrameworks = projectSignature.frameworks || []

    // CRITICAL: Platform-specific filtering to prevent mobile rules in web projects
    const isWebProject = detectedFrameworks.some((framework) => {
      const fw = framework.toLowerCase()
      return (
        fw.includes('next.js') ||
        fw.includes('nextjs') ||
        (fw.includes('react') && !fw.includes('react native')) ||
        fw.includes('vue.js') ||
        fw.includes('angular') ||
        fw.includes('nuxt') ||
        fw.includes('remix') ||
        fw.includes('gatsby')
      )
    })

    const isMobileProject = detectedFrameworks.some((framework) => {
      const fw = framework.toLowerCase()
      return (
        fw.includes('react native') ||
        fw.includes('expo') ||
        fw.includes('flutter') ||
        fw.includes('ionic') ||
        fw.includes('capacitor')
      )
    })

    // For web projects, completely exclude mobile/native patterns
    if (
      isWebProject &&
      !isMobileProject &&
      (fileName.includes('react-native') ||
        filePath.includes('react-native') ||
        fileName.includes('expo') ||
        filePath.includes('expo') ||
        fileName.includes('mobile') ||
        filePath.includes('mobile') ||
        fileName.includes('native') ||
        filePath.includes('native') ||
        fileName.includes('ios') ||
        fileName.includes('android'))
    ) {
      if (this.verbose) {
        console.log(chalk.yellow(`🚫 Excluding mobile rule for web project: ${fileName}`))
      }
      return 0 // Completely exclude mobile rules for web projects
    }

    // For mobile projects, prefer mobile-specific rules
    if (
      isMobileProject &&
      !isWebProject &&
      (fileName.includes('react-native') ||
        fileName.includes('expo') ||
        fileName.includes('mobile'))
    ) {
      score += 0.7 // Boost mobile rules for mobile projects
    }

    // If no JavaScript/TypeScript, heavily penalize frontend frameworks
    if (
      !detectedLanguages.some((lang) =>
        ['javascript', 'typescript'].includes(lang.toLowerCase())
      ) &&
      (fileName.includes('next') ||
        fileName.includes('react') ||
        fileName.includes('vue') ||
        fileName.includes('angular'))
    ) {
      score = Math.max(0, score - 0.6) // Heavy penalty for frontend frameworks in non-JS projects
    }

    // If no Python, penalize Python-specific rules
    if (
      !detectedLanguages.some((lang) => lang.toLowerCase() === 'python') &&
      (fileName.includes('django') ||
        fileName.includes('flask') ||
        fileName.includes('fastapi') ||
        fileName.includes('python'))
    ) {
      score = Math.max(0, score - 0.6)
    }

    // Comprehensive exclusion for completely irrelevant languages
    // For web projects (Astro, Next.js, etc.), exclude mobile/backend languages entirely
    if (isWebProject) {
      // Exclude mobile development languages
      if (
        fileName.includes('swift') ||
        fileName.includes('kotlin') ||
        fileName.includes('java') ||
        fileName.includes('dart') ||
        fileName.includes('flutter') ||
        fileName.includes('xamarin')
      ) {
        if (this.verbose) {
          console.log(
            chalk.yellow(`🚫 Excluding mobile language rule for web project: ${fileName}`)
          )
        }
        return 0
      }

      // Exclude system programming languages
      if (
        fileName.includes('cpp') ||
        fileName.includes('c++') ||
        fileName.includes('rust') ||
        fileName.includes('go') ||
        fileName.includes('c#') ||
        fileName.includes('csharp')
      ) {
        if (this.verbose) {
          console.log(
            chalk.yellow(`🚫 Excluding system language rule for web project: ${fileName}`)
          )
        }
        return 0
      }
    }

    // For documentation/content projects (Astro Starlight), be even more restrictive
    const isContentProject = detectedFrameworks.some((framework) => {
      const fw = framework.toLowerCase()
      return fw.includes('astro') || fw.includes('starlight') || fw.includes('content')
    })

    if (isContentProject) {
      // Only allow Astro, TypeScript, and basic web technologies
      if (
        !(
          (
            fileName.includes('astro') ||
            fileName.includes('typescript') ||
            fileName.includes('ts') ||
            fileName.includes('content') ||
            fileName.includes('markdown') ||
            fileName.includes('mcp') ||
            fileName.includes('common-errors') ||
            fileName.includes('project-context') ||
            fileName.startsWith('0')
          ) // Core rules
        )
      ) {
        // Check if it's a completely different technology stack
        if (
          fileName.includes('nextjs') ||
          fileName.includes('react') ||
          fileName.includes('vue') ||
          fileName.includes('supabase') ||
          fileName.includes('trpc') ||
          fileName.includes('ecommerce') ||
          fileName.includes('enterprise') ||
          fileName.includes('clerk') ||
          fileName.includes('python') ||
          fileName.includes('swift') ||
          fileName.includes('kotlin') ||
          fileName.includes('cpp') ||
          fileName.includes('node') ||
          fileName.includes('express')
        ) {
          if (this.verbose) {
            console.log(
              chalk.yellow(`🚫 Excluding non-content rule for Astro content project: ${fileName}`)
            )
          }
          score = Math.max(0, score - 0.8) // Heavy penalty instead of complete exclusion for backward compatibility
        }
      }
    }

    // Language matching (important for language-specific rules)
    for (const language of projectSignature.languages || []) {
      const languageLower = language.toLowerCase()
      const normalizedLanguage = languageLower
        .replace('typescript', 'ts')
        .replace('javascript', 'js')

      if (
        fileName.includes(languageLower) ||
        filePath.includes(languageLower) ||
        fileName.includes(normalizedLanguage) ||
        filePath.includes(normalizedLanguage)
      ) {
        score += 0.6
      }

      // Special boosting for TypeScript since it's very common
      if (
        languageLower === 'typescript' &&
        (fileName.includes('typescript') || fileName.includes('ts'))
      ) {
        score += 0.3 // Extra boost for TypeScript rules
      }
    }

    // Library matching (important for technology-specific rules like shadcn/ui)
    for (const library of projectSignature.libraries || []) {
      const libraryLower = library.toLowerCase()
      const normalizedLibrary = libraryLower
        .replace('shadcn/ui', 'shadcnui')
        .replace('tailwind css', 'tailwind')
        .replace('-', '')
        .replace('.', '')
        .replace('/', '')
        .replace(' ', '')

      if (
        fileName.includes(normalizedLibrary) ||
        filePath.includes(normalizedLibrary) ||
        fileName.includes(libraryLower) ||
        filePath.includes(libraryLower)
      ) {
        score += 0.7 // High score for library-specific rules
      }

      // Special matching for UI libraries
      if (libraryLower.includes('shadcn') && fileName.includes('shadcn')) {
        score += 0.8
      }
      if (libraryLower.includes('radix') && fileName.includes('radix')) {
        score += 0.7
      }
    }

    // Complexity matching
    if (fileName.includes(projectSignature.complexity)) {
      score += 0.1
    }

    // Project size matching
    if (fileName.includes(projectSignature.projectSize)) {
      score += 0.1
    }

    // Technology-specific rules get highest priority
    if (
      filePath.includes('technologies/') ||
      filePath.includes('stacks/') ||
      filePath.includes('languages/')
    ) {
      score += 0.5 // High priority for technology rules
    }

    // Assistant-specific rules - lower priority for technology rule fetching
    if (filePath.includes('assistants/')) {
      score += 0.2 // Reduced from 0.4 to prioritize technology rules
    }

    // Core tools and tasks get medium relevance
    if (filePath.includes('tools/') || filePath.includes('tasks/')) {
      score += 0.3
    }

    return Math.min(score, 1.0)
  }

  /**
   * Fetch template content from URL
   */
  async fetchTemplateContent(downloadUrl) {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Template fetch failed: ${response.status}`)
    }
    return await response.text()
  }

  /**
   * Validate remote repository templates against VDK schema
   * (Skip validation for generated local files as they're IDE-specific)
   */
  async validateRulesWithVDKSchema(_rulesResult, remoteTemplates = []) {
    if (!this.schemaValidation) {
      return []
    }

    if (this.verbose) {
      console.log(chalk.gray('✅ Validating remote templates against VDK schema...'))
    }

    const validationErrors = []

    // Only validate remote templates, not generated local files
    for (const template of remoteTemplates) {
      if (template.content) {
        try {
          const parsed = this.parseFrontmatter(template.content)
          const errors = await this.validateVDKSchema(parsed)
          if (errors.length > 0) {
            validationErrors.push({
              template: template.name,
              path: template.path,
              errors,
            })
          }
        } catch (error) {
          validationErrors.push({
            template: template.name,
            path: template.path,
            errors: [`Parse error: ${error.message}`],
          })
        }
      }
    }

    if (validationErrors.length > 0 && this.verbose) {
      console.log(
        chalk.yellow(`⚠️ Found ${validationErrors.length} VDK schema violations in remote templates`)
      )
      validationErrors.slice(0, 3).forEach((error) => {
        console.log(chalk.yellow(`   - ${error.template}: ${error.errors[0]}`))
      })
    } else if (this.verbose && remoteTemplates.length > 0) {
      console.log(chalk.green('✅ All remote templates pass VDK schema validation'))
    }

    return validationErrors
  }

  /**
   * Validate frontmatter against VDK schema
   */
  async validateVDKSchema(frontmatter) {
    try {
      const validation = await validateBlueprint(frontmatter)
      return validation.errors || []
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`Schema validation error: ${error.message}`))
      }
      // Fallback to basic validation if schema loading fails
      const errors = []
      const required = ['description', 'version', 'lastUpdated']
      for (const field of required) {
        if (!(field in frontmatter)) {
          errors.push(`Missing required field: ${field}`)
        }
      }
      return errors
    }
  }

  /**
   * Generate VDK ecosystem manifest
   */
  async generateVDKManifest(analysisData, remoteTemplates, rulesResult) {
    const projectRoot = analysisData.projectStructure?.root || process.cwd()

    const manifest = {
      ecosystemVersion: this.ecosystemVersion,
      generatedAt: new Date().toISOString(),
      architecture: 'three-tier',
      components: {
        cli: 'VDK CLI',
        repository: 'VDK Blueprints Repository',
        hub: 'VDK Hub',
      },
      project: {
        name: path.basename(projectRoot),
        signature: this.generateProjectSignature(analysisData),
      },
      rules: {
        local: rulesResult.summary?.totalFiles || 0,
        remote: remoteTemplates.length,
        integrations: rulesResult.summary?.integrations || 0,
      },
      dataFlow: {
        repositorySync: this.enableRemoteFetch,
        hubAnalytics: this.enableAnalytics,
        schemaValidation: this.schemaValidation,
      },
    }

    // Create .vdk directory structure
    const vdkDir = path.join(projectRoot, '.vdk')
    await fs.mkdir(vdkDir, { recursive: true })

    const manifestPath = path.join(vdkDir, 'manifest.json')
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    if (this.verbose) {
      console.log(chalk.green(`📋 Generated VDK manifest: ${manifestPath}`))
    }
  }

  /**
   * Send analytics to VDK Hub
   */
  async sendAnalyticsToHub(analysisData, rulesResult) {
    if (!this.enableAnalytics) {
      return
    }

    try {
      if (this.verbose) {
        console.log(chalk.gray('📊 Sending analytics to VDK Hub...'))
      }

      const analyticsData = {
        timestamp: new Date().toISOString(),
        ecosystemVersion: this.ecosystemVersion,
        project: this.generateProjectSignature(analysisData),
        generation: {
          rulesGenerated: rulesResult.summary?.totalFiles || 0,
          integrations: rulesResult.summary?.integrations || 0,
          formats: rulesResult.summary?.formats || [],
        },
      }

      await this.fetchFromHub('/analytics/usage', analyticsData)

      if (this.verbose) {
        console.log(chalk.green('📊 Analytics sent successfully'))
      }
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`⚠️ Analytics failed: ${error.message}`))
      }
    }
  }

  /**
   * Utility methods for project analysis
   */
  categorizeProjectSize(projectStructure) {
    const fileCount = projectStructure?.fileCount || 0
    if (fileCount < 50) {
      return 'small'
    }
    if (fileCount < 200) {
      return 'medium'
    }
    if (fileCount < 1000) {
      return 'large'
    }
    return 'enterprise'
  }

  assessComplexity(analysisData) {
    let score = 0
    score += (analysisData.techStack?.primaryLanguages?.length || 0) * 2
    score += (analysisData.techStack?.frameworks?.length || 0) * 3
    score += Math.min((analysisData.techStack?.libraries?.length || 0) * 0.5, 20)

    if (score < 10) {
      return 'simple'
    }
    if (score < 25) {
      return 'moderate'
    }
    if (score < 50) {
      return 'complex'
    }
    return 'highly-complex'
  }

  /**
   * Fetch data from VDK Hub
   */
  async fetchFromHub(endpoint, data) {
    try {
      const response = await fetch(`${this.hubEndpoint}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `VDK-CLI/${this.ecosystemVersion}`,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Hub request failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      throw new Error(`Hub communication failed: ${error.message}`)
    }
  }

  /**
   * Override: Enhanced remote fetching for rule generation
   * Replaces the basic implementation with comprehensive remote rule fetching
   */
  async fetchAndDeployRemoteRules(ruleType, relevantItems, analysisData) {
    if (!this.enableRemoteFetch) {
      // Generate basic fallback rules using light templating
      return await this.generateBasicFallbackRules(ruleType, relevantItems, analysisData)
    }

    try {
      if (this.verbose) {
        console.log(chalk.blue(`🌐 Fetching ${ruleType} rules from remote repository...`))
      }

      // Fetch remote rules using specific items
      const remoteRules = await this.fetchSpecificRemoteRules(ruleType, relevantItems)

      if (remoteRules.length === 0) {
        if (this.verbose) {
          console.log(chalk.yellow(`No remote ${ruleType} rules available, using local fallback`))
        }
        return await this.generateFromLocalTemplates(ruleType, relevantItems, analysisData)
      }

      // Apply light templating for project context
      const templatedRules = await this.applyLightTemplatingToRules(remoteRules, analysisData)

      // Deploy to detected IDEs using adapters
      const deployedRules = []
      for (const integration of this.detectedIntegrations || []) {
        const ideId = this.mapIntegrationToIDE(integration.name)
        const adapter = this.ruleAdapters[ideId]
        if (adapter) {
          const adapted = await adapter.adaptRules(templatedRules, ideId, analysisData)
          deployedRules.push(...adapted.files)
        }
      }

      if (this.verbose) {
        console.log(
          chalk.green(
            `✅ Successfully deployed ${deployedRules.length} ${ruleType} rules to ${this.detectedIntegrations.length} IDEs`
          )
        )
      }

      return deployedRules
    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Remote ${ruleType} fetch failed: ${error.message}`))
      }

      // Graceful fallback to basic rule generation
      return await this.generateBasicFallbackRules(ruleType, relevantItems, analysisData)
    }
  }

  /**
   * Override: Enhanced task selection based on comprehensive project analysis
   * Replaces the basic implementation in the parent class with intelligent analysis
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Array of relevant task names
   */
  selectRelevantTasks(analysisData) {
    const tasks = ['file-operations'] // Always include basic file operations

    const frameworks = analysisData.techStack?.frameworks || []
    const languages = analysisData.techStack?.primaryLanguages || []
    const hasTests = analysisData.techStack?.testingFrameworks?.length > 0
    const hasDocker = analysisData.techStack?.hasDocker
    const hasDatabase = analysisData.techStack?.hasDatabase

    // Framework-specific tasks
    if (frameworks.includes('React')) {
      tasks.push('UI-Component', 'Component-Interfaces', 'Write-Tests')
    }

    if (frameworks.includes('Next.js')) {
      tasks.push('API-Endpoints', 'Service-Integration', 'UI-Component')
    }

    if (frameworks.includes('Vue')) {
      tasks.push('UI-Component', 'Component-Interfaces')
    }

    if (frameworks.includes('Angular')) {
      tasks.push('UI-Component', 'Service-Integration')
    }

    if (frameworks.includes('Express') || frameworks.includes('FastAPI')) {
      tasks.push('API-Endpoints', 'Service-Integration')
    }

    // Language-specific tasks
    if (languages.includes('TypeScript')) {
      tasks.push('Type-Definitions', 'Interface-Design')
    }

    if (languages.includes('Python')) {
      tasks.push('API-Endpoints', 'Data-Processing')
    }

    // Infrastructure tasks
    if (hasDocker) {
      tasks.push('DevOps-Tasks', 'Service-Integration')
    }

    if (hasDatabase) {
      tasks.push('Database-Schema', 'API-Endpoints')
    }

    // Testing tasks
    if (hasTests) {
      tasks.push('Write-Tests', 'Analyze-Coverage', 'Code-Quality-Review')
    }

    return [...new Set(tasks)] // Remove duplicates
  }

  /**
   * Override: Enhanced tool selection based on project analysis
   * Replaces the basic implementation in the parent class with intelligent analysis
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Array of relevant tool names
   */
  selectRelevantTools(analysisData) {
    const tools = ['file-operations'] // Always include

    const packageManager = analysisData.techStack?.packageManager
    const hasGit = analysisData.techStack?.hasGit
    const hasDocker = analysisData.techStack?.hasDocker
    const buildTools = analysisData.techStack?.buildTools || []

    if (packageManager) {
      tools.push('command-execution')
    }

    if (hasGit) {
      tools.push('code-search', 'version-control')
    }

    if (hasDocker) {
      tools.push('command-execution', 'container-management')
    }

    if (buildTools.includes('webpack') || buildTools.includes('vite')) {
      tools.push('build-tools')
    }

    return [...new Set(tools)]
  }

  /**
   * Override: Enhanced assistant selection based on detected IDEs and integrations
   * Replaces the basic implementation in the parent class with IDE detection logic
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Array of relevant assistant names
   */
  selectRelevantAssistants(analysisData) {
    const assistants = []

    // Use detected integrations from analysis
    if (this.detectedIntegrations) {
      for (const integration of this.detectedIntegrations) {
        const assistantId = this.mapIntegrationToAssistant(integration.name)
        if (assistantId) {
          assistants.push(assistantId)
        }
      }
    }

    // Fallback: detect from IDE indicators in project
    if (assistants.length === 0) {
      // Check for common IDE configuration files
      const projectStructure = analysisData.projectStructure || {}
      const files = projectStructure.files || []

      if (files.some((f) => f.includes('.cursor'))) {
        assistants.push('cursor')
      }

      if (files.some((f) => f.includes('.windsurf'))) {
        assistants.push('windsurf')
      }

      if (files.some((f) => f.includes('CLAUDE.md'))) {
        assistants.push('claude-code')
      }

      // Default assistants for common scenarios
      if (analysisData.techStack?.frameworks?.length > 0) {
        assistants.push('general-coding', 'code-review')
      }
    }

    return [...new Set(assistants)]
  }

  /**
   * Map integration names to assistant identifiers
   * @param {string} integrationName - Integration name
   * @returns {string} Assistant identifier
   */
  mapIntegrationToAssistant(integrationName) {
    const mapping = {
      'Cursor AI': 'cursor',
      Windsurf: 'windsurf',
      'Claude Code': 'claude-code',
      'GitHub Copilot': 'github-copilot',
    }

    return mapping[integrationName] || null
  }

  /**
   * Fetch specific remote rules from the repository
   * @param {string} ruleType - Type of rules
   * @param {Array} relevantItems - Array of relevant item names
   * @returns {Array} Array of fetched rules
   */
  async fetchSpecificRemoteRules(ruleType, relevantItems) {
    const rules = []

    try {
      const response = await fetch(`${this.repositoryEndpoint}/contents/.ai/rules/${ruleType}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${ruleType} directory: ${response.status}`)
      }

      const contents = await response.json()

      // Filter for relevant files
      const relevantFiles = contents.filter(
        (item) =>
          item.type === 'file' &&
          item.name.endsWith('.mdc') &&
          relevantItems.some((itemName) => item.name === `${itemName}.mdc`)
      )

      // Fetch individual rule files
      for (const file of relevantFiles) {
        try {
          const fileResponse = await fetch(file.download_url)
          if (fileResponse.ok) {
            const content = await fileResponse.text()
            const rule = this.parseRuleContent(content)
            rule.name = file.name.replace('.mdc', '')
            rules.push(rule)
          }
        } catch (fileError) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Failed to fetch ${file.name}: ${fileError.message}`))
          }
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Failed to fetch remote ${ruleType}: ${error.message}`))
      }
    }

    return rules
  }

  /**
   * Apply light templating to rules for project-specific customization
   * @param {Array} rules - Array of rules
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Array of templated rules
   */
  async applyLightTemplatingToRules(rules, analysisData) {
    const templateVariables = {
      projectName: analysisData.projectContext?.name || path.basename(this.projectPath),
      frameworks: (analysisData.techStack?.frameworks || []).join(', '),
      languages: (analysisData.techStack?.languages || []).join(', '),
      packageManager: analysisData.techStack?.packageManager || 'npm',
    }

    return rules.map((rule) => ({
      ...rule,
      content: this.applySimpleTemplating(rule.content, templateVariables),
    }))
  }

  /**
   * Apply simple ${variable} templating to content
   * @param {string} content - Content to template
   * @param {Object} variables - Template variables
   * @returns {string} Templated content
   */
  applySimpleTemplating(content, variables) {
    let templated = content

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g')
      templated = templated.replace(regex, value)
    }

    return templated
  }

  /**
   * Generate basic fallback rules using light templating
   * Creates simple markdown rules when remote fetch is disabled
   * @param {string} ruleType - Type of rules
   * @param {Array} relevantItems - Array of relevant item names
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Array of generated rules
   */
  async generateBasicFallbackRules(ruleType, relevantItems, analysisData) {
    const rules = []
    const projectName =
      analysisData.projectContext?.name || path.basename(this.projectPath || process.cwd())
    const frameworks = (analysisData.techStack?.frameworks || []).join(', ')

    for (const item of relevantItems) {
      const ruleContent = `---
source: "VDK Blueprints"
framework: "vdk"
repository: "entro314-labs/VDK-Blueprints"
cli_version: ">=1.0.0"
description: "${ruleType.charAt(0).toUpperCase() + ruleType.slice(0, -1)} rule for ${item}"
globs: []
alwaysApply: false
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["${frameworks || 'General'}"]
category: "${ruleType.slice(0, -1)}"
---

# ${item} - ${ruleType.charAt(0).toUpperCase() + ruleType.slice(0, -1)} Rule

## Overview
This rule provides guidance for ${item} in ${projectName}.

## Guidelines
- Follow project conventions for ${frameworks || 'general development'}
- Maintain consistency with existing ${ruleType}
- Use appropriate best practices

## Integration
When working with ${item}:
1. Check existing patterns in the codebase
2. Follow established conventions
3. Maintain code quality standards

---
NOTE TO AI: Apply this rule when working with ${item} in this project.
`

      rules.push({
        name: item,
        type: ruleType,
        content: ruleContent,
        frontmatter: {
          source: 'VDK Blueprints',
          framework: 'vdk',
          repository: 'entro314-labs/VDK-Blueprints',
          cli_version: '>=1.0.0',
          description: `${ruleType.charAt(0).toUpperCase() + ruleType.slice(0, -1)} rule for ${item}`,
          globs: [],
          alwaysApply: false,
          version: '2.1.0',
          lastUpdated: new Date().toISOString().split('T')[0],
          compatibleWith: [frameworks || 'General'],
          category: ruleType.slice(0, -1),
        },
      })
    }

    return rules
  }

  /**
   * Generate actual rule files from remote templates
   * @param {Array} remoteTemplates - Templates fetched from repository
   * @param {Object} analysisData - Project analysis data
   */
  async generateRulesFromRemoteTemplates(remoteTemplates, analysisData) {
    if (!remoteTemplates || remoteTemplates.length === 0) {
      return
    }

    const rulesOutputPath = path.join(
      analysisData.projectStructure?.root || process.cwd(),
      '.ai',
      'rules'
    )
    await fs.mkdir(rulesOutputPath, { recursive: true })

    for (const template of remoteTemplates) {
      try {
        // Apply light templating to the content
        const templateData = prepareTemplateVariables(analysisData)
        const processedContent = applyLightTemplating(template.content, templateData)

        // Generate filename based on template name or ID
        const filename = this.generateRuleFilename(template)
        const filePath = path.join(rulesOutputPath, filename)

        // Write the rule file
        await fs.writeFile(filePath, processedContent, 'utf8')
        this.generatedFiles.push(filePath)

        if (this.verbose) {
          console.log(chalk.gray(`Generated rule: ${filename}`))
        }
      } catch (error) {
        if (this.verbose) {
          console.log(
            chalk.yellow(`Failed to generate rule from template ${template.name}: ${error.message}`)
          )
        }
      }
    }
  }

  /**
   * Generate appropriate filename for a rule template
   * @param {Object} template - Rule template
   * @returns {string} Filename for the rule
   */
  generateRuleFilename(template) {
    // Use the template's suggested filename or generate one
    if (template.filename) {
      return template.filename.endsWith('.md') ? template.filename : `${template.filename}.md`
    }

    if (template.name) {
      return `${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`
    }

    if (template.id) {
      return `${template.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`
    }

    // Fallback to a generic name with timestamp
    return `rule-${Date.now()}.md`
  }

  /**
   * Generate basic universal rules when no IDE detected
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Generated file paths
   */
  async generateBasicUniversalRules(_analysisData) {
    const rules = []

    // Create output directory
    await fs.mkdir(this.outputPath, { recursive: true })

    // Generate core agent rule
    const coreAgentPath = path.join(this.outputPath, '00-core-agent.md')
    const coreAgentContent = this.getDefaultCoreAgentTemplate()
    await fs.writeFile(coreAgentPath, coreAgentContent, 'utf8')
    rules.push(coreAgentPath)

    if (this.verbose) {
      console.log(chalk.gray(`Generated core agent rule at: ${coreAgentPath}`))
    }

    return rules
  }

  /**
   * Generate rules from local templates as fallback
   * @param {string} ruleType - Type of rules (tasks, tools, assistants)
   * @param {Array} relevantItems - Array of relevant item names
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Array of generated rules
   */
  async generateFromLocalTemplates(ruleType, relevantItems, analysisData) {
    const rules = []

    for (const item of relevantItems) {
      try {
        const rule = await this.generateBasicRule(ruleType, item, analysisData)
        if (rule) {
          rules.push(rule)
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(
            chalk.yellow(`Failed to generate ${ruleType} rule for ${item}: ${error.message}`)
          )
        }
      }
    }

    return rules
  }

  /**
   * Generate a basic rule for a specific item
   * @param {string} ruleType - Type of rule
   * @param {string} item - Item name
   * @param {Object} analysisData - Analysis data
   * @returns {Object} Generated rule object
   */
  async generateBasicRule(ruleType, item, analysisData) {
    const projectName = analysisData.projectContext?.name || 'Project'
    const frameworks = analysisData.techStack?.frameworks || []

    const ruleContent = `---
description: ${ruleType.charAt(0).toUpperCase() + ruleType.slice(0, -1)} rule for ${item}
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["${frameworks.join('", "')}"]
alwaysApply: false
category: "${ruleType.slice(0, -1)}"
---

# ${item} - ${ruleType.charAt(0).toUpperCase() + ruleType.slice(0, -1)} Rule

## Overview
This rule provides guidance for ${item} in ${projectName}.

## Guidelines
- Follow project conventions
- Maintain consistency with existing ${ruleType}
- Use appropriate best practices for ${frameworks.join(', ')}

## Integration
When working with ${item}:
1. Check existing patterns in the codebase
2. Follow established conventions
3. Maintain code quality standards

---
NOTE TO AI: Apply this rule when working with ${item} in this project.
`

    return {
      name: item,
      type: ruleType,
      content: ruleContent,
      filePath: path.join(this.outputPath, `${item}.md`),
    }
  }

  /**
   * Gets default core agent template
   * @returns {string} Default template content
   */
  getDefaultCoreAgentTemplate() {
    return `---
description: Core agent behavior and fundamental rules for AI assistance
globs:
alwaysApply: true
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["All-AI-Assistants", "Core-Behavior"]
---

# Core Agent Rules

## Fundamental Behavior

### Code Quality Standards
- Always write clean, readable, and maintainable code
- Follow established patterns and conventions in the project
- Implement proper error handling and edge case management
- Use meaningful variable and function names

### Project Integration
- Understand the project context before making changes
- Maintain consistency with existing codebase patterns
- Consider the impact of changes on the entire system
- Follow the project's architectural decisions

### Communication
- Provide clear explanations for code changes
- Document complex logic and architectural decisions
- Ask for clarification when requirements are ambiguous
- Suggest improvements while respecting project constraints

## Development Principles

1. **Backward Compatibility**: Maintain compatibility unless explicitly told otherwise
2. **Security First**: Always consider security implications of code changes
3. **Performance Awareness**: Write efficient code and consider performance impact
4. **Testing**: Include appropriate tests for new functionality
5. **Documentation**: Keep documentation up to date with code changes

---
NOTE TO AI: These are the fundamental rules that apply to all interactions in this project.
`
  }

  // ============================================================================
  // HANDLEBARS TEMPLATE FALLBACK METHODS
  // Used when remote rules are unavailable - generates the 4 core .mdc files
  // ============================================================================

  /**
   * Generates core rule files using light templating (fallback when remote fails)
   * @param {Object} analysisData - Combined analysis results
   * @returns {string[]} List of generated file paths
   */
  async generateLocalTemplateRules(analysisData) {
    if (this.verbose) {
      console.log(chalk.gray('Generating rules from local templates (fallback mode)...'))
    }

    this.generatedFiles = []

    // Ensure output directory exists
    await fs.mkdir(this.outputPath, { recursive: true })

    // Generate the 4 core rules that the CLI currently produces
    await this.generateCoreAgentRule(analysisData)
    await this.generateProjectContextRule(analysisData)
    await this.generateCommonErrorsRule(analysisData)
    await this.generateMcpConfigRule(analysisData)

    return this.generatedFiles
  }

  /**
   * Generates 00-core-agent.mdc with core agent behavior
   */
  async generateCoreAgentRule(analysisData) {
    const _variables = prepareTemplateVariables(analysisData)
    const content = `---
description: "Core agent behavior and personality configuration"
globs: []
alwaysApply: true
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["01-project-context.mdc", "02-common-errors.mdc", "03-mcp-configuration.mdc"]
---

# 🤖 Core Agent Configuration

**Behavior and personality settings for AI assistants**

## 1. Role & Responsibility

You are an expert AI Developer Assistant. Your primary goal is to help users write, understand, debug, and improve code effectively and efficiently while working with this specific codebase.

## 2. Core Principles

- **Expertise**: Act as a knowledgeable full-stack developer familiar with modern best practices
- **Context Awareness**: Always consider the current project structure, technologies, and patterns
- **Clarity**: Provide clear, actionable explanations and code examples
- **Efficiency**: Prioritize solutions that are maintainable, performant, and follow project conventions

## 3. Response Style

- Be direct and concise while remaining helpful
- Use code examples when explaining concepts
- Reference specific files and line numbers when relevant
- Suggest improvements that align with project patterns`

    await this.writeRuleFile('00-core-agent.mdc', content)
  }

  /**
   * Generates 01-project-context.mdc with project-specific information
   */
  async generateProjectContextRule(analysisData) {
    const variables = prepareTemplateVariables(analysisData)
    const content = applyLightTemplating(
      `---
description: "Project-specific context and technology stack information"
globs: []
alwaysApply: true
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["00-core-agent.mdc", "02-common-errors.mdc", "03-mcp-configuration.mdc"]
---

# 📋 Project Context

**Current project: \${projectName}**

## 1. Project Overview

- **Type**: \${projectType}
- **Primary Language**: \${primaryLanguage}
- **Architecture**: \${architecturalPattern}

## 2. Technology Stack

### Languages
\${join languages}

### Frameworks & Libraries
\${join frameworks}

### Key Features
- Tests: \${hasTests ? 'Available' : 'Not configured'}
- Components: \${hasComponents ? 'Available' : 'Not configured'}
- Documentation: \${hasDocs ? 'Available' : 'Not configured'}

## 3. Project Structure

- **Source**: \${srcPath}
- **Tests**: \${testPath}
- **Docs**: \${docsPath}`,
      variables
    )

    await this.writeRuleFile('01-project-context.mdc', content)
  }

  /**
   * Generates 02-common-errors.mdc with error patterns
   */
  async generateCommonErrorsRule(analysisData) {
    const variables = prepareTemplateVariables(analysisData)
    const content = applyLightTemplating(
      `---
description: "Common error patterns and debugging guidance"
globs: []
alwaysApply: false
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["00-core-agent.mdc", "01-project-context.mdc", "03-mcp-configuration.mdc"]
---

# 🐛 Common Error Patterns

**Error detection and resolution guidance for \${projectName}**

## 1. Technology-Specific Errors

### \${primaryLanguage} Common Issues
- Check syntax and imports
- Verify variable naming conventions
- Ensure proper error handling

## 2. Framework-Specific Issues
\${frameworks.length > 0 ? 'Based on detected frameworks: ' + join(frameworks) : 'No specific frameworks detected'}

## 3. Common Error Categories

*This section will be populated based on project analysis*

## 4. Debugging Guidelines

- Always check the console/logs first
- Verify file paths and imports
- Check for typos in variable names
- Ensure dependencies are installed`,
      variables
    )

    await this.writeRuleFile('02-common-errors.mdc', content)
  }

  /**
   * Generates 03-mcp-configuration.mdc with MCP setup
   */
  async generateMcpConfigRule(analysisData) {
    const variables = prepareTemplateVariables(analysisData)
    const content = applyLightTemplating(
      `---
description: "MCP (Model Context Protocol) configuration and setup"
globs: []
alwaysApply: false
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["00-core-agent.mdc", "01-project-context.mdc", "02-common-errors.mdc"]
---

# ⚙️ MCP Configuration

**Model Context Protocol setup for \${projectName}**

## 1. MCP Overview

The Model Context Protocol enables AI assistants to access external tools and data sources securely.

## 2. Available Servers

*Configure MCP servers based on your project needs*

## 3. Available MCP Servers

*This section will be populated with detected MCP servers*

## 4. Configuration Guidelines

- Use secure connections only
- Limit access to necessary resources
- Monitor server responses for errors
- Keep configurations up to date`,
      variables
    )

    await this.writeRuleFile('03-mcp-configuration.mdc', content)
  }

  /**
   * Helper to write rule files with proper error handling
   */
  async writeRuleFile(filename, content) {
    const filePath = path.join(this.outputPath, filename)

    try {
      await fs.writeFile(filePath, content, 'utf8')
      this.generatedFiles.push(filePath)

      if (this.verbose) {
        console.log(chalk.gray(`Generated ${filename}`))
      } else {
        console.log(`Generated ${filename} at: ${path.relative(process.cwd(), filePath)}`)
      }
    } catch (error) {
      console.error(chalk.red(`Failed to write ${filename}: ${error.message}`))
      throw error
    }
  }
}
