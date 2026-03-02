/**
 * VDK IR File Reference Resolver
 * ================================
 *
 * Resolves file references (@path syntax) in IR content.
 * Handles:
 * - Relative and absolute path resolution
 * - Circular reference detection
 * - Recursion depth limits
 * - Missing file warnings
 * - Content inlining
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdownContent } from './index.js';

// ============================================================================
// Configuration
// ============================================================================

const MAX_RECURSION_DEPTH = 5;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * @typedef {Object} ResolverOptions
 * @property {string} baseDir - Base directory for relative paths
 * @property {number} [maxDepth] - Maximum recursion depth (default: 5)
 * @property {boolean} [followReferences] - Follow nested references (default: true)
 * @property {boolean} [inlineContent] - Inline file content (default: false)
 * @property {Set<string>} [visited] - Internally used for cycle detection
 */

/**
 * @typedef {Object} ResolvedReference
 * @property {string} path - Original reference path
 * @property {string} resolvedPath - Absolute resolved path
 * @property {boolean} exists - Whether the file exists
 * @property {string} [content] - File content (if inlineContent=true)
 * @property {Error} [error] - Error if resolution failed
 * @property {ResolvedReference[]} [nestedReferences] - Nested references (if followReferences=true)
 * @property {number} depth - Current depth in resolution tree
 */

// ============================================================================
// File Reference Resolver
// ============================================================================

/**
 * Resolve a single file reference
 * @param {string} referencePath - File reference path (e.g., 'docs/README.md')
 * @param {ResolverOptions} options - Resolution options
 * @returns {ResolvedReference}
 */
export function resolveFileReference(referencePath, options) {
  const {
    baseDir = process.cwd(),
    maxDepth = MAX_RECURSION_DEPTH,
    followReferences = true,
    inlineContent = false,
    visited = new Set(),
  } = options;

  const currentDepth = visited.size;

  // Check depth limit
  if (currentDepth >= maxDepth) {
    return {
      path: referencePath,
      resolvedPath: '',
      exists: false,
      error: new Error(`Maximum recursion depth (${maxDepth}) exceeded`),
      depth: currentDepth,
    };
  }

  // Resolve path
  const resolvedPath = path.isAbsolute(referencePath)
    ? referencePath
    : path.resolve(baseDir, referencePath);

  // Normalize path for cycle detection
  const normalizedPath = path.normalize(resolvedPath);

  // Check for circular reference
  if (visited.has(normalizedPath)) {
    return {
      path: referencePath,
      resolvedPath,
      exists: false,
      error: new Error(`Circular reference detected: ${referencePath}`),
      depth: currentDepth,
    };
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    return {
      path: referencePath,
      resolvedPath,
      exists: false,
      error: new Error(`File not found: ${resolvedPath}`),
      depth: currentDepth,
    };
  }

  // Check if it's a file
  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    return {
      path: referencePath,
      resolvedPath,
      exists: false,
      error: new Error(`Not a file: ${resolvedPath}`),
      depth: currentDepth,
    };
  }

  // Check file size
  if (stats.size > MAX_FILE_SIZE) {
    return {
      path: referencePath,
      resolvedPath,
      exists: true,
      error: new Error(`File too large (${stats.size} bytes): ${resolvedPath}`),
      depth: currentDepth,
    };
  }

  // Mark as visited
  const newVisited = new Set(visited);
  newVisited.add(normalizedPath);

  const result = {
    path: referencePath,
    resolvedPath,
    exists: true,
    depth: currentDepth,
  };

  // Read content if requested
  if (inlineContent) {
    try {
      result.content = fs.readFileSync(resolvedPath, 'utf8');

      // Follow nested references if requested
      if (followReferences && result.content) {
        const nestedRefs = extractFileReferences(result.content);
        if (nestedRefs.length > 0) {
          result.nestedReferences = nestedRefs.map(ref =>
            resolveFileReference(ref.path, {
              baseDir: path.dirname(resolvedPath),
              maxDepth,
              followReferences,
              inlineContent,
              visited: newVisited,
            })
          );
        }
      }
    } catch (error) {
      result.error = error;
    }
  }

  return result;
}

/**
 * Resolve all file references in content
 * @param {string} content - Content with @path references
 * @param {ResolverOptions} options - Resolution options
 * @returns {ResolvedReference[]}
 */
export function resolveAllReferences(content, options) {
  const references = extractFileReferences(content);
  return references.map(ref => resolveFileReference(ref.path, options));
}

/**
 * Resolve file references in IR
 * @param {IntermediateRepresentation} ir - IR with file references
 * @param {ResolverOptions} options - Resolution options
 * @returns {Object} Resolution results
 */
export function resolveIRReferences(ir, options) {
  if (!ir.fileReferences || ir.fileReferences.length === 0) {
    return {
      resolved: [],
      errors: [],
      warnings: [],
    };
  }

  const resolved = [];
  const errors = [];
  const warnings = [];

  for (const ref of ir.fileReferences) {
    const result = resolveFileReference(ref.path, options);
    resolved.push(result);

    if (result.error) {
      if (!result.exists) {
        errors.push({
          path: ref.path,
          message: result.error.message,
          type: 'not-found',
        });
      } else {
        warnings.push({
          path: ref.path,
          message: result.error.message,
          type: 'resolution-error',
        });
      }
    }

    // Check for circular references in nested
    if (result.nestedReferences) {
      for (const nested of result.nestedReferences) {
        if (nested.error?.message.includes('Circular reference')) {
          warnings.push({
            path: nested.path,
            message: `Circular reference from ${ref.path}`,
            type: 'circular',
          });
        }
      }
    }
  }

  return {
    resolved,
    errors,
    warnings,
  };
}

