/**
 * Windsurf Adapter
 * ================
 *
 * Adapts VDK rules and IR components for Windsurf IDE (Codeium).
 *
 * Windsurf-specific features:
 * - Cascade agent with workflow-based procedures
 * - Rules with glob pattern triggers
 * - Markdown format with YAML frontmatter
 * - Workflow/procedure support
 */

import path from 'node:path';
import fs from 'fs-extra';
import { irToWindsurf, sanitizeFileName } from '../../ir/generators.js';
import { parseMarkdownContent, windsurfToIR } from '../../ir/index.js';
import { createIR } from '../../ir/types.js';
import { RuleAdapter } from './RuleAdapter.js';

/**
 * Windsurf IDE Adapter - Cascade agent and workflow support
 */
export class WindsurfAdapter extends RuleAdapter {
  constructor(options = {}) {
    super(options);
    this.name = 'windsurf';
    this.configDir = '.windsurf';
    this.rulesDir = '.windsurf/rules';
  }

  // ============================================================================
  // DETECTION
  // ============================================================================

  /**
   * Detect Windsurf configuration in project
   * @param {string} projectPath - Project root path
   * @returns {Object} Detection result
   */
  async detectWindsurfUsage(projectPath) {
    const result = {
      detected: false,
      files: [],
      hasWorkflows: false,
      recommendations: [],
    };

    // Check for .windsurf directory
    const windsurfDir = path.join(projectPath, this.configDir);
    if (await fs.pathExists(windsurfDir)) {
      result.detected = true;

      // List rules
      const rulesDir = path.join(projectPath, this.rulesDir);
      if (await fs.pathExists(rulesDir)) {
        const files = await fs.readdir(rulesDir);
        result.files = files.filter(f => f.endsWith('.md')).map(f => path.join(this.rulesDir, f));

        // Check for workflow files
        result.hasWorkflows = files.some(f => f.includes('workflow') || f.includes('procedure'));
      }
    }

    return result;
  }

  // ============================================================================
  // IMPORT (Windsurf → IR)
  // ============================================================================

  /**
   * Import Windsurf rule to IR
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Object} IR component
   */
  importToIR(content, filePath) {
    return windsurfToIR({ content, filePath });
  }

  /**
   * Import all Windsurf rules from project
   * @param {string} projectPath - Project root
   * @returns {Promise<Array>} Array of IR components
   */
  async importAllToIR(projectPath) {
    const detection = await this.detectWindsurfUsage(projectPath);
    if (!detection.detected) {
      return [];
    }

    const components = [];
    for (const file of detection.files) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const ir = windsurfToIR({ content, filePath });
      components.push(ir);
    }

