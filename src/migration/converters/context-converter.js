/**
 * Context Converter
 * ----------------
 * Converts existing AI contexts from various formats to VDK schema format.
 * Supports conversion from Claude Code CLI, Cursor, GitHub Copilot, Windsurf, and generic formats.
 */

import path from 'node:path'
import matter from 'gray-matter'
import { v4 as uuidv4 } from 'uuid'
import { generateBlueprintId } from '../../utils/filename-generator.js'

export class ContextConverter {
  constructor() {
    // Conversion strategy mapping
    this.conversionStrategies = {
      'claude-code': this.convertClaudeCode.bind(this),
      cursor: this.convertCursor.bind(this),
      'github-copilot': this.convertGitHubCopilot.bind(this),
      windsurf: this.convertWindsurf.bind(this),
      'generic-ai': this.convertGenericAI.bind(this),
    }
  }

  /**
   * Convert a detected context to VDK format
   * @param {Object} context Detected context object
   * @returns {Object|null} Converted VDK context
   */
  async convert(context) {
    const strategy = this.conversionStrategies[context.type]
    if (!strategy) {
      throw new Error(`No conversion strategy for context type: ${context.type}`)
    }

    try {
      const converted = await strategy(context)
      if (!converted) {
        return null
      }

      // Add common metadata
      return {
        ...converted,
        id: converted.id || this.generateId(context),
        originalSource: context.source,
        originalPath: context.relativePath,
        migrationDate: new Date().toISOString(),
        vdkVersion: '2.5.0',
      }
    } catch (error) {
      throw new Error(`Failed to convert ${context.filePath}: ${error.message}`)
    }
  }

  /**
   * Convert Claude Code CLI contexts
   * @param {Object} context Claude Code CLI context
   * @returns {Object} VDK blueprint or command
   */
  async convertClaudeCode(context) {
    const { fileName, bodyContent, metadata, claudeSpecific } = context

    // Determine if it's a command or blueprint
    const isCommand = claudeSpecific?.hasSlashCommands || fileName.includes('command')
    const isMemory = fileName === 'CLAUDE.md' || context.relativePath.includes('memory')

    if (isCommand) {
      return this.convertToCommand(context, {
        target: 'claude-code',
        commandType: claudeSpecific?.hasSlashCommands ? 'slash' : 'custom-slash',
      })
    }

    if (isMemory) {
      return this.convertToMemoryBlueprint(context)
    }

    return this.convertToBlueprint(context, {
      category: this.inferCategory(bodyContent),
      platforms: {
        'claude-code': {
          compatible: true,
          memory: true,
          mcpIntegration: claudeSpecific?.hasMCPReferences,
        },
      },
    })
  }

  /**
   * Convert Cursor contexts
   * @param {Object} context Cursor context
   * @returns {Object} VDK blueprint
   */
  async convertCursor(context) {
    const { fileName, bodyContent, cursorSpecific } = context

    // .cursorrules files are typically project-wide rules
    if (fileName === '.cursorrules' || fileName === 'cursorrules') {
      return this.convertToBlueprint(context, {
        category: 'core',
        scope: 'project',
        platforms: {
          cursor: {
            compatible: true,
            activation: 'always',
            globs: cursorSpecific?.hasFileGlobs ? this.extractGlobs(bodyContent) : ['**/*'],
            priority: 'high',
          },
          'claude-code': {
            compatible: true,
            memory: true,
          },
        },
      })
    }

    return this.convertToBlueprint(context, {
      category: this.inferCategory(bodyContent),
      platforms: {
        cursor: {
          compatible: true,
          activation: 'auto-attached',
        },
        'claude-code': {
          compatible: true,
          memory: true,
        },
      },
    })
  }

  /**
   * Convert GitHub Copilot contexts
   * @param {Object} context GitHub Copilot context
   * @returns {Object} VDK blueprint
   */
  async convertGitHubCopilot(context) {
    const { bodyContent, copilotSpecific } = context

    const reviewType = copilotSpecific?.hasSecurityRules
      ? 'security'
      : copilotSpecific?.hasReviewRules
        ? 'code-quality'
        : 'style'

    return this.convertToBlueprint(context, {
      category: copilotSpecific?.hasSecurityRules ? 'security' : 'task',
      platforms: {
        'github-copilot': {
          compatible: true,
          priority: copilotSpecific?.hasSecurityRules ? 9 : 7,
          reviewType,
        },
        'claude-code': {
          compatible: true,
          memory: true,
        },
      },
    })
  }

