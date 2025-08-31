/**
 * UniversalFormatConverter - Rule Format Conversion System
 *
 * Converts various AI assistant rule formats to the universal VDK Blueprint format
 * for community sharing and cross-platform compatibility.
 *
 * Supported Input Formats:
 * - VDK Blueprint (MDC with YAML frontmatter)
 * - Claude Code CLI Memory (Markdown)
 * - Cursor Rules (Text/Markdown)
 * - GitHub Copilot (JSON)
 * - Windsurf Rules (XML/Text)
 * - Generic Markdown/Text
 *
 * Output: Universal VDK Blueprint Schema v2.1.0 format
 */

import path from 'path'
import matter from 'gray-matter'
import { generateBlueprintId } from '../utils/filename-generator.js'
import { validateBlueprint } from '../utils/schema-validator.js'

export class UniversalFormatConverter {
  constructor() {
    // Conversion strategies for different formats
    this.converters = new Map([
      ['vdk-blueprint', this.convertFromVDKBlueprint.bind(this)],
      ['claude-memory', this.convertFromClaudeMemory.bind(this)],
      ['cursor-rules', this.convertFromCursorRules.bind(this)],
      ['copilot-config', this.convertFromCopilotConfig.bind(this)],
      ['windsurf-rules', this.convertFromWindsurfRules.bind(this)],
      ['markdown', this.convertFromMarkdown.bind(this)],
      ['text', this.convertFromText.bind(this)],
    ])
  }

  /**
   * Convert any supported format to universal VDK Blueprint format
   */
  async convertToUniversal({ content, format, projectContext, originalFile }) {
    const converter = this.converters.get(format)

    if (!converter) {
      throw new Error(`Unsupported format: ${format}`)
    }

    // Convert using format-specific converter
    const converted = await converter(content, projectContext, originalFile)

    // Enhance with project context
    const enhanced = this.enhanceWithProjectContext(converted, projectContext)

    // Validate the result
    const validation = await validateBlueprint(enhanced.frontmatter)
    if (!validation.valid) {
      console.warn('Generated blueprint has validation issues:', validation.errors)
      // Continue anyway - we'll fix what we can
    }

    return {
      frontmatter: enhanced.frontmatter,
      content: enhanced.content,
      format: 'vdk-blueprint',
      originalFormat: format,
      validation: validation,
    }
  }

  /**
   * Preview conversion without full processing
   */
  async previewConversion({ content, format, projectContext }) {
    const converter = this.converters.get(format)

    if (!converter) {
      return {
        supported: false,
        error: `Unsupported format: ${format}`,
      }
    }

    try {
      const converted = await converter(content, projectContext, 'preview.mdc')

      return {
        supported: true,
        title: converted.frontmatter.title,
        description: converted.frontmatter.description,
        category: converted.frontmatter.category,
        tags: converted.frontmatter.tags,
        platforms: Object.keys(converted.frontmatter.platforms || {}),
        contentLength: converted.content.length,
      }
    } catch (error) {
      return {
        supported: false,
        error: error.message,
      }
    }
  }

  /**
   * Convert from VDK Blueprint format (already in target format)
   */
  async convertFromVDKBlueprint(content, projectContext, originalFile) {
    try {
      const parsed = matter(content)

      // Already in correct format, just ensure required fields
      const frontmatter = {
        ...parsed.data,
        // Ensure required fields exist
        id: parsed.data.id || this.generateId(parsed.data.title || 'untitled'),
        version: parsed.data.version || '1.0.0',
        created: parsed.data.created || this.getCurrentDate(),
        lastUpdated: this.getCurrentDate(),
      }

      return {
        frontmatter,
        content: parsed.content,
      }
    } catch (error) {
      throw new Error(`Invalid VDK Blueprint format: ${error.message}`)
    }
  }

  /**
   * Convert from Claude memory format
   */
  async convertFromClaudeMemory(content, projectContext, originalFile) {
    const title = this.extractTitleFromContent(content) || `${projectContext.name} Claude Memory`

    const frontmatter = {
      id: this.generateId(title),
      title: title,
      description: `Claude Code CLI memory rules for ${projectContext.name} project`,
      version: '1.0.0',
      category: this.inferCategory(content, projectContext),
      created: this.getCurrentDate(),
      lastUpdated: this.getCurrentDate(),
      author: 'Community Contributor',
      tags: this.extractTags(content, projectContext),
      complexity: this.inferComplexity(content),
      scope: 'project',
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatformConfig('claude-code-cli-optimized'),
      originalFormat: 'claude-memory',
    }

    // Clean and enhance content
    const processedContent = this.processClaudeMemoryContent(content, projectContext)

    return { frontmatter, content: processedContent }
  }

