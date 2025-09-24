/**
 * Generic AI Integration Module
 * ---------------------------
 * Provides integration with generic AI platforms and services not covered
 * by specific integrations. Handles custom AI configurations, third-party
 * AI services, and generic AI assistant setups.
 */

import fs from 'node:fs'
import path from 'node:path'

import { BaseIntegration } from './base-integration.js'

/**
 * Generic AI integration that detects and manages AI services and platforms
 * not covered by specific integrations (Claude Code, Cursor, etc.)
 */
export class GenericAIIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Generic AI Platform', projectPath)
    this.detectedAIServices = []
  }

  /**
   * Detect AI platform usage in the project
   * @returns {Object} Detection result with details
   */
  detectUsage() {
    const detection = this.createDetectionResult({
      isUsed: false,
      confidence: 'none',
      indicators: [],
      recommendations: [],
      hasProjectSpecificConfig: false,
    })

    // Check for generic AI configuration files
    this.checkAIConfigFiles(detection)

    // Check for AI-related environment variables
    this.checkAIEnvironmentVariables(detection)

    // Check for AI service configurations
    this.checkAIServiceConfigurations(detection)

    // Check for custom AI tool configurations
    this.checkCustomAITools(detection)

    // Add recommendations based on findings
    this.addAIRecommendations(detection)

    return detection
  }

  /**
   * Check for generic AI configuration files
   * @param {Object} detection - Detection result to update
   */
  checkAIConfigFiles(detection) {
    const aiConfigFiles = {
      'AI configuration file (.aiconfig.json)': path.join(this.projectPath, '.aiconfig.json'),
      'AI configuration file (ai-config.json)': path.join(this.projectPath, 'ai-config.json'),
      'AI assistant configuration (.ai-assistant.json)': path.join(this.projectPath, '.ai-assistant.json'),
      'LLM configuration (llm-config.json)': path.join(this.projectPath, 'llm-config.json'),
      'OpenAI configuration (.openai.json)': path.join(this.projectPath, '.openai.json'),
      'Anthropic configuration (.anthropic.json)': path.join(this.projectPath, '.anthropic.json'),
      'Generic AI directory (.ai/)': path.join(this.projectPath, '.ai'),
      'AI configuration directory (.ai-config/)': path.join(this.projectPath, '.ai-config'),
      'LLM directory (.llm/)': path.join(this.projectPath, '.llm'),
      'GPT configuration directory (.gpt/)': path.join(this.projectPath, '.gpt'),
      'Assistant configuration directory (.assistant/)': path.join(this.projectPath, '.assistant'),
    }

    this.checkPaths(detection, aiConfigFiles, 'medium', true)
  }

  /**
   * Check for AI-related environment variables
   * @param {Object} detection - Detection result to update
   */
  checkAIEnvironmentVariables(detection) {
    const envFiles = ['.env', '.env.local', '.env.ai', '.env.llm', '.env.openai']
    const aiEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'CLAUDE_API_KEY',
      'AI_API_KEY',
      'LLM_API_KEY',
      'COHERE_API_KEY',
      'HUGGING_FACE_API_KEY',
      'REPLICATE_API_TOKEN',
      'TOGETHER_API_KEY',
      'FIREWORKS_API_KEY',
      'MISTRAL_API_KEY',
      'GROQ_API_KEY',
      'PERPLEXITY_API_KEY',
      'PALM_API_KEY',
      'GEMINI_API_KEY',
    ]

    for (const envFile of envFiles) {
      const envPath = path.join(this.projectPath, envFile)
      if (this.fileExists(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf8')
          for (const varName of aiEnvVars) {
            if (content.includes(varName)) {
              detection.indicators.push(`AI API key configuration found in ${envFile} (${varName})`)
              detection.isUsed = true
              detection.hasProjectSpecificConfig = true
              if (detection.confidence === 'none') {
                detection.confidence = 'low'
              }
            }
          }
        } catch (error) {
          // Ignore file read errors
        }
      }
    }
  }

  /**
   * Check for AI service configurations in package.json and other files
   * @param {Object} detection - Detection result to update
   */
  checkAIServiceConfigurations(detection) {
    // Check package.json for AI dependencies
    const packageJsonPath = path.join(this.projectPath, 'package.json')
    if (this.fileExists(packageJsonPath)) {
      try {
        const packageJson = this.readJsonFile(packageJsonPath)
        if (packageJson) {
          const aiDependencies = [
            'openai',
            '@anthropic-ai/sdk',
            'langchain',
            '@langchain/core',
            'llamaindex',
            'ai',
            'vercel-ai',
            '@ai-sdk/openai',
            '@ai-sdk/anthropic',
            'gpt-3-encoder',
            'gpt4all',
            'ollama',
            'replicate',
            'cohere-ai',
            'together-ai',
          ]

          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
          }

          for (const dep of aiDependencies) {
            if (allDeps[dep]) {
              detection.indicators.push(`AI dependency found: ${dep}`)
              detection.isUsed = true
              detection.hasProjectSpecificConfig = true
              if (detection.confidence === 'none') {
                detection.confidence = 'low'
              }
            }
          }
        }
      } catch (error) {
        // Ignore package.json read errors
      }
    }

    // Check for AI service configuration files
    const serviceConfigFiles = {
      'Langchain configuration': path.join(this.projectPath, 'langchain.config.js'),
      'AI SDK configuration': path.join(this.projectPath, 'ai.config.js'),
      'OpenAI configuration': path.join(this.projectPath, 'openai.config.js'),
      'Anthropic configuration': path.join(this.projectPath, 'anthropic.config.js'),
      'Ollama configuration': path.join(this.projectPath, 'ollama.config.js'),
      'AI workflow configuration': path.join(this.projectPath, 'ai-workflow.json'),
      'LLM pipeline configuration': path.join(this.projectPath, 'llm-pipeline.json'),
    }

    this.checkPaths(detection, serviceConfigFiles, 'medium', true)
  }

  /**
   * Check for custom AI tools and configurations
   * @param {Object} detection - Detection result to update
   */
  checkCustomAITools(detection) {
    // Check for AI-related scripts and tools
    const aiToolPaths = {
      'AI scripts directory (scripts/ai/)': path.join(this.projectPath, 'scripts', 'ai'),
      'AI tools directory (tools/ai/)': path.join(this.projectPath, 'tools', 'ai'),
      'AI utilities directory (utils/ai/)': path.join(this.projectPath, 'utils', 'ai'),
      'AI helpers directory (helpers/ai/)': path.join(this.projectPath, 'helpers', 'ai'),
      'Custom AI prompt templates': path.join(this.projectPath, 'prompts'),
      'AI prompt directory': path.join(this.projectPath, 'ai-prompts'),
      'LLM prompt templates': path.join(this.projectPath, 'llm-prompts'),
    }

    this.checkPaths(detection, aiToolPaths, 'low', true)

    // Check for AI-related files in common directories
    const commonDirs = ['src', 'lib', 'utils', 'helpers', 'tools']
    for (const dir of commonDirs) {
      const dirPath = path.join(this.projectPath, dir)
      if (this.directoryExists(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath)
          const aiFiles = files.filter(
            (file) =>
              file.includes('ai') ||
              file.includes('llm') ||
              file.includes('gpt') ||
              file.includes('claude') ||
              file.includes('openai') ||
              file.includes('anthropic')
          )

          if (aiFiles.length > 0) {
            detection.indicators.push(`AI-related files found in ${dir}/ (${aiFiles.length} files)`)
            detection.isUsed = true
            detection.hasProjectSpecificConfig = true
            if (detection.confidence === 'none') {
              detection.confidence = 'low'
            }
          }
        } catch (error) {
          // Ignore directory read errors
        }
      }
    }
  }

  /**
   * Add AI-specific recommendations
   * @param {Object} detection - Detection result to update
   */
  addAIRecommendations(detection) {
    if (detection.confidence === 'none') {
      detection.recommendations.push('No AI platform configurations detected')
      detection.recommendations.push('Consider setting up AI assistance with: vdk init --interactive')
      detection.recommendations.push('VDK can help configure AI tools for your development workflow')
    } else if (detection.confidence === 'low') {
      detection.recommendations.push('Basic AI configurations detected but may need optimization')
      detection.recommendations.push('Run: vdk init to create optimized AI assistant rules')
      detection.recommendations.push('Consider creating project-specific AI prompts and templates')
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('AI configurations found - consider centralizing with VDK')
      detection.recommendations.push('VDK can help standardize AI tool configurations across your project')
      detection.recommendations.push('Review .vdk/rules/ for AI assistant optimization opportunities')
    } else {
      detection.recommendations.push('Well-configured AI setup detected')
      detection.recommendations.push('Consider creating custom AI rules for your specific project patterns')
      detection.recommendations.push('Keep AI configurations updated as your project evolves')
    }
  }

  /**
   * Get configuration paths for detected AI services
   * @returns {Object} Configuration paths for AI services
   */
  getConfigPaths() {
    return {
      aiConfig: path.join(this.projectPath, '.ai'),
      vdkRules: path.join(this.projectPath, '.vdk', 'rules'),
      aiConfigFiles: [
        path.join(this.projectPath, '.aiconfig.json'),
        path.join(this.projectPath, 'ai-config.json'),
        path.join(this.projectPath, '.ai-assistant.json'),
        path.join(this.projectPath, 'llm-config.json'),
      ],
      envFiles: [
        path.join(this.projectPath, '.env'),
        path.join(this.projectPath, '.env.local'),
        path.join(this.projectPath, '.env.ai'),
      ],
      promptDirectories: [
        path.join(this.projectPath, 'prompts'),
        path.join(this.projectPath, 'ai-prompts'),
        path.join(this.projectPath, 'llm-prompts'),
      ],
    }
  }

  /**
   * Initialize generic AI integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const { verbose = false } = options

    try {
      if (verbose) {
        console.log('Setting up generic AI platform integration...')
      }

      // Ensure .vdk/rules directory exists
      const rulesPath = path.join(this.projectPath, '.vdk', 'rules')
      await this.ensureDirectory(rulesPath)

      // Create basic AI configuration if none exists
      await this.createBasicAIConfiguration(rulesPath, options)

      // Add .vdk to .gitignore if not already present
      await this.ensureGitignoreEntry('.vdk/')

      if (verbose) {
        console.log('✅ Generic AI platform integration configured')
      }

      return true
    } catch (error) {
      if (verbose) {
        console.log(`❌ Failed to configure generic AI integration: ${error.message}`)
      }
      return false
    }
  }

  /**
   * Create basic AI configuration for projects without specific AI setups
   * @param {string} rulesPath - Path to rules directory
   * @param {Object} options - Configuration options
   */
  async createBasicAIConfiguration(rulesPath, options = {}) {
    // Create basic AI assistant configuration
    const aiConfigPath = path.join(rulesPath, 'ai-assistant.md')

    if (!this.fileExists(aiConfigPath)) {
      const basicConfig = `# AI Assistant Configuration

This project uses VDK (Vibe Development Kit) for AI assistant integration.

## Project Context

This configuration was automatically generated by VDK to provide basic AI assistance for your project.

## Usage

- AI assistants can use this configuration to better understand your project structure
- Customize this file to include project-specific patterns and conventions
- Add more specific rules in the .vdk/rules/ directory as needed

## Generated

- Generated by: VDK CLI
- Date: ${new Date().toISOString()}
- Project: ${path.basename(this.projectPath)}

## Next Steps

1. Run \`vdk scan\` to analyze your project and generate specific rules
2. Review and customize the generated rules for your project
3. Consider setting up IDE-specific integrations with \`vdk init --interactive\`
`

      await fs.promises.writeFile(aiConfigPath, basicConfig, 'utf8')
    }

    // Create VDK configuration file
    const vdkConfigPath = path.join(rulesPath, '.vdk-config.json')
    if (!this.fileExists(vdkConfigPath)) {
      const config = {
        platform: 'generic-ai',
        rulesFormat: 'md',
        lastUpdated: new Date().toISOString(),
        vdkVersion: '3.0.0',
        autoGenerated: true,
      }

      await this.writeJsonFile(vdkConfigPath, config)
    }
  }

  /**
   * Get detected AI services information
   * @returns {Array} Array of detected AI service configurations
   */
  getDetectedAIServices() {
    const detection = this.getCachedDetection()
    return detection.detectedAIServices || []
  }

  /**
   * Check if specific AI service is detected
   * @param {string} serviceName - Name of AI service to check
   * @returns {boolean} True if service is detected
   */
  isAIServiceDetected(serviceName) {
    const detection = this.getCachedDetection()
    return detection.indicators.some((indicator) => indicator.toLowerCase().includes(serviceName.toLowerCase()))
  }

  /**
   * Get summary of AI platform integration
   * @returns {Object} Summary of AI integration status
   */
  getSummary() {
    const detection = this.getCachedDetection()
    const baseSummary = super.getSummary()

    return {
      ...baseSummary,
      detectedServices: this.getDetectedAIServices().length,
      hasProjectConfig: detection.hasProjectSpecificConfig,
      aiIndicators: detection.indicators.filter((i) => i.includes('AI') || i.includes('LLM') || i.includes('API key'))
        .length,
    }
  }
}