  /**
   * Convert Windsurf contexts
   * @param {Object} context Windsurf context
   * @returns {Object} VDK blueprint
   */
  async convertWindsurf(context) {
    const { bodyContent, windsurfSpecific } = context

    return this.convertToBlueprint(context, {
      category: windsurfSpecific?.hasAgentRules ? 'assistant' : this.inferCategory(bodyContent),
      platforms: {
        windsurf: {
          compatible: true,
          mode: 'workspace',
          xmlTag: this.extractXMLTag(bodyContent),
          characterLimit: Math.max(bodyContent.length * 1.2, 1000),
        },
        'claude-code': {
          compatible: true,
          memory: true,
        },
      },
    })
  }

  /**
   * Convert generic AI contexts
   * @param {Object} context Generic AI context
   * @returns {Object} VDK blueprint
   */
  async convertGenericAI(context) {
    const { bodyContent } = context

    return this.convertToBlueprint(context, {
      category: this.inferCategory(bodyContent),
      platforms: {
        'claude-code': {
          compatible: true,
          memory: true,
        },
        cursor: {
          compatible: true,
          activation: 'manual',
        },
      },
    })
  }

  /**
   * Convert context to VDK blueprint format
   * @param {Object} context Original context
   * @param {Object} options Conversion options
   * @returns {Object} VDK blueprint
   */
  convertToBlueprint(context, options = {}) {
    const { fileName, bodyContent, metadata, sections } = context
    const id = this.generateId(context)

    // Extract or generate blueprint metadata
    const title = metadata.title || this.extractTitle(bodyContent, fileName)
    const description = metadata.description || this.extractDescription(bodyContent)

    const blueprint = {
      type: 'blueprint',
      id,
      title,
      description,
      version: metadata.version || '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      category: options.category || 'core',
      subcategory: metadata.subcategory || options.subcategory,
      complexity: this.inferComplexity(bodyContent),
      scope: options.scope || this.inferScope(bodyContent),
      audience: metadata.audience || 'developer',
      maturity: 'stable',
      platforms: options.platforms || this.getDefaultPlatforms(),
      tags: this.extractTags(bodyContent, metadata.tags),
      author: metadata.author || 'Migrated from ' + context.source,

      // Content organization
      content: this.organizeContent(bodyContent, sections),
      contentSections: sections.map((s) => s.title),

      // Output file information
      outputFile: this.generateOutputFileName(id, 'blueprint'),
    }

    // Add optional fields if present
    if (metadata.requires) blueprint.requires = metadata.requires
    if (metadata.suggests) blueprint.suggests = metadata.suggests
    if (metadata.conflicts) blueprint.conflicts = metadata.conflicts

    return blueprint
  }

  /**
   * Convert context to VDK command format
   * @param {Object} context Original context
   * @param {Object} options Conversion options
   * @returns {Object} VDK command
   */
  convertToCommand(context, options = {}) {
    const { fileName, bodyContent, metadata, claudeSpecific } = context
    const id = this.generateId(context)

    const name = metadata.name || this.extractCommandName(bodyContent, fileName)
    const description = metadata.description || this.extractDescription(bodyContent)

    const command = {
      type: 'command',
      id,
      name,
      description,
      target: options.target || 'claude-code',
      commandType: options.commandType || 'slash',
      version: metadata.version || '1.0.0',
      scope: options.scope || 'project',
      category: this.inferCommandCategory(bodyContent),

      claudeCode: {
        slashCommand: this.extractSlashCommand(bodyContent),
        arguments: {
          supports: this.hasArguments(bodyContent),
          placeholder: '$ARGUMENTS',
          examples: this.extractArgumentExamples(bodyContent),
        },
        fileReferences: {
          supports: claudeSpecific?.hasFileReferences || bodyContent.includes('@'),
          autoInclude: this.extractAutoIncludeFiles(bodyContent),
        },
        bashCommands: {
          supports: this.hasBashCommands(bodyContent),
          commands: this.extractBashCommands(bodyContent),
        },
        mcpIntegration: claudeSpecific?.hasMCPReferences
          ? {
              requiredServers: this.extractMCPServers(bodyContent),
            }
          : undefined,
        memoryFiles: claudeSpecific?.hasMemoryFiles ? ['CLAUDE.md'] : [],
      },

      examples: this.extractCommandExamples(bodyContent),
      tags: this.extractTags(bodyContent, metadata.tags),
      author: metadata.author || 'Migrated from ' + context.source,
      lastUpdated: new Date().toISOString().split('T')[0],

      // Content
      content: bodyContent,
      outputFile: this.generateOutputFileName(id, 'command'),
    }

    return command
  }