  /**
   * Convert from Cursor rules format
   */
  async convertFromCursorRules(content, projectContext, originalFile) {
    const title = this.extractTitleFromContent(content) || `${projectContext.name} Cursor Rules`

    const frontmatter = {
      id: this.generateId(title),
      title: title,
      description: `Cursor IDE rules for ${projectContext.name} project`,
      version: '1.0.0',
      category: this.inferCategory(content, projectContext),
      created: this.getCurrentDate(),
      lastUpdated: this.getCurrentDate(),
      author: 'Community Contributor',
      tags: this.extractTags(content, projectContext),
      complexity: this.inferComplexity(content),
      scope: 'project',
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatformConfig('cursor-optimized'),
      originalFormat: 'cursor-rules',
    }

    // Process content for universal format
    const processedContent = this.processCursorRulesContent(content, projectContext)

    return { frontmatter, content: processedContent }
  }

  /**
   * Convert from GitHub Copilot configuration
   */
  async convertFromCopilotConfig(content, projectContext, originalFile) {
    let config
    try {
      config = JSON.parse(content)
    } catch (error) {
      throw new Error(`Invalid JSON in Copilot configuration: ${error.message}`)
    }

    const title = config.title || `${projectContext.name} Copilot Guidelines`

    const frontmatter = {
      id: this.generateId(title),
      title: title,
      description: config.description || `GitHub Copilot guidelines for ${projectContext.name} project`,
      version: '1.0.0',
      category: this.inferCategory(JSON.stringify(config), projectContext),
      created: this.getCurrentDate(),
      lastUpdated: this.getCurrentDate(),
      author: 'Community Contributor',
      tags: this.extractTags(JSON.stringify(config), projectContext),
      complexity: this.inferComplexity(content),
      scope: 'project',
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatformConfig('copilot-optimized'),
      originalFormat: 'copilot-config',
    }

    // Convert JSON to markdown content
    const processedContent = this.processCopilotConfigContent(config, projectContext)

    return { frontmatter, content: processedContent }
  }

  /**
   * Convert from Windsurf rules format
   */
  async convertFromWindsurfRules(content, projectContext, originalFile) {
    const title = this.extractTitleFromContent(content) || `${projectContext.name} Windsurf Rules`

    const frontmatter = {
      id: this.generateId(title),
      title: title,
      description: `Windsurf IDE rules for ${projectContext.name} project`,
      version: '1.0.0',
      category: this.inferCategory(content, projectContext),
      created: this.getCurrentDate(),
      lastUpdated: this.getCurrentDate(),
      author: 'Community Contributor',
      tags: this.extractTags(content, projectContext),
      complexity: this.inferComplexity(content),
      scope: 'project',
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatformConfig('windsurf-optimized'),
      originalFormat: 'windsurf-rules',
    }

    // Process XML/text content to markdown
    const processedContent = this.processWindsurfRulesContent(content, projectContext)

    return { frontmatter, content: processedContent }
  }

  /**
   * Convert from generic markdown
   */
  async convertFromMarkdown(content, projectContext, originalFile) {
    const title = this.extractTitleFromContent(content) || `${projectContext.name} AI Rules`

    const frontmatter = {
      id: this.generateId(title),
      title: title,
      description: `AI assistant rules for ${projectContext.name} project`,
      version: '1.0.0',
      category: this.inferCategory(content, projectContext),
      created: this.getCurrentDate(),
      lastUpdated: this.getCurrentDate(),
      author: 'Community Contributor',
      tags: this.extractTags(content, projectContext),
      complexity: this.inferComplexity(content),
      scope: 'project',
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatformConfig('universal'),
      originalFormat: 'markdown',
    }

    // Clean markdown content
    const processedContent = this.processMarkdownContent(content, projectContext)

    return { frontmatter, content: processedContent }
  }

