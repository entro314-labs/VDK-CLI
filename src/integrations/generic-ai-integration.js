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
   * NOTE: Only as last resort fallback - should NOT run when specific IDEs detected
   */
  detectUsage() {
    const indicators = []
    const recommendations = []
    let confidence = 'none'

    // ONLY detect existing user-created AI configurations - NEVER create folders
    // This integration should be a last resort that provides guidance, not pollution

    // Check for actual user-created AI config files (not folders VDK might create)
    const userCreatedAIFiles = ['.aiconfig.json', 'ai-config.json', '.ai-assistant.json', 'llm-config.json']

    for (const configFile of userCreatedAIFiles) {
      const configPath = path.join(this.projectPath, configFile)
      if (fs.existsSync(configPath)) {
        indicators.push(`Found user AI configuration: ${configFile}`)
        confidence = 'low' // Very low confidence - just provide guidance
      }
    }

    // Check for other AI-related configuration patterns
    const aiConfigPatterns = ['.ai-config/', '.llm/', '.gpt/', '.assistant/', 'ai.config.json', 'llm.config.json']

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
          const aiRelatedVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AI_API_KEY', 'LLM_API_KEY', 'CLAUDE_API_KEY']

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

    // Provide guidance recommendations (but NEVER create folders automatically)
    if (confidence === 'none') {
      recommendations.push(
        'No specific AI tool detected - consider using a supported IDE like VS Code, Cursor, or Windsurf'
      )
      recommendations.push('Run "vdk browse" to explore available AI integrations')
    } else {
      recommendations.push('Consider migrating to a supported AI IDE for better VDK integration')
      recommendations.push('Use "vdk migrate" to convert existing AI configurations')
    }

    return {
      isUsed: confidence !== 'none',
      confidence,
      indicators,
      recommendations,
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
      promptsFile: path.join(this.projectPath, '.ai', 'prompts.json'),
    }
  }

  /**
   * Generic AI integration does NOT initialize folders - it only provides guidance
   * Use specific IDE integrations for actual file creation
   */
  async initialize(options = {}) {
    const { verbose = false } = options

    if (verbose) {
      console.log('Generic AI integration provides guidance only - no files created')
      console.log('Use a specific IDE integration (VS Code, Cursor, etc.) for file generation')
    }

    return true // Always succeeds since it does nothing
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
        const ruleFiles = fs
          .readdirSync(configPaths.rulesPath)
          .filter((file) => file.endsWith('.mdc') || file.endsWith('.md'))
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
      contextAware: true,
    }
  }
}

export default GenericAIIntegration
