/**
 * GitHub Copilot Adapter
 * ======================
 *
 * Adapts VDK rules and IR components for GitHub Copilot.
 *
 * Copilot-specific constraints:
 * - 3,000 character limit per instruction level
 * - No native agent/command support
 * - Multi-level hierarchy: org → repo → directory
 * - Markdown format only
 */

import path from 'node:path';
import fs from 'fs-extra';
import { irToCopilot } from '../../ir/generators.js';
import { copilotToIR } from '../../ir/index.js';
import { RuleAdapter } from './RuleAdapter.js';

/**
 * GitHub Copilot Adapter - Character-limited instructions
 */
export class CopilotAdapter extends RuleAdapter {
  constructor(options = {}) {
    super(options);
    this.name = 'github-copilot';
    this.configDir = '.github';
    this.mainFile = '.github/copilot-instructions.md';

    // Copilot constraints
    this.constraints = {
      maxCharsPerLevel: 3000,
      supportedLevels: ['organization', 'repository', 'directory'],
      format: 'markdown',
    };
  }

  // ============================================================================
  // DETECTION
  // ============================================================================

  /**
   * Detect Copilot configuration in project
   * @param {string} projectPath - Project root path
   * @returns {Object} Detection result
   */
  async detectCopilotUsage(projectPath) {
    const result = {
      detected: false,
      files: [],
      characterCount: 0,
      withinLimit: true,
      recommendations: [],
    };

    // Check for repo-level instructions
    const mainPath = path.join(projectPath, this.mainFile);
    if (await fs.pathExists(mainPath)) {
      result.detected = true;
      result.files.push(this.mainFile);

      const content = await fs.readFile(mainPath, 'utf-8');
      result.characterCount = content.length;
      result.withinLimit = content.length <= this.constraints.maxCharsPerLevel;

      if (!result.withinLimit) {
        result.recommendations.push(
          `Instructions exceed ${this.constraints.maxCharsPerLevel} character limit (${content.length} chars). Consider splitting into directory-level instructions.`
        );
      }
    }

    // Check for directory-level instructions
    const directories = await this.findDirectoryInstructions(projectPath);
    result.files.push(...directories);

    return result;
  }

  /**
   * Find directory-level copilot instructions
   * @param {string} projectPath - Project root
   * @returns {Promise<Array>} List of instruction files
   */
  async findDirectoryInstructions(projectPath) {
    const files = [];
    const walkDir = async (dir, depth = 0) => {
      if (depth > 5) return; // Limit depth

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            const instructionPath = path.join(
              dir,
              entry.name,
              '.github',
              'copilot-instructions.md'
            );
            if (await fs.pathExists(instructionPath)) {
              files.push(path.relative(projectPath, instructionPath));
            }
            await walkDir(path.join(dir, entry.name), depth + 1);
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    await walkDir(projectPath);
    return files;
  }

  // ============================================================================
  // IMPORT (Copilot → IR)
  // ============================================================================

  /**
   * Import Copilot instructions to IR
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Object} IR component
   */
  importToIR(content, filePath) {
    return copilotToIR({ content, filePath });
  }

  /**
   * Import all Copilot instructions from project
   * @param {string} projectPath - Project root
   * @returns {Promise<Array>} Array of IR components
   */
  async importAllToIR(projectPath) {
    const detection = await this.detectCopilotUsage(projectPath);
    if (!detection.detected) {
      return [];
    }

    const components = [];
    for (const file of detection.files) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const ir = copilotToIR({ content, filePath });
      components.push(ir);
    }

    return components;
  }

  // ============================================================================
  // EXPORT (IR → Copilot)
  // ============================================================================

  /**
   * Generate Copilot instructions from IR
   * @param {Object} ir - IR component
   * @param {Object} options - Generation options
   * @returns {Object} Generated content with truncation info
   */
  generateFromIR(ir, options = {}) {
    return irToCopilot(ir, {
      maxLength: options.maxLength || this.constraints.maxCharsPerLevel,
      priorityTruncation: options.priorityTruncation !== false,
      ...options,
    });
  }

  // ============================================================================
  // ADAPTATION (Rules → Copilot Format)
  // ============================================================================

  /**
   * Adapt VDK rules for Copilot with smart truncation
   * @param {Array} rules - VDK rules
   * @param {Object} projectContext - Project context
   * @param {Object} options - Adaptation options
   * @returns {Object} Adapted Copilot configuration
   */
  async adaptForCopilot(rules, projectContext, _options = {}) {
    const result = {
      files: [],
      summary: {
        totalRules: rules.length,
        includedRules: 0,
        truncated: false,
        originalLength: 0,
        finalLength: 0,
      },
      lossInfo: [],
    };

    // Prioritize and score rules
    const prioritizedRules = this.prioritizeRules(rules, projectContext);

    // Build content within character limit
    const { content, includedRules, lossInfo } = this.buildConstrainedContent(
      prioritizedRules,
      projectContext,
      this.constraints.maxCharsPerLevel
    );

    result.summary.includedRules = includedRules;
    result.summary.originalLength = this.calculateTotalLength(rules);
    result.summary.finalLength = content.length;
    result.summary.truncated = includedRules < rules.length;
    result.lossInfo = lossInfo;

    result.files.push({
      path: this.mainFile,
      content,
      type: 'copilot-instructions',
    });

    return result;
  }

