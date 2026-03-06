/**
 * UniversalFormatConverter - Refactored as IR Facade
 * ===================================================
 *
 * Clean facade over the VDK IR system for format conversion.
 * Delegates all conversion logic to IR system, eliminating duplication.
 *
 * Supported Platforms (11 total):
 * - Claude Code, Cursor, GitHub Copilot, Windsurf (base)
 * - OpenAI AGENTS.md, Continue, Aider, Gemini, Zed, Tabnine, JetBrains (extended)
 */

// Import complete IR system via unified API
import IR from '../ir/index.js';
import { validateIR } from '../ir/types.js';
import { generateBlueprintId } from '../utils/filename-generator.js';
import { validateBlueprint } from '../utils/schema-validator.js';

export class UniversalFormatConverter {
  constructor() {
    // Map format names to IR platform IDs
    this.formatToPlatform = new Map([
      ['vdk-blueprint', 'generic'],
      ['claude-memory', 'claude-code'],
      ['cursor-rules', 'cursor'],
      ['copilot-config', 'github-copilot'],
      ['json', 'generic'],
      ['windsurf-rules', 'windsurf'],
      ['agents-md', 'openai-codex'],
      ['continue-config', 'continue'],
      ['aider-config', 'aider'],
      ['gemini-context', 'gemini-cli'],
      ['zed-settings', 'zed'],
      ['tabnine-guideline', 'tabnine'],
      ['jetbrains-aiignore', 'jetbrains'],
      ['markdown', 'generic'],
      ['text', 'generic'],
    ]);
  }