  /**
   * Convert context to memory blueprint
   * @param {Object} context Original context
   * @returns {Object} Memory blueprint
   */
  convertToMemoryBlueprint(context) {
    const { bodyContent, sections } = context

    return this.convertToBlueprint(context, {
      category: 'core',
      scope: 'project',
      title: 'Project Memory',
      description: 'Project-specific context and memory extracted from CLAUDE.md',
      platforms: {
        'claude-code': {
          compatible: true,
          memory: true,
          namespace: 'project',
        },
      },
    })
  }

  /**
   * Generate unique ID for converted context
   * @param {Object} context Original context
   * @returns {string} Generated ID
   */
  generateId(context) {
    const baseName = path.basename(context.fileName, path.extname(context.fileName))
    return generateBlueprintId(baseName) || `migrated-${Date.now()}`
  }

  /**
   * Extract title from content or filename
   * @param {string} content File content
   * @param {string} fileName File name
   * @returns {string} Extracted title
   */
  extractTitle(content, fileName) {
    // Look for markdown H1
    const h1Match = content.match(/^#\s+(.+)/m)
    if (h1Match) {
      return h1Match[1].trim()
    }

    // Look for title-like patterns
    const titleMatch = content.match(/(?:title|name):\s*(.+)/i)
    if (titleMatch) {
      return titleMatch[1].trim()
    }

    // Use filename as fallback
    const baseName = path.basename(fileName, path.extname(fileName))
    return baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  /**
   * Extract description from content
   * @param {string} content File content
   * @returns {string} Extracted description
   */
  extractDescription(content) {
    // Look for description field
    const descMatch = content.match(/(?:description|desc):\s*(.+)/i)
    if (descMatch) {
      return descMatch[1].trim()
    }

    // Use first paragraph after title
    const lines = content.split('\n').filter((line) => line.trim())
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('#') && !line.includes(':') && line.length > 20) {
        return line.length > 200 ? line.substring(0, 197) + '...' : line
      }
    }

    return 'Migrated AI context rule or configuration'
  }

  /**
   * Infer category from content
   * @param {string} content File content
   * @returns {string} Inferred category
   */
  inferCategory(content) {
    const lowerContent = content.toLowerCase()

    if (lowerContent.includes('test') || lowerContent.includes('spec')) return 'testing'
    if (lowerContent.includes('security') || lowerContent.includes('auth')) return 'security'
    if (lowerContent.includes('performance') || lowerContent.includes('optimize')) return 'performance'
    if (lowerContent.includes('git') || lowerContent.includes('commit')) return 'git'
    if (lowerContent.includes('debug') || lowerContent.includes('log')) return 'debugging'
    if (lowerContent.includes('doc') || lowerContent.includes('readme')) return 'documentation'
    if (lowerContent.includes('refactor') || lowerContent.includes('clean')) return 'refactoring'
    if (lowerContent.includes('api') || lowerContent.includes('endpoint')) return 'development'
    if (lowerContent.includes('ui') || lowerContent.includes('component')) return 'development'

    return 'core'
  }

  /**
   * Infer command category from content
   * @param {string} content File content
   * @returns {string} Command category
   */
  inferCommandCategory(content) {
    const category = this.inferCategory(content)

    // Map blueprint categories to command categories
    const categoryMap = {
      core: 'development',
      testing: 'testing',
      security: 'security',
      performance: 'performance',
      git: 'git',
      debugging: 'debugging',
      documentation: 'documentation',
      refactoring: 'refactoring',
      development: 'development',
    }

    return categoryMap[category] || 'development'
  }

