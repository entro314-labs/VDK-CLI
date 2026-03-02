/**
 * PlatformConstraintValidator
 * ---------------------------
 * Validates and enforces platform-specific constraints for blueprint deployment.
 * Based on technical specifications from vdk-ecosystem-technical-analysis.md
 */

import chalk from 'chalk';

export class PlatformConstraintValidator {
  constructor(options = {}) {
    this.verbose = options.verbose;
    this.constraints = this.initializeConstraints();
  }

  /**
   * Initialize platform-specific constraints
   * Source: vdk-ecosystem-technical-analysis.md
   */
  initializeConstraints() {
    return {
      'claude-code': {
        main: {
          maxFileSize: null, // No hard limit
          fileReferences: {
            maxDepth: 5,
            syntax: '@path/to/file.md',
          },
        },
        agents: {
          requiredFields: ['name', 'description'],
          supportedTools: ['Read', 'Write', 'Grep', 'Glob', 'Bash'],
          supportedModels: ['opus', 'sonnet', 'haiku'],
          triggers: ['PROACTIVELY'], // Keyword for auto-delegation
        },
        rules: {
          requiredFrontmatter: ['paths'],
          globPattern: 'minimatch',
        },
        commands: {
          requiredFrontmatter: ['description'],
          argumentSyntax: '$1, $2, etc.',
          bashExecution: '!command',
        },
        skills: {
          requiredFrontmatter: ['name', 'description'],
        },
      },

      'github-copilot': {
        'org-level': {
          maxChars: 3000,
          format: 'markdown',
          fileReferences: false, // Must inline content
        },
        'repo-level': {
          maxChars: 3000,
          format: 'markdown',
          location: '.github/copilot-instructions.md',
        },
        'directory-level': {
          maxChars: 3000,
          format: 'markdown',
          location: '<dir>/.github/copilot-instructions.md',
        },
        conditional: {
          frontmatter: ['applyTo', 'excludeAgent'],
          applyToSyntax: 'glob patterns',
        },
        totalLimit: {
          maxChars: 6000, // Combined across all levels
        },
      },

      cursor: {
        rules: {
          location: '.cursor/rules/',
          format: 'mdc', // Markdown Components
          frontmatter: ['description', 'globs', 'alwaysApply'],
          activationModes: ['alwaysApply', 'globs', 'description', 'manual'],
          globPattern: 'minimatch',
          fileReferences: '@path/to/file',
        },
      },

      windsurf: {
        rules: {
          location: '.windsurf/rules/',
          format: 'markdown',
          frontmatter: ['globs', 'mode'],
          modes: ['glob', 'always', 'manual'],
          combinedLimit: {
            maxChars: 12000, // Global + local combined
          },
        },
        workflows: {
          location: '.windsurf/workflows/',
          format: 'yaml',
          requiredFields: ['name', 'description', 'steps'],
          triggers: ['manual', 'on_commit'],
        },
      },

      continue: {
        config: {
          location: '~/.continue/config.yaml',
          format: 'yaml',
          scope: 'user-wide', // No project-level by default
          sections: ['models', 'contextProviders', 'slashCommands', 'mcpServers'],
        },
        commands: {
          location: '~/.continue/prompts/',
          format: 'txt',
        },
      },

      aider: {
        config: {
          location: '.aider.conf.yml',
          format: 'yaml',
          hierarchy: ['default', 'user', 'git-root', 'current-dir', 'env', 'cli'],
          sections: ['model', 'git', 'lint-cmd', 'test-cmd', 'read'],
        },
        ignore: {
          location: '.aiderignore',
          format: 'gitignore',
        },
      },

      'openai-codex': {
        agents: {
          location: 'AGENTS.md',
          format: 'markdown',
          naturalLanguage: true, // No structured frontmatter
          sections: ['Role', 'Expertise', 'Responsibilities', 'Tools', 'Constraints'],
        },
        agentFiles: {
          location: '.agents/',
          format: 'markdown',
        },
        config: {
          location: '.openai/config.toml',
          format: 'toml',
        },
      },

      'gemini-cli': {
        main: {
          location: 'GEMINI.md',
          format: 'markdown',
          importSyntax: '@.gemini/context/file.md',
          maxImportDepth: 10,
        },
        context: {
          location: '.gemini/context/',
          format: 'markdown',
        },
        settings: {
          location: '.gemini/settings.json',
          format: 'json',
          requiredFields: ['model', 'temperature'],
        },
      },

      'jetbrains-ai': {
        ignore: {
          location: '.aiignore',
          format: 'gitignore',
        },
        config: {
          location: 'IDE settings UI',
          portable: false, // Not file-based
        },
      },

      zed: {
        config: {
          location: '~/.config/zed/settings.json',
          format: 'json',
          scope: 'user-wide',
        },
      },

      tabnine: {
        guidelines: {
          location: '.tabnine/guidelines/',
          format: 'markdown',
        },
        mcp: {
          location: '.tabnine/mcp_servers.json',
          format: 'json',
        },
      },
    };
  }

