/**
 * Generic AI Platform Integration
 * -------------------------------
 * Detects and manages integration with generic AI platforms and tools
 * Handles .ai/ configuration folders and provides fallback support for unknown AI tools.
 */

import fs from 'node:fs'
import path from 'node:path'
import { BaseIntegration } from './base-integration.js'

/**
 * Generic AI Platform integration for VDK
 */
export class GenericAIIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Generic AI Platform', projectPath)
  }

  /**
   * Detect Generic AI platform usage in the project
   */
  detectUsage() {
    const indicators = []
    const recommendations = []
    let confidence = 'none'

    // Check for .ai folder
    const aiPath = path.join(this.projectPath, '.ai')
    if (fs.existsSync(aiPath)) {
      indicators.push('Found .ai configuration folder')
      confidence = 'high'

      // Check for common AI configuration files
      const configFiles = [
        'config.json',
        'settings.json',
        'prompts.json',
        'context.json'
      ]

      for (const file of configFiles) {
        const filePath = path.join(aiPath, file)
        if (fs.existsSync(filePath)) {
          indicators.push(`Found .ai/${file}`)
        }
      }

      // Check for rules directory
      const rulesPath = path.join(aiPath, 'rules')
      if (fs.existsSync(rulesPath)) {
        indicators.push('AI rules directory found')
        
        // Count rule files
        try {
          const ruleFiles = fs.readdirSync(rulesPath)
            .filter(file => file.endsWith('.mdc') || file.endsWith('.md'))
          
          if (ruleFiles.length > 0) {
            indicators.push(`Found ${ruleFiles.length} rule files`)
          }
        } catch (error) {
          // Ignore read errors
        }
      } else {
        recommendations.push('Create .ai/rules/ directory for VDK Blueprint rules')
      }
    }

    // Check for other AI-related configuration patterns
    const aiConfigPatterns = [
      '.ai-config/',
      '.llm/',
      '.gpt/',
      '.assistant/',
      'ai.config.json',
      'llm.config.json'
    ]

    for (const pattern of aiConfigPatterns) {
      const patternPath = path.join(this.projectPath, pattern)
      if (fs.existsSync(patternPath)) {
        indicators.push(`Found AI configuration: ${pattern}`)
        if (confidence === 'none') confidence = 'low'
      }
    }

    // Check for AI-related environment variables or config files
    const envFiles = ['.env', '.env.local', '.env.ai']
    for (const envFile of envFiles) {
      const envPath = path.join(this.projectPath, envFile)
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf8')
          const aiRelatedVars = [
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'AI_API_KEY',
            'LLM_API_KEY',
            'CLAUDE_API_KEY'
          ]

          for (const varName of aiRelatedVars) {
            if (content.includes(varName)) {
              indicators.push(`AI API configuration found in ${envFile}`)
              if (confidence === 'none') confidence = 'low'
              break
            }
          }
        } catch (error) {
          // Ignore file read errors
        }
      }
    }

    // General recommendations
    if (confidence === 'none') {
      recommendations.push('Consider creating .ai/ folder for AI tool configuration')
      recommendations.push('Use .ai/rules/ directory to organize AI Blueprint rules')
    } else {
      recommendations.push('Organize AI rules in .ai/rules/ directory using .mdc format')
      recommendations.push('Use .ai/config.json for platform-specific settings')
      recommendations.push('Consider adding context files in .ai/ for better AI assistance')
    }

    return {
      isUsed: confidence !== 'none',
      confidence,
      indicators,
      recommendations
    }
  }

  /**
   * Get configuration paths
   */
  getConfigPaths() {
    return {
      projectConfig: path.join(this.projectPath, '.ai'),
      rulesPath: path.join(this.projectPath, '.ai', 'rules'),
      configFile: path.join(this.projectPath, '.ai', 'config.json'),
      contextFile: path.join(this.projectPath, '.ai', 'context.json'),
      promptsFile: path.join(this.projectPath, '.ai', 'prompts.json')
    }
  }

  /**
   * Initialize Generic AI integration
   */
  async initialize(options = {}) {
    const { verbose = false } = options

    try {
      const configPaths = this.getConfigPaths()

      // Create .ai directory if it doesn't exist
      if (!fs.existsSync(configPaths.projectConfig)) {
        fs.mkdirSync(configPaths.projectConfig, { recursive: true })
        if (verbose) {
          console.log(`Created AI config directory: ${configPaths.projectConfig}`)
        }
      }

      // Create rules directory if it doesn't exist
      if (!fs.existsSync(configPaths.rulesPath)) {
        fs.mkdirSync(configPaths.rulesPath, { recursive: true })
        if (verbose) {
          console.log(`Created rules directory: ${configPaths.rulesPath}`)
        }
      }

      // Create basic config file if it doesn't exist
      if (!fs.existsSync(configPaths.configFile)) {
        const defaultConfig = {
          version: "1.0.0",
          platform: "generic-ai",
          rules: {
            priority: 5,
            autoLoad: true,
            formats: ["mdc", "md"]
          },
          context: {
            includeProjectStructure: true,
            includeRecentChanges: true,
            maxContextSize: 50000
          }
        }

        fs.writeFileSync(configPaths.configFile, JSON.stringify(defaultConfig, null, 2))
        if (verbose) {
          console.log(`Created default config file: ${configPaths.configFile}`)
        }
      }

      // Create basic context file if it doesn't exist
      if (!fs.existsSync(configPaths.contextFile)) {
        const contextContent = {
          projectName: path.basename(this.projectPath),
          description: "AI context for generic AI platform integration",
          lastUpdated: new Date().toISOString(),
          keywords: [],
          technologies: [],
          frameworks: []
        }

        fs.writeFileSync(configPaths.contextFile, JSON.stringify(contextContent, null, 2))
        if (verbose) {
          console.log(`Created context file: ${configPaths.contextFile}`)
        }
      }

      return true
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Generic AI integration: ${error.message}`)
      }
      return false
    }
  }

  /**
   * Get integration summary
   */
  getSummary() {
    const detection = this.getCachedDetection()
    const configPaths = this.getConfigPaths()

    let ruleCount = 0
    try {
      if (fs.existsSync(configPaths.rulesPath)) {
        const ruleFiles = fs.readdirSync(configPaths.rulesPath)
          .filter(file => file.endsWith('.mdc') || file.endsWith('.md'))
        ruleCount = ruleFiles.length
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      name: this.name,
      isActive: detection.isUsed,
      confidence: detection.confidence,
      configPath: configPaths.projectConfig,
      rulesPath: configPaths.rulesPath,
      ruleCount,
      priority: 5,
      contextAware: true
    }
  }
}

export default GenericAIIntegration