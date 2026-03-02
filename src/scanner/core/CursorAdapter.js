/**
 * Cursor Adapter
 * ==============
 *
 * Adapts VDK rules and IR components for Cursor IDE.
 * Uses MDC format (.mdc) in .cursor/rules/.
 *
 * Cursor-specific features:
 * - MDC (Markdown with Components) format with YAML frontmatter
 * - Activation modes: auto-attached, agent-requested, manual, always
 * - Glob pattern matching for file-specific rules
 * - Directory-based rules in .cursor/rules/
 */

import path from 'node:path';
import fs from 'fs-extra';
import { irToCursor } from '../../ir/generators.js';
import { cursorToIR, parseMarkdownContent } from '../../ir/index.js';
import { createIR } from '../../ir/types.js';
import { RuleAdapter } from './RuleAdapter.js';

/**
 * Cursor IDE Adapter - MDC format and rules management
 */
export class CursorAdapter extends RuleAdapter {
  constructor(options = {}) {
    super(options);
    this.name = 'cursor';
    this.configDir = '.cursor';
    this.rulesDir = '.cursor/rules';
  }

  // ============================================================================
  // DETECTION
  // ============================================================================

  /**
   * Detect Cursor configuration in project
   * @param {string} projectPath - Project root path
   * @returns {Object} Detection result
   */
  async detectCursorUsage(projectPath) {
    const result = {
      detected: false,
      format: null,
      files: [],
      recommendations: [],
    };

    // Check for .cursor directory
    const cursorDir = path.join(projectPath, this.configDir);
    if (await fs.pathExists(cursorDir)) {
      result.detected = true;
      result.format = 'mdc';

      // List rules in .cursor/rules/
      const rulesDir = path.join(projectPath, this.rulesDir);
      if (await fs.pathExists(rulesDir)) {
        const files = await fs.readdir(rulesDir);
        result.files = files
          .filter(f => f.endsWith('.mdc') || f.endsWith('.md'))
          .map(f => path.join(this.rulesDir, f));
      }
    }

    return result;
  }

  // ============================================================================
  // IMPORT (Cursor → IR)
  // ============================================================================

  /**
   * Import all Cursor rules from a project to IR
   * @param {string} projectPath - Project root path
   * @returns {Promise<Array>} Array of IR components
   */
  async importAllToIR(projectPath) {
    const detection = await this.detectCursorUsage(projectPath);
    if (!detection.detected) {
      return [];
    }

    const components = [];

    for (const file of detection.files) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const ir = cursorToIR({ content, filePath });
      components.push(ir);
    }

