/**
 * Claude Code CLI Integration Module
 * ----------------------------------
 * Context Platform Integration: Claude Code CLI
 *
 * Claude Code CLI is Anthropic's command-line coding tool that creates and manages
 * its own context ecosystem (.claude/ directory, CLAUDE.md memory files, commands).
 * This tool works across multiple IDEs via plugins/extensions.
 *
 * Context Format: Claude-specific (.claude/ ecosystem)
 * Multi-IDE: Works with VS Code, JetBrains, Zed, etc. via plugins
 * Priority: HIGH (Context-creating platform)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

/**
 * Claude Code configuration and integration utilities
 */
export class ClaudeCodeCLIIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Claude Code CLI', projectPath);
    this.priority = 'high';
    this.claudeConfigPath = path.join(projectPath, '.claude');
    this.globalClaudeConfigPath = path.join(os.homedir(), '.claude');
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
    };
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
    };

    // 1. Check for .claude directory structure
    if (this.directoryExists(this.claudeConfigPath)) {
      detection.indicators.push('Project has .claude directory');
      detection.confidence = 'medium';
      detection.isUsed = true;

      // Check for specific Claude Code files
      const claudeFiles = ['settings.json', 'settings.local.json', 'commands/'];

      claudeFiles.forEach(file => {
        const filePath = path.join(this.claudeConfigPath, file);
        if (this.fileExists(filePath) || this.directoryExists(filePath)) {
          detection.indicators.push(`Found .claude/${file}`);
          if (file === 'settings.json') {
            detection.confidence = 'high';
          }
        }
      });
    }

    // 2. Check for CLAUDE.md files (main indicator)
    const memoryPaths = [
      path.join(this.projectPath, 'CLAUDE.md'),
      path.join(this.projectPath, 'CLAUDE.local.md'),
    ];

    memoryPaths.forEach(memoryPath => {
      if (this.fileExists(memoryPath)) {
        detection.indicators.push(`Found ${path.basename(memoryPath)}`);
        detection.confidence = 'high';
        detection.isUsed = true;
      }
    });

    // Check for global Claude Code installation
    const globalClaudePath = path.join(os.homedir(), '.claude');
    if (this.directoryExists(globalClaudePath)) {
      detection.indicators.push('Global Claude Code config found');
      if (detection.confidence === 'none') {
        detection.confidence = 'low';
      }
    }

    // Check if we're currently running in Claude Code context
    const claudeEnvVars = [
      'CLAUDE_CODE_SESSION',
      'CLAUDE_CODE_SSE_PORT',
      'CLAUDE_CODE_ENTRYPOINT',
      'CLAUDECODE',
      'ANTHROPIC_SMALL_FAST_MODEL',
    ];
    const hasClaudeEnv = claudeEnvVars.some(envVar => process.env[envVar]);

    if (
      hasClaudeEnv ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.USER_AGENT?.includes('claude') ||
      process.argv[0]?.includes('claude')
    ) {
      detection.indicators.push('Currently running in Claude Code context');
      detection.confidence = 'high';
      detection.isUsed = true;
    }

    // 3. Check for Claude Code process indicators
    if (this.commandExists('claude')) {
      detection.indicators.push('Claude Code CLI is installed');
      if (detection.confidence === 'none') {
        detection.confidence = 'low';
      }

      const version = this.getCommandVersion('claude');
      if (version) {
        detection.indicators.push(`Claude Code version: ${version}`);
        detection.confidence = detection.confidence === 'none' ? 'medium' : detection.confidence;
      }
    }

    // 4. Check for Claude Code workspace indicators
    const _workspaceIndicators = [
      '.claude/commands/',
      '.claude/settings.json',
      'CLAUDE.md',
      '.gitignore', // Check if .claude is gitignored
    ];

    // Check workspace structure
    const workspaceChecks = ['.claude/commands/', '.claude/settings.json', 'CLAUDE.md'];
    workspaceChecks.forEach(indicator => {
      const indicatorPath = path.join(this.projectPath, indicator);
      if (this.directoryExists(indicatorPath)) {
        detection.indicators.push(`Workspace has ${indicator}`);
        detection.isUsed = true;
        if (detection.confidence === 'none' || detection.confidence === 'low') {
          detection.confidence = 'medium';
        }
      }
    });

    // Check .gitignore for Claude Code patterns
    const gitignorePatterns = this.checkGitignore(['.claude', 'claude-code']);
    if (gitignorePatterns.length > 0) {
      detection.indicators.push(
        `Claude Code paths found in .gitignore: ${gitignorePatterns.join(', ')}`
      );
    }

    // 5. Check for recent Claude Code activity
    const platformPaths = this.getPlatformPaths();
    const claudeLogPaths = [
      path.join(platformPaths.home, '.claude', 'logs'),
      path.join(platformPaths.logs, 'claude-code'),
      path.join(this.claudeConfigPath, 'logs'),
    ];

    claudeLogPaths.forEach(logPath => {
      const recentLogs = this.getRecentActivity(logPath, 7);
      if (recentLogs.length > 0) {
        detection.indicators.push(`Recent Claude Code activity (${recentLogs.length} log files)`);
        detection.isUsed = true;
        detection.confidence = 'high';
      }
    });

    // 6. Generate recommendations based on detection
    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Claude Code not detected. Install with: npm install -g @anthropic-ai/claude-code'
      );
    } else if (detection.confidence === 'low') {
      detection.recommendations.push(
        'Claude Code may be installed but not configured for this project'
      );
      detection.recommendations.push('Run: vdk claude-code --setup to configure integration');
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('Claude Code appears to be configured');
      detection.recommendations.push('Run: vdk claude-code --check to verify integration');
    } else if (detection.confidence === 'high') {
      detection.recommendations.push('Claude Code is actively configured and being used');
      detection.recommendations.push(
        'Consider running: vdk claude-code --update-memory to sync latest project context'
      );
    }

    return detection;
  }

  /**
   * Check if Claude Code global installation is available
   * @returns {boolean} True if Claude Code is globally installed
   */
  isClaudeCodeInstalled() {
    return this.commandExists('claude');
  }

  /**
   * Initialize Claude Code configuration for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const paths = this.getConfigPaths();

    try {
      // Create .claude directory structure
      await this.ensureDirectory(this.claudeConfigPath);
      await this.ensureDirectory(paths.projectCommands);

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
      };

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
      };

      const settingsPath = paths.projectSettings;
      if (!this.fileExists(settingsPath)) {
        await this.writeJsonFile(settingsPath, claudeSettings);
      }

      // Write VDK configuration to separate file
      const vdkConfigPath = path.join(this.claudeConfigPath, 'vdk.config.json');
      await this.writeJsonFile(vdkConfigPath, vdkConfig);

      // Create CLAUDE.md memory file with project context (only if it doesn't exist)
      // Note: ClaudeCodeAdapter may have already created a rich CLAUDE.md with technology-specific content
      const claudeMemoryPath = paths.projectMemory;
      if (!this.fileExists(claudeMemoryPath)) {
        await this.createProjectMemoryFile(options);
      } else if (this.verbose) {
        console.log(
          'CLAUDE.md already exists, skipping basic template creation (likely created by ClaudeCodeAdapter)'
        );
      }

      // Ensure .claude/settings.local.json is in .gitignore
      await this.ensureGitignoreEntry('.claude/settings.local.json');
      await this.ensureGitignoreEntry('CLAUDE.local.md');
      await this.ensureGitignoreEntry('.claude/vdk.config.json');

      // Note: VDK slash commands are now fetched from remote repository
      // No longer generating hardcoded VDK commands here

      return true;
    } catch (error) {
      console.error('Failed to initialize Claude Code configuration:', error.message);
      return false;
    }
  }

  /**
   * Deploy ClaudeCodeAdapter results to filesystem
   * Handles the file writing responsibility separated from the adapter
   * @param {Object} adaptationResults - Results from ClaudeCodeAdapter
   * @returns {boolean} Success status
   */
  async deployAdaptationResults(adaptationResults) {
    try {
      // Ensure all required directories exist
      for (const dir of adaptationResults.directories || []) {
        await this.ensureDirectory(dir);
      }

      // Write all files generated by the adapter
      const filesWritten = [];
      for (const fileObj of adaptationResults.files || []) {
        if (typeof fileObj === 'object' && fileObj.path && fileObj.content) {
          // This is the new format with type information
          await this.ensureDirectory(path.dirname(fileObj.path));

          if (fileObj.type === 'settings') {
            // For settings files, use JSON formatting
            await this.writeJsonFile(fileObj.path, JSON.parse(fileObj.content));
          } else {
            // For content files, write directly
            await fs.promises.writeFile(fileObj.path, fileObj.content, 'utf8');
          }
          filesWritten.push(fileObj.path);

          if (this.verbose) {
            console.log(`📝 Wrote ${fileObj.type}: ${path.basename(fileObj.path)}`);
          }
        } else {
          throw new Error('Invalid adaptation file entry: expected object with path and content');
        }
      }

      console.log(`✅ Deployed ${filesWritten.length} Claude Code files`);
      return true;
    } catch (error) {
      console.error('Failed to deploy Claude Code adaptation results:', error.message);
      return false;
    }
  }

  /**
   * Create project memory file for Claude Code
   * @param {Object} options - Memory configuration options
   */
  async createProjectMemoryFile(options = {}) {
    const paths = this.getConfigPaths();
    const memoryFilePath = paths.projectMemory;

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
- All AI rule artifacts are stored in \`.vdk/blueprints/rules/\` directory
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
`;

    await fs.promises.writeFile(memoryFilePath, memoryContent, 'utf8');
  }

  /**
   * Create VDK-specific slash commands for Claude Code
   * Following the new Claude Code command schema
   */
  async createVDKSlashCommands() {
    const paths = this.getConfigPaths();
    const commandsDir = paths.projectCommands;

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
    autoInclude: ["CLAUDE.md", ".vdk/blueprints/rules/", "package.json"]

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
- \`@.vdk/blueprints/rules/\` - Current VDK rule artifacts directory
- \`@package.json\` - Project dependencies

## Analysis Areas

1. **Project Structure Analysis**
   - Scan directory structure and identify patterns
   - Detect naming conventions and architectural patterns
   - Analyze technology stack and dependencies

2. **Rule Status Review**
  - Check existing VDK rules in \`.vdk/blueprints/rules/\`
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
`;

    await fs.promises.writeFile(
      path.join(commandsDir, 'vdk-analyze.md'),
      vdkAnalyzeCommand,
      'utf8'
    );

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
    autoInclude: ["CLAUDE.md", ".vdk/blueprints/rules/", "package.json"]

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
`;

    await fs.promises.writeFile(
      path.join(commandsDir, 'vdk-refresh.md'),
      vdkRefreshCommand,
      'utf8'
    );

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
    autoInclude: ["CLAUDE.md", ".vdk/blueprints/rules/", "package.json"]
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
`;

    await fs.promises.writeFile(
      path.join(commandsDir, 'vdk-handoff.md'),
      vdkHandoffCommand,
      'utf8'
    );
  }

  /**
   * Update existing Claude Code memory with VDK context
   * @param {Object} projectContext - Project analysis results
   */
  async updateMemoryWithVDKContext(projectContext) {
    const paths = this.getConfigPaths();
    const memoryPath = paths.projectLocalMemory;

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
`;

    await fs.promises.writeFile(memoryPath, vdkContext, 'utf8');
  }

  /**
   * Check Claude Code version compatibility
   * @returns {Object} Version information and compatibility status
   */
  async getClaudeCodeVersion() {
    if (this.commandExists('claude')) {
      const version = this.getCommandVersion('claude');
      return {
        version,
        compatible: true,
        features: {
          memory: true,
          commands: true,
          projectConfig: true,
          hooks: true,
        },
      };
    }
    return {
      version: null,
      compatible: false,
      error: 'Claude Code not found or not accessible',
    };
  }

  // ============================================================================
  // V3.0 COMPONENT METHODS
  // ============================================================================

  /**
   * Get all component paths for Claude Code platform
   * @returns {Object} Component paths by type
   */
  getComponentPaths() {
    return {
      main: path.join(this.projectPath, 'CLAUDE.md'),
      agents: path.join(this.claudeConfigPath, 'agents'),
      rules: path.join(this.claudeConfigPath, 'rules'),
      commands: path.join(this.claudeConfigPath, 'commands'),
      skills: path.join(this.claudeConfigPath, 'skills'),
      workflows: null, // Claude Code doesn't have workflows
      settings: path.join(this.claudeConfigPath, 'settings.json'),
      mcpConfig: path.join(this.projectPath, '.mcp.json'),
    };
  }

  /**
   * Get platform constraints for Claude Code
   * @returns {Object} Platform constraints
   */
  getPlatformConstraints() {
    return {
      maxCharacters: null, // No hard limit
      maxFiles: null,
      maxDepth: 5, // File reference depth
      supportsFileReferences: true,
      supportsYAMLFrontmatter: true,
      supportsAgents: true,
      supportsRules: true,
      supportsCommands: true,
      supportsSkills: true,
      supportsWorkflows: false,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }

  /**
   * Parse agent component with Claude-specific metadata
   * @param {string} filePath - Path to agent file
   * @returns {Promise<Object>} Parsed agent component
   */
  async parseAgentComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const frontmatter = this.extractFrontmatter(content);

      const agent = {
        type: 'agent',
        name: path.basename(filePath, '.md'),
        file: filePath,
        content,
        format: 'markdown',
      };

      if (frontmatter) {
        agent.frontmatter = frontmatter;
        agent.tools = frontmatter.tools || [];
        agent.model = frontmatter.model || 'sonnet';
        agent.triggers = frontmatter.triggers || [];

        // Check for PROACTIVELY trigger
        if (content.includes('PROACTIVELY') || frontmatter.triggers?.includes('PROACTIVELY')) {
          agent.proactive = true;
        }
      }

      return agent;
    } catch (error) {
      console.error(`Error parsing agent ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse rule component with path patterns
   * @param {string} filePath - Path to rule file
   * @returns {Promise<Object>} Parsed rule component
   */
  async parseRuleComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const frontmatter = this.extractFrontmatter(content);

      const rule = {
        type: 'rule',
        name: path.basename(filePath, '.md'),
        file: filePath,
        content,
        format: 'markdown',
      };

      if (frontmatter) {
        rule.frontmatter = frontmatter;
        rule.paths = frontmatter.paths || [];
      }

      return rule;
    } catch (error) {
      console.error(`Error parsing rule ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse command component with tool permissions
   * @param {string} filePath - Path to command file
   * @returns {Promise<Object>} Parsed command component
   */
  async parseCommandComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const frontmatter = this.extractFrontmatter(content);

      const command = {
        type: 'command',
        name: path.basename(filePath, '.md'),
        file: filePath,
        content,
        format: 'markdown',
      };

      if (frontmatter) {
        command.frontmatter = frontmatter;
        command.allowedTools = frontmatter.allowedTools || [];
        command.argumentHint = frontmatter.argumentHint || '';
      }

      return command;
    } catch (error) {
      console.error(`Error parsing command ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse agents directory with Claude-specific handling
   * @param {string} dirPath - Path to agents directory
   * @returns {Promise<Array>} Array of parsed agent components
   */
  async parseAgentComponents(dirPath) {
    const agents = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return agents;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dirPath, file);
        const agent = await this.parseAgentComponent(filePath);

        if (agent) {
          agents.push(agent);
        }
      }
    } catch (error) {
      console.error(`Error parsing agents directory ${dirPath}:`, error);
    }

    return agents;
  }

  /**
   * Parse rules directory with Claude-specific handling
   * @param {string} dirPath - Path to rules directory
   * @returns {Promise<Array>} Array of parsed rule components
   */
  async parseRuleComponents(dirPath) {
    const rules = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return rules;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dirPath, file);
        const rule = await this.parseRuleComponent(filePath);

        if (rule) {
          rules.push(rule);
        }
      }
    } catch (error) {
      console.error(`Error parsing rules directory ${dirPath}:`, error);
    }

    return rules;
  }

  /**
   * Parse commands directory with Claude-specific handling
   * @param {string} dirPath - Path to commands directory
   * @returns {Promise<Array>} Array of parsed command components
   */
  async parseCommandComponents(dirPath) {
    const commands = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return commands;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dirPath, file);
        const command = await this.parseCommandComponent(filePath);

        if (command) {
          commands.push(command);
        }
      }
    } catch (error) {
      console.error(`Error parsing commands directory ${dirPath}:`, error);
    }

    return commands;
  }

  /**
   * Parse skill component
   * @param {string} filePath - Path to skill file
   * @returns {Promise<Object>} Parsed skill component
   */
  async parseSkillComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const frontmatter = this.extractFrontmatter(content);

      const skill = {
        type: 'skill',
        name: path.basename(filePath, '.md'),
        file: filePath,
        content,
        format: 'markdown',
      };

      if (frontmatter) {
        skill.frontmatter = frontmatter;
        skill.template = frontmatter.template || '';
        skill.usage = frontmatter.usage || '';
      }

      return skill;
    } catch (error) {
      console.error(`Error parsing skill ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse skills directory
   * @param {string} dirPath - Path to skills directory
   * @returns {Promise<Array>} Array of parsed skill components
   */
  async parseSkillComponents(dirPath) {
    const skills = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return skills;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dirPath, file);
        const skill = await this.parseSkillComponent(filePath);

        if (skill) {
          skills.push(skill);
        }
      }
    } catch (error) {
      console.error(`Error parsing skills directory ${dirPath}:`, error);
    }

    return skills;
  }

  /**
   * Generate agent component file
   * @param {Object} agent - Agent data
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Path to generated file
   */
  async generateAgentComponent(agent, _options = {}) {
    const agentsDir = path.join(this.claudeConfigPath, 'agents');
    await this.ensureDirectory(agentsDir);

    const fileName = `${agent.name}.md`;
    const filePath = path.join(agentsDir, fileName);

    // Build frontmatter
    const frontmatter = {
      name: agent.name,
      description: agent.description || '',
      tools: agent.tools || ['Read', 'Grep', 'Glob'],
      model: agent.model || 'sonnet',
      triggers: agent.triggers || [],
    };

    // Build content
    let content = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        content += `${key}: [${value.join(', ')}]\n`;
      } else {
        content += `${key}: ${value}\n`;
      }
    }
    content += '---\n\n';
    content += agent.content || '';

    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Generate rule component file
   * @param {Object} rule - Rule data
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Path to generated file
   */
  async generateRuleComponent(rule, _options = {}) {
    const rulesDir = path.join(this.claudeConfigPath, 'rules');
    await this.ensureDirectory(rulesDir);

    const fileName = `${rule.name}.md`;
    const filePath = path.join(rulesDir, fileName);

    // Build frontmatter
    const frontmatter = {
      name: rule.name,
      description: rule.description || '',
      paths: rule.paths || [],
    };

    // Build content
    let content = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        content += `${key}:\n`;
        value.forEach(item => {
          content += `  - ${item}\n`;
        });
      } else {
        content += `${key}: ${value}\n`;
      }
    }
    content += '---\n\n';
    content += rule.content || '';

    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Generate command component file
   * @param {Object} command - Command data
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Path to generated file
   */
  async generateCommandComponent(command, _options = {}) {
    const commandsDir = path.join(this.claudeConfigPath, 'commands');
    await this.ensureDirectory(commandsDir);

    const fileName = `${command.name}.md`;
    const filePath = path.join(commandsDir, fileName);

    // Build frontmatter
    const frontmatter = {
      name: command.name,
      description: command.description || '',
      allowedTools: command.allowedTools || ['Read'],
      argumentHint: command.argumentHint || '',
    };

    // Build content
    let content = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        content += `${key}: [${value.join(', ')}]\n`;
      } else {
        content += `${key}: ${value}\n`;
      }
    }
    content += '---\n\n';
    content += command.content || '';

    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Generate skill component file
   * @param {Object} skill - Skill data
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Path to generated file
   */
  async generateSkillComponent(skill, _options = {}) {
    const skillsDir = path.join(this.claudeConfigPath, 'skills');
    await this.ensureDirectory(skillsDir);

    const fileName = `${skill.name}.md`;
    const filePath = path.join(skillsDir, fileName);

    // Build frontmatter
    const frontmatter = {
      name: skill.name,
      description: skill.description || '',
      template: skill.template || '',
      usage: skill.usage || '',
    };

    // Build content
    let content = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      content += `${key}: ${value}\n`;
    }
    content += '---\n\n';
    content += skill.content || '';

    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Generate all components for Claude Code
   * @param {Object} components - Components to generate
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateComponents(components, options = {}) {
    const result = {
      success: true,
      files: [],
      errors: [],
    };

    try {
      // Generate agents
      if (components.agents && components.agents.length > 0) {
        for (const agent of components.agents) {
          try {
            const filePath = await this.generateAgentComponent(agent, options);
            result.files.push({ type: 'agent', path: filePath });
          } catch (error) {
            result.errors.push(`Failed to generate agent ${agent.name}: ${error.message}`);
          }
        }
      }

      // Generate rules
      if (components.rules && components.rules.length > 0) {
        for (const rule of components.rules) {
          try {
            const filePath = await this.generateRuleComponent(rule, options);
            result.files.push({ type: 'rule', path: filePath });
          } catch (error) {
            result.errors.push(`Failed to generate rule ${rule.name}: ${error.message}`);
          }
        }
      }

      // Generate commands
      if (components.commands && components.commands.length > 0) {
        for (const command of components.commands) {
          try {
            const filePath = await this.generateCommandComponent(command, options);
            result.files.push({ type: 'command', path: filePath });
          } catch (error) {
            result.errors.push(`Failed to generate command ${command.name}: ${error.message}`);
          }
        }
      }

      // Generate skills
      if (components.skills && components.skills.length > 0) {
        for (const skill of components.skills) {
          try {
            const filePath = await this.generateSkillComponent(skill, options);
            result.files.push({ type: 'skill', path: filePath });
          } catch (error) {
            result.errors.push(`Failed to generate skill ${skill.name}: ${error.message}`);
          }
        }
      }

      // Generate main file if provided
      if (components.main) {
        try {
          const mainPath = path.join(this.projectPath, 'CLAUDE.md');
          await fs.promises.writeFile(mainPath, components.main.content, 'utf8');
          result.files.push({ type: 'main', path: mainPath });
        } catch (error) {
          result.errors.push(`Failed to generate main file: ${error.message}`);
        }
      }

      // Generate settings if provided
      if (components.settings) {
        try {
          const settingsPath = path.join(this.claudeConfigPath, 'settings.json');
          await this.writeJsonFile(settingsPath, components.settings.content);
          result.files.push({ type: 'settings', path: settingsPath });
        } catch (error) {
          result.errors.push(`Failed to generate settings: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Component generation failed: ${error.message}`);
    }

    return result;
  }
}

/**
 * Helper function to integrate VDK with Claude Code
 * @param {string} projectPath - Project root path
 * @param {Object} projectContext - Project analysis results
 * @returns {boolean} Success status
 */
export async function setupClaudeCodeIntegration(projectPath, projectContext = {}) {
  const integration = new ClaudeCodeIntegration(projectPath);

  // Check if Claude Code is available
  const versionInfo = await integration.getClaudeCodeVersion();
  if (!versionInfo.compatible) {
    console.warn('Claude Code not found or incompatible version');
    return false;
  }

  // Initialize Claude Code configuration
  const initSuccess = await integration.initialize({
    projectName: projectContext.projectName || path.basename(projectPath),
    projectType: projectContext.projectType,
    primaryLanguage: projectContext.techStack?.primaryLanguages?.[0],
    framework: projectContext.techStack?.frameworks?.[0],
  });

  if (initSuccess && projectContext) {
    // Update memory with project context
    await integration.updateMemoryWithVDKContext(projectContext);
  }

  return initSuccess;
}
