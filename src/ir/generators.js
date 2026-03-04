/**
 * VDK IR Generators
 * =================
 *
 * Generators convert IR to platform-specific output formats.
 * They handle platform constraints and track any information loss.
 */

import { calculateSemanticScore, trackConversionLoss } from './types.js';

// ============================================================================
// IR → Claude Code
// ============================================================================

/**
 * Generate Claude Code component from IR
 * @param {IntermediateRepresentation} ir - IR to convert
 * @param {Object} [options] - Generation options
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToClaude(ir, _options = {}) {
  const lossInfo = [];
  let content = '';
  let filePath = '';

  // Determine output path based on type
  const typeToDir = {
    agent: '.claude/agents',
    rule: '.claude/rules',
    command: '.claude/commands',
    skill: '.claude/skills',
    main: '',
    settings: '.claude',
  };

  const dir = typeToDir[ir.type] || '.claude/rules';
  const fileName =
    ir.type === 'main'
      ? 'CLAUDE.md'
      : ir.type === 'settings'
        ? 'settings.json'
        : `${sanitizeFileName(ir.name)}.md`;

  filePath = dir ? `${dir}/${fileName}` : fileName;

  // Handle settings as JSON
  if (ir.type === 'settings') {
    content = JSON.stringify(ir.platformSpecific?.['claude-code']?.settings || {}, null, 2);
    return { content, filePath, lossInfo };
  }

  // Build frontmatter
  const frontmatter = {};
  if (ir.description) frontmatter.description = ir.description;
  if (ir.triggers?.length) frontmatter.triggers = ir.triggers;
  if (ir.tools?.length) frontmatter.tools = ir.tools.map(t => t.name);
  if (ir.content?.frontmatter?.model) frontmatter.model = ir.content.frontmatter.model;

  // Generate content
  if (Object.keys(frontmatter).length > 0) {
    content += '---\n';
    content += Object.entries(frontmatter)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? `\n  - ${v.join('\n  - ')}` : v}`)
      .join('\n');
    content += '\n---\n\n';
  }

  // Add body content
  if (ir.content?.sections?.length) {
    content += ir.content.sections
      .map(s => {
        const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
        return heading + s.content;
      })
      .join('\n\n');
  } else if (ir.content?.raw) {
    // Fallback to raw content without frontmatter
    const rawWithoutFrontmatter = ir.content.hasFrontmatter
      ? ir.content.raw.replace(/^---[\s\S]*?---\s*/, '')
      : ir.content.raw;
    content += rawWithoutFrontmatter;
  }

  // Update conversion metadata
  const _updatedIR = {
    ...ir,
    conversionMetadata: {
      ...ir.conversionMetadata,
      targetPlatform: 'claude-code',
      lossInfo,
      semanticScore: calculateSemanticScore(ir, ir),
    },
  };

  return { content: content.trim(), filePath, lossInfo };
}

// ============================================================================
// IR → Cursor
// ============================================================================

/**
 * Generate Cursor rule from IR
 * @param {IntermediateRepresentation} ir - IR to convert
 * @param {Object} [options] - Generation options
 * @param {boolean} [options.useMDC=true] - Use MDC format for .cursor/rules/
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToCursor(ir, options = {}) {
  const { useMDC = true } = options;
  const lossInfo = trackConversionLoss(ir, ir, 'cursor');

  // Track agent conversion (Cursor doesn't support agents)
  if (ir.type === 'agent') {
    lossInfo.push({
      field: 'type',
      reason: 'Cursor does not support agents',
      originalValue: 'agent',
      suggestion: 'Converted to rule',
    });
  }

  let content = '';
  const filePath = `.cursor/rules/${sanitizeFileName(ir.name)}.mdc`;

  if (useMDC) {
    // Generate MDC format
    const frontmatter = {};
    if (ir.description) frontmatter.description = ir.description;
    if (ir.conditionalRules?.globs) frontmatter.globs = ir.conditionalRules.globs;
    if (ir.conditionalRules?.activation === 'always') {
      frontmatter.alwaysApply = true;
    }

    if (Object.keys(frontmatter).length > 0) {
      content += '---\n';
      content += Object.entries(frontmatter)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`;
          return `${k}: ${v}`;
        })
        .join('\n');
      content += '\n---\n\n';
    }
  }

  // Add body content
  if (ir.content?.sections?.length) {
    content += ir.content.sections
      .map(s => {
        const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
        return heading + s.content;
      })
      .join('\n\n');
  } else if (ir.content?.raw) {
    const rawWithoutFrontmatter = ir.content.hasFrontmatter
      ? ir.content.raw.replace(/^---[\s\S]*?---\s*/, '')
      : ir.content.raw;
    content += rawWithoutFrontmatter;
  }

  return { content: content.trim(), filePath, lossInfo };
}

