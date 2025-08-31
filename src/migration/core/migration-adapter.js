/**
 * Migration Adapter
 * -----------------
 * Adapts existing AI contexts to VDK blueprint format using existing
 * VDK schema structures and templating systems.
 */

import path from 'node:path'
import matter from 'gray-matter'

export class MigrationAdapter {
  constructor() {
    // VDK category mapping for different context types
    this.categoryMapping = {
      'claude-code-cli': {
        memory: 'core',
        commands: 'assistant',
        rules: 'core',
        tools: 'tool',
      },
      cursor: {
        rules: 'core',
        patterns: 'language',
        workflows: 'task',
      },
      'github-copilot': {
        review: 'task',
        security: 'security',
        guidelines: 'core',
      },
      windsurf: {
        agent: 'assistant',
        context: 'core',
        flows: 'task',
      },
      'generic-ai': {
        default: 'core',
      },
    }
  }

  /**
   * Adapt detected AI contexts to VDK blueprint format
   * @param {Array} contexts Detected AI contexts
   * @param {Object} projectContext Project analysis data
   * @returns {Object} Adaptation results
   */
  async adaptContextsToVDK(contexts, projectContext) {
    const results = {
      successful: [],
      failed: [],
      skipped: [],
    }

    for (const context of contexts) {
      try {
        const adapted = await this.adaptSingleContext(context, projectContext)
        if (adapted) {
          results.successful.push(adapted)
        } else {
          results.skipped.push({
            context,
            reason: 'No adaptation strategy available',
          })
        }
      } catch (error) {
        results.failed.push({
          context,
          error: error.message,
        })
      }
    }

    return results
  }

  /**
   * Adapt a single context to VDK format
   * @param {Object} context AI context to adapt
   * @param {Object} projectContext Project data
   * @returns {Object} VDK blueprint
   */
  async adaptSingleContext(context, projectContext) {
    const adaptationStrategy = this.getAdaptationStrategy(context)
    if (!adaptationStrategy) {
      return null
    }

    const baseBlueprint = this.createBaseBlueprint(context, projectContext)
    const specificAdaptation = await adaptationStrategy(context, projectContext)

    return {
      ...baseBlueprint,
      ...specificAdaptation,
      migration: {
        originalSource: context.source,
        originalPath: context.relativePath,
        confidence: context.confidence,
        migrationDate: new Date().toISOString(),
      },
    }
  }

  /**
   * Get adaptation strategy for context type
   * @param {Object} context AI context
   * @returns {Function|null} Adaptation function
   */
  getAdaptationStrategy(context) {
    const strategies = {
      'claude-code-cli': this.adaptClaudeCode.bind(this),
      cursor: this.adaptCursor.bind(this),
      'github-copilot': this.adaptGitHubCopilot.bind(this),
      windsurf: this.adaptWindsurf.bind(this),
      'generic-ai': this.adaptGenericAI.bind(this),
    }

    return strategies[context.type] || null
  }

  /**
   * Create base VDK blueprint structure
   * @param {Object} context AI context
   * @param {Object} projectContext Project data
   * @returns {Object} Base blueprint
   */
  createBaseBlueprint(context, projectContext) {
    const id = this.generateBlueprintId(context)
    const title = this.extractTitle(context)
    const description = this.extractDescription(context)
    const category = this.inferCategory(context, projectContext)

    return {
      id,
      title,
      description,
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      category,
      subcategory: this.inferSubcategory(context),
      complexity: this.inferComplexity(context),
      scope: this.inferScope(context),
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatforms(context),
      tags: this.extractTags(context, projectContext),
      author: `Migrated from ${context.source}`,
      contentSections: context.sections?.map((s) => s.title) || [],
    }
  }