  /**
   * Convert from plain text
   */
  async convertFromText(content, projectContext, originalFile) {
    const title = this.extractTitleFromContent(content) || `${projectContext.name} AI Rules`

    const frontmatter = {
      id: this.generateId(title),
      title: title,
      description: `AI assistant rules for ${projectContext.name} project`,
      version: '1.0.0',
      category: this.inferCategory(content, projectContext),
      created: this.getCurrentDate(),
      lastUpdated: this.getCurrentDate(),
      author: 'Community Contributor',
      tags: this.extractTags(content, projectContext),
      complexity: this.inferComplexity(content),
      scope: 'project',
      audience: 'developer',
      maturity: 'stable',
      platforms: this.generatePlatformConfig('universal'),
      originalFormat: 'text',
    }

    // Convert text to markdown format
    const processedContent = this.processTextContent(content, projectContext)

    return { frontmatter, content: processedContent }
  }

  /**
   * Enhance blueprint with project context
   */
  enhanceWithProjectContext(blueprint, projectContext) {
    const enhanced = { ...blueprint }

    // Add project-specific tags
    const contextTags = [projectContext.framework, projectContext.language, ...projectContext.technologies].filter(
      Boolean
    )

    enhanced.frontmatter.tags = [...new Set([...(enhanced.frontmatter.tags || []), ...contextTags])]

    // Update description with project context
    if (!enhanced.frontmatter.description.includes(projectContext.name)) {
      enhanced.frontmatter.description = `${enhanced.frontmatter.description} - Adapted for ${projectContext.name} (${projectContext.framework})`
    }

    // Add project metadata
    enhanced.frontmatter.projectContext = {
      name: projectContext.name,
      framework: projectContext.framework,
      language: projectContext.language,
      technologies: projectContext.technologies,
    }

    return enhanced
  }

  // Content Processing Methods

  processClaudeMemoryContent(content, projectContext) {
    let processed = content

    // Add project context section if not present
    if (!processed.includes('## Project Context')) {
      const contextSection = `\n## Project Context\n\n- **Project**: ${projectContext.name}\n- **Framework**: ${projectContext.framework}\n- **Language**: ${projectContext.language}\n- **Technologies**: ${projectContext.technologies.join(', ')}\n\n`
      processed = contextSection + processed
    }

    return processed.trim()
  }

  processCursorRulesContent(content, projectContext) {
    let processed = `# ${projectContext.name} Development Rules\n\n`

    // Add project-specific header
    processed += `## Project: ${projectContext.name}\n**Framework**: ${projectContext.framework} | **Language**: ${projectContext.language}\n\n`

    // Process original content
    processed += this.convertToMarkdown(content)

    return processed.trim()
  }

  processCopilotConfigContent(config, projectContext) {
    let processed = `# ${projectContext.name} - GitHub Copilot Guidelines\n\n`

    // Add project context
    processed += `## Project Information\n- **Name**: ${projectContext.name}\n- **Framework**: ${projectContext.framework}\n- **Language**: ${projectContext.language}\n\n`

    // Convert guidelines
    if (config.guidelines && Array.isArray(config.guidelines)) {
      processed += `## Guidelines\n\n`
      config.guidelines.forEach((guideline, index) => {
        processed += `### ${guideline.title || `Guideline ${index + 1}`}\n\n${guideline.content || guideline.description || ''}\n\n`
      })
    }

    // Add preferences if present
    if (config.preferences) {
      processed += `## Preferences\n\n`
      for (const [key, value] of Object.entries(config.preferences)) {
        processed += `- **${key}**: ${value}\n`
      }
      processed += '\n'
    }

    return processed.trim()
  }

  processWindsurfRulesContent(content, projectContext) {
    let processed = `# ${projectContext.name} - Windsurf IDE Rules\n\n`

    // Add project context
    processed += `## Project Information\n- **Name**: ${projectContext.name}\n- **Framework**: ${projectContext.framework}\n- **Language**: ${projectContext.language}\n\n`

    // Clean XML tags and convert to markdown
    let cleaned = content
      .replace(/<windsurf[^>]*>/g, '')
      .replace(/<\/windsurf[^>]*>/g, '')
      .replace(/<([^>]+)>/g, (match, tag) => {
        // Convert simple XML tags to markdown headers
        if (tag.startsWith('/')) return ''
        return `\n### ${tag}\n`
      })

    processed += this.convertToMarkdown(cleaned)

    return processed.trim()
  }

  processMarkdownContent(content, projectContext) {
    let processed = content

    // Add project context header if not present
    if (!processed.includes(projectContext.name)) {
      const header = `# ${projectContext.name} - AI Assistant Rules\n\n**Framework**: ${projectContext.framework} | **Language**: ${projectContext.language}\n\n`
      processed = header + processed
    }

    return processed.trim()
  }