  /**
   * Backward-compatible format detector used by legacy comprehensive tests.
   */
  detectFormat(content, filePath = '') {
    const lowerPath = String(filePath || '').toLowerCase();
    const trimmed = String(content || '').trim();

    if (lowerPath.endsWith('.json')) return 'json';
    if (lowerPath.endsWith('.md') || lowerPath.endsWith('.mdc')) return 'markdown';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Continue format detection
      }
    }
    if (trimmed.startsWith('#') || /\n#{1,6}\s+/.test(`\n${trimmed}`)) return 'markdown';

    return 'text';
  }

  /**
   * Backward-compatible content validator used by legacy comprehensive tests.
   */
  validateFormat(content, format) {
    const errors = [];
    const text = String(content || '');

    if (text.includes('\x00')) {
      errors.push('Content contains invalid null bytes');
    }

    if (/\\x[0-9a-fA-F]{2}/.test(text)) {
      errors.push('Content contains escaped binary byte sequences');
    }

    if (format === 'json') {
      try {
        JSON.parse(text);
      } catch (error) {
        errors.push(`Invalid JSON: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Backward-compatible direct converter used by legacy comprehensive tests.
   */
  async convert(sourceContent, fromFormat, toFormat) {
    const source = sourceContent ?? '';

    if (fromFormat === toFormat) {
      return typeof source === 'string' ? source : JSON.stringify(source, null, 2);
    }

    if (fromFormat === 'json' && toFormat === 'markdown') {
      const parsed = typeof source === 'string' ? JSON.parse(source) : source;
      const title = parsed?.title || 'Converted Content';
      const description = parsed?.description ? `\n\n${parsed.description}` : '';
      const body = parsed?.content
        ? `\n\n${parsed.content}`
        : `\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
      return `# ${title}${description}${body}`;
    }

    if (toFormat === 'json') {
      if (typeof source === 'string') {
        return JSON.stringify(
          {
            title: this.extractTitleFromMarkdown(source) || 'Converted Content',
            content: source,
          },
          null,
          2
        );
      }
      return JSON.stringify(source, null, 2);
    }

    // Fallback to string output for unsupported direct mappings.
    return typeof source === 'string' ? source : JSON.stringify(source, null, 2);
  }

  /**
   * Preview conversion output without performing publication side effects.
   */
  async previewConversion({ content, format, projectContext = {} }) {
    const detectedFormat = format || this.detectFormat(content);
    const previewTitle =
      this.extractTitleFromMarkdown(content) || projectContext?.name || 'Publication Preview';

    return {
      title: previewTitle,
      sourceFormat: detectedFormat,
      targetFormat: 'vdk-blueprint',
      estimatedLength: String(content || '').length,
      compatiblePlatforms: this.getSupportedPlatforms().slice(0, 6),
    };
  }

  extractTitleFromMarkdown(markdown) {
    const match = String(markdown || '').match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() || '';
  }

  /**
   * Convert any supported format to universal VDK Blueprint format
   * @param {Object} options
   * @param {string} options.content - Source content
   * @param {string} options.format - Format identifier
   * @param {Object} [options.projectContext] - Project metadata
   * @param {string} [options.originalFile] - Original file path
   * @returns {Promise<Object>} Converted blueprint
   */
  async convertToUniversal({ content, format, projectContext = {}, originalFile = '' }) {
    // Get platform ID from format
    const platformId = this.formatToPlatform.get(format);
    if (!platformId) {
      throw new Error(
        `Unsupported format: ${format}. Supported: ${Array.from(this.formatToPlatform.keys()).join(', ')}`
      );
    }

    // Convert to IR using auto-detection or specific parser
    let ir;
    if (originalFile) {
      // Use file path for platform detection
      ir = IR.parse.auto({ content, filePath: originalFile });
    } else {
      // Use format-based detection
      const parser = IR.parse[platformId === 'openai-codex' ? 'agents' : platformId];
      if (parser) {
        ir = parser({ content, filePath: originalFile || 'unknown' });
      } else {
        ir = IR.parse.markdown(content);
      }
    }

    // Handle array results (e.g., AGENTS.md returns multiple IRs)
    const irs = Array.isArray(ir) ? ir : [ir];

    // Convert IRs to blueprint format
    const blueprints = irs.map(singleIR => this.irToBlueprint(singleIR, projectContext));

    // For multiple IRs, return the first (or merge if needed)
    const blueprint = blueprints[0];

    // Validate the result
    const validation = await validateBlueprint(blueprint.frontmatter);
    if (!validation.valid) {
      console.warn('Generated blueprint has validation issues:', validation.errors);
    }

    return {
      frontmatter: blueprint.frontmatter,
      content: blueprint.content,
      format: 'vdk-blueprint',
      originalFormat: format,
      validation,
    };
  }

  /**
   * Convert IR to VDK Blueprint format
   * @param {IntermediateRepresentation} ir - IR object
   * @param {Object} projectContext - Project metadata
   * @returns {Object} Blueprint with frontmatter and content
   */
  irToBlueprint(ir, projectContext = {}) {
    // Build frontmatter from IR
    const frontmatter = {
      id: generateBlueprintId(ir.name),
      title: ir.name,
      description: ir.description || '',
      version: ir.version || '1.0.0',
      category: ir.category || this.inferCategory(ir),
      platforms: this.buildPlatformsConfig(ir),
    };

    // Add optional fields
    if (ir.tags?.length) frontmatter.tags = ir.tags;
    if (ir.complexity) frontmatter.complexity = ir.complexity;
    if (projectContext.author) frontmatter.author = projectContext.author;
    if (projectContext.license) frontmatter.license = projectContext.license;

    // Extract content
    let content = '';
    if (ir.content?.sections?.length) {
      content = ir.content.sections
        .map(s => {
          const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
          return heading + s.content;
        })
        .join('\n\n');
    } else if (ir.content?.raw) {
      content = ir.content.raw;
    }

    return { frontmatter, content };
  }

  /**
   * Build platforms configuration from IR
   * @param {IntermediateRepresentation} ir - IR object
   * @returns {Object} Platforms config
   */
  buildPlatformsConfig(ir) {
    const platforms = {};
    const sourcePlatform = ir.conversionMetadata?.sourcePlatform;

    // Add source platform
    if (sourcePlatform) {
      platforms[sourcePlatform] = {
        compatible: true,
        ...ir.platformSpecific?.[sourcePlatform],
      };
    }

    // Add compatible platforms based on IR type
    const compatiblePlatforms = this.getCompatiblePlatforms(ir.type);
    for (const platform of compatiblePlatforms) {
      if (!platforms[platform]) {
        platforms[platform] = { compatible: true };
      }
    }

    return platforms;
  }

  /**
   * Get compatible platforms for component type
   * @param {string} type - Component type
   * @returns {string[]} Compatible platform IDs
   */
  getCompatiblePlatforms(type) {
    const compatibility = {
      agent: ['claude-code', 'openai-codex'],
      rule: ['claude-code', 'cursor', 'windsurf', 'github-copilot', 'gemini-cli', 'tabnine'],
      command: ['claude-code', 'continue'],
      skill: ['claude-code'],
      workflow: ['windsurf'],
      settings: ['claude-code', 'continue', 'aider', 'gemini-cli', 'zed', 'jetbrains'],
      main: ['claude-code', 'cursor', 'github-copilot', 'windsurf', 'gemini-cli'],
    };

    return compatibility[type] || ['claude-code', 'cursor', 'github-copilot'];
  }

  /**
   * Convert between platforms using IR as intermediate representation
   * @param {Object} options
   * @param {string} options.content - Source content
   * @param {string} options.filePath - Source file path
   * @param {string} options.targetPlatform - Target platform ID
   * @param {Object} [options.targetOptions] - Platform-specific options
   * @returns {Promise<Object>} Conversion result
   */
  async convertViaIR({ content, filePath, targetPlatform, targetOptions = {} }) {
    // Use IR system's convert helper
    const result = IR.convert.fromTo({
      from: IR.utils.detectPlatform(filePath),
      to: targetPlatform,
      content,
      filePath,
      generateOptions: targetOptions,
    });

    return {
      ...result.result,
      ir: result.ir,
      semanticScore: result.ir.conversionMetadata?.semanticScore || 100,
      sourcePlatform: result.ir.conversionMetadata?.sourcePlatform || 'unknown',
      targetPlatform,
    };
  }

  /**
   * Import content to IR (parsing step only)
   * @param {Object} options
   * @param {string} options.content - Content to parse
   * @param {string} options.filePath - File path for detection
   * @returns {IntermediateRepresentation|IntermediateRepresentation[]}
   */
  async importToIR({ content, filePath }) {
    return IR.parse.auto({ content, filePath });
  }

  /**
   * Export IR to specific platform
   * @param {IntermediateRepresentation} ir - IR to export
   * @param {string} targetPlatform - Target platform ID
   * @param {Object} options - Platform-specific options
   * @returns {Object} Generated content
   */
  async exportFromIR(ir, targetPlatform, options = {}) {
    const generator = IR.generate[targetPlatform];
    if (!generator) {
      throw new Error(`Unknown target platform: ${targetPlatform}`);
    }

    return generator(ir, options);
  }

  /**
   * Convert to multiple platforms via IR (single parse, multi-generate)
   * @param {Object} options
   * @param {string} options.content - Source content
   * @param {string} options.filePath - Source file path
   * @param {string[]} options.targetPlatforms - Target platform IDs
   * @param {Object} options.platformOptions - Platform-specific options
   * @returns {Promise<Object>} Map of platform -> {content, filePath, lossInfo, ir}
   */
  async convertToMultiplePlatformsViaIR({
    content,
    filePath,
    targetPlatforms,
    platformOptions = {},
  }) {
    // Parse once to IR
    const ir = IR.parse.auto({ content, filePath });

    // Validate IR
    const validation = validateIR(ir);
    if (!validation.valid) {
      console.warn('IR validation warnings:', validation.errors);
    }

    // Generate for all target platforms
    const results = IR.generate.multi(ir, targetPlatforms, platformOptions);

    // Add metadata to each result
    for (const platform of Object.keys(results)) {
      results[platform].ir = ir;
      results[platform].sourcePlatform = ir.conversionMetadata?.sourcePlatform || 'unknown';
      results[platform].targetPlatform = platform;
    }

    return results;
  }

  /**
   * Batch convert multiple files
   * @param {Array<Object>} files - Array of {content, filePath}
   * @param {string} targetPlatform - Target platform
   * @param {Object} options - Conversion options
   * @returns {Promise<Array>} Conversion results
   */
  async batchConvert(files, targetPlatform, options = {}) {
    return IR.performance.batch(
      files,
      async ({ content, filePath }) => {
        return this.convertViaIR({ content, filePath, targetPlatform, targetOptions: options });
      },
      { concurrency: options.concurrency || 5 }
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Infer category from IR content
   * @param {IntermediateRepresentation} ir
   * @returns {string}
   */
  inferCategory(ir) {
    const content = ir.content?.raw?.toLowerCase() || '';
    const name = ir.name?.toLowerCase() || '';

    if (content.includes('typescript') || name.includes('typescript')) return 'languages';
    if (content.includes('react') || content.includes('next.js')) return 'technologies';
    if (content.includes('security') || content.includes('audit')) return 'tasks';
    if (ir.type === 'agent') return 'assistants';
    if (ir.type === 'workflow') return 'tasks';

    return 'core';
  }

  /**
   * Extract tags from content
   * @param {string} content
   * @returns {string[]}
   */
  extractTags(content) {
    const tags = new Set();
    const keywords = [
      'typescript',
      'javascript',
      'python',
      'react',
      'nextjs',
      'vue',
      'security',
      'testing',
      'performance',
      'accessibility',
      'ai',
      'backend',
      'frontend',
      'fullstack',
      'database',
      'api',
    ];

    const contentLower = content.toLowerCase();
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        tags.add(keyword);
      }
    }

    return Array.from(tags);
  }

  /**
   * Infer complexity from content
   * @param {string} content
   * @returns {string}
   */
  inferComplexity(content) {
    const lines = content.split('\n').length;
    const sections = (content.match(/^#{1,3}\s/gm) || []).length;

    if (lines > 200 || sections > 10) return 'advanced';
    if (lines > 100 || sections > 5) return 'intermediate';
    return 'basic';
  }

  /**
   * Enhance blueprint with project context
   * @param {Object} converted - Converted blueprint
   * @param {Object} projectContext - Project metadata
   * @returns {Object} Enhanced blueprint
   */
  enhanceWithProjectContext(converted, projectContext) {
    const frontmatter = { ...converted.frontmatter };

    if (projectContext.author) frontmatter.author = projectContext.author;
    if (projectContext.license) frontmatter.license = projectContext.license;
    if (projectContext.repository) frontmatter.repository = projectContext.repository;

    return {
      frontmatter,
      content: converted.content,
    };
  }

  /**
   * Detect source platform from format
   * @param {string} format - Format identifier
   * @returns {string} Platform name
   */
  detectSourcePlatform(format) {
    return this.formatToPlatform.get(format) || 'unknown';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return Array.from(this.formatToPlatform.keys());
  }

  /**
   * Get supported platforms
   * @returns {string[]}
   */
  getSupportedPlatforms() {
    return Array.from(new Set(this.formatToPlatform.values()));
  }

  /**
   * Get supported conversions matrix showing capabilities and limits
   * @returns {Object} Platform conversion capabilities
   */
  getSupportedConversions() {
    return {
      'claude-code': {
        supportsAgents: true,
        supportsRules: true,
        supportsCommands: true,
        supportsSkills: true,
        supportsSettings: true,
        supportsWorkflows: false,
        characterLimit: null,
        format: 'markdown',
      },
      cursor: {
        supportsAgents: false,
        supportsRules: true,
        supportsCommands: false,
        supportsSkills: false,
        supportsSettings: false,
        supportsWorkflows: false,
        characterLimit: null,
        format: 'mdc',
        conversionsFromClaude: {
          agent: 'rule (with agent-requested activation)',
          command: 'rule (triggers lost)',
          skill: 'rule',
        },
      },
      'github-copilot': {
        supportsAgents: false,
        supportsRules: true,
        supportsCommands: false,
        supportsSkills: false,
        supportsSettings: false,
        supportsWorkflows: false,
        characterLimit: 3000,
        format: 'markdown',
        conversionsFromClaude: {
          agent: 'content only (truncated if over limit)',
          command: 'content only (triggers lost)',
          skill: 'content only',
        },
      },
      windsurf: {
        supportsAgents: false,
        supportsRules: true,
        supportsCommands: false,
        supportsSkills: false,
        supportsSettings: false,
        supportsWorkflows: true,
        characterLimit: null,
        format: 'markdown',
        conversionsFromClaude: {
          agent: 'rule',
          command: 'rule (triggers lost)',
          skill: 'rule',
          workflow: 'workflow',
        },
      },
    };
  }
}

export default UniversalFormatConverter;