    return components;
  }

  // ============================================================================
  // EXPORT (IR → Windsurf)
  // ============================================================================

  /**
   * Generate Windsurf rule from IR
   * @param {Object} ir - IR component
   * @param {Object} options - Generation options
   * @returns {Object} Generated content and path
   */
  generateFromIR(ir, options = {}) {
    return irToWindsurf(ir, options);
  }

  // ============================================================================
  // ADAPTATION (Rules → Windsurf Format)
  // ============================================================================

  /**
   * Adapt VDK rules for Windsurf
   * @param {Array} rules - VDK rules
   * @param {Object} projectContext - Project context
   * @param {Object} options - Adaptation options
   * @returns {Object} Adapted Windsurf configuration
   */
  async adaptForWindsurf(rules, projectContext, _options = {}) {
    const result = {
      files: [],
      summary: {
        totalRules: rules.length,
        ruleFiles: 0,
        workflowFiles: 0,
      },
    };

    // Separate rules and workflows
    const { regularRules, workflows } = this.categorizeByType(rules);

    // Generate rule files
    for (const rule of regularRules) {
      const ir = this.ruleToIR(rule);
      const generated = irToWindsurf(ir);

      result.files.push({
        path: generated.filePath,
        content: generated.content,
        type: 'rule',
      });
      result.summary.ruleFiles++;
    }

    // Generate workflow files
    for (const workflow of workflows) {
      const ir = this.workflowToIR(workflow);
      const generated = irToWindsurf(ir);

      result.files.push({
        path: generated.filePath,
        content: generated.content,
        type: 'workflow',
      });
      result.summary.workflowFiles++;
    }

    // Generate global rules if no specific files
    if (result.files.length === 0 && rules.length > 0) {
      const combinedContent = this.combineRulesToMarkdown(rules, projectContext);
      result.files.push({
        path: `${this.rulesDir}/global-rules.md`,
        content: combinedContent,
        type: 'rule',
      });
      result.summary.ruleFiles++;
    }

    return result;
  }

  /**
   * Categorize rules by type (regular vs workflow)
   * @param {Array} rules - Rules to categorize
   * @returns {Object} Categorized rules
   */
  categorizeByType(rules) {
    const regularRules = [];
    const workflows = [];

    for (const rule of rules) {
      const content = (rule.content || '').toLowerCase();
      const title = (rule.title || '').toLowerCase();

      if (
        content.includes('workflow') ||
        content.includes('procedure') ||
        content.includes('steps:') ||
        title.includes('workflow')
      ) {
        workflows.push(rule);
      } else {
        regularRules.push(rule);
      }
    }

    return { regularRules, workflows };
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
      sections: rule.sections || parseMarkdownContent(rule.content || '').sections,
      hasFrontmatter: false,
    };

    if (rule.globs || rule.trigger) {
      ir.conditionalRules = {
        globs: rule.globs || (rule.trigger ? [rule.trigger] : []),
        activation: 'path-based',
      };
    }

    ir.tags = rule.tags || [];
    return ir;
  }

  /**
   * Convert a workflow to IR
   * @param {Object} workflow - Workflow definition
   * @returns {Object} IR component
   */
  workflowToIR(workflow) {
    const ir = createIR('workflow', workflow.id || workflow.title || 'workflow');
    ir.description = workflow.description || '';
    ir.content = {
      raw: workflow.content || '',
      format: 'markdown',
      sections: workflow.sections || parseMarkdownContent(workflow.content || '').sections,
      hasFrontmatter: false,
    };

    ir.triggers = workflow.triggers || [];
    ir.tags = workflow.tags || [];

    return ir;
  }

  /**
   * Combine multiple rules into markdown
   * @param {Array} rules - Rules to combine
   * @param {Object} projectContext - Project context
   * @returns {string} Combined markdown
   */
  combineRulesToMarkdown(rules, projectContext) {
    let content = `# ${projectContext.name} - Windsurf Rules\n\n`;
    content += `**Framework**: ${projectContext.framework || 'N/A'} | **Language**: ${projectContext.language || 'N/A'}\n\n`;

    for (const rule of rules) {
      const title = rule.title || rule.id || 'Rule';
      content += `## ${title}\n\n`;

      if (rule.description) {
        content += `${rule.description}\n\n`;
      }

      if (rule.content) {
        const ruleContent = rule.content.replace(/^---[\s\S]*?---\s*/, '');
        content += `${ruleContent}\n\n`;
      }
    }

    return content.trim();
  }

  // ============================================================================
  // WORKFLOW GENERATION
  // ============================================================================

  /**
   * Generate a Cascade workflow
   * @param {Object} options - Workflow options
   * @returns {Object} Generated workflow
   */
  generateWorkflow({ name, description, steps, triggers = [] }) {
    let content = `---\nname: ${name}\ndescription: ${description}\n`;

    if (triggers.length > 0) {
      content += `triggers:\n${triggers.map(t => `  - ${t}`).join('\n')}\n`;
    }

    content += `---\n\n# ${name}\n\n${description}\n\n## Steps\n\n`;

    steps.forEach((step, index) => {
      content += `### Step ${index + 1}: ${step.title || 'Step'}\n\n`;
      content += `${step.description || step.content || ''}\n\n`;

      if (step.commands) {
        content += '```bash\n';
        content += step.commands.join('\n');
        content += '\n```\n\n';
      }
    });

    return {
      path: `${this.rulesDir}/${sanitizeFileName(name)}-workflow.md`,
      content,
      type: 'workflow',
    };
  }

  // ============================================================================
  // DEPLOYMENT
  // ============================================================================

  /**
   * Deploy Windsurf configuration to project
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
      // Ensure rules directory exists
      const rulesDir = path.join(projectPath, this.rulesDir);
      await fs.ensureDir(rulesDir);

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

  /**
   * Get Windsurf features information
   * @returns {Object} Feature details
   */
  static getFeatures() {
    return {
      cascadeAgent: {
        description: 'AI agent with autonomous workflow execution',
        capabilities: ['Multi-file editing', 'Command execution', 'Context awareness'],
      },
      rules: {
        location: '.windsurf/rules/',
        format: 'Markdown with YAML frontmatter',
        globSupport: true,
      },
      workflows: {
        description: 'Procedural task automation',
        triggers: ['Manual', 'File pattern', 'Command'],
      },
    };
  }
}

export default WindsurfAdapter;