// ============================================================================
// IR → GitHub Copilot
// ============================================================================

/**
 * Generate GitHub Copilot instructions from IR
 * @param {IntermediateRepresentation} ir - IR to convert
 * @param {Object} [options] - Generation options
 * @param {number} [options.maxLength=3000] - Maximum character length
 * @param {boolean} [options.priorityTruncation=true] - Use smart truncation
 * @returns {{content: string, filePath: string, lossInfo: Array, truncated: boolean}}
 */
export function irToCopilot(ir, options = {}) {
  const { maxLength = 3000, priorityTruncation = true } = options;
  const lossInfo = trackConversionLoss(ir, ir, 'github-copilot');
  let truncated = false;

  // Copilot doesn't support frontmatter
  let content = '';

  // Build content from sections
  if (ir.content?.sections?.length) {
    content = ir.content.sections
      .map(s => {
        const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
        return heading + s.content;
      })
      .join('\n\n');
  } else if (ir.content?.raw) {
    // Strip frontmatter if present
    content = ir.content.hasFrontmatter
      ? ir.content.raw.replace(/^---[\s\S]*?---\s*/, '')
      : ir.content.raw;
  }

  // Handle character limit
  if (content.length > maxLength) {
    truncated = true;
    lossInfo.push({
      field: 'content',
      reason: `GitHub Copilot has ${maxLength} character limit`,
      originalValue: `${content.length} characters`,
      suggestion: 'Content truncated with priority preservation',
    });

    if (priorityTruncation) {
      content = priorityTruncate(content, ir.content.sections, maxLength);
    } else {
      content = `${content.substring(0, maxLength - 3)}...`;
    }
  }

  return {
    content: content.trim(),
    filePath: '.github/copilot-instructions.md',
    lossInfo,
    truncated,
  };
}

/**
 * Smart truncation that prioritizes important sections
 * @param {string} content - Full content
 * @param {Array} sections - Parsed sections
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated content
 */
function priorityTruncate(content, sections, maxLength) {
  // Priority order for sections
  const highPriority = ['overview', 'important', 'critical', 'must', 'never'];
  const lowPriority = ['examples', 'notes', 'references', 'see also'];

  if (!sections?.length) {
    return `${content.substring(0, maxLength - 100)}\n\n[Content truncated due to character limit]`;
  }

  // Sort sections by priority
  const sortedSections = [...sections].sort((a, b) => {
    const aTitle = a.title?.toLowerCase() || '';
    const bTitle = b.title?.toLowerCase() || '';

    const aHighPriority = highPriority.some(p => aTitle.includes(p));
    const bHighPriority = highPriority.some(p => bTitle.includes(p));
    const aLowPriority = lowPriority.some(p => aTitle.includes(p));
    const bLowPriority = lowPriority.some(p => bTitle.includes(p));

    if (aHighPriority && !bHighPriority) return -1;
    if (!aHighPriority && bHighPriority) return 1;
    if (aLowPriority && !bLowPriority) return 1;
    if (!aLowPriority && bLowPriority) return -1;

    return 0;
  });

  // Build content up to limit
  let result = '';
  for (const section of sortedSections) {
    const heading = section.title ? `${'#'.repeat(section.level || 1)} ${section.title}\n\n` : '';
    const sectionContent = `${heading + section.content}\n\n`;

    if (result.length + sectionContent.length <= maxLength - 50) {
      result += sectionContent;
    } else if (result.length < maxLength - 100) {
      // Partial section add
      const remaining = maxLength - result.length - 100;
      result += `${sectionContent.substring(0, remaining)}...\n`;
      break;
    } else {
      break;
    }
  }

  result += '\n[Some content omitted due to character limit]';

  return result;
}