  processTextContent(content, projectContext) {
    // Convert plain text to markdown structure
    let processed = `# ${projectContext.name} - AI Assistant Rules\n\n`
    processed += `**Framework**: ${projectContext.framework} | **Language**: ${projectContext.language}\n\n`

    // Convert text to markdown
    processed += this.convertToMarkdown(content)

    return processed.trim()
  }

  // Utility Methods

  convertToMarkdown(text) {
    let markdown = text

    // Convert simple patterns to markdown
    markdown = markdown
      .replace(/^([A-Z][A-Z\s]+)$/gm, '## $1') // ALL CAPS lines to headers
      .replace(/^(\d+\.\s)/gm, '$1') // Keep numbered lists
      .replace(/^([-*]\s)/gm, '$1') // Keep bullet lists
      .replace(/^([A-Za-z][^:\n]*):(?!\w)/gm, '### $1') // "Title:" to headers

    return markdown
  }

  extractTitleFromContent(content) {
    // Try to extract title from various formats
    const patterns = [
      /^#\s+(.+)$/m, // Markdown H1
      /^([A-Z][A-Za-z\s]+)\s*$/m, // First capitalized line
      /title:\s*(.+)$/im, // YAML title
      /"title"\s*:\s*"([^"]+)"/i, // JSON title
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    return null
  }

  extractTags(content, projectContext) {
    const tags = new Set()

    // Add project context tags
    if (projectContext.framework) tags.add(projectContext.framework.toLowerCase())
    if (projectContext.language) tags.add(projectContext.language.toLowerCase())
    projectContext.technologies.forEach((tech) => tags.add(tech.toLowerCase()))

    // Extract tags from content
    const lowerContent = content.toLowerCase()
    const techKeywords = [
      'react',
      'vue',
      'angular',
      'nodejs',
      'python',
      'typescript',
      'javascript',
      'docker',
      'kubernetes',
      'aws',
      'testing',
      'api',
      'database',
      'frontend',
      'backend',
      'fullstack',
      'mobile',
      'web',
      'cli',
      'framework',
    ]

    techKeywords.forEach((keyword) => {
      if (lowerContent.includes(keyword)) {
        tags.add(keyword)
      }
    })

    return Array.from(tags).slice(0, 10) // Limit to 10 tags
  }

  inferCategory(content, projectContext) {
    const lowerContent = content.toLowerCase()

    // Category inference based on content and context
    if (projectContext.framework && projectContext.framework !== 'generic') {
      return 'technology'
    }

    if (lowerContent.includes('test') || lowerContent.includes('spec')) {
      return 'task'
    }

    if (lowerContent.includes('react') || lowerContent.includes('vue') || lowerContent.includes('angular')) {
      return 'technology'
    }

    if (lowerContent.includes('full stack') || lowerContent.includes('fullstack')) {
      return 'stack'
    }

    return 'core'
  }

  inferComplexity(content) {
    const length = content.length
    const codeBlocks = (content.match(/```/g) || []).length / 2
    const headings = (content.match(/^#+\s/gm) || []).length

    let score = 0
    if (length > 1000) score += 1
    if (length > 3000) score += 1
    if (codeBlocks > 3) score += 1
    if (headings > 5) score += 1

    if (score >= 3) return 'complex'
    if (score >= 1) return 'medium'
    return 'simple'
  }

  generatePlatformConfig(optimization = 'universal') {
    const baseConfig = {
      'claude-code-cli': { compatible: true, memory: true, priority: 5 },
      cursor: { compatible: true, activation: 'auto-attached', priority: 'medium' },
      windsurf: { compatible: true, mode: 'workspace', priority: 7 },
      'github-copilot': { compatible: true, priority: 8 },
    }

    // Optimize for specific platforms
    switch (optimization) {
      case 'claude-code-cli-optimized':
        baseConfig['claude-code-cli'].priority = 9
        baseConfig['claude-code-cli'].command = true
        break
      case 'cursor-optimized':
        baseConfig['cursor'].priority = 'high'
        baseConfig['cursor'].globs = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']
        break
      case 'windsurf-optimized':
        baseConfig['windsurf'].priority = 9
        baseConfig['windsurf'].characterLimit = 6000
        break
      case 'copilot-optimized':
        baseConfig['github-copilot'].priority = 9
        baseConfig['github-copilot'].maxGuidelines = 10
        break
    }

    return baseConfig
  }

  generateId(title) {
    const baseId = generateBlueprintId(title)
    return `${baseId}-${Date.now().toString(36)}`
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0]
  }
}
