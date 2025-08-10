/**
 * Claude Code Integration Module
 * ---------------------------
 * Provides enhanced integration with Claude Code CLI, including memory management,
 * slash command support, and project-specific configurations.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BaseIntegration } from './base-integration.js'

/**
 * Claude Code configuration and integration utilities
 */
export class ClaudeCodeIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Claude Code', projectPath)
    this.claudeConfigPath = path.join(projectPath, '.claude')
    this.globalClaudeConfigPath = path.join(os.homedir(), '.claude')
  }

  /**
   * Get Claude Code configuration paths (following official hierarchy)
   * @returns {Object} Configuration paths for Claude Code
   */
  getConfigPaths() {
    return {
      // Settings hierarchy (order matters - later overrides earlier)
      userSettings: path.join(os.homedir(), '.claude', 'settings.json'),
      projectSettings: path.join(this.claudeConfigPath, 'settings.json'),
      localProjectSettings: path.join(this.claudeConfigPath, 'settings.local.json'),

      // Memory hierarchy (Claude Code reads recursively)
      projectMemory: path.join(this.projectPath, 'CLAUDE.md'),
      projectLocalMemory: path.join(this.projectPath, 'CLAUDE.local.md'),
      userMemory: path.join(os.homedir(), '.claude', 'CLAUDE.md'),

      // Custom slash commands
      projectCommands: path.join(this.claudeConfigPath, 'commands'),
      userCommands: path.join(os.homedir(), '.claude', 'commands'),
    }
  }

  /**
   * Detect if Claude Code is actively being used in the project
   * @returns {Object} Detection result with details
   */
  detectUsage() {
    const detection = {
      isUsed: false,
      confidence: 'none', // none, low, medium, high
      indicators: [],
      recommendations: [],
    }

    // 1. Check for .claude directory structure
    if (this.directoryExists(this.claudeConfigPath)) {
      detection.indicators.push('Project has .claude directory')
      detection.confidence = 'medium'
      detection.isUsed = true

      // Check for specific Claude Code files
      const claudeFiles = ['settings.json', 'settings.local.json', 'commands/']

      claudeFiles.forEach((file) => {
        const filePath = path.join(this.claudeConfigPath, file)
        if (this.fileExists(filePath) || this.directoryExists(filePath)) {
          detection.indicators.push(`Found .claude/${file}`)
          if (file === 'settings.json') {
            detection.confidence = 'high'
          }
        }
      })
    }

    // 2. Check for CLAUDE.md files (main indicator)
    const memoryPaths = [
      path.join(this.projectPath, 'CLAUDE.md'),
      path.join(this.projectPath, 'CLAUDE.local.md'),
    ]

    memoryPaths.forEach((memoryPath) => {
      if (this.fileExists(memoryPath)) {
        detection.indicators.push(`Found ${path.basename(memoryPath)}`)
        detection.confidence = 'high'
        detection.isUsed = true
      }
    })

    // Check for global Claude Code installation
    const globalClaudePath = path.join(os.homedir(), '.claude')
    if (this.directoryExists(globalClaudePath)) {
      detection.indicators.push('Global Claude Code config found')
      if (detection.confidence === 'none') {
        detection.confidence = 'low'
      }
    }

    // Check if we're currently running in Claude Code context
    const claudeEnvVars = [
      'CLAUDE_CODE_SESSION',
      'CLAUDE_CODE_SSE_PORT',
      'CLAUDE_CODE_ENTRYPOINT',
      'CLAUDECODE',
      'ANTHROPIC_SMALL_FAST_MODEL',
    ]
    const hasClaudeEnv = claudeEnvVars.some((envVar) => process.env[envVar])

    if (
      hasClaudeEnv ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.USER_AGENT?.includes('claude') ||
      process.argv[0]?.includes('claude')
    ) {
      detection.indicators.push('Currently running in Claude Code context')
      detection.confidence = 'high'
      detection.isUsed = true
    }

    // 3. Check for Claude Code process indicators
    if (this.commandExists('claude')) {
      detection.indicators.push('Claude Code CLI is installed')
      if (detection.confidence === 'none') {
        detection.confidence = 'low'
      }

      const version = this.getCommandVersion('claude')
      if (version) {
        detection.indicators.push(`Claude Code version: ${version}`)
        detection.confidence = detection.confidence === 'none' ? 'medium' : detection.confidence
      }
    }

    // 4. Check for Claude Code workspace indicators
    const _workspaceIndicators = [
      '.claude/commands/',
      '.claude/settings.json',
      'CLAUDE.md',
      '.gitignore', // Check if .claude is gitignored
    ]

    // Check workspace structure
    const workspaceChecks = ['.claude/commands/', '.claude/settings.json', 'CLAUDE.md']
    workspaceChecks.forEach((indicator) => {
      const indicatorPath = path.join(this.projectPath, indicator)
      if (this.directoryExists(indicatorPath)) {
        detection.indicators.push(`Workspace has ${indicator}`)
        detection.isUsed = true
        if (detection.confidence === 'none' || detection.confidence === 'low') {
          detection.confidence = 'medium'
        }
      }
    })

    // Check .gitignore for Claude Code patterns
    const gitignorePatterns = this.checkGitignore(['.claude', 'claude-code'])
    if (gitignorePatterns.length > 0) {
      detection.indicators.push(
        `Claude Code paths found in .gitignore: ${gitignorePatterns.join(', ')}`
      )
    }

    // 5. Check for recent Claude Code activity
    const platformPaths = this.getPlatformPaths()
    const claudeLogPaths = [
      path.join(platformPaths.home, '.claude', 'logs'),
      path.join(platformPaths.logs, 'claude-code'),
      path.join(this.claudeConfigPath, 'logs'),
    ]

    claudeLogPaths.forEach((logPath) => {
      const recentLogs = this.getRecentActivity(logPath, 7)
      if (recentLogs.length > 0) {
        detection.indicators.push(`Recent Claude Code activity (${recentLogs.length} log files)`)
        detection.isUsed = true
        detection.confidence = 'high'
      }
    })

    // 6. Generate recommendations based on detection
    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Claude Code not detected. Install with: npm install -g @anthropic-ai/claude-code'
      )
    } else if (detection.confidence === 'low') {
      detection.recommendations.push(
        'Claude Code may be installed but not configured for this project'
      )
      detection.recommendations.push('Run: vdk claude-code --setup to configure integration')
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('Claude Code appears to be configured')
      detection.recommendations.push('Run: vdk claude-code --check to verify integration')
    } else if (detection.confidence === 'high') {
      detection.recommendations.push('Claude Code is actively configured and being used')
      detection.recommendations.push(
        'Consider running: vdk claude-code --update-memory to sync latest project context'
      )
    }

    return detection
  }

  /**
   * Check if Claude Code global installation is available
   * @returns {boolean} True if Claude Code is globally installed
   */
  isClaudeCodeInstalled() {
    return this.commandExists('claude')
  }

  /**
   * Initialize Claude Code configuration for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const paths = this.getConfigPaths()

    try {
      // Create .claude directory structure
      await this.ensureDirectory(this.claudeConfigPath)
      await this.ensureDirectory(paths.projectCommands)

      // Create project-specific Claude Code settings following official format
      const claudeSettings = {
        allowedTools: [
          'Bash',
          'Edit',
          'MultiEdit',
          'Read',
          'Write',
          'Glob',
          'Grep',
          'LS',
          'WebFetch',
          'WebSearch',
        ],
        disallowedTools: ['Bash(rm:*)', 'Bash(sudo:*)'],
        hooks: {},
      }

      // Create separate VDK configuration file for our custom settings
      const vdkConfig = {
        enabled: true,
        version: '1.0.0',
        integration: 'claude-code',
        projectName: options.projectName || path.basename(this.projectPath),
        memory: {
          enabled: true,
          persistence: 'project',
          autoSave: true,
        },
        rules: {
          directory: './rules',
          autoLoad: true,
          format: 'md',
        },
        tools: {
          fileOperations: true,
          codeAnalysis: true,
          projectScanning: true,
        },
      }

      const settingsPath = paths.projectSettings
      if (!this.fileExists(settingsPath)) {
        await this.writeJsonFile(settingsPath, claudeSettings)
      }

      // Write VDK configuration to separate file
      const vdkConfigPath = path.join(this.claudeConfigPath, 'vdk.config.json')
      await this.writeJsonFile(vdkConfigPath, vdkConfig)

      // Create CLAUDE.md memory file with project context (only if it doesn't exist)
      // Note: ClaudeCodeAdapter may have already created a rich CLAUDE.md with technology-specific content
      const claudeMemoryPath = paths.projectMemory
      if (!this.fileExists(claudeMemoryPath)) {
        await this.createProjectMemoryFile(options)
      } else if (this.verbose) {
        console.log(
          'CLAUDE.md already exists, skipping basic template creation (likely created by ClaudeCodeAdapter)'
        )
      }

      // Ensure .claude/settings.local.json is in .gitignore
      await this.ensureGitignoreEntry('.claude/settings.local.json')
      await this.ensureGitignoreEntry('CLAUDE.local.md')
      await this.ensureGitignoreEntry('.claude/vdk.config.json')

      // Note: VDK slash commands are now fetched from remote repository
      // No longer generating hardcoded VDK commands here

      return true
    } catch (error) {
      console.error('Failed to initialize Claude Code configuration:', error.message)
      return false
    }
  }

  /**
   * Create project memory file for Claude Code
   * @param {Object} options - Memory configuration options
   */
  async createProjectMemoryFile(options = {}) {
    const paths = this.getConfigPaths()
    const memoryFilePath = paths.projectMemory

    const memoryContent = `# ${options.projectName || path.basename(this.projectPath)} - Claude Code Memory

## Project Overview

This project uses VDK CLI for AI assistant integration and follows specific patterns and conventions.

### Key Information
- **VDK CLI Integration**: Active
- **Rule Format**: Unified .md format compatible with all AI assistants
- **Project Type**: ${options.projectType || 'Not specified'}
- **Primary Language**: ${options.primaryLanguage || 'Not detected'}
- **Framework**: ${options.framework || 'Not detected'}

### Important Conventions
- All AI rules are stored in \`.ai/rules/\` directory
- Rules follow unified YAML frontmatter format
- Project follows VDK CLI naming conventions
- Memory persistence is enabled for context continuity

### VDK CLI Commands
- \`vdk init\` - Initialize VDK in project
- \`vdk scan\` - Analyze project and generate rules
- \`vdk sync\` - Sync with VDK Hub
- \`vdk validate\` - Validate rule files

### Integration Notes
- Claude Code memory management is active
- Project rules auto-load when working in this directory
- Use \`/vdk\` slash commands for VDK-specific operations
- Context preservation across sessions is enabled

---
*This memory file is automatically managed by VDK CLI. Last updated: ${new Date().toISOString()}*
`

    await fs.promises.writeFile(memoryFilePath, memoryContent, 'utf8')
  }

  /**
   * Create VDK-specific slash commands for Claude Code
   * Following the new Claude Code command schema
   */
  async createVDKSlashCommands() {
    const paths = this.getConfigPaths()
    const commandsDir = paths.projectCommands

    // VDK analysis command following schema
    const vdkAnalyzeCommand = `---
id: "vdk-analyze"
name: "VDK Project Analysis"
description: "Comprehensive analysis of VDK setup and project patterns for optimization"
target: "claude-code"
commandType: "slash"
version: "1.0.0"
scope: "project"

claudeCode:
  slashCommand: "/vdk-analyze"
  arguments:
    supports: false
  fileReferences:
    supports: true
    autoInclude: ["CLAUDE.md", ".ai/rules/", "package.json"]

permissions:
  allowedTools: ["Read", "Glob", "Grep"]
  requiredApproval: false

examples:
  - usage: "/vdk-analyze"
    description: "Analyze current VDK setup and suggest improvements"
    context: "When reviewing project configuration or onboarding"
    expectedOutcome: "Comprehensive report with optimization recommendations"

category: "analysis"
tags: ["vdk", "analysis", "optimization", "configuration"]
author: "VDK CLI"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
---

# VDK Project Analysis

## Purpose

Analyze the current project using VDK CLI capabilities and provide actionable recommendations for improvement.

## Claude Code Integration

### Slash Command Usage
\`\`\`
/vdk-analyze
\`\`\`

### File References
Auto-included files:
- \`@CLAUDE.md\` - Project context and conventions
- \`@.ai/rules/\` - Current VDK rules directory
- \`@package.json\` - Project dependencies

## Analysis Areas

1. **Project Structure Analysis**
   - Scan directory structure and identify patterns
   - Detect naming conventions and architectural patterns
   - Analyze technology stack and dependencies

2. **Rule Status Review**
   - Check existing VDK rules in \`.ai/rules/\`
   - Validate rule format and content
   - Identify missing or outdated rules

3. **Integration Status**
   - Verify Claude Code integration
   - Check memory persistence settings
   - Review automation configuration

4. **Recommendations**
   - Suggest rule improvements
   - Recommend additional VDK features
   - Identify optimization opportunities

## Usage Example

\`\`\`
/vdk-analyze
\`\`\`

**Context**: Regular project health checks or onboarding new team members
**Expected Outcome**: Detailed analysis report with specific recommendations for improving VDK setup and project patterns

---
*Generated by VDK CLI - Claude Code Integration*
`

    await fs.promises.writeFile(path.join(commandsDir, 'vdk-analyze.md'), vdkAnalyzeCommand, 'utf8')

    // VDK rules refresh command following schema
    const vdkRefreshCommand = `---
id: "vdk-refresh"
name: "VDK Blueprints Refresh"
description: "Refresh and update VDK blueprints after project changes"
target: "claude-code"
commandType: "slash"
version: "1.0.0"
scope: "project"

claudeCode:
  slashCommand: "/vdk-refresh"
  arguments:
    supports: false
  fileReferences:
    supports: true
    autoInclude: ["CLAUDE.md", ".ai/rules/", "package.json"]

permissions:
  allowedTools: ["Read", "Write", "Edit", "Bash(git:*)"]
  requiredApproval: false

examples:
  - usage: "/vdk-refresh"
    description: "Refresh VDK setup after adding new dependencies"
    context: "After major project changes or dependency updates"
    expectedOutcome: "Updated rules and refreshed project context"

category: "development"
tags: ["vdk", "refresh", "sync", "update"]
author: "VDK CLI"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
---

# VDK Blueprints Refresh

## Purpose

Refresh and update VDK blueprints for the current project after changes.

## Claude Code Integration

### Slash Command Usage
\`\`\`
/vdk-refresh
\`\`\`

## Refresh Process

1. **Scan Project Changes**
   - Re-analyze project structure for any changes
   - Update technology stack detection
   - Refresh naming convention patterns

2. **Update Rules**
   - Regenerate core VDK rules if needed
   - Update project context with latest information
   - Sync with VDK Hub for latest patterns

3. **Validate Setup**
   - Check rule format consistency
   - Validate YAML frontmatter
   - Ensure Claude Code integration is optimal

4. **Apply Changes**
   - Update memory files with new context
   - Refresh slash command definitions
   - Update project documentation

## Usage Example

\`\`\`
/vdk-refresh
\`\`\`

**Context**: After project structure changes, dependency updates, or framework migrations
**Expected Outcome**: Synchronized VDK rules and updated project context

---
*Generated by VDK CLI - Claude Code Integration*
`

    await fs.promises.writeFile(path.join(commandsDir, 'vdk-refresh.md'), vdkRefreshCommand, 'utf8')

    // VDK memory handoff command following schema
    const vdkHandoffCommand = `---
id: "vdk-handoff"
name: "VDK Memory Handoff"
description: "Prepare comprehensive project handoff documentation for team collaboration"
target: "claude-code"
commandType: "slash"
version: "1.0.0"
scope: "project"

claudeCode:
  slashCommand: "/vdk-handoff"
  arguments:
    supports: false
  fileReferences:
    supports: true
    autoInclude: ["CLAUDE.md", ".ai/rules/", "package.json"]
  bashCommands:
    supports: true
    commands: ["git status", "git log --oneline -10"]

permissions:
  allowedTools: ["Read", "Write", "Bash(git:*)"]
  requiredApproval: false

examples:
  - usage: "/vdk-handoff"
    description: "Generate handoff documentation for team transition"
    context: "End of work session or team member change"
    expectedOutcome: "Comprehensive handoff document with current state"

category: "documentation"
tags: ["handoff", "documentation", "collaboration", "memory"]
author: "VDK CLI"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
---

# VDK Memory Handoff

## Purpose

Prepare a comprehensive handoff of the current project state for another developer or AI session.

## Claude Code Integration

### Slash Command Usage
\`\`\`
/vdk-handoff
\`\`\`

### Git Integration
Includes recent changes: !\`git status\` and !\`git log --oneline -10\`

## Handoff Process

1. **Project State Summary**
   - Current task and progress status
   - Recent changes and their rationale
   - Outstanding issues or blockers

2. **VDK Configuration Export**
   - Export current rule configurations
   - Document custom patterns and conventions
   - Save memory state and context

3. **Development Context**
   - Active feature branches and their purpose
   - Testing status and coverage notes
   - Deployment and environment notes

4. **Next Steps Documentation**
   - Planned features and their priorities
   - Technical debt items to address
   - Recommended next actions

## Usage Example

\`\`\`
/vdk-handoff
\`\`\`

**Context**: End of work session, team transitions, or project handovers
**Expected Outcome**: Detailed handoff document with current state, context, and next steps

---
*Generated by VDK CLI - Claude Code Integration*
`

    await fs.promises.writeFile(path.join(commandsDir, 'vdk-handoff.md'), vdkHandoffCommand, 'utf8')
  }

  /**
   * Update existing Claude Code memory with VDK context
   * @param {Object} projectContext - Project analysis results
   */
  async updateMemoryWithVDKContext(projectContext) {
    const paths = this.getConfigPaths()
    const memoryPath = paths.projectLocalMemory

    const vdkContext = `# VDK Project Context Update

## Technology Stack
${
  projectContext.techStack
    ? Object.entries(projectContext.techStack)
        .map(([key, value]) => `- **${key}**: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\n')
    : 'Not analyzed'
}