  /**
   * Adapt Claude Code CLI contexts
   * @param {Object} context Claude Code CLI context
   * @param {Object} projectContext Project data
   * @returns {Object} Adapted blueprint
   */
  async adaptClaudeCode(context, projectContext) {
    const { claudeSpecific } = context

    // Determine if this should be a command or blueprint
    const isCommand = claudeSpecific?.hasSlashCommands || context.fileName.includes('command') || context.hasCommands

    if (isCommand) {
      return this.adaptAsCommand(context, {
        target: 'claude-code-cli',
        commandType: claudeSpecific?.hasSlashCommands ? 'slash' : 'custom-slash',
        features: {
          mcpIntegration: claudeSpecific?.hasMCPReferences,
          fileReferences: claudeSpecific?.hasFileReferences,
          toolReferences: claudeSpecific?.hasToolReferences,
        },
      })
    }

    // Memory or blueprint adaptation
    const isMemory = context.fileName === 'CLAUDE.md' || context.relativePath.includes('memory')

    return {
      category: isMemory ? 'core' : this.inferCategory(context, projectContext),
      content: this.organizeContent(context),
      platforms: {
        'claude-code-cli': {
          compatible: true,
          memory: true,
          mcpIntegration: claudeSpecific?.hasMCPReferences,
          allowedTools: this.extractAllowedTools(context),
        },
      },
    }
  }

  /**
   * Adapt Cursor contexts
   * @param {Object} context Cursor context
   * @param {Object} projectContext Project data
   * @returns {Object} Adapted blueprint
   */
  async adaptCursor(context, projectContext) {
    const { cursorSpecific } = context
    const isCursorRules = ['.cursorrules', 'cursorrules'].includes(context.fileName)

    return {
      category: isCursorRules ? 'core' : 'language',
      scope: isCursorRules ? 'project' : 'component',
      content: this.organizeContent(context),
      platforms: {
        cursor: {
          compatible: true,
          activation: isCursorRules ? 'always' : 'auto-attached',
          globs: cursorSpecific?.hasFileGlobs ? this.extractGlobs(context) : ['**/*'],
          priority: isCursorRules ? 'high' : 'medium',
        },
        'claude-code-cli': {
          compatible: true,
          memory: true,
        },
      },
    }
  }

  /**
   * Adapt GitHub Copilot contexts
   * @param {Object} context Copilot context
   * @param {Object} projectContext Project data
   * @returns {Object} Adapted blueprint
   */
  async adaptGitHubCopilot(context, projectContext) {
    const { copilotSpecific } = context
    const category = copilotSpecific?.hasSecurityRules ? 'security' : copilotSpecific?.hasReviewRules ? 'task' : 'core'

    return {
      category,
      content: this.organizeContent(context),
      platforms: {
        'github-copilot': {
          compatible: true,
          priority: copilotSpecific?.hasSecurityRules ? 9 : 7,
          reviewType: copilotSpecific?.hasSecurityRules
            ? 'security'
            : copilotSpecific?.hasReviewRules
              ? 'code-quality'
              : 'style',
        },
        'claude-code-cli': {
          compatible: true,
          memory: true,
        },
      },
    }
  }

  /**
   * Adapt Windsurf contexts
   * @param {Object} context Windsurf context
   * @param {Object} projectContext Project data
   * @returns {Object} Adapted blueprint
   */
  async adaptWindsurf(context, projectContext) {
    const { windsurfSpecific } = context

    return {
      category: windsurfSpecific?.hasAgentRules ? 'assistant' : 'core',
      content: this.organizeContent(context),
      platforms: {
        windsurf: {
          compatible: true,
          mode: 'workspace',
          xmlTag: this.extractXMLTag(context),
          characterLimit: Math.max(context.wordCount * 6, 1000), // Estimate character count
        },
        'claude-code-cli': {
          compatible: true,
          memory: true,
        },
      },
    }
  }

  /**
   * Adapt generic AI contexts
   * @param {Object} context Generic AI context
   * @param {Object} projectContext Project data
   * @returns {Object} Adapted blueprint
   */
  async adaptGenericAI(context, projectContext) {
    return {
      category: this.inferCategory(context, projectContext),
      content: this.organizeContent(context),
      platforms: {
        'claude-code-cli': {
          compatible: true,
          memory: true,
        },
        cursor: {
          compatible: true,
          activation: 'manual',
          priority: 'low',
        },
      },
    }
  }