// Import shared file reference extraction
import { extractFileReferences as extractFileReferencesShared } from './index.js';

/**
 * Extract file references from content (uses shared implementation from index.js)
 * @param {string} content - Content to scan
 * @returns {Array<{path: string, type: string}>} Array of references
 */
function extractFileReferences(content) {
  return extractFileReferencesShared(content);
}

// ============================================================================
// Content Inlining
// ============================================================================

/**
 * Inline file references in content
 * @param {string} content - Content with @path references
 * @param {ResolverOptions} options - Resolution options
 * @returns {{content: string, warnings: Array, errors: Array}}
 */
export function inlineFileReferences(content, options) {
  const warnings = [];
  const errors = [];
  let inlinedContent = content;

  const references = extractFileReferences(content);

  for (const ref of references) {
    const resolved = resolveFileReference(ref.path, {
      ...options,
      inlineContent: true,
    });

    if (resolved.exists && resolved.content && !resolved.error) {
      // Replace @path with actual content
      const pattern = new RegExp(`@${escapeRegExp(ref.path)}`, 'g');
      inlinedContent = inlinedContent.replace(pattern, () => {
        // Add a comment about the inlined file
        return `<!-- Inlined from @${ref.path} -->\n${resolved.content}\n<!-- End of ${ref.path} -->`;
      });
    } else if (resolved.error) {
      if (!resolved.exists) {
        errors.push({
          path: ref.path,
          message: `File not found: ${ref.path}`,
        });
      } else {
        warnings.push({
          path: ref.path,
          message: resolved.error.message,
        });
      }
    }
  }

  return {
    content: inlinedContent,
    warnings,
    errors,
  };
}

/**
 * Inline file references in IR content
 * @param {IntermediateRepresentation} ir - IR to process
 * @param {ResolverOptions} options - Resolution options
 * @returns {IntermediateRepresentation} IR with inlined content
 */
export function inlineIRReferences(ir, options) {
  if (!ir.content?.raw) {
    return ir;
  }

  const { content, warnings, errors } = inlineFileReferences(ir.content.raw, options);

  // Update IR
  const updatedIR = {
    ...ir,
    content: {
      ...ir.content,
      raw: content,
      sections: parseMarkdownContent(content).sections,
    },
  };

  // Add warnings to conversion metadata
  if (warnings.length > 0 || errors.length > 0) {
    updatedIR.conversionMetadata = {
      ...ir.conversionMetadata,
      lossInfo: [
        ...(ir.conversionMetadata?.lossInfo || []),
        ...errors.map(e => ({
          field: 'fileReference',
          reason: e.message,
          originalValue: e.path,
          suggestion: 'Remove or fix the file reference',
        })),
      ],
    };
  }

  return updatedIR;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate all file references in IR
 * @param {IntermediateRepresentation} ir - IR to validate
 * @param {string} baseDir - Base directory for resolution
 * @returns {{valid: boolean, errors: Array, warnings: Array}}
 */
export function validateIRReferences(ir, baseDir) {
  const result = resolveIRReferences(ir, {
    baseDir,
    inlineContent: false,
    followReferences: false,
  });

  return {
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * Get reference resolution report
 * @param {IntermediateRepresentation} ir - IR to analyze
 * @param {string} baseDir - Base directory
 * @returns {Object} Detailed report
 */
export function getReferencesReport(ir, baseDir) {
  if (!ir.fileReferences || ir.fileReferences.length === 0) {
    return {
      totalReferences: 0,
      resolved: 0,
      missing: 0,
      circular: 0,
      errors: 0,
      details: [],
    };
  }

  const result = resolveIRReferences(ir, {
    baseDir,
    inlineContent: false,
    followReferences: true,
    maxDepth: MAX_RECURSION_DEPTH,
  });

  const report = {
    totalReferences: ir.fileReferences.length,
    resolved: 0,
    missing: 0,
    circular: 0,
    errors: 0,
    details: [],
  };

  for (const resolved of result.resolved) {
    const detail = {
      path: resolved.path,
      resolvedPath: resolved.resolvedPath,
      exists: resolved.exists,
      depth: resolved.depth,
    };

    if (resolved.exists && !resolved.error) {
      report.resolved++;
      detail.status = 'ok';
    } else if (!resolved.exists) {
      report.missing++;
      detail.status = 'missing';
      detail.error = resolved.error?.message;
    } else if (resolved.error?.message.includes('Circular')) {
      report.circular++;
      detail.status = 'circular';
      detail.error = resolved.error?.message;
    } else if (resolved.error) {
      report.errors++;
      detail.status = 'error';
      detail.error = resolved.error?.message;
    }

    report.details.push(detail);
  }

  return report;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  resolveFileReference,
  resolveAllReferences,
  resolveIRReferences,
  inlineFileReferences,
  inlineIRReferences,
  validateIRReferences,
  getReferencesReport,
};