## Architecture Patterns
${
  projectContext.patterns
    ? Object.entries(projectContext.patterns)
        .map(
          ([key, value]) =>
            `- **${key}**: ${Array.isArray(value) ? value.join(', ') : JSON.stringify(value)}`
        )
        .join('\n')
    : 'Not analyzed'
}

## Project Structure
- **Root Directory**: ${this.projectPath}
- **Rules Directory**: ${paths.rulesDirectory}
- **Total Files**: ${projectContext.projectStructure?.fileCount || 'Unknown'}
- **File Types**: ${projectContext.projectStructure?.fileTypes ? Object.keys(projectContext.projectStructure.fileTypes).join(', ') : 'Unknown'}

## VDK Integration Status
- **VDK Version**: Active
- **Rule Format**: Unified .md format
- **Memory Persistence**: Enabled
- **Auto-sync**: ${projectContext.autoSync ? 'Enabled' : 'Disabled'}

---
*Updated: ${new Date().toISOString()}*
`

    await fs.promises.writeFile(memoryPath, vdkContext, 'utf8')
  }

  /**
   * Check Claude Code version compatibility
   * @returns {Object} Version information and compatibility status
   */
  async getClaudeCodeVersion() {
    const version = this.getCommandVersion('claude')

    if (version) {
      return {
        version,
        compatible: true, // All current versions are compatible
        features: {
          memory: true,
          slashCommands: true,
          projectConfig: true,
          hooks: true,
        },
      }
    }
    return {
      version: null,
      compatible: false,
      error: 'Claude Code not found or not accessible',
    }
  }
}

/**
 * Helper function to integrate VDK with Claude Code
 * @param {string} projectPath - Project root path
 * @param {Object} projectContext - Project analysis results
 * @returns {boolean} Success status
 */
export async function setupClaudeCodeIntegration(projectPath, projectContext = {}) {
  const integration = new ClaudeCodeIntegration(projectPath)

  // Check if Claude Code is available
  const versionInfo = await integration.getClaudeCodeVersion()
  if (!versionInfo.compatible) {
    console.warn('Claude Code not found or incompatible version')
    return false
  }

  // Initialize Claude Code configuration
  const initSuccess = await integration.initialize({
    projectName: projectContext.projectName || path.basename(projectPath),
    projectType: projectContext.projectType,
    primaryLanguage: projectContext.techStack?.primaryLanguages?.[0],
    framework: projectContext.techStack?.frameworks?.[0],
  })

  if (initSuccess && projectContext) {
    // Update memory with project context
    await integration.updateMemoryWithVDKContext(projectContext)
  }

  return initSuccess
}
