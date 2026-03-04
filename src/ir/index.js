/**
 * VDK Intermediate Representation (IR) Module
 * ============================================
 *
 * This module provides the core IR system for cross-platform conversion.
 * It includes parsers for converting various formats to IR and generators
 * for converting IR to platform-specific formats.
 */

import path from 'node:path';
import matter from 'gray-matter';

import { createIR } from './types.js';

// ============================================================================
// Content Parsers
// ============================================================================

/**
 * Parse markdown content with optional YAML frontmatter
 * @param {string} content - Raw content
 * @param {string} [fileName] - Original file name for type inference
 * @returns {Object} Parsed content with frontmatter and sections
 */
export function parseMarkdownContent(content, _fileName = '') {
  let frontmatter = {};
  let body = content;
  let hasFrontmatter = false;

  // Try to parse YAML frontmatter
  try {
    const parsed = matter(content);
    if (Object.keys(parsed.data).length > 0) {
      frontmatter = parsed.data;
      body = parsed.content;
      hasFrontmatter = true;
    }
  } catch {
    // Not valid frontmatter, use content as-is
  }

  // Parse sections from body
  const sections = parseMarkdownSections(body);

  return {
    raw: content,
    format: 'markdown',
    frontmatter,
    sections,
    hasFrontmatter,
  };
}

/**
 * Parse markdown into hierarchical sections
 * @param {string} content - Markdown content
 * @returns {Array} Array of sections
 */
export function parseMarkdownSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let contentBuffer = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        sections.push(currentSection);
      }

      currentSection = {
        title: headingMatch[2],
        level: headingMatch[1].length,
        content: '',
        children: [],
      };
      contentBuffer = [];
    } else {
      contentBuffer.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentBuffer.join('\n').trim();
    sections.push(currentSection);
  } else if (contentBuffer.length > 0) {
    // Content without headers
    sections.push({
      title: '',
      level: 0,
      content: contentBuffer.join('\n').trim(),
      children: [],
    });
  }

  return sections;
}

/**
 * Parse MDC (Markdown with Components) format used by Cursor
 * @param {string} content - MDC content
 * @returns {Object} Parsed MDC structure
 */
export function parseMDCContent(content) {
  const parsed = parseMarkdownContent(content);

  // Extract MDC-specific metadata
  const mdcMeta = {};

  // Check for description in frontmatter
  if (parsed.frontmatter.description) {
    mdcMeta.description = parsed.frontmatter.description;
  }

  // Check for globs/alwaysApply
  if (parsed.frontmatter.globs) {
    mdcMeta.globs = Array.isArray(parsed.frontmatter.globs)
      ? parsed.frontmatter.globs
      : [parsed.frontmatter.globs];
  }

  if (parsed.frontmatter.alwaysApply !== undefined) {
    mdcMeta.alwaysApply = parsed.frontmatter.alwaysApply;
  }

  return {
    ...parsed,
    format: 'mdc',
    mdcMeta,
  };
}

/**
 * Extract file references (@path syntax) from content
 * @param {string} content - Content to scan
 * @returns {Array} Array of file references
 */
