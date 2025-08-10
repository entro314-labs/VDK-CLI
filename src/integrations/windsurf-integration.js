/**
 * Windsurf Integration Module
 * ---------------------------
 * Provides enhanced integration with Windsurf AI Editor,
 * including Codeium AI features, Windsurf-specific configurations, and optimized workflows.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BaseIntegration } from './base-integration.js'

/**
 * Windsurf AI Editor configuration and integration utilities
 */
export class WindsurfIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Windsurf', projectPath)
    this.windsurfConfigPath = path.join(projectPath, '.windsurf')
    this.globalWindsurfConfigPath = path.join(os.homedir(), '.codeium', 'windsurf')
  }

  /**
   * Get Windsurf configuration paths (updated for native memories system)
   * @returns {Object} Configuration paths for Windsurf
   */
  getConfigPaths() {
    return {
      // Project-specific configurations
      projectConfig: path.join(this.windsurfConfigPath, 'config.json'),
      projectSettings: path.join(this.windsurfConfigPath, 'settings.json'),
      rulesDirectory: path.join(this.windsurfConfigPath, 'rules'),
      workspaceConfig: path.join(this.windsurfConfigPath, 'workspace.json'),
      aiConfig: path.join(this.windsurfConfigPath, 'ai_settings.json'),

      // Native Windsurf memories system
      globalMemories: path.join(os.homedir(), '.codeium', 'windsurf', 'memories'),
      globalRulesFile: path.join(
        os.homedir(),
        '.codeium',
        'windsurf',
        'memories',
        'global_rules.md'
      ),

      // Global configurations
      globalConfig: path.join(this.globalWindsurfConfigPath, 'config.json'),
      globalMcp: path.join(this.globalWindsurfConfigPath, 'mcp_config.json'),
      projectMcp: path.join(this.windsurfConfigPath, 'mcp_config.json'),
      codeiumConfig: path.join(os.homedir(), '.codeium', 'config'),
    }
  }

  /**
   * Detect if Windsurf is actively being used in the project
   * @returns {Object} Detection result with details
   */
  detectUsage() {
    const detection = {
      isUsed: false,
      confidence: 'none', // none, low, medium, high
      indicators: [],
      recommendations: [],
    }

    // 1. Check for .windsurf directory structure
    if (this.directoryExists(this.windsurfConfigPath)) {
      detection.indicators.push('Project has .windsurf directory')
      detection.confidence = 'high'
      detection.isUsed = true

      // Check for specific Windsurf files
      const windsurfFiles = [
        'config.json',
        'settings.json',
        'workspace.json',
        'mcp_config.json',
        'ai_settings.json',
      ]

      windsurfFiles.forEach((file) => {
        const filePath = path.join(this.windsurfConfigPath, file)
        if (this.fileExists(filePath)) {
          detection.indicators.push(`Found .windsurf/${file}`)
          if (file === 'config.json' || file === 'ai_settings.json') {
            detection.confidence = 'high'
          }
        }
      })

      // Check for rules directory and memories system
      const rulesPath = path.join(this.windsurfConfigPath, 'rules')
      if (this.directoryExists(rulesPath)) {
        detection.indicators.push('Found .windsurf/rules directory')
        detection.confidence = 'high'
      }

      // Check for native memories system
      const memoriesPath = path.join(os.homedir(), '.codeium', 'windsurf', 'memories')
      if (this.directoryExists(memoriesPath)) {
        detection.indicators.push('Found Windsurf native memories directory')
        detection.confidence = 'high'
      }
    }

    // 2. Check for global Codeium/Windsurf installation
    const platformPaths = this.getPlatformPaths()
    const windsurfPaths = [
      platformPaths.applications ? path.join(platformPaths.applications, 'Windsurf.app') : null,
      platformPaths.applications ? path.join(platformPaths.applications, 'Codeium.app') : null,
      platformPaths.home ? path.join(platformPaths.home, '.codeium') : null,
      platformPaths.appData ? path.join(platformPaths.appData, 'Codeium') : null,
      platformPaths.appData ? path.join(platformPaths.appData, 'Windsurf') : null,
    ].filter(Boolean)

    windsurfPaths.forEach((windsurfPath) => {
      if (this.directoryExists(windsurfPath)) {
        detection.indicators.push(`Windsurf/Codeium installation found at ${windsurfPath}`)
        if (detection.confidence === 'none') {
          detection.confidence = 'low'
        }
      }
    })

    // 3. Check for Windsurf command availability
    const commands = ['windsurf', 'codeium']
    commands.forEach((command) => {
      if (this.commandExists(command)) {
        detection.indicators.push(`${command} CLI command is available`)
        if (detection.confidence === 'none') {
          detection.confidence = 'medium'
        }

        const version = this.getCommandVersion(command, '--version')
        if (version) {
          detection.indicators.push(`${command} version: ${version}`)
        }
      }
    })

    // 4. Check for Windsurf-specific workspace indicators
    const workspaceIndicators = ['.windsurf/', '.windsurf/rules/', '.codeium/']

    workspaceIndicators.forEach((indicator) => {
      const indicatorPath = path.join(this.projectPath, indicator)
      if (this.directoryExists(indicatorPath)) {
        detection.indicators.push(`Workspace has ${indicator}`)
        detection.isUsed = true
        if (detection.confidence === 'none' || detection.confidence === 'low') {
          detection.confidence = 'medium'
        }
      }
    })

    // 5. Check for Codeium API configuration
    try {
      const codeiumConfigPath = path.join(os.homedir(), '.codeium', 'config')
      if (this.fileExists(codeiumConfigPath)) {
        detection.indicators.push('Codeium API configuration found')
        if (detection.confidence === 'none') {
          detection.confidence = 'low'
        }
      }
    } catch {
      // Skip if homedir is not available
    }

    // 6. Check .gitignore for Windsurf patterns
    const gitignorePatterns = this.checkGitignore(['.windsurf', '.codeium'])
    if (gitignorePatterns.length > 0) {
      detection.indicators.push(
        `Windsurf paths found in .gitignore: ${gitignorePatterns.join(', ')}`
      )
    }

    // 7. Check for recent Windsurf activity
    const windsurfLogPaths = [
      platformPaths.logs ? path.join(platformPaths.logs, 'Windsurf') : null,
      platformPaths.logs ? path.join(platformPaths.logs, 'Codeium') : null,
      platformPaths.home ? path.join(platformPaths.home, '.codeium', 'logs') : null,
    ].filter(Boolean)

    windsurfLogPaths.forEach((logPath) => {
      const recentLogs = this.getRecentActivity(logPath, 7)
      if (recentLogs.length > 0) {
        detection.indicators.push(`Recent Windsurf activity (${recentLogs.length} log files)`)
        detection.isUsed = true
        detection.confidence = 'high'
      }
    })

    // 8. Generate recommendations based on detection
    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Windsurf not detected. Install from: https://codeium.com/windsurf'
      )
    } else if (detection.confidence === 'low') {
      detection.recommendations.push(
        'Windsurf may be installed but not configured for this project'
      )
      detection.recommendations.push(
        'Run: vdk init --ide-integration to configure Windsurf integration'
      )
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('Windsurf appears to be configured')
      detection.recommendations.push('Consider optimizing AI rules for better Codeium assistance')
    } else if (detection.confidence === 'high') {
      detection.recommendations.push('Windsurf is actively configured and being used')
      detection.recommendations.push(
        'Consider leveraging Codeium supercomplete features with custom rules'
      )
    }

    return detection
  }

  /**
   * Initialize Windsurf configuration for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const paths = this.getConfigPaths()

    try {
      // Create .windsurf directory structure
      await this.ensureDirectory(this.windsurfConfigPath)
      await this.ensureDirectory(paths.rulesDirectory)

      // Create project-specific Windsurf configuration
      if (!this.fileExists(paths.projectConfig)) {
        const windsurfConfig = {
          codeium: {
            enabled: true,
            supercomplete: true,
            chat: true,
            search: true,
          },
          ai: {
            modelPreferences: {
              chat: 'claude-3-5-sonnet',
              autocomplete: 'codeium',
              explanation: 'gpt-4',
            },
            features: {
              contextAwareness: true,
              projectScanning: true,
              documentationGeneration: true,
            },
          },
          vdk: {
            enabled: true,
            version: '1.0.0',
            integration: 'windsurf',
            rulesPath: '.windsurf/rules',
          },
          workspace: {
            autoSave: true,
            formatOnSave: true,
            linting: true,
          },
        }

        await this.writeJsonFile(paths.projectConfig, windsurfConfig)
      }

      // Create AI-specific settings
      await this.createWindsurfAISettings(options)

      // Create MCP configuration for Windsurf
      await this.createWindsurfMCPConfig(options)

      // Create Windsurf-specific AI rules
      await this.createWindsurfAIRules(options)

      // Create workspace configuration
      await this.createWindsurfWorkspaceConfig(options)

      return true
    } catch (error) {
      console.error('Failed to initialize Windsurf configuration:', error.message)
      return false
    }
  }

  /**
   * Create Windsurf AI settings configuration
   * @param {Object} options - Configuration options
   */
  async createWindsurfAISettings(_options = {}) {
    const paths = this.getConfigPaths()

    if (this.fileExists(paths.aiConfig)) {
      return // Don't overwrite existing AI config
    }

    const aiSettings = {
      codeium: {
        enableSupercomplete: true,
        enableChat: true,
        enableSearch: true,
        contextLines: 100,
        maxSuggestions: 5,
      },
      models: {
        primary: 'claude-3-5-sonnet',
        fallback: 'gpt-4',
        autocomplete: 'codeium-proprietary',
      },
      features: {
        explainCode: true,
        generateTests: true,
        documentCode: true,
        refactorCode: true,
        findBugs: true,
      },
      projectAwareness: {
        enabled: true,
        includeFiles: ['README.md', 'package.json', '*.config.*', '.ai/rules/**'],
        excludePatterns: ['node_modules/**', 'dist/**', '*.log', '.git/**'],
      },
    }

    await this.writeJsonFile(paths.aiConfig, aiSettings)
  }

  /**
   * Create MCP configuration for Windsurf
   * @param {Object} options - Configuration options
   */
  async createWindsurfMCPConfig(options = {}) {
    const paths = this.getConfigPaths()

    if (this.fileExists(paths.projectMcp)) {
      return // Don't overwrite existing MCP config
    }

    const mcpConfig = {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', this.projectPath],
          env: {},
        },
        git: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-git', '--repository', this.projectPath],
          env: {},
        },
        codeium: {
          command: 'codeium-server',
          args: ['--project-path', this.projectPath],
          env: {
            CODEIUM_API_KEY: '${CODEIUM_API_KEY}',
          },
        },
      },
      vdk: {
        enabled: true,
        projectName: options.projectName || path.basename(this.projectPath),
        rulesPath: '.windsurf/rules',
        integration: 'windsurf',
      },
    }

    await this.writeJsonFile(paths.projectMcp, mcpConfig)
  }

  /**
   * Create Windsurf workspace configuration
   * @param {Object} options - Configuration options
   */
  async createWindsurfWorkspaceConfig(options = {}) {
    const paths = this.getConfigPaths()

    if (this.fileExists(paths.workspaceConfig)) {
      return // Don't overwrite existing workspace config
    }

    const workspaceConfig = {
      folders: [
        {
          path: '.',
        },
      ],
      settings: {
        'codeium.enabled': true,
        'ai.chat.enabled': true,
        'ai.supercomplete.enabled': true,
        'files.autoSave': 'onWindowChange',
        'editor.formatOnSave': true,
        'editor.codeActionsOnSave': {
          'source.fixAll': true,
          'source.organizeImports': true,
        },
      },
      extensions: {
        recommendations: ['codeium.codeium', 'ms-vscode.vscode-typescript-next'],
      },
      vdk: {
        projectName: options.projectName || path.basename(this.projectPath),
        rulesDirectory: '.windsurf/rules',
        lastUpdated: new Date().toISOString(),
      },
    }

    await this.writeJsonFile(paths.workspaceConfig, workspaceConfig)
  }

  /**
   * Create Windsurf-specific AI rules following official format
   * @param {Object} options - Configuration options
   */
  async createWindsurfAIRules(options = {}) {
    const paths = this.getConfigPaths()
    const rulesPath = paths.rulesDirectory

    // Create global rules file (proper Windsurf format)
    await this.createGlobalRules(options)

    // Create workspace rules (following 6K character limit)
    const windsurfRulePath = path.join(rulesPath, 'vdk-integration.md')

    if (this.fileExists(windsurfRulePath)) {
      return // Don't overwrite existing rules
    }

    // Create workspace rule following Windsurf format (under 6K chars)
    const windsurfRuleContent = `# VDK Integration - Windsurf Rules

## VDK-Specific Guidelines for Windsurf

<development-standards>
- Follow existing project architecture patterns
- Use VDK CLI for AI rule generation and management
- Maintain consistent naming conventions across files
- Leverage Codeium's context awareness for better suggestions
</development-standards>

<ai-workflow>
- **Supercomplete**: Multi-line code generation and boilerplate
- **Chat**: Complex reasoning and architecture discussions
- **Search**: Find existing patterns in codebase
- **Context Scanning**: Let Codeium analyze project structure
</ai-workflow>

<model-selection>
- **Claude 3.5 Sonnet**: System design and complex reasoning
- **GPT-4**: General coding tasks and documentation
- **Codeium**: Fast autocomplete and pattern matching
</model-selection>

<vdk-integration>
- Rules stored in \`.windsurf/rules/\` directory
- Global rules in \`~/.codeium/windsurf/memories/\`
- Update with VDK CLI when project evolves
- Character limits: 6K per file, 12K total
</vdk-integration>

<quality-standards>
- Proper error handling and logging patterns
- Tests for new functionality
- Documentation updates
- Security best practices
- Performance considerations
</quality-standards>

*Generated by VDK CLI - Keep under 6K characters*`

    await fs.promises.writeFile(windsurfRulePath, windsurfRuleContent, 'utf8')
  }

  /**
   * Create global Windsurf rules following native memories format
   * @param {Object} options - Configuration options
   */
  async createGlobalRules(_options = {}) {
    const paths = this.getConfigPaths()

    // Ensure the global memories directory exists
    await this.ensureDirectory(paths.globalMemories)

    if (this.fileExists(paths.globalRulesFile)) {
      return // Don't overwrite existing global rules
    }

    const globalRulesContent = `# Global Windsurf Rules - VDK Enhanced

## Organization Standards

<coding-standards>
- Use consistent indentation (2 spaces for JS/TS, 4 for Python)
- Follow conventional commit messages (feat:, fix:, docs:)
- Prefer descriptive variable names over abbreviations
- Add meaningful comments for complex logic
- Use TypeScript for new JavaScript projects
</coding-standards>

<security-requirements>
- Never commit secrets or API keys
- Validate all user inputs
- Use environment variables for configuration
- Implement proper authentication patterns
- Keep dependencies updated
</security-requirements>

<documentation-standards>
- Write clear README files with setup instructions
- Document API endpoints with examples
- Include code examples in documentation
- Update docs when code changes
- Use JSDoc for complex functions
</documentation-standards>

<vdk-integration>
- VDK CLI generates project-aware AI rules
- Rules follow platform-specific formats
- Automatic detection of IDE configurations
- Memory management for project context
</vdk-integration>

*Organization-wide standards - Applied across all Windsurf workspaces*`

    await fs.promises.writeFile(paths.globalRulesFile, globalRulesContent, 'utf8')
  }

  /**
   * Check if Windsurf has specific features enabled
   * @returns {Promise<Object>} Feature availability status
   */
  async getWindsurfFeatures() {
    const paths = this.getConfigPaths()
    const features = {
      codeiumEnabled: false,
      supercompleteEnabled: false,
      chatEnabled: false,
      searchEnabled: false,
      mcpConfigured: false,
      rulesConfigured: false,
      workspaceConfigured: false,
    }

    try {
      if (this.fileExists(paths.projectConfig)) {
        const config = await this.readJsonFile(paths.projectConfig)
        features.codeiumEnabled = config?.codeium?.enabled
        features.supercompleteEnabled = config?.codeium?.supercomplete
        features.chatEnabled = config?.codeium?.chat
        features.searchEnabled = config?.codeium?.search
      }

      features.mcpConfigured = this.fileExists(paths.projectMcp)
      features.rulesConfigured = await this.directoryExistsAsync(paths.rulesDirectory)
      features.workspaceConfigured = this.fileExists(paths.workspaceConfig)
    } catch {
      // Features remain false if we can't read config
    }

    return features
  }

  /**
   * Get Windsurf status summary
   * @returns {Promise<Object>} Status summary object
   */
  async getStatusSummary() {
    const detection = this.getCachedDetection()
    const features = await this.getWindsurfFeatures()
    const paths = this.getConfigPaths()

    return {
      isConfigured: detection.isUsed,
      confidence: detection.confidence,
      features,
      configPaths: paths,
      recommendations: detection.recommendations,
    }
  }
}
