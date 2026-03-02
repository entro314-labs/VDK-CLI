/**
 * VDK IR System - Enhanced Unified Export
 * ========================================
 *
 * This file provides a unified interface to the complete VDK IR system,
 * including all base and extended platform support, file resolution,
 * and performance optimizations.
 *
 * Usage:
 *   import IR from './ir/index-enhanced.js';
 *
 *   const ir = IR.parse.claude({ content, filePath });
 *   const result = IR.generate.cursor(ir);
 *   IR.performance.clearCaches();
 */

// Core types and validation
export * from './types.js';

// Extended platform converters
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
// File reference resolution
import {
  getReferencesReport,
  inlineFileReferences,
  inlineIRReferences,
  resolveAllReferences,
  resolveFileReference,
  resolveIRReferences,
  validateIRReferences,
} from './file-resolver.js';
// Base platform generators
import {
  irToClaude,
  irToCopilot,
  irToCursor,
  irToMultiplePlatforms,
  irToWindsurf,
  sanitizeFileName,
} from './generators.js';
// Base platform parsers
import {
  autoConvertToIR,
  claudeToIR,
  copilotToIR,
  cursorToIR,
  detectPlatformFromPath,
  extractFileReferences,
  parseMarkdownContent,
  parseMarkdownSections,
  parseMDCContent,
  windsurfToIR,
} from './index.js';

// Performance optimizations
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

// ============================================================================
// Organized API Surface
// ============================================================================

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
  // File size checking
  checkSize: checkFileSize,
  readLarge: readLargeFile,

  // Batch processing
  batch: batchProcess,

  // Memory
  memory: getMemoryUsage,
  checkMemoryLimit,

  // Cache management
  clearCaches,
  stats: getCacheStats,
  prune: pruneCaches,

  // Measurement
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
 * Conversion helpers
 */
export const convert = {
  /**
   * Convert from one platform to another
   * @param {Object} options
   * @param {string} options.from - Source platform
   * @param {string} options.to - Target platform
   * @param {string} options.content - Content to convert
   * @param {string} options.filePath - Source file path
   * @param {Object} [options.parseOptions] - Parser options
   * @param {Object} [options.generateOptions] - Generator options
   * @returns {{ir: IntermediateRepresentation, result: Object}}
   */
  fromTo: ({ from, to, content, filePath, parseOptions = {}, generateOptions = {} }) => {
    // Parse to IR
    const parser = parse[from] || parse.auto;
    const ir = parser({ content, filePath, ...parseOptions });

    // Platform ID mapping (full names to short keys)
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

    // Generate target
    const generator = generatorMap[to] || generate[to];
    if (!generator) {
      throw new Error(`Unknown target platform: ${to}`);
    }

    const result = generator(ir, generateOptions);

    return { ir, result };
  },

  /**
   * Round-trip conversion test
   * @param {string} platform - Platform to test
   * @param {string} content - Original content
   * @param {string} filePath - File path
   * @returns {Object} Round-trip test results
   */
  roundTrip: async (platform, content, filePath) => {
    const { calculateSemanticScore } = await import('./types.js');

    // Parse to IR
    const originalIR = parse[platform]({ content, filePath });

    // Generate back
    const { content: generatedContent } = generate[platform](originalIR);

    // Parse generated content
    const roundTripIR = parse[platform]({ content: generatedContent, filePath });

    // Calculate semantic score
    const semanticScore = calculateSemanticScore(originalIR, roundTripIR);

    return {
      originalIR,
      generatedContent,
      roundTripIR,
      semanticScore,
      passed: semanticScore >= 95,
    };
  },

  /**
   * Convert and track losses
   * @param {Object} options - Conversion options
   * @returns {Object} Conversion results with detailed loss tracking
   */
  withTracking: async ({ from, to, content, filePath }) => {
    const { trackConversionLoss, calculateSemanticScore } = await import('./types.js');

    const { ir, result } = convert.fromTo({ from, to, content, filePath });

    // Additional loss tracking
    const lossInfo = trackConversionLoss(ir, ir, to);

    return {
      ir,
      result: {
        ...result,
        lossInfo: [...(result.lossInfo || []), ...lossInfo],
      },
      semanticScore: calculateSemanticScore(ir, ir),
    };
  },
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

// ============================================================================
// Default Export (Organized API)
// ============================================================================

export default {
  parse,
  generate,
  fileRefs,
  performance,
  utils,
  validate,
  convert,
  workflow,
};
