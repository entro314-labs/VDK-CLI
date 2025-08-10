/**
 * Cursor AI Integration Module
 * ---------------------------
 * Provides enhanced integration with Cursor AI Editor, including
 * .cursorignore support, AI model configurations, and Cursor-specific workflows.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BaseIntegration } from './base-integration.js'

/**
 * Cursor AI Editor configuration and integration utilities
 */
export class CursorIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Cursor AI', projectPath)
    this.cursorConfigPath = path.join(projectPath, '.cursor')
    this.globalCursorConfigPath = path.join(os.homedir(), '.cursor')
  }

  /**
   * Get Cursor AI configuration paths (updated for native .cursor/rules/)
   * @returns {Object} Configuration paths for Cursor AI
   */
  getConfigPaths() {
    return {
      projectConfig: path.join(this.cursorConfigPath, 'settings.json'),
      projectLocalConfig: path.join(this.cursorConfigPath, 'settings.local.json'),
      rulesDirectory: path.join(this.cursorConfigPath, 'rules'), // Native Cursor rules location
      cursorIgnore: path.join(this.projectPath, '.cursorignore'),
      globalConfig: path.join(this.globalCursorConfigPath, 'settings.json'),
      globalMcp: path.join(this.globalCursorConfigPath, 'mcp.json'),
      projectMcp: path.join(this.cursorConfigPath, 'mcp.json'),
      extensionsConfig: path.join(this.cursorConfigPath, 'extensions.json'),
    }
  }

  /**
   * Detect if Cursor AI is actively being used in the project
   * @returns {Object} Detection result with details
   */
  detectUsage() {
    const detection = {
      isUsed: false,
      confidence: 'none', // none, low, medium, high
      indicators: [],
      recommendations: [],
    }

    // 1. Check for .cursor directory structure
    if (this.directoryExists(this.cursorConfigPath)) {
      detection.indicators.push('Project has .cursor directory')
      detection.confidence = 'high'
      detection.isUsed = true

      // Check for specific Cursor files
      const cursorFiles = ['settings.json', 'settings.local.json', 'extensions.json', 'mcp.json']

      cursorFiles.forEach((file) => {
        const filePath = path.join(this.cursorConfigPath, file)
        if (this.fileExists(filePath)) {
          detection.indicators.push(`Found .cursor/${file}`)
          if (file === 'settings.json' || file === 'mcp.json') {
            detection.confidence = 'high'
          }
        }
      })
    }

    // 2. Check for .cursorignore file
    const cursorIgnorePath = path.join(this.projectPath, '.cursorignore')
    if (this.fileExists(cursorIgnorePath)) {
      detection.indicators.push('Found .cursorignore file')
      detection.isUsed = true
      if (detection.confidence === 'none') {
        detection.confidence = 'medium'
      }
    }

    // 3. Check for global Cursor installation
    const platformPaths = this.getPlatformPaths()
    const cursorPaths = [
      platformPaths.applications ? path.join(platformPaths.applications, 'Cursor.app') : null,
      platformPaths.home ? path.join(platformPaths.home, '.cursor') : null,
      platformPaths.config ? path.join(platformPaths.config, 'Cursor') : null,
      platformPaths.appData ? path.join(platformPaths.appData, 'Cursor') : null,
    ].filter(Boolean)

    cursorPaths.forEach((cursorPath) => {
      if (this.directoryExists(cursorPath)) {
        detection.indicators.push(`Cursor installation found at ${cursorPath}`)
        if (detection.confidence === 'none') {
          detection.confidence = 'low'
        }
      }
    })

    // 4. Check for Cursor command availability
    if (this.commandExists('cursor')) {
      detection.indicators.push('Cursor CLI command is available')
      if (detection.confidence === 'none') {
        detection.confidence = 'medium'
      }

      const version = this.getCommandVersion('cursor', '--version')
      if (version) {
        detection.indicators.push(`Cursor version: ${version}`)
      }
    }

    // 5. Check for Cursor-specific workspace indicators
    const workspaceIndicators = [
      '.cursor/',
      '.cursor/rules/', // Native Cursor rules location
      '.cursorignore',
    ]

    workspaceIndicators.forEach((indicator) => {
      const indicatorPath = path.join(this.projectPath, indicator)
      if (this.directoryExists(indicatorPath) || this.fileExists(indicatorPath)) {
        detection.indicators.push(`Workspace has ${indicator}`)
        detection.isUsed = true
        if (detection.confidence === 'none' || detection.confidence === 'low') {
          detection.confidence = 'medium'
        }
        // Native .cursor/rules/ directory indicates high confidence
        if (indicator === '.cursor/rules/') {
          detection.confidence = 'high'
        }
      }
    })

    // 6. Check .gitignore for Cursor patterns
    const gitignorePatterns = this.checkGitignore(['.cursor', '.cursorignore'])
    if (gitignorePatterns.length > 0) {
      detection.indicators.push(`Cursor paths found in .gitignore: ${gitignorePatterns.join(', ')}`)
    }

    // 7. Check for recent Cursor activity
    const cursorLogPaths = [
      platformPaths.logs ? path.join(platformPaths.logs, 'Cursor') : null,
      platformPaths.home ? path.join(platformPaths.home, '.cursor', 'logs') : null,
    ].filter(Boolean)

    cursorLogPaths.forEach((logPath) => {
      const recentLogs = this.getRecentActivity(logPath, 7)
      if (recentLogs.length > 0) {
        detection.indicators.push(`Recent Cursor activity (${recentLogs.length} log files)`)
        detection.isUsed = true
        detection.confidence = 'high'
      }
    })

    // 8. Generate recommendations based on detection
    if (detection.confidence === 'none') {
      detection.recommendations.push('Cursor AI not detected. Install from: https://cursor.sh')
    } else if (detection.confidence === 'low') {
      detection.recommendations.push(
        'Cursor AI may be installed but not configured for this project'
      )
      detection.recommendations.push(
        'Run: vdk init --ide-integration to configure Cursor integration'
      )
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('Cursor AI appears to be configured')
      detection.recommendations.push('Consider optimizing .ai/rules for better AI assistance')
    } else if (detection.confidence === 'high') {
      detection.recommendations.push('Cursor AI is actively configured and being used')
      detection.recommendations.push(
        'Consider creating custom AI rules for your specific project patterns'
      )
    }

    return detection
  }

  /**
   * Initialize Cursor AI configuration for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const paths = this.getConfigPaths()

    try {
      // Create .cursor directory structure if it doesn't exist
      await this.ensureDirectory(this.cursorConfigPath)
      await this.ensureDirectory(paths.rulesDirectory)

      // Create VDK-specific configuration file (separate from main Cursor settings)
      const vdkConfigPath = path.join(this.cursorConfigPath, 'vdk.config.json')
      const vdkConfig = {
        enabled: true,
        version: '1.0.0',
        integration: 'cursor',
        projectName: options.projectName || path.basename(this.projectPath),
        rules: {
          directory: './rules',
          format: 'mdc',
          autoLoad: true,
        },
        ai: {
          codeCompletions: true,
          chat: true,
          rules: true,
        },
      }

      await this.writeJsonFile(vdkConfigPath, vdkConfig)

      // Add VDK config to .gitignore
      await this.ensureGitignoreEntry('.cursor/vdk.config.json')

      // Create .cursorignore file with sensible defaults
      await this.createCursorIgnoreFile(options)

      // Create MCP configuration for Cursor
      await this.createCursorMCPConfig(options)

      // Create Cursor-specific AI rules in proper MDC format
      await this.createCursorAIRules(options)

      return true
    } catch (error) {
      console.error('Failed to initialize Cursor AI configuration:', error.message)
      return false
    }
  }

  /**
   * Create .cursorignore file with VDK-appropriate patterns
   * @param {Object} options - Configuration options
   */
  async createCursorIgnoreFile(_options = {}) {
    const paths = this.getConfigPaths()

    if (this.fileExists(paths.cursorIgnore)) {
      return // Don't overwrite existing .cursorignore
    }

    const cursorIgnoreContent = `# VDK Cursor Ignore Patterns
# Generated by VDK CLI

# Dependencies
node_modules/
vendor/
.pnpm/
.npm/
.yarn/

# Build outputs
dist/
build/
out/
target/
.next/
.nuxt/

# Environment files
.env
.env.local
.env.*.local

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
*.log
logs/

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage and test files
coverage/
.nyc_output/
.coverage
htmlcov/

# Temporary files
tmp/
temp/
*.tmp
*.temp

# VDK specific (comment out if you want AI to see these)
# .ai/rules/
# vdk.config.json
`

    await fs.promises.writeFile(paths.cursorIgnore, cursorIgnoreContent, 'utf8')
  }

  /**
   * Create MCP configuration for Cursor
   * @param {Object} options - Configuration options
   */
  async createCursorMCPConfig(options = {}) {
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
      },
      vdk: {
        enabled: true,
        projectName: options.projectName || path.basename(this.projectPath),
        rulesPath: '.cursor/rules',
      },
    }

    await this.writeJsonFile(paths.projectMcp, mcpConfig)
  }

  /**
   * Create Cursor-specific AI rules in proper MDC format
   * @param {Object} options - Configuration options
   */
  async createCursorAIRules(options = {}) {
    const paths = this.getConfigPaths()
    const rulesPath = paths.rulesDirectory

    // Create multiple rule files following Cursor's MDC format
    await this.createCursorProjectStandardsRule(rulesPath, options)
    await this.createCursorWorkflowRule(rulesPath, options)
    await this.createCursorVDKIntegrationRule(rulesPath, options)
  }

  /**
   * Create project standards rule (Auto Attached to common files)
   */
  async createCursorProjectStandardsRule(rulesPath, _options = {}) {
    const rulePath = path.join(rulesPath, 'project-standards.md')

    if (this.fileExists(rulePath)) {
      return // Don't overwrite existing rules
    }

    // MDC format with proper metadata for auto-attachment
    const projectStandardsContent = `---
type: auto-attached
globs: ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.py"]
---

# Project Development Standards

When working with project files:

## Code Style Requirements
- Use consistent indentation (2 spaces for JS/TS, 4 for Python)
- Follow existing naming conventions in the codebase
- Add meaningful comments for complex logic
- Use TypeScript for new JavaScript features
- Follow project's established architectural patterns

## Quality Checklist
- [ ] Code follows project conventions
- [ ] Proper error handling implemented
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] No sensitive data exposed

## VDK Integration Notes
- Rules generated by VDK CLI for project awareness
- Stored in \`.cursor/rules/\` directory for native Cursor compatibility
- Update with \`vdk init\` when project evolves

*Auto-attached to common development files*
`

    await fs.promises.writeFile(rulePath, projectStandardsContent, 'utf8')
  }

  /**
   * Create workflow automation rule (Agent Requested)
   */
  async createCursorWorkflowRule(rulesPath, _options = {}) {
    const rulePath = path.join(rulesPath, 'vdk-workflow.md')

    if (this.fileExists(rulePath)) {
      return
    }

    const workflowContent = `---
type: agent-requested
description: "Assists with VDK CLI workflows and project analysis"
---

# VDK Workflow Automation

When asked to analyze or work with the project:

## Analysis Steps
1. Review project structure and dependencies
2. Check existing VDK configuration and rules
3. Analyze technology stack and patterns
4. Identify areas for improvement

## VDK CLI Commands
- \`vdk init\` - Initialize VDK for project
- \`vdk claude-code --check\` - Check Claude Code integration
- \`vdk claude-code --setup\` - Configure Claude Code
- \`vdk status\` - Check VDK setup status

## Cursor-Specific Features
- Use **@Files** to reference project files for context
- Use **@Code** to reference specific functions
- Use **@Git** for commit and change references
- Leverage Cursor Tab for fast autocompletions

## Project Context
- Rules auto-load when working in this directory
- Memory preserved across sessions
- Use Cursor's multi-file editing for coordinated changes

*Available when AI needs VDK workflow assistance*
`

    await fs.promises.writeFile(rulePath, workflowContent, 'utf8')
  }

  /**
   * Create VDK integration rule (Manual reference)
   */
  async createCursorVDKIntegrationRule(rulesPath, _options = {}) {
    const rulePath = path.join(rulesPath, 'vdk-integration.md')

    if (this.fileExists(rulePath)) {
      return
    }

    const integrationContent = `---
type: manual
---

# VDK-Cursor Integration Guide

Reference this rule with @vdk-integration when working with VDK CLI.

## Integration Features
- **Automatic Detection**: VDK CLI detects Cursor configuration
- **Rule Generation**: Creates Cursor-compatible .ai/rules
- **MDC Format**: Proper metadata for rule activation
- **Cross-IDE Compatibility**: Works with multiple AI assistants

## Cursor Rule Types Used
- **Auto Attached**: Applied based on file patterns (globs)
- **Agent Requested**: Available when AI needs specific guidance
- **Manual**: Referenced explicitly with @rule-name syntax

## File Structure
\`\`\`
.cursor/rules/
├── project-standards.md    # Auto-attached to common files
├── vdk-workflow.md        # Agent-requested for VDK tasks
└── vdk-integration.md     # Manual reference (this file)
\`\`\`

## Usage Examples
- Mention @project-standards for coding guidelines
- AI automatically applies vdk-workflow for analysis tasks
- Reference @vdk-integration for integration questions

*Manual reference rule - Use @vdk-integration to activate*
`

    await fs.promises.writeFile(rulePath, integrationContent, 'utf8')
  }

  /**
   * Parse .cursorignore file and return patterns
   * @returns {Promise<string[]>} Array of ignore patterns
   */
  async parseCursorIgnore() {
    const paths = this.getConfigPaths()

    try {
      const content = await fs.promises.readFile(paths.cursorIgnore, 'utf8')
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => (line.endsWith('/') ? `${line}**` : line))
    } catch {
      return []
    }
  }

  /**
   * Check if Cursor AI has specific features enabled
   * @returns {Promise<Object>} Feature availability status
   */
  async getCursorFeatures() {
    const paths = this.getConfigPaths()
    const features = {
      aiEnabled: false,
      codeCompletions: false,
      chatEnabled: false,
      mcpConfigured: false,
      rulesConfigured: false,
    }

    try {
      if (this.fileExists(paths.projectConfig)) {
        const config = await this.readJsonFile(paths.projectConfig)
        features.aiEnabled = config?.ai?.enabled
        features.codeCompletions = config?.ai?.codeCompletions?.enabled
        features.chatEnabled = config?.ai?.chat?.enabled
      }

      features.mcpConfigured = this.fileExists(paths.projectMcp)
      features.rulesConfigured = await this.directoryExistsAsync(paths.rulesDirectory)
    } catch {
      // Features remain false if we can't read config
    }

    return features
  }

  /**
   * Get Cursor AI status summary
   * @returns {Promise<Object>} Status summary object
   */
  async getStatusSummary() {
    const detection = this.getCachedDetection()
    const features = await this.getCursorFeatures()
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