  /**
   * Adapt context as a command
   * @param {Object} context Context to adapt
   * @param {Object} commandOptions Command options
   * @returns {Object} Command blueprint
   */
  adaptAsCommand(context, commandOptions) {
    return {
      type: 'command',
      commandType: commandOptions.commandType,
      target: commandOptions.target,
      scope: 'project',
      content: this.organizeContent(context),
      claudeCode: {
        slashCommand: this.extractSlashCommand(context),
        arguments: {
          supports: this.hasArguments(context),
          placeholder: '$ARGUMENTS',
        },
        fileReferences: {
          supports: commandOptions.features?.fileReferences,
        },
        mcpIntegration: commandOptions.features?.mcpIntegration
          ? {
              requiredServers: this.extractMCPServers(context),
            }
          : undefined,
      },
    }
  }

  // Utility methods

  generateBlueprintId(context) {
    const baseName = path.basename(context.fileName, path.extname(context.fileName))
    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const sourcePrefix = context.type.split('-')[0] // e.g., 'claude' from 'claude-code-cli'
    return `${sourcePrefix}-${sanitized}` || `migrated-${Date.now()}`
  }

  extractTitle(context) {
    // Try frontmatter first
    if (context.frontmatter?.title) {
      return context.frontmatter.title
    }

    // Look for H1 in content
    if (context.bodyContent || context.content) {
      const content = context.bodyContent || context.content || ''
      const h1Match = content.match(/^#\s+(.+)/m)
      if (h1Match) {
        return h1Match[1].trim()
      }
    }

    // Use filename as fallback
    const baseName = path.basename(context.fileName, path.extname(context.fileName))
    return baseName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace(/^(Claude|Cursor|Copilot|Windsurf)\s*/i, '') // Remove platform prefixes
  }

  extractDescription(context) {
    // Try frontmatter first
    if (context.frontmatter?.description) {
      return context.frontmatter.description
    }

    // Look for description in content
    const content = context.bodyContent || context.content || ''
    const descMatch = content.match(/(?:description|desc):\s*(.+)/i)
    if (descMatch) {
      return descMatch[1].trim()
    }

    // Use first meaningful paragraph
    const lines = content.split('\n').filter((line) => line.trim())
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('#') && !line.includes(':') && line.length > 20) {
        return line.length > 200 ? line.substring(0, 197) + '...' : line
      }
    }