  /**
   * Validate content against platform constraints
   * @param {string} content - Content to validate
   * @param {string} platformId - Platform identifier
   * @param {string} componentType - Component type (main, agents, rules, etc.)
   * @returns {Object} Validation result
   */
  validate(content, platformId, componentType) {
    const platformConstraints = this.constraints[platformId];

    if (!platformConstraints) {
      return {
        valid: true,
        warnings: [`No constraints defined for platform: ${platformId}`],
      };
    }

    const componentConstraints = platformConstraints[componentType];

    if (!componentConstraints) {
      return {
        valid: true,
        warnings: [`No constraints defined for ${platformId}.${componentType}`],
      };
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      adaptations: [],
    };

    // Validate character limits
    if (componentConstraints.maxChars) {
      const charCount = content.length;
      if (charCount > componentConstraints.maxChars) {
        result.valid = false;
        result.errors.push(
          `Content exceeds ${componentConstraints.maxChars} character limit (${charCount} chars)`
        );
        result.suggestions.push('Summarize content or split into multiple files');
        result.adaptations.push({
          type: 'truncate',
          target: componentConstraints.maxChars,
          current: charCount,
        });
      } else if (charCount > componentConstraints.maxChars * 0.9) {
        result.warnings.push(
          `Content approaching limit: ${charCount}/${componentConstraints.maxChars} chars`
        );
      }
    }

    // Validate file references
    if (componentConstraints.fileReferences === false) {
      const fileRefPattern = /@[\w/\-.]+/g;
      const fileRefs = content.match(fileRefPattern);
      if (fileRefs && fileRefs.length > 0) {
        result.valid = false;
        result.errors.push(
          `Platform ${platformId} does not support file references (@path syntax)`
        );
        result.suggestions.push('Inline referenced content or remove references');
        result.adaptations.push({
          type: 'inline-references',
          references: fileRefs,
        });
      }
    }

    // Validate frontmatter requirements
    if (componentConstraints.requiredFrontmatter) {
      const frontmatter = this.extractFrontmatter(content);
      for (const field of componentConstraints.requiredFrontmatter) {
        if (!frontmatter[field]) {
          result.errors.push(`Missing required frontmatter field: ${field}`);
          result.valid = false;
        }
      }
    }

    // Validate format-specific requirements
    if (componentConstraints.format === 'yaml' && !this.isValidYAML(content)) {
      result.errors.push('Invalid YAML format');
      result.valid = false;
    }

    if (componentConstraints.format === 'json' && !this.isValidJSON(content)) {
      result.errors.push('Invalid JSON format');
      result.valid = false;
    }

    return result;
  }

  /**
   * Adapt content to meet platform constraints
   * @param {string} content - Original content
   * @param {string} platformId - Platform identifier
   * @param {string} componentType - Component type
   * @param {Object} options - Adaptation options
   * @returns {Object} Adapted content and metadata
   */
  adapt(content, platformId, componentType, options = {}) {
    const validation = this.validate(content, platformId, componentType);

    if (validation.valid && validation.warnings.length === 0) {
      return {
        content,
        adapted: false,
        changes: [],
      };
    }

    let adaptedContent = content;
    const changes = [];

    // Apply adaptations based on validation result
    for (const adaptation of validation.adaptations) {
      switch (adaptation.type) {
        case 'truncate':
          adaptedContent = this.truncateContent(adaptedContent, adaptation.target, options);
          changes.push({
            type: 'truncate',
            from: adaptation.current,
            to: adaptation.target,
          });
          break;

        case 'inline-references':
          if (options.inlineReferences) {
            adaptedContent = this.inlineFileReferences(adaptedContent, options);
            changes.push({
              type: 'inline-references',
              count: adaptation.references.length,
            });
          } else {
            adaptedContent = this.removeFileReferences(adaptedContent);
            changes.push({
              type: 'remove-references',
              count: adaptation.references.length,
            });
          }
          break;
      }
    }

    return {
      content: adaptedContent,
      adapted: true,
      changes,
      originalLength: content.length,
      adaptedLength: adaptedContent.length,
    };
  }

  /**
   * Truncate content intelligently to meet character limit
   * @param {string} content - Content to truncate
   * @param {number} maxChars - Maximum characters
   * @param {Object} options - Truncation options
   * @returns {string} Truncated content
   */
  truncateContent(content, maxChars, options = {}) {
    if (content.length <= maxChars) {
      return content;
    }

    const strategy = options.truncationStrategy || 'smart';

    switch (strategy) {
      case 'smart':
        return this.smartTruncate(content, maxChars);
      case 'priority':
        return this.priorityTruncate(content, maxChars, options.priorities);
      default:
        return `${content.slice(0, maxChars - 3)}...`;
    }
  }

