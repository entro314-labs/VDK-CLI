/**
 * Rule Detector
 * -------------
 * Detects and analyzes existing AI context files, rules, and configurations
 * from various AI assistant formats and structures.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export class RuleDetector {
  constructor(projectPath) {
    this.projectPath = projectPath;

    // Known AI context patterns and their characteristics
    this.contextPatterns = {
      'claude-code-cli': {
        patterns: ['.claude/**/*.md', 'CLAUDE.md', '**/CLAUDE.md', '.claude/commands/**/*'],
        indicators: ['CLAUDE.md', '.claude/', 'claude-code-cli', 'mcp'],
        confidence: 'high',
      },
      cursor: {
        patterns: ['.cursor/**/*', '.cursorrules', 'cursorrules', '.cursor-rules'],
        indicators: ['.cursorrules', '.cursor/', 'cursor', '@'],
        confidence: 'high',
      },
      'github-copilot': {
        patterns: [
          '.github/copilot/**/*',
          '.copilotrc*',
          '.github/copilot.*',
          '.github/copilot-instructions.md',
          '**/copilot-instructions.md',
          '**/COPILOT.md',
        ],
        indicators: ['copilot', 'github.com', 'pull_request_template', 'review'],
        confidence: 'medium',
      },
      windsurf: {
        patterns: ['.windsurf/**/*', '.windsurfrc', 'windsurf.config.*'],
        indicators: ['windsurf', 'cascade', 'codeium'],
        confidence: 'high',
      },
      'openai-codex': {
        patterns: ['AGENTS.md', '**/AGENTS.md', '.codex/**/*', '.openai/config.toml'],
        indicators: ['agents.md', 'codex', '.codex', 'openai'],
        confidence: 'high',
      },
      'gemini-cli': {
        patterns: ['GEMINI.md', '**/GEMINI.md', '.gemini/**/*'],
        indicators: ['gemini', '.gemini', 'google'],
        confidence: 'high',
      },
      opencode: {
        patterns: ['opencode.json', '.opencode/**/*', '**/AGENTS.md'],
        indicators: ['opencode', '.opencode', 'agents.md'],
        confidence: 'medium',
      },
      'claude-skill': {
        patterns: ['**/SKILL.md', '**/skill.md', '.claude/skills/**/*'],
        indicators: ['skill.md', 'name:', 'description:'],
        confidence: 'medium',
      },
      acp: {
        patterns: ['.acp/**/*', 'ACP.md', '**/ACP.md'],
        indicators: ['.acp', 'acp', 'agent-client-protocol'],
        confidence: 'high',
      },
      'generic-ai': {
        patterns: ['.vdk/**/*', 'ai-rules/**/*', 'prompts/**/*', '.prompts/**/*'],
        indicators: ['prompt', 'ai', 'assistant', 'context', 'memory'],
        confidence: 'low',
      },
    };
  }

  /**
   * Analyze a file to detect AI context type and content
   * @param {string} filePath Path to file
   * @returns {Object|null} Context analysis or null if not an AI context
   */
  async analyzeFile(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        return null;
      }

      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath);
      const relativePath = path.relative(this.projectPath, filePath);

      // Detect context type based on file path and name
      const contextType = this.detectContextType(filePath, fileName, dirName);
      if (!contextType) {
        return null;
      }

      // Read and analyze file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const analysis = this.analyzeContent(content, contextType, fileName);

      if (!analysis) {
        return null;
      }

      return {
        filePath,
        relativePath,
        fileName,
        type: contextType,
        source: this.getContextSource(contextType),
        confidence: this.calculateConfidence(contextType, fileName, content),
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        ...analysis,
      };
    } catch {
      // File might not exist or be readable, skip silently
      return null;
    }
  }

  /**
   * Detect the context type based on file path and name
   * @param {string} filePath Full file path
   * @param {string} fileName File name
   * @param {string} dirName Directory name
   * @returns {string|null} Context type or null
   */
  detectContextType(filePath, fileName, dirName) {
    const lowerFilePath = filePath.toLowerCase();
    const lowerFileName = fileName.toLowerCase();
    const lowerDirName = dirName.toLowerCase();

    // Prioritize explicit file-name standards first
    if (fileName === 'CLAUDE.md') return 'claude-code-cli';
    if (fileName === 'AGENTS.md') {
      if (lowerDirName.includes('.opencode')) return 'opencode';
      return 'openai-codex';
    }
    if (fileName === 'GEMINI.md') return 'gemini-cli';
    if (fileName === 'ACP.md' || fileName === 'acp.md') return 'acp';
    if (fileName === 'COPILOT.md' || fileName === 'copilot-instructions.md') {
      return 'github-copilot';
    }
    if (fileName === 'manifest.json' && lowerFilePath.includes('/.acp/')) return 'acp';
    if (fileName === 'SKILL.md' || fileName === 'skill.md') return 'claude-skill';
    if (['.cursorrules', 'cursorrules', '.cursor-rules'].includes(fileName)) return 'cursor';
    if (fileName.startsWith('.copilotrc')) return 'github-copilot';
    if (fileName.startsWith('.windsurfrc') || fileName.startsWith('windsurf.config')) {
      return 'windsurf';
    }

    // Check for specific patterns
    for (const [type, config] of Object.entries(this.contextPatterns)) {
      for (const indicator of config.indicators) {
        if (
          lowerFilePath.includes(indicator.toLowerCase()) ||
          lowerFileName.includes(indicator.toLowerCase()) ||
          lowerDirName.includes(indicator.toLowerCase())
        ) {
          return type;
        }
      }
    }

    // Check directory-based detection
    if (lowerDirName.includes('.claude')) return 'claude-code-cli';
    if (lowerDirName.includes('.cursor')) return 'cursor';
    if (lowerDirName.includes('copilot')) return 'github-copilot';
    if (lowerDirName.includes('.windsurf')) return 'windsurf';
    if (lowerDirName.includes('.gemini')) return 'gemini-cli';
    if (lowerDirName.includes('.opencode')) return 'opencode';
    if (lowerDirName.includes('.codex')) return 'openai-codex';
    if (lowerDirName.includes('.acp')) return 'acp';
    if (lowerDirName.includes('skills')) return 'claude-skill';
    if (lowerDirName.includes('.ai') || lowerDirName.includes('prompts')) return 'generic-ai';

    return null;
  }

  /**
   * Analyze file content to extract structured information
   * @param {string} content File content
   * @param {string} contextType Detected context type
   * @param {string} fileName File name
   * @returns {Object|null} Content analysis
   */
  analyzeContent(content, contextType, fileName) {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const analysis = {
      contentType: this.detectContentType(content, fileName),
      hasMarkdown: content.includes('#') || content.includes('**') || content.includes('*'),
      hasFrontmatter: content.startsWith('---'),
      hasCommands: this.hasCommands(content, contextType),
      hasRules: this.hasRules(content),
      hasMemory: this.hasMemory(content),
      hasTemplating: this.hasTemplating(content),
      wordCount: content.split(/\s+/).length,
      lineCount: content.split('\n').length,
      sections: this.extractSections(content),
      metadata: {},
    };

    // Parse frontmatter if present
    if (analysis.hasFrontmatter) {
      try {
        const parsed = matter(content);
        analysis.metadata = parsed.data;
        analysis.bodyContent = parsed.content;
      } catch {
        analysis.bodyContent = content;
      }
    } else {
      analysis.bodyContent = content;
    }

    // Extract specific patterns based on context type
    switch (contextType) {
      case 'claude-code-cli':
        analysis.claudeSpecific = this.analyzeClaudeContent(content);
        break;
      case 'cursor':
        analysis.cursorSpecific = this.analyzeCursorContent(content);
        break;
      case 'github-copilot':
        analysis.copilotSpecific = this.analyzeCopilotContent(content);
        break;
      case 'windsurf':
        analysis.windsurfSpecific = this.analyzeWindsurfContent(content);
        break;
      case 'openai-codex':
        analysis.codexSpecific = this.analyzeCodexContent(content);
        break;
      case 'gemini-cli':
        analysis.geminiSpecific = this.analyzeGeminiContent(content);
        break;
      case 'opencode':
        analysis.opencodeSpecific = this.analyzeCodexContent(content);
        break;
      case 'claude-skill':
        analysis.skillSpecific = this.analyzeSkillContent(content);
        break;
      case 'acp':
        analysis.acpSpecific = this.analyzeACPContent(content);
        break;
    }

    return analysis;
  }

  /**
   * Detect content type based on structure and syntax
   * @param {string} content File content
   * @param {string} fileName File name
   * @returns {string} Content type
   */
  detectContentType(content, fileName) {
    const extension = path.extname(fileName).toLowerCase();

    if (extension === '.json') return 'json';
    if (extension === '.yaml' || extension === '.yml') return 'yaml';
    if (extension === '.md') return 'markdown';
    if (extension === '.js') return 'javascript';

    // Detect by content
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) return 'json';
    if (content.includes('---\n') && content.includes('\n---')) return 'yaml-frontmatter';
    if (content.includes('#') || content.includes('**')) return 'markdown';

    return 'text';
  }

  /**
   * Check if content contains command-like structures
   * @param {string} content File content
   * @param {string} contextType Context type
   * @returns {boolean} Has commands
   */
  hasCommands(content, contextType) {
    const commandPatterns = {
      'claude-code-cli': ['/[a-z]', 'mcp:', 'claude-code-cli', 'tool'],
      cursor: ['@', 'cursor:', 'ctrl+', 'cmd+'],
      'github-copilot': ['copilot:', 'gh ', 'github.com'],
      windsurf: ['cascade:', 'windsurf:', 'agent:'],
      'openai-codex': ['codex', 'agents.md', 'tool', 'constraint'],
      'gemini-cli': ['gemini', '.gemini', 'styleguide', 'settings.json'],
      opencode: ['opencode', 'opencode.json', 'agents.md'],
      'claude-skill': ['name:', 'description:', 'skill'],
      acp: ['acp', '.acp', 'manifest', 'context'],
      'generic-ai': ['/command', '!', 'run:', 'execute:'],
    };

    const patterns = commandPatterns[contextType] || commandPatterns['generic-ai'];
    return patterns.some(pattern => content.toLowerCase().includes(pattern.toLowerCase()));
  }

  /**
   * Check if content contains rule-like structures
   * @param {string} content File content
   * @returns {boolean} Has rules
   */
  hasRules(content) {
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
    ];

    const lowerContent = content.toLowerCase();
    return ruleKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Check if content contains memory-like structures
   * @param {string} content File content
   * @returns {boolean} Has memory
   */
  hasMemory(content) {
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
    ];

    const lowerContent = content.toLowerCase();
    return memoryKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Check if content contains templating syntax
   * @param {string} content File content
   * @returns {boolean} Has templating
   */
  hasTemplating(content) {
    const templatePatterns = [
      /\{\{[\s\S]*?\}\}/, // Handlebars
      /\$\{[\s\S]*?\}/, // Template literals
      /<[\w-]+>/, // XML-like tags
      /\[\[[\s\S]*?\]\]/, // Double brackets
      /%[\w-]+%/, // Percent variables
    ];

    return templatePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Extract sections from content
   * @param {string} content File content
   * @returns {Array} Extracted sections
   */
  extractSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Markdown headers
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level: headerMatch[1].length,
          title: headerMatch[2],
          content: [],
        };
        continue;
      }

      // YAML-style sections
      const yamlMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_-]*):/);
      if (yamlMatch && trimmed.endsWith(':')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level: 1,
          title: yamlMatch[1],
          content: [],
        };
        continue;
      }

      if (currentSection && trimmed) {
        currentSection.content.push(line);
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Analyze Claude Code CLI specific content
   * @param {string} content File content
   * @returns {Object} Claude-specific analysis
   */
  analyzeClaudeContent(content) {
    return {
      hasSlashCommands: content.includes('/'),
      hasMCPReferences: content.toLowerCase().includes('mcp'),
      hasToolReferences: content.toLowerCase().includes('tool'),
      hasFileReferences: content.includes('@'),
      hasHooks: content.toLowerCase().includes('hook'),
      hasMemoryFiles: content.toLowerCase().includes('claude.md'),
    };
  }

  /**
   * Analyze Cursor specific content
   * @param {string} content File content
   * @returns {Object} Cursor-specific analysis
   */
  analyzeCursorContent(content) {
    return {
      hasFileGlobs: /\*\*?\//.test(content),
      hasInstructions: content.toLowerCase().includes('instruction'),
      hasTabTriggers: content.includes('@'),
      hasIgnorePatterns: content.toLowerCase().includes('ignore'),
    };
  }

  /**
   * Analyze GitHub Copilot specific content
   * @param {string} content File content
   * @returns {Object} Copilot-specific analysis
   */
  analyzeCopilotContent(content) {
    return {
      hasReviewRules: content.toLowerCase().includes('review'),
      hasSecurityRules: content.toLowerCase().includes('security'),
      hasWorkflowRules: content.toLowerCase().includes('workflow'),
      hasGitHubReferences: content.toLowerCase().includes('github'),
    };
  }

  /**
   * Analyze Windsurf specific content
   * @param {string} content File content
   * @returns {Object} Windsurf-specific analysis
   */
  analyzeWindsurfContent(content) {
    return {
      hasCascadeRules: content.toLowerCase().includes('cascade'),
      hasAgentRules: content.toLowerCase().includes('agent'),
      hasFlowRules: content.toLowerCase().includes('flow'),
      hasContextRules: content.toLowerCase().includes('context'),
    };
  }

  /**
   * Analyze OpenAI Codex / AGENTS.md specific content
   * @param {string} content File content
   * @returns {Object} Codex-specific analysis
   */
  analyzeCodexContent(content) {
    return {
      hasAgentsStructure: /##\s+(project context|code standards|architecture)/i.test(content),
      hasToolConstraints: /tool|tools|constraint|allowed/i.test(content),
      hasBuildCommands: /build|test|lint/i.test(content),
    };
  }

  /**
   * Analyze Gemini-specific content
   * @param {string} content File content
   * @returns {Object} Gemini-specific analysis
   */
  analyzeGeminiContent(content) {
    return {
      hasGeminiImports: content.includes('@.gemini/'),
      hasStyleGuideSections: /##\s+(code style|testing|architecture)/i.test(content),
      hasPromptContext: /context|guideline|instruction/i.test(content),
    };
  }

  /**
   * Analyze SKILL.md style content
   * @param {string} content File content
   * @returns {Object} Skill-specific analysis
   */
  analyzeSkillContent(content) {
    return {
      hasSkillFrontmatter: content.startsWith('---') && /name:|description:/i.test(content),
      hasUsageTriggers: /use when|trigger|when to use/i.test(content),
      hasReferenceLinks: /references?\//i.test(content),
    };
  }

  /**
   * Analyze ACP-specific content
   * @param {string} content File content
   * @returns {Object} ACP-specific analysis
   */
  analyzeACPContent(content) {
    return {
      hasManifestFields: /protocol|schemaVersion|entries/i.test(content),
      hasStructuredEntries: /entries|context|kind/i.test(content),
      hasProtocolHints: /acp|agent-client-protocol/i.test(content),
    };
  }

  /**
   * Calculate confidence score for detection
   * @param {string} contextType Context type
   * @param {string} fileName File name
   * @param {string} content File content
   * @returns {string} Confidence level
   */
  calculateConfidence(contextType, fileName, content) {
    let score = 0;
    const config = this.contextPatterns[contextType];

    // Base confidence from pattern configuration
    const baseConfidence =
      {
        high: 80,
        medium: 60,
        low: 40,
      }[config.confidence] || 40;

    score += baseConfidence;

    // Boost for exact file name matches
    if (fileName === 'CLAUDE.md' && contextType === 'claude-code-cli') score += 20;
    if (['.cursorrules', 'cursorrules'].includes(fileName) && contextType === 'cursor') score += 20;
    if (fileName.startsWith('.copilotrc') && contextType === 'github-copilot') score += 15;
    if ((fileName === 'ACP.md' || fileName === 'acp.md') && contextType === 'acp') score += 20;

    // Boost for content indicators
    const indicators = config.indicators || [];
    for (const indicator of indicators) {
      if (content.toLowerCase().includes(indicator.toLowerCase())) {
        score += 5;
      }
    }

    // Reduce for generic patterns
    if (contextType === 'generic-ai') score -= 20;

    // Convert score to confidence level
    if (score >= 85) return 'high';
    if (score >= 65) return 'medium';
    if (score >= 45) return 'low';
    return 'none';
  }

  /**
   * Get user-friendly source name for context type
   * @param {string} contextType Context type
   * @returns {string} Source name
   */
  getContextSource(contextType) {
    const sourceMap = {
      'claude-code-cli': 'Claude Code CLI',
      cursor: 'Cursor',
      'github-copilot': 'GitHub Copilot',
      windsurf: 'Windsurf',
      'openai-codex': 'OpenAI Codex',
      'gemini-cli': 'Gemini CLI',
      opencode: 'OpenCode',
      'claude-skill': 'Claude Skill',
      acp: 'ACP (Agent Client Protocol)',
      'generic-ai': 'Generic AI',
    };

    return sourceMap[contextType] || 'Unknown';
  }
}