export function extractFileReferences(content) {
  const refs = [];

  // Match @path/to/file patterns (Claude Code syntax)
  const pathMatches = content.matchAll(/@([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/g);
  for (const match of pathMatches) {
    refs.push({
      path: match[1],
      type: 'include',
    });
  }

  // Match {{ path/to/file }} patterns (MDC include syntax)
  const includeMatches = content.matchAll(/\{\{\s*([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)\s*\}\}/g);
  for (const match of includeMatches) {
    refs.push({
      path: match[1],
      type: 'include',
    });
  }

  return refs;
}

// ============================================================================
// IR Conversion: Source → IR
// ============================================================================

/**
 * Convert Claude Code component to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @param {'agent'|'rule'|'command'|'skill'|'main'|'settings'} [options.type] - Override type detection
 * @returns {IntermediateRepresentation}
 */
export function claudeToIR({ content, filePath, type }) {
  const fileName = path.basename(filePath);
  const dirName = path.basename(path.dirname(filePath));

  // Infer type from path if not provided
  const inferredType = type || inferClaudeType(filePath);

  const ir = createIR(inferredType, fileName.replace(/\.md$/, ''));
  ir.content = parseMarkdownContent(content, fileName);
  ir.fileReferences = extractFileReferences(content);

  // Update name from frontmatter if available
  if (ir.content.frontmatter?.name) {
    ir.name = ir.content.frontmatter.name;
  }

  // Extract triggers for commands
  if (inferredType === 'command' && ir.content.frontmatter?.triggers) {
    ir.triggers = Array.isArray(ir.content.frontmatter.triggers)
      ? ir.content.frontmatter.triggers
      : [ir.content.frontmatter.triggers];
  }

  // Extract tools
  if (ir.content.frontmatter?.tools) {
    ir.tools = ir.content.frontmatter.tools.map(t => (typeof t === 'string' ? { name: t } : t));
  }

  // Extract description from first section or frontmatter
  ir.description =
    ir.content.frontmatter?.description || ir.content.sections[0]?.content?.substring(0, 200) || '';

  // Set platform-specific data
  ir.platformSpecific = {
    'claude-code': {
      originalPath: filePath,
      frontmatter: ir.content.frontmatter,
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'claude-code',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Infer Claude component type from file path
 * @param {string} filePath - File path
 * @returns {ComponentType}
 */
function inferClaudeType(filePath) {
  const dirName = path.basename(path.dirname(filePath));
  const fileName = path.basename(filePath).toLowerCase();

  if (dirName === 'agents' || fileName.includes('agent')) return 'agent';
  if (dirName === 'rules' || fileName.includes('rule')) return 'rule';
  if (dirName === 'commands' || fileName.includes('command')) return 'command';
  if (dirName === 'skills' || fileName.includes('skill')) return 'skill';
  if (fileName === 'claude.md') return 'main';
  if (fileName === 'settings.json') return 'settings';

  return 'rule'; // Default
}

/**
 * Convert Cursor rule to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function cursorToIR({ content, filePath }) {
  const fileName = path.basename(filePath);
  const isMDC = filePath.includes('.cursor/rules/') || filePath.endsWith('.mdc');

  const ir = createIR('rule', fileName.replace(/\.(mdc|md)$/, ''));

  if (isMDC) {
    const parsed = parseMDCContent(content);
    ir.content = parsed;

    // Map MDC metadata to IR
    if (parsed.mdcMeta.globs) {
      ir.conditionalRules = {
        globs: parsed.mdcMeta.globs,
        activation: parsed.mdcMeta.alwaysApply ? 'always' : 'path-based',
      };
    }
  } else {
    ir.content = parseMarkdownContent(content, fileName);
  }

  ir.fileReferences = extractFileReferences(content);
  ir.description = ir.content.frontmatter?.description || '';

  ir.platformSpecific = {
    cursor: {
      originalPath: filePath,
      isMDC,
      globs: ir.conditionalRules?.globs,
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'cursor',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert GitHub Copilot instructions to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function copilotToIR({ content, filePath }) {
  const ir = createIR('main', 'copilot-instructions');
  ir.content = parseMarkdownContent(content, path.basename(filePath));
  ir.fileReferences = extractFileReferences(content);
  ir.description = ir.content.sections[0]?.content?.substring(0, 200) || '';

  ir.platformSpecific = {
    'github-copilot': {
      originalPath: filePath,
      characterCount: content.length,
      withinLimit: content.length <= 3000,
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'github-copilot',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert Windsurf rules to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function windsurfToIR({ content, filePath }) {
  const fileName = path.basename(filePath);
  const ir = createIR('rule', fileName.replace(/\.md$/, ''));
  ir.content = parseMarkdownContent(content, fileName);
  ir.fileReferences = extractFileReferences(content);

  // Check for workflow/procedure patterns
  if (content.includes('workflow') || content.includes('procedure') || content.includes('steps:')) {
    ir.type = 'workflow';
  }

  ir.description = ir.content.frontmatter?.description || '';

  ir.platformSpecific = {
    windsurf: {
      originalPath: filePath,
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'windsurf',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Auto-detect platform and convert to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function autoConvertToIR({ content, filePath }) {
  const platform = detectPlatformFromPath(filePath);

  switch (platform) {
    case 'claude-code':
      return claudeToIR({ content, filePath });
    case 'cursor':
      return cursorToIR({ content, filePath });
    case 'github-copilot':
      return copilotToIR({ content, filePath });
    case 'windsurf':
      return windsurfToIR({ content, filePath });
    default: {
      // Generic conversion
      const ir = createIR('rule', path.basename(filePath));
      ir.content = parseMarkdownContent(content, filePath);
      ir.fileReferences = extractFileReferences(content);
      ir.conversionMetadata = {
        sourcePlatform: 'generic',
        sourceFile: filePath,
        convertedAt: new Date().toISOString(),
        vdkVersion: '3.0.0',
        lossInfo: [],
        semanticScore: 100,
      };
      return ir;
    }
  }
}

/**
 * Detect platform from file path
 * @param {string} filePath - File path
 * @returns {PlatformId}
 */
export function detectPlatformFromPath(filePath) {
  const normalizedPath = filePath.toLowerCase();

  if (normalizedPath.includes('.claude') || normalizedPath.includes('claude.md'))
    return 'claude-code';
  if (normalizedPath.includes('.cursor') || normalizedPath.endsWith('.mdc')) return 'cursor';
  if (normalizedPath.includes('copilot') || normalizedPath.includes('.github/copilot'))
    return 'github-copilot';
  if (normalizedPath.includes('.windsurf')) return 'windsurf';
  if (normalizedPath.includes('.continue')) return 'continue';
  if (normalizedPath.includes('.aider')) return 'aider';

  return 'generic';
}

// ============================================================================
// Exports
// ============================================================================

// Re-export extended converters
export * from './converters-extended.js';
// Re-export file resolver
export * from './file-resolver.js';
// Re-export generators
export * from './generators.js';
// Re-export performance utilities
export * from './performance.js';
export * from './types.js';

// ============================================================================
// Organized API Surface (from index-enhanced.js)
// ============================================================================

// Import extended converters
import {
  agentsToIR,
  aiderToIR,
  autoConvertExtendedToIR,
  continueToIR,
  geminiToIR,
  irToAgents,
  irToAider,
  irToContinue,
  irToGemini,
  irToJetbrains,
  irToTabnine,
  irToZed,
  jetbrainsToIR,
  tabnineToIR,
  zedToIR,
} from './converters-extended.js';
// Import file resolver
import {
  getReferencesReport,
  inlineFileReferences,
  inlineIRReferences,
  resolveAllReferences,
  resolveFileReference,
  resolveIRReferences,
  validateIRReferences,
} from './file-resolver.js';
// Import generators for organized API
import {
  irToClaude,
  irToCopilot,
  irToCursor,
  irToMultiplePlatforms,
  irToWindsurf,
  sanitizeFileName,
} from './generators.js';

// Import performance utilities
import {
  batchProcess,
  cachedParse,
  cachedParseFile,
  checkFileSize,
  checkMemoryLimit,
  clearCaches,
  getCacheStats,
  getMemoryUsage,
  getPerformanceReport,
  measure,
  measureAsync,
  parseLargeFileInChunks,
  pruneCaches,
  readLargeFile,
} from './performance.js';

/**
 * Parse content to IR
 */
export const parse = {
  // Base platforms
  claude: claudeToIR,
  cursor: cursorToIR,
  copilot: copilotToIR,
  windsurf: windsurfToIR,

  // Extended platforms
  agents: agentsToIR,
  continue: continueToIR,
  aider: aiderToIR,
  gemini: geminiToIR,
  zed: zedToIR,
  tabnine: tabnineToIR,
  jetbrains: jetbrainsToIR,

  // Auto-detection
  auto: options => {
    const ir = autoConvertToIR(options);
    return ir || autoConvertExtendedToIR(options) || null;
  },

  // Content parsing
  markdown: parseMarkdownContent,
  mdc: parseMDCContent,
  sections: parseMarkdownSections,

  // Cached parsing
  cached: cachedParse,
  cachedFile: cachedParseFile,

  // Large files
  largeFile: parseLargeFileInChunks,
};

/**
 * Generate platform-specific output from IR
 */
export const generate = {
  // Base platforms
  claude: irToClaude,
  cursor: irToCursor,
  copilot: irToCopilot,
  windsurf: irToWindsurf,

  // Extended platforms
  agents: irToAgents,
  continue: irToContinue,
  aider: irToAider,
  gemini: irToGemini,
  zed: irToZed,
  tabnine: irToTabnine,
  jetbrains: irToJetbrains,

  // Multi-platform
  multi: irToMultiplePlatforms,

  // Batch conversion
  batch: async (irs, targetPlatform, options = {}) => {
    const generatorMap = {
      'claude-code': irToClaude,
      cursor: irToCursor,
      'github-copilot': irToCopilot,
      windsurf: irToWindsurf,
      'openai-codex': irToAgents,
      continue: irToContinue,
      aider: irToAider,
      'gemini-cli': irToGemini,
      zed: irToZed,
      tabnine: irToTabnine,
      jetbrains: irToJetbrains,
    };

    const generator = generatorMap[targetPlatform];
    if (!generator) {
      throw new Error(`Unknown target platform: ${targetPlatform}`);
    }

    return batchProcess(irs, async ir => generator(ir, options), options.batchOptions || {});
  },
};

/**
 * File reference operations
 */
export const fileRefs = {
  extract: extractFileReferences,
  resolve: resolveFileReference,
  resolveAll: resolveAllReferences,
  resolveIR: resolveIRReferences,
  inline: inlineFileReferences,
  inlineIR: inlineIRReferences,
  validate: validateIRReferences,
  report: getReferencesReport,
};

/**
 * Performance utilities
 */
export const performance = {
  checkSize: checkFileSize,
  readLarge: readLargeFile,
  batch: batchProcess,
  memory: getMemoryUsage,
  checkMemoryLimit,
  clearCaches,
  stats: getCacheStats,
  prune: pruneCaches,
  measure,
  measureAsync,
  report: getPerformanceReport,
};

/**
 * Utilities
 */
export const utils = {
  sanitizeFileName,
  detectPlatform: detectPlatformFromPath,
};

/**
 * Conversion helpers
 */
export const convert = {
  fromTo: ({ from, to, content, filePath, parseOptions = {}, generateOptions = {} }) => {
    const parser = parse[from] || parse.auto;
    const ir = parser({ content, filePath, ...parseOptions });

    const generatorMap = {
      'claude-code': irToClaude,
      cursor: irToCursor,
      'github-copilot': irToCopilot,
      windsurf: irToWindsurf,
      'openai-codex': irToAgents,
      continue: irToContinue,
      aider: irToAider,
      'gemini-cli': irToGemini,
      zed: irToZed,
      tabnine: irToTabnine,
      jetbrains: irToJetbrains,
    };

    const generator = generatorMap[to] || generate[to];
    if (!generator) {
      throw new Error(`Unknown target platform: ${to}`);
    }

    const result = generator(ir, generateOptions);
    return { ir, result };
  },
};

/**
 * Validation
 */
export const validate = {
  ir: async ir => {
    const { validateIR } = await import('./types.js');
    return validateIR(ir);
  },
  bundle: async bundle => {
    const { validateIRBundle } = await import('./types.js');
    return validateIRBundle(bundle);
  },
  fileRefs: validateIRReferences,
};

/**
 * Workflow helpers
 */
export const workflow = {
  /**
   * Complete project import workflow
   * @param {string} projectPath - Project root path
   * @param {string} platform - Source platform
   * @returns {Promise<IRBundle>} Bundle of all project components
   */
  importProject: async (projectPath, platform) => {
    const { createIRBundle } = await import('./types.js');
    const fs = await import('node:fs');
    const path = await import('node:path');

    // Detect platform files
    const files = []; // TODO: Implement file discovery

    // Parse all files
    const irs = await batchProcess(
      files,
      async filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        return parse[platform]({ content, filePath });
      },
      { concurrency: 5 }
    );

    // Create bundle
    const components = irs.filter(r => r.success).map(r => r.result);
    return createIRBundle(path.basename(projectPath), components);
  },

  /**
   * Complete export workflow
   * @param {IRBundle} bundle - Bundle to export
   * @param {string[]} targetPlatforms - Target platforms
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Export results
   */
  exportProject: async (bundle, targetPlatforms, _outputDir) => {
    const results = {};

    for (const platform of targetPlatforms) {
      const platformResults = await generate.batch(bundle.components, platform);
      results[platform] = platformResults;

      // TODO: Write files to outputDir
    }

    return results;
  },
};

export default {
  // Parsers
  parseMarkdownContent,
  parseMarkdownSections,
  parseMDCContent,
  extractFileReferences,

  // Platform converters
  claudeToIR,
  cursorToIR,
  copilotToIR,
  windsurfToIR,
  autoConvertToIR,

  // Utilities
  detectPlatformFromPath,

  // Organized API
  parse,
  generate,
  fileRefs,
  performance,
  utils,
  convert,
  validate,
  workflow,
};
