/**
 * RuleAdapter.js
 *
 * Transforms standardized VDK rules into IDE-native formats and locations.
 * Each IDE gets rules in the format that makes the most sense for that platform.
 *
 * Platform Configuration Integration - FIXED ✅
 * - RuleGenerator extracts and passes platformConfig from blueprint frontmatter ✅
 * - Platform-specific features (globs, characterLimit, priority, etc.) now available ✅
 * - Empty platformConfig={} calls should now receive proper configuration ✅
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import chalk from 'chalk'

import { generateCursorFilename } from '../../utils/filename-generator.js'

export class RuleAdapter {
  constructor(options = {}) {
    this.verbose = options.verbose
    this.projectPath = options.projectPath || process.cwd()

    // Centralized character limits for each IDE
    this.characterLimits = {
      windsurf: {
        perFile: 6000,
        totalWorkspace: 12000,
        global: 6000,
      },
      'github-copilot': {
        perGuideline: 600,
        maxGuidelines: 6,
      },
      cursor: {
        perFile: Number.POSITIVE_INFINITY, // No specific limit
        total: Number.POSITIVE_INFINITY,
      },
      claude: {
        perFile: Number.POSITIVE_INFINITY, // No specific limit
        perCommand: 10000, // Reasonable limit for commands
      },
    }
  }

  /**
   * Adapt a collection of rules for a specific IDE with platform configuration
   * @param {Array} rules - Array of rule objects with frontmatter and content
   * @param {string} targetIDE - Target IDE ('claude', 'cursor', 'windsurf', 'github-copilot')
   * @param {Object} projectContext - Project analysis context
   * @param {Object} platformConfig - Platform-specific configuration from blueprint
   * @returns {Object} Adapted rules with paths and content
   */
  async adaptRules(rules, targetIDE, projectContext = {}, platformConfig = {}) {
    if (this.verbose) {
      console.log(chalk.gray(`Adapting ${rules.length} rules for ${targetIDE}...`))
    }

    // Check platform compatibility first
    if (platformConfig.compatible === false) {
      return {
        paths: [],
        rules: [],
        summary: {
          generated: 0,
          skipped: rules.length,
          reason: 'Platform not compatible',
        },
      }
    }

    switch (targetIDE.toLowerCase()) {
      case 'claude':
      case 'claude-code-cli':
        return await this.adaptForClaude(rules, projectContext, platformConfig)

      case 'cursor':
        return await this.adaptForCursor(rules, projectContext, platformConfig)

      case 'windsurf':
        return await this.adaptForWindsurf(rules, projectContext, platformConfig)

      case 'github-copilot':
        return await this.adaptForGitHubCopilot(rules, projectContext, platformConfig)

      case 'zed':
        return await this.adaptForZed(rules, projectContext, platformConfig)

      case 'vscode':
      case 'vscode-insiders':
      case 'vscodium':
        return await this.adaptForVSCode(rules, projectContext, platformConfig)

      default:
        return await this.adaptForGeneric(rules, projectContext, platformConfig)
    }
  }

  /**
   * Enforce character limits for content based on IDE type
   * @param {string} content - Content to check/truncate
   * @param {string} ideType - IDE type
   * @param {string} limitType - Type of limit (perFile, perGuideline, etc.)
   * @returns {Object} Result with content and truncation info
   */
  enforceCharacterLimits(content, ideType, limitType = 'perFile') {
    const limits = this.characterLimits[ideType.toLowerCase()]
    if (!limits) {
      return { content, truncated: false, originalLength: content.length }
    }

    const limit = limits[limitType]
    if (limit === Number.POSITIVE_INFINITY || content.length <= limit) {
      return { content, truncated: false, originalLength: content.length }
    }

    // Smart truncation at sentence boundaries
    const truncationPoint = this.findSmartTruncationPoint(content, limit)
    const truncatedContent =
      content.substring(0, truncationPoint) +
      (truncationPoint < content.length ? '\n\n*Truncated due to character limit*' : '')

    if (this.verbose) {
      console.warn(
        chalk.yellow(`Content truncated for ${ideType} (${content.length} → ${truncatedContent.length} chars)`)
      )
    }

    return {
      content: truncatedContent,
      truncated: true,
      originalLength: content.length,
      truncatedLength: truncatedContent.length,
    }
  }

  /**
   * Find smart truncation point at sentence or paragraph boundaries
   * @param {string} content - Content to truncate
   * @param {number} limit - Character limit
   * @returns {number} Truncation point
   */
  findSmartTruncationPoint(content, limit) {
    const buffer = Math.max(50, limit * 0.05) // 5% buffer or minimum 50 chars
    const targetLength = limit - buffer

    if (content.length <= targetLength) {
      return content.length
    }

    // Try to find good truncation points in order of preference
    const truncationPoints = [
      content.lastIndexOf('\n\n', targetLength), // Paragraph boundary
      content.lastIndexOf('.\n', targetLength), // Sentence with newline
      content.lastIndexOf('. ', targetLength), // Sentence boundary
      content.lastIndexOf('\n', targetLength), // Line boundary
      targetLength, // Hard truncation
    ]

    for (const point of truncationPoints) {
      if (point > targetLength * 0.7) {
        // Keep at least 70% of content
        return point
      }
    }

    return targetLength // Fallback to hard truncation
  }

  /**
   * Adapt rules for Claude Code CLI's memory system with VDK-native intelligence
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Full VDK analysis data (projectStructure, technologyData, patterns)
   * @param {Object} platformConfig - Claude-specific configuration
   * @returns {Object} Claude-native memory files and commands
   */
  async adaptForClaude(rules, projectContext, platformConfig = {}) {
    // Extract platform-specific settings with defaults
    const memory = platformConfig.memory !== false // Default: true
    const command = platformConfig.command !== false // Default: true
    const priority = platformConfig.priority || 5 // Default priority
    const namespace = platformConfig.namespace || 'project' // Default: project
    const allowedTools = platformConfig.allowedTools || []
    const mcpIntegration = platformConfig.mcpIntegration
    const adaptedFiles = []
    const _projectName = path.basename(this.projectPath)
    const globalDir = path.join(os.homedir(), '.claude')
    const commandsDir = path.join(this.projectPath, '.claude', 'commands')
    const userCommandsDir = path.join(os.homedir(), '.claude', 'commands')

    // Skip memory generation if disabled
    if (!memory) {
      return {
        paths: [],
        rules: [],
        summary: {
          generated: 0,
          skipped: rules.length,
          reason: 'Memory disabled in platform config',
        },
      }
    }

    // Sort rules by priority (higher priority first)
    const prioritizedRules = rules.sort((a, b) => {
      const aPriority = a.frontmatter?.priority || priority
      const bPriority = b.frontmatter?.priority || priority
      return bPriority - aPriority
    })

    // 1. Global memory (cross-project preferences) - Deploy to ~/.claude/CLAUDE.md
    const globalRules = prioritizedRules.filter(
      (rule) => rule.frontmatter?.category === 'core' && rule.frontmatter?.alwaysApply === true
    )

    if (globalRules.length > 0) {
      const globalContent = this.generateClaudeGlobalMemory(globalRules, { priority, allowedTools })
      adaptedFiles.push({
        path: path.join(globalDir, 'CLAUDE.md'),
        content: globalContent,
        type: 'memory',
        scope: 'global',
        hierarchyLevel: 'global',
      })
    }

    // 2. Main project memory with VDK-native intelligence - Deploy to ./CLAUDE.md
    const projectName = path.basename(this.projectPath)
    const technologyData = projectContext.technologyData || projectContext.technology || {}
    const projectType = this.determineProjectType(projectContext)
    const packageManager = await this.detectPackageManager(projectContext)

    // Get technology-specific rules for smart guidelines
    const technologyRules = rules.filter(
      (rule) =>
        rule.frontmatter?.category === 'technology' ||
        rule.frontmatter?.category === 'technologies' ||
        rule.frontmatter?.category === 'framework' ||
        rule.frontmatter?.category === 'language' ||
        rule.frontmatter?.category === 'languages' ||
        rule.frontmatter?.category === 'stack' ||
        rule.frontmatter?.category === 'stacks'
    )

    const technologyGuidelines = await this.extractVDKTechnologyGuidelines(technologyRules, projectContext)

    const claudeMainContent = `# ${projectName} - Claude Code CLI Memory

## Project Overview

This is a **${projectType}** project.

### Key Information
- **Project Type**: ${projectType}
- **Primary Language**: ${technologyData.primaryLanguages?.join(', ') || 'Not detected'}
- **Frameworks**: ${technologyData.frameworks?.join(', ') || 'Not detected'}
- **Libraries**: ${technologyData.libraries?.slice(0, 3).join(', ') || 'Standard libraries'}

## Coding Preferences

### Code Style
- Use 2-space indentation for JavaScript/TypeScript
- Prefer ${technologyData.primaryLanguages?.includes('TypeScript') ? 'TypeScript strict mode' : 'modern JavaScript'}
- Follow project conventions

### Project Structure
- Follow standard module structure
- Follow conventional directory structures

### Testing
- Use jest for testing
- Write tests for all business logic, use descriptive test names

## Development Environment

### Tools & Setup
- Package manager: ${packageManager}
- Build tool: npm scripts
- Primary IDE: Claude Code CLI
- AI Assistant: Claude Code CLI

### Development Commands
- \`${packageManager} run dev\` - Start development server
- \`${packageManager} run test\` - Run tests
- \`${packageManager} run build\` - Build for production

## Technology-Specific Guidelines

${technologyGuidelines}

## Workflow Preferences

### Development Workflow
- Start with failing tests when appropriate
- Run tests before committing
- Use feature flags for incomplete features
- Plan for rollback strategies

### Communication
- Over-communicate in remote environments
- Document decisions and reasoning
- Share knowledge through code comments and docs
- Ask for clarification when requirements are unclear

---
*Generated by VDK CLI - Enhanced for Claude Code CLI*
*Technology rules: ${technologyRules.length} rules integrated*`

    adaptedFiles.push({
      path: path.join(this.projectPath, 'CLAUDE.md'),
      content: claudeMainContent,
      type: 'memory',
      scope: 'project',
      hierarchyLevel: 'project',
    })

    // 3. Technology-specific memory files with import structure
    const techRules = rules.filter(
      (rule) =>
        rule.frontmatter?.category === 'technology' ||
        rule.frontmatter?.category === 'framework' ||
        rule.frontmatter?.category === 'language'
    )

    // 3. Technology patterns are integrated into main CLAUDE.md, not separate files
    // Claude Code CLI reads CLAUDE.md as the primary project memory

    // 4. Optional: Generate CLAUDE.local.md for private/local context (gitignored)
    if (techRules.length > 0) {
      const localTechContent = this.generateClaudeLocalMemory(techRules, projectContext)
      adaptedFiles.push({
        path: path.join(this.projectPath, 'CLAUDE.local.md'),
        content: localTechContent,
        type: 'memory',
        scope: 'local',
        hierarchyLevel: 'local',
      })
    }

    // 5. Project commands (namespace: /project:)
    const taskRules = rules.filter((rule) => rule.frontmatter?.category === 'task')

    for (const rule of taskRules) {
      const commandContent = this.generateClaudeSlashCommand(rule, projectContext)
      const commandName = this.getCommandName(rule.frontmatter?.description)

      adaptedFiles.push({
        path: path.join(commandsDir, `${commandName}.md`),
        content: commandContent,
        type: 'command',
        scope: 'project',
        namespace: 'project',
        commandName,
      })
    }

    // 6. User commands (namespace: /user:) - Deploy to ~/.claude/commands/
    const personalRules = rules.filter(
      (rule) => rule.frontmatter?.category === 'assistant' || rule.frontmatter?.category === 'workflow'
    )

    for (const rule of personalRules) {
      const commandContent = this.generateClaudeSlashCommand(rule, projectContext)
      const commandName = this.getCommandName(rule.frontmatter?.description)

      adaptedFiles.push({
        path: path.join(userCommandsDir, `${commandName}.md`),
        content: commandContent,
        type: 'command',
        scope: 'user',
        namespace: 'user',
        commandName,
      })
    }

    return {
      files: adaptedFiles,
      directories: [globalDir, commandsDir, userCommandsDir].filter(Boolean), // Add directories array
      summary: {
        memoryFiles: adaptedFiles.filter((f) => f.type === 'memory').length,
        commands: adaptedFiles.filter((f) => f.type === 'command').length,
        totalSize: adaptedFiles.reduce((size, file) => size + file.content.length, 0),
      },
    }
  }

  /**
   * Adapt rules for Cursor's MDC system with proper activation types
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @returns {Object} Cursor-native MDC files
   */
  async adaptForCursor(rules, projectContext, platformConfig = {}) {
    const adaptedFiles = []
    const rulesDir = path.join(this.projectPath, '.cursor', 'rules')

    // Extract platform-specific settings
    const activation = platformConfig.activation || 'auto-attached'
    const globs = platformConfig.globs || []
    const priority = platformConfig.priority || 'medium'
    const fileTypes = platformConfig.fileTypes || []

    // Group rules by activation type for better organization
    const rulesByActivation = this.groupCursorRulesByActivation(rules)

    // 1. Always rules - Always included in context
    for (const rule of rulesByActivation.always) {
      const mdcContent = this.generateCursorMDC(rule, projectContext)
      const fileName = this.getCursorFileName(rule)

      adaptedFiles.push({
        path: path.join(rulesDir, `always-${fileName}`),
        content: mdcContent,
        type: 'rule',
        activation: 'always',
        scope: 'project',
        priority: 'high',
      })
    }

    // 2. Auto-attached rules - When files matching globs are referenced
    for (const rule of rulesByActivation.autoAttached) {
      const mdcContent = this.generateCursorMDC(rule, projectContext)
      const fileName = this.getCursorFileName(rule)

      adaptedFiles.push({
        path: path.join(rulesDir, `auto-${fileName}`),
        content: mdcContent,
        type: 'rule',
        activation: 'auto-attached',
        scope: 'project',
        globs: rule.frontmatter?.globs || [],
        priority: 'medium',
      })
    }

    // 3. Agent-requested rules - AI decides whether to include
    for (const rule of rulesByActivation.agentRequested) {
      const mdcContent = this.generateCursorMDC(rule, projectContext)
      const fileName = this.getCursorFileName(rule)

      adaptedFiles.push({
        path: path.join(rulesDir, `agent-${fileName}`),
        content: mdcContent,
        type: 'rule',
        activation: 'agent-requested',
        scope: 'project',
        description: rule.frontmatter?.description,
        priority: 'medium',
      })
    }

    // 4. Manual rules - Only when explicitly mentioned using @ruleName
    for (const rule of rulesByActivation.manual) {
      const mdcContent = this.generateCursorMDC(rule, projectContext)
      const fileName = this.getCursorFileName(rule)
      const ruleName = this.getCursorRuleName(rule)

      adaptedFiles.push({
        path: path.join(rulesDir, `manual-${fileName}`),
        content: mdcContent,
        type: 'rule',
        activation: 'manual',
        scope: 'project',
        ruleName,
        priority: 'low',
      })
    }

    return {
      files: adaptedFiles,
      summary: {
        always: rulesByActivation.always.length,
        autoAttached: rulesByActivation.autoAttached.length,
        agentRequested: rulesByActivation.agentRequested.length,
        manual: rulesByActivation.manual.length,
        totalFiles: adaptedFiles.length,
      },
    }
  }

  /**
   * Generate Cursor MDC format with proper frontmatter (FIXED IMPLEMENTATION)
   * @param {Object} rule - Rule object
   * @param {Object} projectContext - Project context
   * @returns {string} MDC formatted content
   */
  generateCursorMDC(rule, _projectContext) {
    const activationType = this.getCursorActivationType(rule)
    const globs = rule.frontmatter?.globs || []
    const description = rule.frontmatter?.description || ''
    const cleanContent = this.stripFrontmatter(rule.content)

    return `---
type: ${activationType}
${globs.length > 0 ? `globs: ${JSON.stringify(globs)}` : ''}
${activationType === 'agent-requested' ? `description: "${description}"` : ''}
alwaysApply: ${rule.frontmatter?.alwaysApply}
---

${cleanContent}`
  }

  /**
   * Get Cursor activation type (FIXED IMPLEMENTATION)
   * @param {Object} rule - Rule object
   * @returns {string} Activation type
   */
  getCursorActivationType(rule) {
    if (rule.frontmatter?.alwaysApply) {
      return 'always'
    }
    if (rule.frontmatter?.globs && rule.frontmatter?.globs.length > 0) {
      return 'auto-attached'
    }
    if (rule.frontmatter?.description) {
      return 'agent-requested'
    }
    return 'manual'
  }

  /**
   * Get Cursor file name using centralized filename generator
   * @param {Object} rule - Rule object
   * @returns {string} File name
   */
  getCursorFileName(rule) {
    return generateCursorFilename(rule)
  }

  /**
   * Group Cursor rules by activation type
   * @param {Array} rules - Rules to group
   * @returns {Object} Rules grouped by activation type
   */
  groupCursorRulesByActivation(rules) {
    const groups = {
      always: [],
      autoAttached: [],
      agentRequested: [],
      manual: [],
    }

    for (const rule of rules) {
      const activationType = this.getCursorActivationType(rule)
      const groupKey =
        activationType === 'auto-attached'
          ? 'autoAttached'
          : activationType === 'agent-requested'
            ? 'agentRequested'
            : activationType

      if (groups[groupKey]) {
        groups[groupKey].push(rule)
      } else {
        groups.manual.push(rule)
      }
    }

    return groups
  }

  /**
   * Get Cursor rule name for manual activation
   * @param {Object} rule - Rule object
   * @returns {string} Rule name for @ruleName usage
   */
  getCursorRuleName(rule) {
    const description = rule.frontmatter?.description || ''
    const category = rule.frontmatter?.category || 'rule'

    if (description) {
      return description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 20)
    }

    return category.toLowerCase()
  }

  /**
   * Adapt rules for Windsurf's memories system with proper deployment
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @returns {Object} Windsurf-native memory files
   */
  async adaptForWindsurf(rules, projectContext, platformConfig = {}) {
    // Extract platform-specific settings
    const mode = platformConfig.mode || 'workspace' // global or workspace
    const xmlTag = platformConfig.xmlTag || 'context'
    const characterLimit = platformConfig.characterLimit || 6000
    const priority = platformConfig.priority || 5
    const adaptedFiles = []
    const rulesDir = path.join(this.projectPath, '.windsurf', 'rules')
    const globalDir = path.join(os.homedir(), '.codeium', 'windsurf', 'memories')
    const projectRuleFile = path.join(this.projectPath, '.windsurfrules.md')

    // 1. Global rules (organization-wide standards) - Deploy to ~/.codeium/windsurf/memories/
    const globalRules = rules.filter(
      (rule) => rule.frontmatter?.category === 'core' || rule.frontmatter?.alwaysApply === true
    )

    if (globalRules.length > 0) {
      let globalContent = this.generateWindsurfGlobalMemory(globalRules, projectContext)

      // Enforce 6K character limit for global rules
      if (globalContent.length > 6000) {
        if (this.verbose) {
          console.warn(chalk.yellow('Global Windsurf rules exceed 6K limit, truncating...'))
        }
        globalContent = `${globalContent.substring(0, 5900)}\n\n*Truncated due to character limit*`
      }

      adaptedFiles.push({
        path: path.join(globalDir, 'global_rules.md'),
        content: globalContent,
        type: 'memory',
        scope: 'global',
        characterCount: globalContent.length,
        activationType: 'always-on',
      })
    }

    // 2. Workspace rules (project-specific) - Deploy to .windsurf/rules/
    const workspaceRules = rules.filter(
      (rule) => rule.frontmatter?.category !== 'core' && rule.frontmatter?.alwaysApply !== true
    )

    for (const rule of workspaceRules) {
      let windsurfContent = this.generateWindsurfRule(rule, projectContext)

      // Ensure character limit compliance (6K per file)
      if (windsurfContent.length > 6000) {
        if (this.verbose) {
          console.warn(chalk.yellow(`Rule ${rule.frontmatter?.description} exceeds 6K limit, truncating...`))
        }
        windsurfContent = `${windsurfContent.substring(0, 5900)}\n\n*Truncated due to character limit*`
      }

      const fileName = this.getWindsurfFileName(rule)
      const activationType = this.getWindsurfActivationType(rule)

      adaptedFiles.push({
        path: path.join(rulesDir, fileName),
        content: windsurfContent,
        type: 'rule',
        scope: 'workspace',
        characterCount: windsurfContent.length,
        activationType,
      })
    }

    // 3. Project rule file (.windsurfrules.md) - Alternative single-file approach
    if (workspaceRules.length > 0) {
      const consolidatedContent = this.generateConsolidatedWindsurfRules(workspaceRules, projectContext)

      // Check if consolidated approach is better (fewer files, under limits)
      if (consolidatedContent.length <= 6000 && workspaceRules.length > 3) {
        adaptedFiles.push({
          path: projectRuleFile,
          content: consolidatedContent,
          type: 'project-rules',
          scope: 'project',
          characterCount: consolidatedContent.length,
          activationType: 'model-decision',
        })
      }
    }

    // Ensure total character limit compliance (12K across all workspace rules)
    const totalChars = adaptedFiles
      .filter((f) => f.scope === 'workspace')
      .reduce((total, file) => total + file.characterCount, 0)

    if (totalChars > 12000) {
      if (this.verbose) {
        console.warn(chalk.yellow(`⚠️ Windsurf workspace rules exceed 12K total limit (${totalChars} chars)`))
      }

      // Truncate files proportionally to stay under limit
      const reductionRatio = 11000 / totalChars // Leave some buffer
      for (const file of adaptedFiles.filter((f) => f.scope === 'workspace')) {
        const targetLength = Math.floor(file.characterCount * reductionRatio)
        if (file.content.length > targetLength) {
          file.content = `${file.content.substring(0, targetLength - 50)}\n\n*Truncated for total limit*`
          file.characterCount = file.content.length
        }
      }
    }

    return {
      files: adaptedFiles,
      summary: {
        globalRules: adaptedFiles.filter((f) => f.scope === 'global').length,
        workspaceRules: adaptedFiles.filter((f) => f.scope === 'workspace').length,
        totalCharacters: adaptedFiles.reduce((total, file) => total + file.characterCount, 0),
        characterLimit: 12000,
      },
    }
  }

  /**
   * Adapt rules for GitHub Copilot's guidelines system (FIXED APPROACH)
   * Generate setup instructions instead of files as per report findings
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @returns {Object} GitHub Copilot setup instructions
   */
  async adaptForGitHubCopilot(rules, _projectContext, platformConfig = {}) {
    // Extract platform-specific settings
    const priority = platformConfig.priority || 8
    const reviewType = platformConfig.reviewType || 'code-quality'
    const scope = platformConfig.scope || 'repository'
    // Don't generate files - generate setup instructions
    const prioritizedRules = this.prioritizeRulesForCopilot(rules)
    const selectedRules = prioritizedRules.slice(0, 6) // GitHub Copilot Enterprise limit

    const guidelines = selectedRules.map((rule, index) => ({
      number: index + 1,
      name: rule.frontmatter?.description || `Rule ${index + 1}`,
      description: this.truncateToCharLimit(this.stripFrontmatter(rule.content), 600), // 600 char limit
      filePatterns: rule.frontmatter?.globs || ['**/*'],
    }))

    const instructionsContent = `# GitHub Copilot Setup Instructions

## Configure in Repository Settings
⚠️ **Enterprise Feature**: Requires GitHub Copilot Enterprise plan

## Configuration Steps
1. Go to Settings → Code & automation → Copilot → Code review
2. Add these coding guidelines:

${guidelines
  .map(
    (guideline) => `
### Guideline ${guideline.number}: ${guideline.name}
**Description:** ${guideline.description}
**File patterns:** ${guideline.filePatterns.join(', ')}
`
  )
  .join('')}

## Important Notes
- Guidelines only apply to code reviews, not code completion
- Each description limited to 600 characters
- File patterns use fnmatch syntax (\`*\` wildcard)
- Manual setup required in repository settings
- Maximum 6 guidelines per repository

## Alternative Options
For file-based AI rule management, consider:
- **Claude Code CLI**: Memory files and slash commands
- **Cursor**: .cursor/rules/ directory with MDC format
- **Windsurf**: .windsurf/rules/ directory with XML grouping

---
*Generated by VDK CLI - Setup Instructions Only*`

    return {
      files: [
        {
          path: path.join(this.projectPath, 'GITHUB_COPILOT_SETUP.md'),
          content: instructionsContent,
          type: 'instructions',
          scope: 'repository',
        },
      ],
      guidelines,
      summary: {
        totalGuidelines: guidelines.length,
        maxGuidelines: 6,
        requiresManualSetup: true,
        enterpriseOnly: true,
        approach: 'instructions-only',
      },
    }
  }

  // === Claude Code CLI Memory Generators ===

  /**
   * Generate Claude Code CLI global memory for cross-project preferences
   * @param {Array} globalRules - Global core rules
   * @returns {string} Global memory content
   */
  generateClaudeGlobalMemory(_globalRules) {
    return `# Claude Code CLI User Memory

## Coding Preferences

### Code Style
- Use consistent indentation (2-space for JS/TS/JSON/YAML, 4-space for Python/Go)
- Always use semicolons in JavaScript/TypeScript
- Prefer const/let over var
- Use descriptive variable names, avoid abbreviations
- Add JSDoc comments for complex functions

### Project Structure
- Follow conventional directory structures (src/, lib/, components/, etc.)
- Keep components small and focused (single responsibility)
- Separate business logic from UI components
- Use barrel exports (index.js/ts) for clean imports

### Testing
- Write tests for all business logic
- Use descriptive test names that explain behavior
- Group related tests with describe blocks
- Mock external dependencies in unit tests

## Development Environment

### Tools & Setup
- Primary IDE: Claude Code CLI
- Package manager: pnpm (primary), npm (fallback)
- Use TypeScript for new JavaScript projects
- Use ESLint + Prettier for code formatting

### Git Workflow
- Use conventional commit messages (feat:, fix:, docs:, etc.)
- Create feature branches from main/master
- Squash commits before merging to main
- Always create pull/merge requests for code review

## Workflow Preferences

### Development Workflow
- Start with failing tests (TDD when appropriate)
- Run tests before committing
- Use feature flags for incomplete features
- Implement monitoring and observability

---
*Global Claude Code CLI preferences - Applied across all projects*`
  }

  generateClaudeMainMemory(_coreRules, projectContext) {
    const projectName = path.basename(this.projectPath)
    const techStack = projectContext.techStack || {}

    const content = `# ${projectName} - Claude Code CLI Memory

## Project Overview

This project uses VDK CLI for AI assistant integration and follows specific patterns and conventions.

### Key Information
- **VDK CLI Integration**: Active
- **Primary Languages**: ${techStack.primaryLanguages?.join(', ') || 'Not detected'}
- **Frameworks**: ${techStack.frameworks?.join(', ') || 'Not detected'}
- **Architecture**: ${projectContext.patterns?.architecturalPatterns?.join(', ') || 'Standard'}

## Memory Hierarchy

@CLAUDE-patterns.md
@CLAUDE-personal.md

## Important Conventions
- All AI rules are stored in \`.vdk/rules/\` directory
- Rules follow unified YAML frontmatter format
- Project follows VDK CLI naming conventions
- Memory persistence is enabled for context continuity

## VDK CLI Commands
- \`/project:analyze\` - Analyze project structure and patterns
- \`/project:refresh\` - Update VDK rules based on project changes
- \`/project:validate\` - Validate rule consistency

---
*Team-shared project memory - Last updated: ${new Date().toISOString()}*`

    return content
  }

  /**
   * Generate Claude Code CLI personal preferences import file
   * @returns {string} Personal preferences import content
   */
  generateClaudePersonalPrefsImport() {
    return `# Personal Preferences Import

## Import Personal Settings
@~/.claude/CLAUDE.md

## Project-Specific Overrides
- Personal preferences are imported automatically
- Project-specific settings take precedence
- Use this file to override global settings for this project

---
*Personal preferences import - Loads from ~/.claude/CLAUDE.md*`
  }

  generateClaudeTechMemory(techRules, _projectContext) {
    const projectName = path.basename(this.projectPath)
    let content = `# ${projectName} - Technology Patterns

## Technology-Specific Guidelines

This file contains technology and framework-specific patterns for this project.

`

    // Group rules by framework/technology
    const rulesByTech = this.groupRulesByTechnology(techRules)

    for (const [tech, rules] of Object.entries(rulesByTech)) {
      content += `## ${tech}\n\n`

      for (const rule of rules) {
        const cleanContent = this.stripFrontmatter(rule.content)
        content += this.extractKeySections(cleanContent, ['patterns', 'best practices', 'conventions'])
        content += '\n'
      }

      content += '\n'
    }

    content += `---
*Generated by VDK CLI - Technology patterns for ${projectName}*`

    return content
  }

  /**
   * Generate CLAUDE.local.md content for local/private project context
   */
  generateClaudeLocalMemory(techRules, projectContext) {
    const projectName = path.basename(this.projectPath)
    let content = `# ${projectName} - Local Development Context

## Technology-Specific Patterns
`

    // Group rules by framework/technology
    const rulesByTech = {}
    for (const rule of techRules) {
      const tech = rule.frontmatter?.framework || rule.frontmatter?.technology || 'General'
      if (!rulesByTech[tech]) {
        rulesByTech[tech] = []
      }
      rulesByTech[tech].push(rule)
    }

    // Generate sections for each technology
    for (const [tech, rules] of Object.entries(rulesByTech)) {
      content += `\n### ${tech}\n`
      for (const rule of rules) {
        const cleanContent = this.stripFrontmatter(rule.content)
        content += `${cleanContent}\n\n`
      }
    }

    content += `
## Local Development Notes
- Add your personal development notes here
- This file is gitignored and won't be shared with the team

---
*Local context - not version controlled*`

    return content
  }

  generateClaudeIntegrationMemory(projectContext) {
    const projectName = path.basename(this.projectPath)
    const techStack = projectContext.techStack || {}

    return `# ${projectName} - Integration Context

## Technology Stack Integration

### Detected Stack
- **Languages**: ${techStack.primaryLanguages?.join(', ') || 'Not detected'}
- **Frameworks**: ${techStack.frameworks?.join(', ') || 'Not detected'}
- **Libraries**: ${techStack.libraries?.join(', ') || 'Not detected'}
- **Build Tools**: ${techStack.buildTools?.join(', ') || 'Not detected'}

### Integration Patterns
- VDK CLI manages AI assistant rules across multiple platforms
- Claude Code CLI provides memory persistence and slash commands
- Project rules are automatically synchronized with team preferences
- Memory hierarchy: Project → Local → User preferences

### Available Commands
- \`/project:analyze\` - Analyze project structure and patterns
- \`/project:refresh\` - Update VDK rules based on project changes
- \`/project:validate\` - Validate rule consistency

---
*Integration context maintained by VDK CLI*`
  }

  generateClaudeActiveContext(_projectContext) {
    return `# Active Development Context

## Current Session
- **Project**: ${path.basename(this.projectPath)}
- **Last Analysis**: ${new Date().toISOString()}
- **VDK Version**: Active

## Quick Reference
- Project memory files are active
- Technology patterns loaded
- Integration context available

## Session Notes
*This file can be used for temporary notes and context that shouldn't be shared with the team*

---
*Local memory file - not version controlled*`
  }

  generateClaudeSlashCommand(rule, _projectContext) {
    const commandName = this.getCommandName(rule.frontmatter?.description)
    const cleanContent = this.stripFrontmatter(rule.content)

    return `# ${commandName}

${cleanContent}

Arguments: $ARGUMENTS

---
*Simple contextual aid with $ARGUMENTS placeholder support*`
  }

  // === Cursor MDC Generators === (Duplicates removed - using methods from line 358)

  // === Windsurf Memory Generators ===

  generateWindsurfGlobalMemory(globalRules, _projectContext) {
    let content = `# Global Development Standards - VDK Enhanced

## Organization Standards

`

    for (const rule of globalRules) {
      const cleanContent = this.stripFrontmatter(rule.content)
      const xmlSection = this.convertToWindsurfXML(rule, cleanContent)
      content += `${xmlSection}\n\n`
    }

    content += '*Organization-wide standards - Applied across all Windsurf workspaces*'

    return content
  }

  generateWindsurfRule(rule, _projectContext) {
    const cleanContent = this.stripFrontmatter(rule.content)
    const _title = this.extractTitle(cleanContent) || rule.frontmatter?.description || 'Rule'
    const category = rule.frontmatter?.category || 'general'
    const xmlTag = this.getWindsurfXMLTag(category)

    return `<${xmlTag}>
${cleanContent}
</${xmlTag}>`
  }

  convertToWindsurfXML(rule, content) {
    const category = rule.frontmatter?.category || 'general'
    const xmlTag = this.getWindsurfXMLTag(category)

    const keyContent = this.extractKeySections(content, ['principles', 'guidelines', 'patterns', 'best practices'])

    return `<${xmlTag}>
${this.formatForWindsurf(keyContent)}
</${xmlTag}>`
  }

  getWindsurfXMLTag(category) {
    const tagMap = {
      core: 'development-standards',
      language: 'language-standards',
      technology: 'technology-guidelines',
      framework: 'technology-guidelines',
      testing: 'testing-patterns',
      task: 'task-workflow',
      assistant: 'ai-assistance',
    }
    return tagMap[category] || 'rule'
  }

  formatForWindsurf(content) {
    // Format content for Windsurf XML sections with proper indentation
    return content
      .split('\n')
      .map((line) => (line.trim() ? `- ${line.trim()}` : ''))
      .filter((line) => line)
      .join('\n')
  }

  getWindsurfFileName(rule) {
    const framework = rule.frontmatter?.framework || rule.frontmatter?.category || 'general'
    const id = rule.frontmatter?.id || ''

    // Create a unique filename combining available identifiers
    let baseName = framework
    if (id && id !== framework) {
      baseName = `${framework}-${id}`
    }

    // Clean up the name: preserve meaningful separators, replace others with hyphens
    const cleanName = baseName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-') // Replace non-alphanumeric (except hyphens/underscores) with hyphens
      .replace(/[-_]+/g, '-') // Replace multiple consecutive separators with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

    // Ensure we have a valid filename
    const finalName = cleanName || `windsurf-rule-${Date.now()}`
    return `${finalName}.md`
  }

  /**
   * Determine Windsurf activation type based on rule characteristics
   * @param {Object} rule - Rule object
   * @returns {string} Activation type
   */
  getWindsurfActivationType(rule) {
    // Manual - Via @mention in Cascade
    if (rule.frontmatter?.category === 'task') {
      return 'manual'
    }

    // Always On - Automatically applied
    if (rule.frontmatter?.alwaysApply === true) {
      return 'always-on'
    }

    // Glob - Based on file pattern matching
    if (rule.frontmatter?.globs && rule.frontmatter?.globs.length > 0) {
      return 'glob'
    }

    // Model Decision - Based on natural language description
    if (rule.frontmatter?.description) {
      return 'model-decision'
    }

    return 'model-decision' // Default
  }

  /**
   * Generate consolidated Windsurf rules for single-file deployment
   * @param {Array} rules - Workspace rules
   * @param {Object} projectContext - Project context
   * @returns {string} Consolidated content
   */
  generateConsolidatedWindsurfRules(rules, _projectContext) {
    const projectName = path.basename(this.projectPath)
    let content = `# ${projectName} - Windsurf Project Rules

## Development Standards

`

    // Group rules by category for better organization
    const rulesByCategory = this.groupRulesByCategory(rules)

    for (const [category, categoryRules] of Object.entries(rulesByCategory)) {
      const xmlTag = this.getWindsurfXMLTag(category)
      content += `<${xmlTag}>\n`

      for (const rule of categoryRules) {
        const cleanContent = this.stripFrontmatter(rule.content)
        const keyPoints = this.extractKeyPoints(cleanContent)
        content += `${keyPoints.map((point) => `- ${point}`).join('\n')}\n`
      }

      content += `</${xmlTag}>\n\n`
    }

    content += '*Consolidated project rules - Model decision activation*'

    return content
  }

  /**
   * Group rules by category for organized display
   * @param {Array} rules - Rules to group
   * @returns {Object} Rules grouped by category
   */
  groupRulesByCategory(rules) {
    const groups = {}

    for (const rule of rules) {
      const category = rule.frontmatter?.category || 'general'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(rule)
    }

    return groups
  }

  /**
   * Truncate content to character limit (HELPER for GitHub Copilot)
   * @param {string} content - Content to truncate
   * @param {number} limit - Character limit
   * @returns {string} Truncated content
   */
  truncateToCharLimit(content, limit) {
    if (content.length <= limit) {
      return content
    }

    // Try to truncate at a sentence boundary
    const truncated = content.substring(0, limit - 3)
    const lastSentence = truncated.lastIndexOf('.')

    if (lastSentence > limit * 0.7) {
      // If we can keep at least 70% and end at sentence
      return truncated.substring(0, lastSentence + 1)
    }

    return `${truncated}...`
  }

  // === GitHub Copilot Generators ===

  prioritizeRulesForCopilot(rules) {
    // Prioritize rules based on their effectiveness for code review
    return rules
      .filter((rule) => rule.frontmatter?.category !== 'assistant') // Skip assistant-specific rules
      .sort((a, b) => {
        const aPriority = this.getCopilotPriority(a)
        const bPriority = this.getCopilotPriority(b)
        return bPriority - aPriority
      })
  }

  getCopilotPriority(rule) {
    // Assign priority scores for GitHub Copilot effectiveness
    const category = rule.frontmatter?.category || 'general'
    const hasGlobs = rule.frontmatter?.globs && rule.frontmatter?.globs.length > 0

    let score = 0
    if (category === 'core') {
      score += 10
    }
    if (category === 'language' || category === 'technology') {
      score += 8
    }
    if (category === 'stack') {
      score += 6
    }
    if (category === 'task') {
      score += 4
    }
    if (hasGlobs) {
      score += 3
    }
    if (rule.frontmatter?.alwaysApply === true) {
      score += 2
    }

    return score
  }

  generateCopilotGuideline(rule, _projectContext) {
    const title = this.extractTitle(this.stripFrontmatter(rule.content)) || rule.frontmatter?.description
    const description = this.generateCopilotDescription(rule)
    const paths = rule.frontmatter?.globs || []

    return {
      title: title.substring(0, 100), // Reasonable title length
      description: description.substring(0, 600), // GitHub Copilot limit
      paths,
    }
  }

  generateCopilotDescription(rule) {
    const cleanContent = this.stripFrontmatter(rule.content)
    const keyPoints = this.extractKeyPoints(cleanContent)

    // Create concise description focused on what Copilot should look for
    let description = rule.frontmatter?.description

    if (keyPoints.length > 0) {
      description += `. Key points: ${keyPoints.slice(0, 3).join('. ')}`
    }

    return description
  }

  generateCopilotDocumentation(guidelines, _projectContext) {
    const projectName = path.basename(this.projectPath)

    let content = `# GitHub Copilot Guidelines for ${projectName}

## Overview

This directory contains GitHub Copilot Enterprise coding guidelines generated by VDK CLI.

## Active Guidelines

`

    guidelines.forEach((guideline, index) => {
      content += `### ${index + 1}. ${guideline.title}

**Description**: ${guideline.description}

`
      if (guideline.paths.length > 0) {
        content += `**File Patterns**: ${guideline.paths.map((p) => `\`${p}\``).join(', ')}

`
      }
    })

    content += `## Setup Instructions

1. Navigate to your repository on GitHub
2. Go to Settings → Code & automation → Copilot → Code review
3. Configure the guidelines listed above
4. Each guideline should be added with its title and description

## VDK Integration

- Guidelines updated automatically with \`vdk sync\`
- Project patterns detected and incorporated
- Maximum 6 guidelines per repository (GitHub Copilot limit)

---
*Generated by VDK CLI*`

    return content
  }

  // === Utility Methods ===

  stripFrontmatter(content) {
    if (content.startsWith('---')) {
      const parts = content.split('---')
      return parts.slice(2).join('---').trim()
    }
    return content
  }

  extractTitle(content) {
    const lines = content.split('\n')
    const titleLine = lines.find((line) => line.startsWith('# '))
    return titleLine ? titleLine.replace('# ', '').trim() : 'Untitled'
  }

  extractKeySections(content, sectionTypes) {
    const lines = content.split('\n')
    let result = ''
    let inTargetSection = false

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const sectionTitle = line.toLowerCase()
        inTargetSection = sectionTypes.some((type) => sectionTitle.includes(type))
      }

      if (inTargetSection && !line.startsWith('#')) {
        result += `${line}\n`
      }
    }

    return result.trim()
  }

  extractKeyPoints(content) {
    const lines = content.split('\n')
    return lines
      .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 10) // Filter out very short points
  }

  groupRulesByTechnology(rules) {
    const groups = {}

    for (const rule of rules) {
      const tech = rule.frontmatter?.framework || rule.frontmatter?.category || 'General'
      if (!groups[tech]) {
        groups[tech] = []
      }
      groups[tech].push(rule)
    }

    return groups
  }

  getCommandName(description) {
    return description
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim()
  }

  /**
   * Adapt rules for Zed Editor
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @param {Object} platformConfig - Zed-specific configuration
   * @returns {Object} Zed-native configuration
   */
  async adaptForZed(rules, projectContext, platformConfig = {}) {
    const adaptedFiles = []
    const mode = platformConfig.mode || 'project' // global or project
    const aiFeatures = platformConfig.aiFeatures !== false // Default: true
    const collaborative = platformConfig.collaborative !== false // Default: true
    const performance = platformConfig.performance || 'high' // high, medium, low

    const baseDir = mode === 'global' ? path.join(os.homedir(), '.config', 'zed') : path.join(this.projectPath, '.zed')

    const aiRulesDir = path.join(baseDir, 'ai-rules')

    for (const rule of rules) {
      const ruleContent = this.stripFrontmatter(rule.content)
      const title = rule.frontmatter?.title || this.extractTitle(rule.content)
      const cleanTitle = title
        .trim()
        .replace(/[^a-z0-9-]/gi, '-') // Replace non-alphanumeric (except hyphens) with hyphens
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase()
      const filename = cleanTitle ? `${cleanTitle}.md` : `rule-${Date.now()}.md`

      adaptedFiles.push({
        path: path.join(aiRulesDir, filename),
        content: ruleContent,
        type: 'ai-rule',
        scope: mode,
        aiFeatures: aiFeatures && rule.frontmatter?.aiFeatures !== false,
        collaborative: collaborative && rule.frontmatter?.collaborative !== false,
        performance,
      })
    }

    return {
      files: adaptedFiles,
      summary: {
        generated: adaptedFiles.length,
        mode,
        aiFeatures,
        collaborative,
        performance,
      },
    }
  }

  /**
   * Adapt rules for VS Code family (VS Code, Insiders, VSCodium)
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @param {Object} platformConfig - VS Code-specific configuration
   * @returns {Object} VS Code-native configuration
   */
  async adaptForVSCode(rules, projectContext, platformConfig = {}) {
    const adaptedFiles = []
    const extension = platformConfig.extension || null
    const settings = platformConfig.settings || {}
    const commands = platformConfig.commands || []
    const mcpIntegration = platformConfig.mcpIntegration

    // Determine config directory based on VS Code variant
    let configDir = '.vscode'
    if (platformConfig.configPath) {
      configDir = platformConfig.configPath
    }

    const aiRulesDir = path.join(this.projectPath, configDir, 'ai-rules')

    // Generate rule files
    for (const rule of rules) {
      const ruleContent = this.stripFrontmatter(rule.content)
      const title = rule.frontmatter?.title || this.extractTitle(rule.content)
      const cleanTitle = title
        .trim()
        .replace(/[^a-z0-9-]/gi, '-') // Replace non-alphanumeric (except hyphens) with hyphens
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase()
      const filename = cleanTitle ? `${cleanTitle}.md` : `rule-${Date.now()}.md`

      adaptedFiles.push({
        path: path.join(aiRulesDir, filename),
        content: ruleContent,
        type: 'ai-rule',
      })
    }

    // Generate MCP configuration if enabled
    if (mcpIntegration) {
      const mcpConfig = {
        servers: {},
        globalShortcuts: settings,
      }

      adaptedFiles.push({
        path: path.join(this.projectPath, configDir, 'mcp.json'),
        content: JSON.stringify(mcpConfig, null, 2),
        type: 'mcp-config',
      })
    }

    return {
      files: adaptedFiles,
      summary: {
        generated: adaptedFiles.length,
        extension,
        mcpIntegration,
        configDir,
      },
    }
  }

  /**
   * Adapt rules for generic platforms
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @param {Object} platformConfig - Generic platform configuration
   * @returns {Object} Generic platform configuration
   */
  async adaptForGeneric(rules, projectContext, platformConfig = {}) {
    const adaptedFiles = []
    const configPath = platformConfig.configPath || '.vdk'
    const rulesPath = platformConfig.rulesPath || '.vdk/rules'
    const priority = platformConfig.priority || 5

    const baseDir = path.join(this.projectPath, configPath)
    const rulesDir = path.join(this.projectPath, rulesPath)

    // Sort rules by priority
    const prioritizedRules = rules.sort((a, b) => {
      const aPriority = a.frontmatter?.priority || priority
      const bPriority = b.frontmatter?.priority || priority
      return bPriority - aPriority
    })

    // Generate rule files
    for (const rule of prioritizedRules) {
      const ruleContent = this.stripFrontmatter(rule.content)
      const title = rule.frontmatter?.title || this.extractTitle(rule.content)
      const cleanTitle = title
        .trim()
        .replace(/[^a-z0-9-]/gi, '-') // Replace non-alphanumeric (except hyphens) with hyphens
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase()
      const filename = cleanTitle ? `${cleanTitle}.md` : `rule-${Date.now()}.md`

      adaptedFiles.push({
        path: path.join(rulesDir, filename),
        content: ruleContent,
        type: 'ai-rule',
        priority: rule.frontmatter?.priority || priority,
      })
    }

    // Generate generic configuration
    const genericConfig = {
      version: '3.0.0',
      platform: 'generic-ai',
      rules: {
        directory: rulesPath,
        priority,
        count: adaptedFiles.length,
      },
      project: {
        name: path.basename(this.projectPath),
        technologies: projectContext.technologies || [],
        framework: projectContext.framework || null,
      },
      generatedAt: new Date().toISOString(),
    }

    adaptedFiles.push({
      path: path.join(baseDir, 'config.json'),
      content: JSON.stringify(genericConfig, null, 2),
      type: 'config',
    })

    return {
      files: adaptedFiles,
      summary: {
        generated: adaptedFiles.length - 1, // Exclude config file
        config: 1,
        priority,
        configPath,
        rulesPath,
      },
    }
  }

  // ============================================================================
  // VDK-Native Intelligence Methods (Universal for all platforms)
  // ============================================================================

  /**
   * Determine project type from VDK technology analysis
   * @param {Object} vdkAnalysis - VDK analysis data
   * @returns {string} Human-readable project type
   */
  determineProjectType(projectContext) {
    const technologyData = projectContext.technologyData || projectContext.technology || {}
    const frameworks = technologyData.frameworks || []
    const languages = technologyData.primaryLanguages || []
    const stacks = technologyData.stacks || []
    const projectStructure = projectContext.projectStructure || projectContext.structure || {}

    // Check for CLI tool indicators FIRST (highest priority)
    if (this.isCLIProject(projectContext)) {
      return 'Node.js CLI Application'
    }

    // Check for documentation/content sites
    if (stacks.includes('Astro Content Stack') && frameworks.includes('Starlight')) {
      return 'Astro Starlight Documentation Site'
    }

    // Check for web frameworks (only if not a CLI)
    if (frameworks.includes('Astro')) {
      return 'Astro Application'
    }
    if (frameworks.includes('Next.js') && frameworks.includes('Supabase')) {
      return 'Next.js + Supabase Full-Stack Application'
    }
    if (frameworks.includes('Next.js')) {
      return 'Next.js Application'
    }
    if (frameworks.includes('React')) {
      return 'React Application'
    }
    if (frameworks.includes('Vue.js')) {
      return 'Vue.js Application'
    }
    if (languages.includes('TypeScript')) {
      return 'TypeScript Application'
    }
    if (languages.includes('JavaScript')) {
      return 'JavaScript Application'
    }

    return 'Software Project'
  }

  /**
   * Check if this is a CLI project based on package.json and structure
   */
  isCLIProject(projectContext) {
    const technologyData = projectContext.technologyData || projectContext.technology || {}
    const projectStructure = projectContext.projectStructure || projectContext.structure || {}

    // Check for CLI indicators in package.json
    if (technologyData.packageInfo) {
      const pkg = technologyData.packageInfo

      // Has bin field in package.json
      if (pkg.bin) {
        return true
      }

      // Has CLI-related keywords
      const keywords = pkg.keywords || []
      const cliKeywords = ['cli', 'command-line', 'terminal', 'tool', 'utility']
      if (cliKeywords.some((keyword) => keywords.includes(keyword))) {
        return true
      }

      // Has CLI-related dependencies
      const deps = [...(pkg.dependencies || []), ...(pkg.devDependencies || [])]
      const cliDeps = ['commander', 'yargs', 'inquirer', 'chalk', 'ora', 'boxen']
      if (cliDeps.some((dep) => deps.includes(dep))) {
        return true
      }
    }

    // Check for executable files in project root
    const rootFiles = projectStructure.files || []
    const hasExecutable = rootFiles.some(
      (file) =>
        file.name === 'cli.js' ||
        file.name === 'cli.ts' ||
        file.name.startsWith('bin/') ||
        (file.executable && file.name.match(/\.(js|ts)$/))
    )

    if (hasExecutable) {
      return true
    }

    return false
  }

  /**
   * Extract VDK technology-specific guidelines from blueprint rules
   * @param {Array} technologyRules - Technology-related blueprint rules
   * @param {Object} vdkAnalysis - VDK analysis data
   * @returns {string} Formatted technology guidelines
   */
  async extractVDKTechnologyGuidelines(technologyRules, projectContext) {
    if (!technologyRules || technologyRules.length === 0) {
      return `### General Guidelines
- Follow established patterns in the codebase
- Maintain consistency with existing code  
- Use project-specific conventions`
    }

    const technologyData = projectContext.technologyData || projectContext.technology || {}
    const frameworks = technologyData.frameworks || []
    const languages = technologyData.primaryLanguages || []
    const libraries = technologyData.libraries || []

    if (this.verbose) {
      console.log(`🔍 Processing ${technologyRules.length} technology rules for VDK-native guidelines`)
    }

    const guidelines = []

    // Extract framework-specific guidelines
    for (const framework of frameworks) {
      const frameworkRules = this.findMatchingRules(technologyRules, framework)
      if (frameworkRules.length > 0) {
        guidelines.push(`### ${framework} Guidelines`)
        for (const rule of frameworkRules.slice(0, 3)) {
          const extractedContent = this.extractActionableContent(rule.content, projectContext)
          if (extractedContent) {
            guidelines.push(extractedContent)
          }
        }
        guidelines.push('')
      }
    }

    // Extract language-specific guidelines
    for (const language of languages) {
      const languageRules = this.findMatchingRules(technologyRules, language)
      if (languageRules.length > 0) {
        guidelines.push(`### ${language} Guidelines`)
        for (const rule of languageRules.slice(0, 2)) {
          const extractedContent = this.extractActionableContent(rule.content, projectContext)
          if (extractedContent) {
            guidelines.push(extractedContent)
          }
        }
        guidelines.push('')
      }
    }

    // Extract library-specific guidelines
    for (const library of libraries.slice(0, 3)) {
      // Limit to top 3 libraries
      const libraryRules = this.findMatchingRules(technologyRules, library)
      if (libraryRules.length > 0) {
        guidelines.push(`### ${library} Guidelines`)
        for (const rule of libraryRules.slice(0, 2)) {
          const extractedContent = this.extractActionableContent(rule.content, projectContext)
          if (extractedContent) {
            guidelines.push(extractedContent)
          }
        }
        guidelines.push('')
      }
    }

    return guidelines.length > 0
      ? guidelines.join('\n')
      : `### Project-Specific Guidelines
- Follow patterns established in this ${frameworks.join('/')} codebase
- Maintain consistency with existing ${languages.join('/')} code
- Reference VDK blueprints: ${technologyRules.length} rules available`
  }

  /**
   * Find blueprint rules matching a technology name
   * @param {Array} rules - Blueprint rules to search
   * @param {string} technology - Technology name to match
   * @returns {Array} Matching rules
   */
  findMatchingRules(rules, technology) {
    const techLower = technology.toLowerCase()
    const aliases = {
      'tailwind css': ['tailwind', 'tailwindcss'],
      'next.js': ['nextjs'],
      'shadcn/ui': ['shadcn', 'shadcnui'],
    }

    const searchTerms = [techLower]
    if (aliases[techLower]) {
      searchTerms.push(...aliases[techLower])
    }

    return rules.filter((rule) =>
      searchTerms.some((term) => rule.name?.toLowerCase().includes(term) || rule.path?.toLowerCase().includes(term))
    )
  }

  /**
   * Extract actionable content from blueprint rules
   * @param {string} content - Rule content
   * @param {Object} vdkAnalysis - VDK analysis for context
   * @returns {string} Extracted actionable guidelines
   */
  extractActionableContent(content, projectContext) {
    if (!content) return null

    try {
      // Remove frontmatter
      const withoutFrontmatter = this.stripFrontmatter(content)
      const lines = withoutFrontmatter.split('\n')
      const relevantLines = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Look for actionable guidelines (bullet points with action words)
        if ((trimmed.startsWith('- ') || trimmed.startsWith('* ')) && this.isActionableGuideline(trimmed)) {
          relevantLines.push(trimmed)
        }
        // Capture numbered lists that are guidelines
        else if (trimmed.match(/^\d+\.\s/) && this.isActionableGuideline(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s/, '')
          relevantLines.push(`- ${content}`)
        }

        // Limit content extraction
        if (relevantLines.length >= 8) break
      }

      return relevantLines.length > 0 ? relevantLines.join('\n') : null
    } catch (error) {
      if (this.verbose) {
        console.warn(`Failed to extract content from rule: ${error.message}`)
      }
      return null
    }
  }

  /**
   * Check if a line contains actionable guidelines
   * @param {string} line - Line to check
   * @returns {boolean} True if actionable
   */
  isActionableGuideline(line) {
    const actionableWords = [
      'use',
      'avoid',
      'prefer',
      'should',
      'must',
      'always',
      'never',
      'implement',
      'ensure',
      'configure',
      'follow',
      'apply',
      'keep',
      'optimize',
      'test',
      'validate',
      'structure',
      'organize',
    ]

    return actionableWords.some((word) => line.toLowerCase().includes(word)) && line.length > 20
  }

  /**
   * Detect package manager from VDK analysis
   * @param {Object} vdkAnalysis - VDK analysis data
   * @returns {Promise<string>} Package manager name
   */
  async detectPackageManager(projectContext) {
    const projectPath = projectContext.projectStructure?.root || projectContext.structure?.root || this.projectPath

    try {
      // Check for lock files in order of preference
      if (await this.fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
        return 'pnpm'
      }
      if (await this.fileExists(path.join(projectPath, 'yarn.lock'))) {
        return 'yarn'
      }
      if (await this.fileExists(path.join(projectPath, 'bun.lockb'))) {
        return 'bun'
      }
      if (await this.fileExists(path.join(projectPath, 'package-lock.json'))) {
        return 'npm'
      }
      return 'npm'
    } catch {
      return 'npm'
    }
  }

  /**
   * Helper to check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