    return components;
  }

  /**
   * Import single Cursor rule to IR
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Object} IR component
   */
  importToIR(content, filePath) {
    return cursorToIR({ content, filePath });
  }

  // ============================================================================
  // EXPORT (IR → Cursor)
  // ============================================================================

  /**
   * Generate Cursor rule from IR
   * @param {Object} ir - IR component
   * @param {Object} options - Generation options
   * @returns {Object} Generated content and path
   */
  generateFromIR(ir, options = {}) {
    return irToCursor(ir, {
      ...options,
      useMDC: true,
      singleFile: false,
    });
  }

  /**
   * Generate MDC content with proper frontmatter
   * @param {Object} options - Content options
   * @returns {string} MDC content
   */
  generateMDC({ name, description, content, globs = [], alwaysApply = false }) {
    const ir = createIR('rule', name);
    ir.description = description;
    ir.content = {
      raw: content,
      format: 'mdc',
      sections: parseMarkdownContent(content).sections,
      hasFrontmatter: false,
    };

    if (globs.length > 0) {
      ir.conditionalRules = {
        globs,
        activation: alwaysApply ? 'always' : 'path-based',
      };
    } else if (alwaysApply) {
      ir.conditionalRules = {
        activation: 'always',
      };
    }

    return irToCursor(ir, { useMDC: true });
  }

  // ============================================================================
  // ADAPTATION (Rules → Cursor Format)
  // ============================================================================

  /**
   * Adapt VDK rules for Cursor
   * @param {Array} rules - VDK rules
   * @param {Object} projectContext - Project context
   * @param {Object} options - Adaptation options
   * @returns {Object} Adapted Cursor configuration
   */
  async adaptForCursor(rules, projectContext, _options = {}) {
    const result = {
      files: [],
      summary: {
        totalRules: rules.length,
        mdcRules: 0,
      },
    };

    // Group rules by their target (file-specific vs global)
    const { globalRules, fileRules } = this.categorizeRules(rules);

    // Generate MDC files for file-specific rules
    for (const rule of fileRules) {
      const ir = this.ruleToIR(rule);
      const generated = irToCursor(ir, { useMDC: true });

      result.files.push({
        path: generated.filePath,
        content: generated.content,
        type: 'mdc',
      });
      result.summary.mdcRules++;
    }

    // Generate global rules as MDC
    if (globalRules.length > 0) {
      const combinedContent = this.combineRulesToMarkdown(globalRules, projectContext);
      const ir = createIR('rule', 'global-rules');
      ir.content = parseMarkdownContent(combinedContent);
      ir.conditionalRules = { activation: 'always' };

      const generated = irToCursor(ir, {
        useMDC: true,
        singleFile: false,
      });

      result.files.push({
        path: generated.filePath,
        content: generated.content,
        type: 'mdc',
      });

      result.summary.mdcRules++;
    }

    return result;
  }

  /**
   * Categorize rules into global and file-specific
   * @param {Array} rules - Rules to categorize
   * @returns {Object} Categorized rules
   */
  categorizeRules(rules) {
    const globalRules = [];
    const fileRules = [];

    for (const rule of rules) {
      if (rule.globs?.length > 0 || rule.paths?.length > 0) {
        fileRules.push(rule);
      } else {
        globalRules.push(rule);
      }
    }

    return { globalRules, fileRules };
  }

  /**
   * Convert a VDK rule to IR
   * @param {Object} rule - VDK rule
   * @returns {Object} IR component
   */
  ruleToIR(rule) {
    const ir = createIR('rule', rule.id || rule.title || 'rule');
    ir.description = rule.description || '';
    ir.content = {
      raw: rule.content || '',
      format: 'markdown',
      sections: rule.sections || [],
      hasFrontmatter: false,
    };

    if (rule.globs || rule.paths) {
      ir.conditionalRules = {
        globs: rule.globs || rule.paths,
        activation: 'path-based',
      };
    }

    ir.tags = rule.tags || [];

    return ir;
  }

  /**
   * Combine multiple rules into single markdown content
   * @param {Array} rules - Rules to combine
   * @param {Object} projectContext - Project context
   * @returns {string} Combined markdown
   */
  combineRulesToMarkdown(rules, projectContext) {
    let content = `# ${projectContext.name} Development Guidelines\n\n`;
    content += `**Framework**: ${projectContext.framework || 'N/A'} | **Language**: ${projectContext.language || 'N/A'}\n\n`;

    for (const rule of rules) {
      const ruleTitle = rule.title || rule.id || 'Rule';
      content += `## ${ruleTitle}\n\n`;
      content += rule.content || rule.description || '';
      content += '\n\n';
    }

    return content.trim();
  }

  // ============================================================================
  // DEPLOYMENT
  // ============================================================================

  /**
   * Deploy Cursor configuration to project
   * @param {string} projectPath - Project root
   * @param {Object} adapted - Adapted configuration
   * @returns {Promise<Object>} Deployment result
   */
  async deploy(projectPath, adapted) {
    const result = {
      success: true,
      filesCreated: [],
      errors: [],
    };

    try {
      // Ensure .cursor/rules directory exists
      const rulesDir = path.join(projectPath, this.rulesDir);
      await fs.ensureDir(rulesDir);

      // Write each file
      for (const file of adapted.files) {
        const fullPath = path.join(projectPath, file.path);

        // Ensure parent directory exists
        await fs.ensureDir(path.dirname(fullPath));

        await fs.writeFile(fullPath, file.content, 'utf-8');
        result.filesCreated.push(file.path);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    return result;
  }

  // ============================================================================
  // ACTIVATION MODES
  // ============================================================================

  /**
   * Get activation mode for a rule based on its characteristics
   * @param {Object} rule - Rule to analyze
   * @returns {string} Activation mode
   */
  getActivationMode(rule) {
    // Agent-requested: complex rules that need AI decision
    if (rule.complexity === 'advanced' || rule.type === 'agent') {
      return 'agent-requested';
    }

    // Auto-attached: file-specific rules
    if (rule.globs?.length > 0 || rule.paths?.length > 0) {
      return 'auto-attached';
    }

    // Always: global project rules
    if (rule.scope === 'project' || rule.alwaysApply) {
      return 'always';
    }

    // Manual: everything else
    return 'manual';
  }

  /**
   * Get supported activation modes
   * @returns {Object} Activation mode definitions
   */
  static getActivationModes() {
    return {
      'auto-attached': {
        description: 'Automatically included when matching files are referenced',
        useCase: 'File-type specific rules (e.g., TypeScript, React)',
        requiresGlobs: true,
      },
      'agent-requested': {
        description: 'AI decides when to include based on context',
        useCase: 'Complex or specialized rules',
        requiresGlobs: false,
      },
      manual: {
        description: 'User must explicitly request',
        useCase: 'Rarely needed rules',
        requiresGlobs: false,
      },
      always: {
        description: 'Always included in context',
        useCase: 'Core project guidelines',
        requiresGlobs: false,
      },
    };
  }
}

export default CursorAdapter;