    return `Migrated AI context from ${context.source}`
  }

  inferCategory(context, projectContext) {
    const { techData } = projectContext || {}
    const content = (context.bodyContent || context.content || '').toLowerCase()

    // Use technology-specific mapping
    if (techData?.frameworks) {
      if (techData.frameworks.includes('React') && content.includes('component')) return 'language'
      if (techData.frameworks.includes('Next.js') && content.includes('routing')) return 'technology'
    }

    // Content-based inference
    if (content.includes('test') || content.includes('spec')) return 'task'
    if (content.includes('security') || content.includes('auth')) return 'security'
    if (content.includes('performance') || content.includes('optimize')) return 'performance'
    if (content.includes('command') || content.includes('slash')) return 'assistant'
    if (content.includes('workflow') || content.includes('process')) return 'task'

    // Type-based mapping
    const mapping = this.categoryMapping[context.type]
    if (mapping) {
      if (context.hasCommands && mapping.commands) return mapping.commands
      if (context.hasMemory && mapping.memory) return mapping.memory
      if (context.hasRules && mapping.rules) return mapping.rules
      return mapping.default || 'core'
    }

    return 'core'
  }

  inferSubcategory(context) {
    const content = (context.bodyContent || context.content || '').toLowerCase()

    if (content.includes('react')) return 'react'
    if (content.includes('typescript')) return 'typescript'
    if (content.includes('next.js')) return 'nextjs'
    if (content.includes('testing')) return 'testing'
    if (content.includes('styling')) return 'styling'

    return
  }

  inferComplexity(context) {
    const wordCount = context.wordCount || 0
    const sectionCount = context.sections?.length || 0
    const hasTemplating = context.hasTemplating

    if (wordCount > 1000 || sectionCount > 5 || hasTemplating) return 'complex'
    if (wordCount > 300 || sectionCount > 2) return 'medium'
    return 'simple'
  }

  inferScope(context) {
    const content = (context.bodyContent || context.content || '').toLowerCase()

    if (content.includes('project') || content.includes('global')) return 'project'
    if (content.includes('system') || content.includes('architecture')) return 'system'
    if (content.includes('feature') || content.includes('module')) return 'feature'
    if (content.includes('component') || context.relativePath.includes('component')) return 'component'

    return 'file'
  }

  generatePlatforms(context) {
    const platforms = {}

    // Always include Claude Code CLI compatibility for migration
    platforms['claude-code-cli'] = {
      compatible: true,
      memory: true,
    }

    // Add original platform with high compatibility
    const platformMap = {
      'claude-code-cli': 'claude-code-cli',
      cursor: 'cursor',
      'github-copilot': 'github-copilot',
      windsurf: 'windsurf',
    }

    const originalPlatform = platformMap[context.type]
    if (originalPlatform && originalPlatform !== 'claude-code-cli') {
      platforms[originalPlatform] = {
        compatible: true,
        ...(originalPlatform === 'cursor' && { activation: 'always' }),
        ...(originalPlatform === 'github-copilot' && { priority: 8 }),
        ...(originalPlatform === 'windsurf' && { mode: 'workspace' }),
      }
    }

    return platforms
  }

  extractTags(context, projectContext) {
    const tags = []
    const { techData } = projectContext || {}
    const content = (context.bodyContent || context.content || '').toLowerCase()

    // Add source tag
    tags.push(`migrated-from-${context.type.replace('-', '')}`)

    // Add technology tags from project context
    if (techData) {
      if (techData.primaryLanguages) tags.push(...techData.primaryLanguages.slice(0, 3))
      if (techData.frameworks) tags.push(...techData.frameworks.slice(0, 3))
    }

    // Add content-based tags
    const contentTags = ['api', 'frontend', 'backend', 'testing', 'security', 'performance']
    for (const tag of contentTags) {
      if (content.includes(tag)) tags.push(tag)
    }

    return [...new Set(tags)].slice(0, 8) // Limit and dedupe
  }

  organizeContent(context) {
    let content = context.bodyContent || context.content || ''

    // If we have sections, reorganize content
    if (context.sections && context.sections.length > 0) {
      content = context.sections.map((section) => `## ${section.title}\n\n${section.content.join('\n')}\n`).join('\n')
    }

    // Add migration notice
    const migrationNotice = `<!-- Migrated from ${context.source} (${context.relativePath}) -->\n\n`
    return migrationNotice + content.trim()
  }

  // Helper extraction methods
  extractGlobs(context) {
    const content = context.bodyContent || context.content || ''
    const globPatterns = content.match(/\*\*?\/[^\s\n]*/g) || []
    return globPatterns.length > 0 ? globPatterns : ['**/*']
  }

  extractXMLTag(context) {
    const content = context.bodyContent || context.content || ''
    const xmlMatch = content.match(/<([a-zA-Z][a-zA-Z0-9-_]*)[^>]*>/)
    return xmlMatch ? xmlMatch[1] : 'context'
  }

  extractSlashCommand(context) {
    const content = context.bodyContent || context.content || ''
    const slashMatch = content.match(/\/[a-z][a-z0-9:-]*/i)
    return slashMatch ? slashMatch[0] : `/migrate-${context.type.split('-')[0]}`
  }

  extractAllowedTools(context) {
    const content = context.bodyContent || context.content || ''
    const tools = []

    const toolPatterns = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']
    for (const tool of toolPatterns) {
      if (content.includes(tool)) tools.push(tool)
    }

    return tools
  }

  extractMCPServers(context) {
    const content = context.bodyContent || context.content || ''
    const servers = []
    const mcpPattern = /mcp[:\s]+([a-z-]+)/gi
    let match

    while ((match = mcpPattern.exec(content)) !== null) {
      servers.push(match[1])
    }

    return [...new Set(servers)]
  }

  hasArguments(context) {
    const content = context.bodyContent || context.content || ''
    return /\$\{?\w+\}?|\{[\w\s]+\}|\[[\w\s]+\]/.test(content)
  }
}