  /**
   * Smart truncation preserving structure
   * @param {string} content - Content to truncate
   * @param {number} maxChars - Maximum characters
   * @returns {string} Truncated content
   */
  smartTruncate(content, maxChars) {
    // Extract frontmatter (preserve it)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[0] : '';
    const body = frontmatter ? content.slice(frontmatter.length) : content;

    const availableChars = maxChars - frontmatter.length - 50; // Reserve for summary

    if (body.length <= availableChars) {
      return content;
    }

    // Split into sections
    const sections = body.split(/\n##\s+/);
    let truncatedBody = '';
    let remainingChars = availableChars;

    for (let i = 0; i < sections.length; i++) {
      const section = i === 0 ? sections[i] : `## ${sections[i]}`;

      if (section.length <= remainingChars) {
        truncatedBody += section;
        remainingChars -= section.length;
      } else if (i === 0) {
        // Always include first section (title/intro)
        truncatedBody += section.slice(0, remainingChars - 50);
        break;
      } else {
        break;
      }
    }

    return `${frontmatter + truncatedBody}\n\n[Content truncated to meet platform limits]`;
  }

  /**
   * Priority-based truncation
   * @param {string} content - Content to truncate
   * @param {number} maxChars - Maximum characters
   * @param {Array} priorities - Section priorities
   * @returns {string} Truncated content
   */
  priorityTruncate(content, maxChars, _priorities = []) {
    // Implementation for priority-based truncation
    // Keep high-priority sections, remove low-priority ones
    return this.smartTruncate(content, maxChars);
  }

  /**
   * Inline file references
   * @param {string} content - Content with references
   * @param {Object} options - Options with file resolver
   * @returns {string} Content with inlined references
   */
  inlineFileReferences(content, options = {}) {
    if (!options.fileResolver) {
      return this.removeFileReferences(content);
    }

    const fileRefPattern = /@([\w/\-.]+)/g;
    return content.replace(fileRefPattern, (_match, filePath) => {
      try {
        const fileContent = options.fileResolver(filePath);
        return `\n<!-- Inlined from ${filePath} -->\n${fileContent}\n`;
      } catch {
        return `[Reference to ${filePath} - file not found]`;
      }
    });
  }

  /**
   * Remove file references
   * @param {string} content - Content with references
   * @returns {string} Content without references
   */
  removeFileReferences(content) {
    const fileRefPattern = /@([\w/\-.]+)/g;
    return content.replace(fileRefPattern, '[Reference removed]');
  }

  /**
   * Extract YAML frontmatter
   * @param {string} content - Content with frontmatter
   * @returns {Object} Parsed frontmatter
   */
  extractFrontmatter(content) {
    if (!content.startsWith('---')) {
      return {};
    }

    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) {
      return {};
    }

    const frontmatterText = content.slice(3, endIndex).trim();
    try {
      const yaml = require('js-yaml');
      return yaml.load(frontmatterText) || {};
    } catch {
      return {};
    }
  }

  /**
   * Validate YAML format
   * @param {string} content - Content to validate
   * @returns {boolean} True if valid YAML
   */
  isValidYAML(content) {
    try {
      const yaml = require('js-yaml');
      yaml.load(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate JSON format
   * @param {string} content - Content to validate
   * @returns {boolean} True if valid JSON
   */
  isValidJSON(content) {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get constraints for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Object} Platform constraints
   */
  getConstraints(platformId) {
    return this.constraints[platformId] || {};
  }

  /**
   * Get supported component types for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Array} Supported component types
   */
  getSupportedComponents(platformId) {
    const platformConstraints = this.constraints[platformId];
    return platformConstraints ? Object.keys(platformConstraints) : [];
  }

  /**
   * Log validation result
   * @param {Object} result - Validation result
   * @param {string} platformId - Platform identifier
   * @param {string} componentType - Component type
   */
  logValidationResult(result, platformId, componentType) {
    if (!this.verbose) return;

    console.log(chalk.cyan(`\n📋 Validation: ${platformId}.${componentType}`));

    if (result.valid) {
      console.log(chalk.green('✓ Valid'));
    } else {
      console.log(chalk.red('✗ Invalid'));
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      result.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      result.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
    }

    if (result.suggestions.length > 0) {
      console.log(chalk.cyan('\nSuggestions:'));
      result.suggestions.forEach(suggestion => console.log(chalk.cyan(`  • ${suggestion}`)));
    }
  }
}