// ============================================================================
// IR → Windsurf
// ============================================================================

/**
 * Generate Windsurf rule from IR
 * @param {IntermediateRepresentation} ir - IR to convert
 * @param {Object} [options] - Generation options
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToWindsurf(ir, _options = {}) {
  const lossInfo = trackConversionLoss(ir, ir, 'windsurf');
  let content = '';

  // Windsurf uses a similar format to Cursor
  // Build frontmatter if needed
  const frontmatter = {};
  if (ir.description) frontmatter.description = ir.description;
  if (ir.conditionalRules?.globs) frontmatter.trigger = ir.conditionalRules.globs;

  if (Object.keys(frontmatter).length > 0) {
    content += '---\n';
    content += Object.entries(frontmatter)
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`;
        return `${k}: ${v}`;
      })
      .join('\n');
    content += '\n---\n\n';
  }

  // Add body content
  if (ir.content?.sections?.length) {
    content += ir.content.sections
      .map(s => {
        const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
        return heading + s.content;
      })
      .join('\n\n');
  } else if (ir.content?.raw) {
    const rawWithoutFrontmatter = ir.content.hasFrontmatter
      ? ir.content.raw.replace(/^---[\s\S]*?---\s*/, '')
      : ir.content.raw;
    content += rawWithoutFrontmatter;
  }

  const fileName = ir.type === 'workflow' ? 'workflow' : sanitizeFileName(ir.name);

  return {
    content: content.trim(),
    filePath: `.windsurf/rules/${fileName}.md`,
    lossInfo,
  };
}

// ============================================================================
// Batch Conversion
// ============================================================================

/**
 * Convert IR to multiple platforms at once
 * @param {IntermediateRepresentation} ir - IR to convert
 * @param {Array<PlatformId>} platforms - Target platforms
 * @param {Object} [options] - Platform-specific options
 * @returns {Object} Map of platform to {content, filePath, lossInfo}
 */
export function irToMultiplePlatforms(ir, platforms, options = {}) {
  const results = {};

  for (const platform of platforms) {
    switch (platform) {
      case 'claude-code':
        results['claude-code'] = irToClaude(ir, options['claude-code']);
        break;
      case 'cursor':
        results.cursor = irToCursor(ir, options.cursor);
        break;
      case 'github-copilot':
        results['github-copilot'] = irToCopilot(ir, options['github-copilot']);
        break;
      case 'windsurf':
        results.windsurf = irToWindsurf(ir, options.windsurf);
        break;
      default:
        // For unsupported platforms, use generic markdown
        results[platform] = {
          content: ir.content?.raw || '',
          filePath: `${sanitizeFileName(ir.name)}.md`,
          lossInfo: [
            {
              field: 'platform',
              reason: `${platform} is not fully supported`,
              originalValue: ir.conversionMetadata?.sourcePlatform,
              suggestion: 'Using generic markdown output',
            },
          ],
        };
    }
  }

  return results;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Sanitize a string for use as a filename
 * @param {string} name - Name to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default {
  irToClaude,
  irToCursor,
  irToCopilot,
  irToWindsurf,
  irToMultiplePlatforms,
  sanitizeFileName,
};