  /**
   * Infer complexity from content
   * @param {string} content File content
   * @returns {string} Complexity level
   */
  inferComplexity(content) {
    const wordCount = content.split(/\s+/).length
    const lineCount = content.split('\n').length
    const hasAdvancedPatterns = /\{\{|\$\{|<%|{{/.test(content)

    if (wordCount > 1000 || lineCount > 50 || hasAdvancedPatterns) return 'complex'
    if (wordCount > 300 || lineCount > 20) return 'medium'
    return 'simple'
  }

  /**
   * Infer scope from content
   * @param {string} content File content
   * @returns {string} Scope level
   */
  inferScope(content) {
    const lowerContent = content.toLowerCase()

    if (lowerContent.includes('project') || lowerContent.includes('global')) return 'project'
    if (lowerContent.includes('system') || lowerContent.includes('architecture')) return 'system'
    if (lowerContent.includes('feature') || lowerContent.includes('module')) return 'feature'
    if (lowerContent.includes('component') || lowerContent.includes('class')) return 'component'

    return 'file'
  }

  /**
   * Extract tags from content and metadata
   * @param {string} content File content
   * @param {Array} existingTags Existing tags from metadata
   * @returns {Array} Extracted tags
   */
  extractTags(content, existingTags = []) {
    const tags = [...(existingTags || [])]
    const lowerContent = content.toLowerCase()

    // Common technology tags
    const techTags = [
      'react',
      'vue',
      'angular',
      'node',
      'typescript',
      'javascript',
      'python',
      'java',
      'go',
      'rust',
      'php',
      'ruby',
      'swift',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
      'database',
    ]

    for (const tech of techTags) {
      if (lowerContent.includes(tech) && !tags.includes(tech)) {
        tags.push(tech)
      }
    }

    // Pattern-based tags
    if (lowerContent.includes('api')) tags.push('api')
    if (lowerContent.includes('frontend')) tags.push('frontend')
    if (lowerContent.includes('backend')) tags.push('backend')
    if (lowerContent.includes('mobile')) tags.push('mobile')
    if (lowerContent.includes('web')) tags.push('web')

    return [...new Set(tags)].slice(0, 10) // Limit to 10 unique tags
  }

  /**
   * Organize content into structured sections
   * @param {string} content Original content
   * @param {Array} sections Detected sections
   * @returns {string} Organized content
   */
  organizeContent(content, sections) {
    if (!sections || sections.length === 0) {
      return content
    }

    // Reconstruct content with clear section headers
    let organized = ''
    for (const section of sections) {
      organized += `\n## ${section.title}\n\n`
      organized += section.content.join('\n')
      organized += '\n'
    }

    return organized.trim() || content
  }

  /**
   * Get default platforms configuration
   * @returns {Object} Default platforms
   */
  getDefaultPlatforms() {
    return {
      'claude-code': {
        compatible: true,
        memory: true,
      },
    }
  }

  /**
   * Generate output filename
   * @param {string} id Context ID
   * @param {string} type Context type
   * @returns {string} Output filename
   */
  generateOutputFileName(id, type) {
    return `${id}.${type}.md`
  }

  // Helper methods for specific extractions...

  extractGlobs(content) {
    const globPatterns = content.match(/\*\*?\/[^\s\n]*/g) || []
    return globPatterns.length > 0 ? globPatterns : ['**/*']
  }

  extractXMLTag(content) {
    const xmlMatch = content.match(/<([a-zA-Z][a-zA-Z0-9-_]*)[^>]*>/)
    return xmlMatch ? xmlMatch[1] : 'context'
  }

  extractSlashCommand(content) {
    const slashMatch = content.match(/\/[a-z][a-z0-9:-]*/i)
    return slashMatch ? slashMatch[0] : '/migrate'
  }

  extractCommandName(content, fileName) {
    const nameMatch = content.match(/(?:name|command):\s*(.+)/i)
    if (nameMatch) return nameMatch[1].trim()

    return path
      .basename(fileName, path.extname(fileName))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  hasArguments(content) {
    return /\$\{?\w+\}?|\{[\w\s]+\}|\[[\w\s]+\]/.test(content)
  }

  extractArgumentExamples(content) {
    // Extract example arguments from content
    const examples = []
    const examplePatterns = [/example[s]?:\s*(.+)/gi, /e\.g\.?\s+(.+)/gi, /usage:\s*(.+)/gi]

    for (const pattern of examplePatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        examples.push(match[1].trim())
      }
    }

    return examples.slice(0, 3) // Limit to 3 examples
  }

  extractAutoIncludeFiles(content) {
    const fileMatches = content.match(/@[\w/.,-]+/g) || []
    return fileMatches.map((match) => match.substring(1))
  }

  hasBashCommands(content) {
    return /!\s*[a-z]/i.test(content) || content.includes('bash') || content.includes('shell')
  }

  extractBashCommands(content) {
    const commands = []
    const bashPattern = /!\s*([^\n]+)/g
    let match

    while ((match = bashPattern.exec(content)) !== null) {
      commands.push(match[1].trim())
    }

    return commands
  }

  extractMCPServers(content) {
    const servers = []
    const mcpPattern = /mcp[:\s]+([a-z-]+)/gi
    let match

    while ((match = mcpPattern.exec(content)) !== null) {
      servers.push(match[1])
    }

    return [...new Set(servers)]
  }

  extractCommandExamples(content) {
    const examples = []

    // Look for usage examples
    const usagePattern = /usage:\s*(.+?)(?:\n\n|\n[A-Z]|$)/gi
    let match

    while ((match = usagePattern.exec(content)) !== null) {
      examples.push({
        usage: match[1].trim(),
        description: 'Basic usage example',
        context: 'General usage',
      })
    }

    return examples.slice(0, 3)
  }
}
