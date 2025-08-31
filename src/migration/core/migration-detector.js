/**
 * Migration Detector
 * ------------------
 * Detects existing AI contexts in project using VDK's ProjectScanner results.
 * Leverages the existing file discovery and pattern matching infrastructure.
 */

import path from 'node:path'
import fs from 'node:fs'
import matter from 'gray-matter'

export class MigrationDetector {
  constructor(projectPath) {
    this.projectPath = projectPath

    // AI context patterns to look for
    this.aiContextPatterns = {
      'claude-code-cli': {
        filePatterns: ['CLAUDE.md', '.claude/**/*.md', '.claude/commands/**/*'],
        directoryPatterns: ['.claude'],
        indicators: ['claude-code-cli', 'mcp:', 'slash command', 'claude.md'],
        priority: 'high',
      },
      cursor: {
        filePatterns: ['.cursorrules', 'cursorrules', '.cursor-rules', '.cursor/**/*'],
        directoryPatterns: ['.cursor'],
        indicators: ['cursor', '@', 'tab trigger'],
        priority: 'high',
      },
      'github-copilot': {
        filePatterns: ['.copilotrc*', '.github/copilot/**/*', '.github/copilot.y*ml'],
        directoryPatterns: ['.github/copilot'],
        indicators: ['copilot', 'github', 'review', 'pull_request'],
        priority: 'medium',
      },
      windsurf: {
        filePatterns: ['.windsurfrc', 'windsurf.config.*', '.windsurf/**/*'],
        directoryPatterns: ['.windsurf'],
        indicators: ['windsurf', 'cascade', 'codeium'],
        priority: 'high',
      },
      'generic-ai': {
        filePatterns: ['.vdk/**/*', 'ai-rules/**/*', 'prompts/**/*', '.prompts/**/*'],
        directoryPatterns: ['.vdk', 'ai-rules', 'prompts', '.prompts'],
        indicators: ['ai', 'prompt', 'assistant', 'context', 'memory'],
        priority: 'low',
      },
    }
  }

  /**
   * Detect AI contexts from project data (leveraging existing ProjectScanner)
   * @param {Object} projectData Project data from ProjectScanner
   * @returns {Array} Detected AI contexts
   */
  async detectAIContexts(projectData) {
    const contexts = []

    // Use existing file discovery from ProjectScanner
    const allFiles = projectData.files || []

    for (const file of allFiles) {
      const context = await this.analyzeFileForAIContext(file)
      if (context) {
        contexts.push(context)
      }
    }

    // Also check directories for AI context patterns
    const directories = projectData.directories || []
    for (const dir of directories) {
      const dirContext = this.analyzeDirForAIContext(dir, allFiles)
      if (dirContext) {
        contexts.push(dirContext)
      }
    }

    // Deduplicate and prioritize contexts
    return this.dedupAndPrioritizeContexts(contexts)
  }

  /**
   * Analyze individual file for AI context indicators
   * @param {Object} file File object from ProjectScanner
   * @returns {Object|null} AI context or null
   */
  async analyzeFileForAIContext(file) {
    const fileName = file.name
    const relativePath = file.relativePath
    const fullPath = file.path

    // Check if file matches known AI context patterns
    const contextType = this.identifyContextType(fileName, relativePath)
    if (!contextType) {
      return null
    }

    // Read and analyze file content if it's a text file
    let content = ''
    let hasContent = false

    try {
      // Only read text-based files
      if (this.isTextFile(fileName)) {
        content = await fs.promises.readFile(fullPath, 'utf-8')
        hasContent = content.trim().length > 0
      }
    } catch (error) {
      // File might not be readable, skip content analysis
      hasContent = false
    }

    if (!hasContent && contextType === 'generic-ai') {
      // Skip empty generic AI files
      return null
    }

    const analysis = this.analyzeContent(content, contextType)

    return {
      type: contextType,
      source: this.getSourceName(contextType),
      filePath: fullPath,
      relativePath,
      fileName,
      fileSize: file.size || 0,
      lastModified: file.modifiedTime || new Date().toISOString(),
      confidence: this.calculateConfidence(contextType, fileName, content, relativePath),
      hasContent,
      wordCount: content.split(/\s+/).length,
      lineCount: content.split('\n').length,
      ...analysis,
    }
  }