  /**
   * Prioritize rules for inclusion
   * @param {Array} rules - Rules to prioritize
   * @param {Object} projectContext - Project context
   * @returns {Array} Prioritized rules
   */
  prioritizeRules(rules, projectContext) {
    return [...rules].toSorted((a, b) => {
      // Critical/important rules first
      const priorityScore = rule => {
        let score = 0;
        const content = (rule.content || '').toLowerCase();

        if (content.includes('must') || content.includes('never')) score += 10;
        if (content.includes('critical') || content.includes('important')) score += 8;
        if (content.includes('security') || content.includes('error')) score += 7;
        if (rule.priority === 'high') score += 5;
        if (rule.scope === 'project') score += 3;

        // Framework-specific rules get priority
        if (projectContext.framework && content.includes(projectContext.framework.toLowerCase())) {
          score += 5;
        }

        return score;
      };

      return priorityScore(b) - priorityScore(a);
    });
  }

  /**
   * Build content within character limit
   * @param {Array} rules - Prioritized rules
   * @param {Object} projectContext - Project context
   * @param {number} maxLength - Maximum character count
   * @returns {Object} Content and metadata
   */
  buildConstrainedContent(rules, projectContext, maxLength) {
    const header = `# ${projectContext.name} - Development Guidelines\n\n`;
    const footer = '\n\n---\n*Generated by VDK*\n';
    const reservedLength = header.length + footer.length + 100; // Buffer
    const _availableLength = maxLength - reservedLength;

    let content = header;
    let includedRules = 0;
    const lossInfo = [];

    for (const rule of rules) {
      const ruleContent = this.formatRuleForCopilot(rule);

      if (content.length + ruleContent.length <= maxLength - footer.length) {
        content += ruleContent;
        includedRules++;
      } else {
        // Track what was excluded
        lossInfo.push({
          field: 'rule',
          reason: 'Character limit exceeded',
          originalValue: rule.title || rule.id || 'Untitled rule',
          suggestion: 'Consider using directory-level instructions',
        });
      }
    }

    // Add truncation notice if needed
    if (lossInfo.length > 0) {
      content += `\n\n> Note: ${lossInfo.length} rule(s) omitted due to character limit.\n`;
    }

    return { content: content.trim(), includedRules, lossInfo };
  }

  /**
   * Format a single rule for Copilot
   * @param {Object} rule - Rule to format
   * @returns {string} Formatted content
   */
  formatRuleForCopilot(rule) {
    let content = '';
    const title = rule.title || rule.id || 'Guidelines';

    content += `## ${title}\n\n`;

    if (rule.description) {
      content += `${rule.description}\n\n`;
    }

    if (rule.content) {
      // Strip frontmatter if present
      const ruleContent = rule.content.replace(/^---[\s\S]*?---\s*/, '');
      content += `${ruleContent}\n\n`;
    }

    return content;
  }

  /**
   * Calculate total content length
   * @param {Array} rules - Rules to measure
   * @returns {number} Total character count
   */
  calculateTotalLength(rules) {
    return rules.reduce((total, rule) => {
      return total + (rule.content?.length || 0) + (rule.description?.length || 0) + 100;
    }, 0);
  }

  // ============================================================================
  // DEPLOYMENT
  // ============================================================================

  /**
   * Deploy Copilot instructions to project
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
      for (const file of adapted.files) {
        const fullPath = path.join(projectPath, file.path);
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
  // VALIDATION
  // ============================================================================

  /**
   * Validate Copilot instructions
   * @param {string} content - Content to validate
   * @returns {Object} Validation result
   */
  validate(content) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      metrics: {
        characterCount: content.length,
        limit: this.constraints.maxCharsPerLevel,
        usage: Math.round((content.length / this.constraints.maxCharsPerLevel) * 100),
      },
    };

    if (content.length > this.constraints.maxCharsPerLevel) {
      result.valid = false;
      result.errors.push(
        `Content exceeds ${this.constraints.maxCharsPerLevel} character limit (${content.length} chars)`
      );
    }

    if (content.length > this.constraints.maxCharsPerLevel * 0.9) {
      result.warnings.push(`Content is at ${result.metrics.usage}% of character limit`);
    }

    return result;
  }

  /**
   * Get Copilot constraints information
   * @returns {Object} Constraint details
   */
  static getConstraints() {
    return {
      maxCharsPerLevel: 3000,
      levels: {
        organization: 'Applies to all repos in org (GitHub Enterprise)',
        repository: 'Applies to entire repo (.github/copilot-instructions.md)',
        directory: 'Applies to specific directory',
      },
      format: 'Markdown only',
      features: {
        agents: false,
        commands: false,
        skills: false,
        conditionalRules: false,
        fileReferences: false,
      },
    };
  }
}

export default CopilotAdapter;