  /**
   * Analyze directory for AI context patterns
   * @param {Object} dir Directory object from ProjectScanner
   * @param {Array} allFiles All files in project
   * @returns {Object|null} AI context or null
   */
  analyzeDirForAIContext(dir, allFiles) {
    const dirName = dir.name
    const relativePath = dir.relativePath

    // Check if directory matches AI context patterns
    const contextType = this.identifyContextTypeFromPath(relativePath, dirName)
    if (!contextType) {
      return null
    }

    // Get files within this directory
    const dirFiles = allFiles.filter((file) => file.relativePath.startsWith(relativePath + '/'))

    if (dirFiles.length === 0) {
      return null
    }

    return {
      type: contextType,
      source: this.getSourceName(contextType),
      isDirectory: true,
      directoryPath: dir.path,
      relativePath,
      directoryName: dirName,
      fileCount: dirFiles.length,
      files: dirFiles.map((f) => ({
        name: f.name,
        relativePath: f.relativePath,
        type: f.type,
      })),
      confidence: this.calculateDirectoryConfidence(contextType, dirName, dirFiles),
      lastModified: Math.max(...dirFiles.map((f) => new Date(f.modifiedTime || 0).getTime())),
    }
  }

  /**
   * Identify context type from file name and path
   * @param {string} fileName File name
   * @param {string} relativePath Relative file path
   * @returns {string|null} Context type or null
   */
  identifyContextType(fileName, relativePath) {
    const lowerFileName = fileName.toLowerCase()
    const lowerPath = relativePath.toLowerCase()

    // Check specific file names first (highest priority)
    if (fileName === 'CLAUDE.md') return 'claude-code-cli'
    if (['.cursorrules', 'cursorrules', '.cursor-rules'].includes(fileName)) return 'cursor'
    if (fileName.startsWith('.copilotrc')) return 'github-copilot'
    if (fileName.startsWith('.windsurfrc') || fileName.startsWith('windsurf.config')) return 'windsurf'

    // Check path-based patterns
    for (const [type, config] of Object.entries(this.aiContextPatterns)) {
      for (const pattern of config.filePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return type
        }
      }
    }

    // Check directory-based patterns
    if (lowerPath.includes('.claude/')) return 'claude-code-cli'
    if (lowerPath.includes('.cursor/')) return 'cursor'
    if (lowerPath.includes('copilot/') || lowerPath.includes('.github/copilot')) return 'github-copilot'
    if (lowerPath.includes('.windsurf/')) return 'windsurf'
    if (lowerPath.includes('.vdk/') || lowerPath.includes('prompts/')) return 'generic-ai'

    return null
  }

  /**
   * Identify context type from directory path
   * @param {string} relativePath Relative directory path
   * @param {string} dirName Directory name
   * @returns {string|null} Context type or null
   */
  identifyContextTypeFromPath(relativePath, dirName) {
    const lowerPath = relativePath.toLowerCase()
    const lowerDirName = dirName.toLowerCase()

    if (lowerDirName === '.claude' || lowerPath.includes('.claude')) return 'claude-code-cli'
    if (lowerDirName === '.cursor' || lowerPath.includes('.cursor')) return 'cursor'
    if (lowerDirName === 'copilot' && lowerPath.includes('.github')) return 'github-copilot'
    if (lowerDirName === '.windsurf' || lowerPath.includes('.windsurf')) return 'windsurf'
    if (['.ai', 'ai-rules', 'prompts', '.prompts'].includes(lowerDirName)) return 'generic-ai'

    return null
  }

  /**
   * Simple pattern matching for file paths
   * @param {string} path File path to test
   * @param {string} pattern Glob-like pattern
   * @returns {boolean} True if path matches pattern
   */
  matchesPattern(path, pattern) {
    // Convert simple glob patterns to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any path segment
      .replace(/\*/g, '[^/]*') // * matches any filename characters
      .replace(/\./g, '\\.') // Escape dots

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(path)
  }

  /**
   * Check if file is a text file we can analyze
   * @param {string} fileName File name
   * @returns {boolean} True if text file
   */
  isTextFile(fileName) {
    const textExtensions = ['.md', '.txt', '.js', '.ts', '.json', '.yaml', '.yml', '.toml', '.ini', '.rc']
    const extension = path.extname(fileName).toLowerCase()

    // Files without extension that are typically text
    const textFiles = ['.cursorrules', 'cursorrules', '.gitignore', '.copilotrc', '.windsurfrc']

    return textExtensions.includes(extension) || textFiles.includes(fileName)
  }

  /**
   * Analyze file content for AI context characteristics
   * @param {string} content File content
   * @param {string} contextType Context type
   * @returns {Object} Content analysis
   */
  analyzeContent(content, contextType) {
    if (!content) {
      return { hasValidContent: false }
    }

    const analysis = {
      hasValidContent: true,
      hasFrontmatter: content.startsWith('---'),
      hasMarkdown: /#{1,6}\s/.test(content) || /\*\*.*\*\*/.test(content),
      hasCommands: this.detectCommands(content, contextType),
      hasRules: this.detectRules(content),
      hasMemory: this.detectMemory(content),
      hasTemplating: this.detectTemplating(content),
      sections: this.extractSections(content),
    }

    // Parse frontmatter if present
    if (analysis.hasFrontmatter) {
      try {
        const parsed = matter(content)
        analysis.frontmatter = parsed.data
        analysis.bodyContent = parsed.content
      } catch (error) {
        analysis.bodyContent = content
      }
    } else {
      analysis.bodyContent = content
    }

    // Context-specific analysis
    switch (contextType) {
      case 'claude-code-cli':
        analysis.claudeSpecific = this.analyzeClaudeContent(content)
        break
      case 'cursor':
        analysis.cursorSpecific = this.analyzeCursorContent(content)
        break
      case 'github-copilot':
        analysis.copilotSpecific = this.analyzeCopilotContent(content)
        break
      case 'windsurf':
        analysis.windsurfSpecific = this.analyzeWindsurfContent(content)
        break
    }

    return analysis
  }

  /**
   * Detect command-like patterns in content
   * @param {string} content File content
   * @param {string} contextType Context type
   * @returns {boolean} Has commands
   */
  detectCommands(content, contextType) {
    const commandPatterns = {
      'claude-code-cli': ['/[a-z]', 'mcp:', 'tool:', 'slash command'],
      cursor: ['@', 'ctrl+', 'cmd+', 'tab trigger'],
      'github-copilot': ['copilot:', 'gh ', 'github.com'],
      windsurf: ['cascade:', 'windsurf:', 'agent:'],
      'generic-ai': ['/command', '!', 'run:', 'execute:'],
    }

    const patterns = commandPatterns[contextType] || commandPatterns['generic-ai']
    const lowerContent = content.toLowerCase()

    return patterns.some((pattern) => lowerContent.includes(pattern.toLowerCase()))
  }

  /**
   * Detect rule-like patterns
   * @param {string} content File content
   * @returns {boolean} Has rules
   */
  detectRules(content) {
    const ruleKeywords = [
      'rule:',
      'rules:',
      'guideline',
      'principle',
      'convention',
      'standard',
      'pattern',
      'practice',
      'requirement',
      'constraint',
      'always',
      'never',
      'should',
      'must',
      'avoid',
      'prefer',
    ]

    const lowerContent = content.toLowerCase()
    return ruleKeywords.some((keyword) => lowerContent.includes(keyword))
  }

  /**
   * Detect memory/context patterns
   * @param {string} content File content
   * @returns {boolean} Has memory
   */
  detectMemory(content) {
    const memoryKeywords = [
      'memory:',
      'remember:',
      'context:',
      'background:',
      'history:',
      'preferences:',
      'settings:',
      'configuration:',
      'project:',
      'codebase:',
      'architecture:',
      'stack:',
    ]

    const lowerContent = content.toLowerCase()
    return memoryKeywords.some((keyword) => lowerContent.includes(keyword))
  }

  /**
   * Detect templating syntax
   * @param {string} content File content
   * @returns {boolean} Has templating
   */
  detectTemplating(content) {
    const templatePatterns = [
      /\{\{[\s\S]*?\}\}/, // Handlebars
      /\$\{[\s\S]*?\}/, // Template literals
      /<[\w-]+>/, // XML-like tags
      /\[\[[\s\S]*?\]\]/, // Double brackets
      /%[\w-]+%/, // Percent variables
    ]

    return templatePatterns.some((pattern) => pattern.test(content))
  }

  /**
   * Extract content sections
   * @param {string} content File content
   * @returns {Array} Content sections
   */
  extractSections(content) {
    const sections = []
    const lines = content.split('\n')
    let currentSection = null

    for (const line of lines) {
      const trimmed = line.trim()

      // Markdown headers
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection)
        }
        currentSection = {
          level: headerMatch[1].length,
          title: headerMatch[2],
          content: [],
        }
        continue
      }

      if (currentSection && trimmed) {
        currentSection.content.push(line)
      }
    }

    if (currentSection) {
      sections.push(currentSection)
    }

    return sections
  }

  // Context-specific analyzers
  analyzeClaudeContent(content) {
    return {
      hasSlashCommands: content.includes('/'),
      hasMCPReferences: content.toLowerCase().includes('mcp'),
      hasToolReferences: content.toLowerCase().includes('tool'),
      hasFileReferences: content.includes('@'),
      hasHooks: content.toLowerCase().includes('hook'),
      hasMemoryFiles: content.toLowerCase().includes('claude.md'),
    }
  }

  analyzeCursorContent(content) {
    return {
      hasFileGlobs: /\*\*?\//.test(content),
      hasInstructions: content.toLowerCase().includes('instruction'),
      hasTabTriggers: content.includes('@'),
      hasIgnorePatterns: content.toLowerCase().includes('ignore'),
    }
  }

  analyzeCopilotContent(content) {
    return {
      hasReviewRules: content.toLowerCase().includes('review'),
      hasSecurityRules: content.toLowerCase().includes('security'),
      hasWorkflowRules: content.toLowerCase().includes('workflow'),
      hasGitHubReferences: content.toLowerCase().includes('github'),
    }
  }

  analyzeWindsurfContent(content) {
    return {
      hasCascadeRules: content.toLowerCase().includes('cascade'),
      hasAgentRules: content.toLowerCase().includes('agent'),
      hasFlowRules: content.toLowerCase().includes('flow'),
      hasContextRules: content.toLowerCase().includes('context'),
    }
  }

  /**
   * Calculate confidence for file-based detection
   * @param {string} contextType Context type
   * @param {string} fileName File name
   * @param {string} content File content
   * @param {string} relativePath Relative path
   * @returns {string} Confidence level
   */
  calculateConfidence(contextType, fileName, content, relativePath) {
    let score = 0
    const config = this.aiContextPatterns[contextType]

    // Base score from pattern priority
    const baseScore = { high: 60, medium: 40, low: 20 }[config.priority] || 20
    score += baseScore

    // Boost for exact matches
    if (fileName === 'CLAUDE.md' && contextType === 'claude-code-cli') score += 30
    if (['.cursorrules', 'cursorrules'].includes(fileName) && contextType === 'cursor') score += 30
    if (fileName.startsWith('.copilotrc') && contextType === 'github-copilot') score += 25
    if (fileName.startsWith('.windsurfrc') && contextType === 'windsurf') score += 25

    // Boost for content indicators
    const indicators = config.indicators || []
    for (const indicator of indicators) {
      if (content.toLowerCase().includes(indicator.toLowerCase())) {
        score += 5
      }
    }

    // Boost for proper directory structure
    if (relativePath.includes('.vdk/') && contextType === 'generic-ai') score += 10
    if (relativePath.includes('.claude/') && contextType === 'claude-code-cli') score += 10
    if (relativePath.includes('.cursor/') && contextType === 'cursor') score += 10

    // Penalty for generic patterns
    if (contextType === 'generic-ai') score -= 10

    // Convert score to confidence level
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    if (score >= 40) return 'low'
    return 'none'
  }

  /**
   * Calculate confidence for directory-based detection
   * @param {string} contextType Context type
   * @param {string} dirName Directory name
   * @param {Array} files Files in directory
   * @returns {string} Confidence level
   */
  calculateDirectoryConfidence(contextType, dirName, files) {
    let score = 40 // Base score for directory detection

    // Boost for exact directory name matches
    if (dirName === '.claude' && contextType === 'claude-code-cli') score += 30
    if (dirName === '.cursor' && contextType === 'cursor') score += 30
    if (dirName === 'copilot' && contextType === 'github-copilot') score += 25
    if (dirName === '.windsurf' && contextType === 'windsurf') score += 25

    // Boost for relevant file types in directory
    const relevantFiles = files.filter((file) => this.isRelevantFile(file, contextType))
    score += Math.min(relevantFiles.length * 5, 20)

    // Convert score to confidence level
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    if (score >= 40) return 'low'
    return 'none'
  }

  /**
   * Check if file is relevant for context type
   * @param {Object} file File object
   * @param {string} contextType Context type
   * @returns {boolean} Is relevant
   */
  isRelevantFile(file, contextType) {
    const relevantExtensions = {
      'claude-code-cli': ['.md', '.json'],
      cursor: ['.md', '.json', '.mdc'],
      'github-copilot': ['.json', '.yml', '.yaml', '.md'],
      windsurf: ['.xml', '.md', '.json'],
      'generic-ai': ['.md', '.txt', '.json', '.yml'],
    }

    const extensions = relevantExtensions[contextType] || ['.md', '.txt']
    const fileExt = path.extname(file.name).toLowerCase()

    return extensions.includes(fileExt)
  }

  /**
   * Get user-friendly source name
   * @param {string} contextType Context type
   * @returns {string} Source name
   */
  getSourceName(contextType) {
    const sourceMap = {
      'claude-code-cli': 'Claude Code CLI',
      cursor: 'Cursor',
      'github-copilot': 'GitHub Copilot',
      windsurf: 'Windsurf',
      'generic-ai': 'Generic AI',
    }

    return sourceMap[contextType] || 'Unknown'
  }

  /**
   * Deduplicate and prioritize detected contexts
   * @param {Array} contexts Detected contexts
   * @returns {Array} Deduplicated contexts
   */
  dedupAndPrioritizeContexts(contexts) {
    // Remove contexts with 'none' confidence
    const validContexts = contexts.filter((ctx) => ctx.confidence !== 'none')

    // Sort by confidence and type priority
    const priorityOrder = ['claude-code-cli', 'cursor', 'windsurf', 'github-copilot', 'generic-ai']
    const confidenceOrder = ['high', 'medium', 'low']

    return validContexts.sort((a, b) => {
      // First sort by confidence
      const confA = confidenceOrder.indexOf(a.confidence)
      const confB = confidenceOrder.indexOf(b.confidence)
      if (confA !== confB) return confA - confB

      // Then by type priority
      const prioA = priorityOrder.indexOf(a.type)
      const prioB = priorityOrder.indexOf(b.type)
      return prioA - prioB
    })
  }
}
