/**
 * RuleAdapter.js
 *
 * Transforms standardized VDK rules into IDE-native formats and locations.
 * Each IDE gets rules in the format that makes the most sense for that platform.
 *
 * Platform Configuration Integration - FIXED ✅
 * - RuleGenerator extracts and passes platformConfig from blueprint frontmatter ✅
 * - Platform-specific features (globs, characterLimit, priority, etc.) now available ✅
 * - Empty platformConfig={} calls should now receive proper configuration ✅
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import chalk from 'chalk';
import IR, { createIR } from '../../ir/index.js'; // Import VDK IR System
import { generateCursorFilename } from '../../utils/filename-generator.js';

export class RuleAdapter {
  constructor(options = {}) {
    this.verbose = options.verbose;
    this.projectPath = options.projectPath || process.cwd();
    this.overwrite = options.overwrite;

    // Initialize platform-specific constraints
    this.constraints = this.initializeConstraints();

    this.characterLimits = {
      windsurf: this.constraints.windsurf?.rules?.combinedLimit || {
        perFile: 6000,
        totalWorkspace: 12000,
      },
      'github-copilot': { perGuideline: 600, maxGuidelines: 6 }, // Derived from logic
      cursor: { perFile: Infinity, total: Infinity },
      claude: { perFile: Infinity, perCommand: 10000 },
    };
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

      cline: {
        rules: {
          location: '.clinerules/',
          format: 'markdown',
          frontmatter: ['paths'],
        },
        workflows: {
          location: '.clinerules/workflows/',
          format: 'markdown',
        },
        skills: {
          location: '.cline/skills/',
          format: 'skill-md',
        },
      },

      'roo-code': {
        rules: {
          location: '.roo/rules/',
          format: 'markdown',
        },
        modeRules: {
          location: '.roo/rules-<mode>/',
          format: 'markdown',
        },
        modes: {
          location: '.roomodes',
          format: 'yaml',
        },
      },

      opencode: {
        main: {
          location: 'AGENTS.md',
          format: 'markdown',
        },
        config: {
          location: 'opencode.json',
          format: 'json',
        },
        skills: {
          location: '.opencode/skills/',
          format: 'skill-md',
        },
      },

      goose: {
        main: {
          location: 'AGENTS.md',
          format: 'markdown',
        },
        config: {
          location: '.goose/config.yaml',
          format: 'yaml',
        },
      },

      junie: {
        main: {
          location: '.junie/guidelines.md',
          format: 'markdown',
        },
        mcp: {
          location: '.junie/mcp/',
          format: 'directory',
        },
        ignore: {
          location: '.aiignore',
          format: 'gitignore',
        },
      },

      'google-antigravity': {
        main: {
          location: 'GEMINI.md',
          format: 'markdown',
        },
        workflows: {
          location: '.agent/workflows/',
          format: 'markdown',
        },
      },

      'kimi-cli': {
        main: {
          location: 'AGENTS.md',
          format: 'markdown',
        },
        config: {
          location: '.kimi/config.toml',
          format: 'toml',
        },
      },

      'mistral-vibe': {
        config: {
          location: '.vibe/config.toml',
          format: 'toml',
        },
        agents: {
          location: '.vibe/agents/',
          format: 'toml',
        },
        prompts: {
          location: '.vibe/prompts/',
          format: 'markdown',
        },
      },

      trae: {
        main: {
          location: '.rules/project_rules.md',
          format: 'markdown',
        },
        user: {
          location: '.rules/user_rules.md',
          format: 'markdown',
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
        valid: false,
        warnings: [],
        errors: [`No constraints defined for platform: ${platformId}`],
        suggestions: [],
        adaptations: [],
      };
    }

    const componentConstraints = platformConstraints[componentType];

    if (!componentConstraints) {
      return {
        valid: false,
        warnings: [],
        errors: [
          `No constraints defined for component '${componentType}' on platform '${platformId}'`,
        ],
        suggestions: [],
        adaptations: [],
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
      // Assuming extractFrontmatter helper or similar logic
      if (content.startsWith('---')) {
        // Basic check, full parsing might be heavy here without deps
        const header = content.split('---')[1];
        for (const field of componentConstraints.requiredFrontmatter) {
          if (!header.includes(`${field}:`)) {
            result.errors.push(`Missing required frontmatter field: ${field}`);
            result.valid = false;
          }
        }
      }
    }

    return result;
  }

  /**
   * Adapt a v3.0 blueprint for a specific platform
   * @param {Object} blueprint - v3.0 blueprint with platforms structure
   * @param {string} targetPlatform - Target platform ID ('claude-code', 'cursor', etc.)
   * @param {Object} options - Adaptation options
   * @returns {Promise<Object>} Adapted files and metadata
   */
  async adaptFromBlueprint(blueprint, targetPlatform, _options = {}) {
    if (blueprint.schemaVersion !== '3.0') {
      throw new Error(`Blueprint must be schema v3.0, got ${blueprint.schemaVersion}`);
    }

    const platformConfig = blueprint.platforms?.[targetPlatform];
    if (!platformConfig) {
      throw new Error(`No configuration for platform ${targetPlatform} in blueprint`);
    }

    const rules = this.extractCanonicalRulesFromComponents(platformConfig.components, blueprint);

    if (rules.length === 0) {
      throw new Error(`No enabled components found for platform ${targetPlatform}`);
    }

    // Extract project context from blueprint metadata
    const projectContext = {
      name: blueprint.title,
      description: blueprint.description,
      category: blueprint.category,
      ...blueprint.metadata,
    };

    return await this.adaptRules(rules, targetPlatform, projectContext, platformConfig);
  }

  /**
   * Extract canonical content units from v3.0 platform components
   * @param {Object} components - v3.0 components object
   * @param {Object} blueprint - Full blueprint for content extraction
   * @returns {Array} Canonical content units for platform adaptation
   */
  extractCanonicalRulesFromComponents(components, blueprint) {
    const rules = [];

    if (!components) return rules;

    // Convert each component type
    for (const [componentType, componentConfig] of Object.entries(components)) {
      if (!componentConfig.enabled) continue;

      if (componentConfig.manifests && Array.isArray(componentConfig.manifests)) {
        for (const manifest of componentConfig.manifests) {
          rules.push({
            name: manifest.name,
            frontmatter: {
              ...manifest,
              component: componentType,
              category: blueprint.category,
            },
            content: manifest.content || blueprint.source?.content || blueprint.content || '',
            filePath: manifest.file,
          });
        }
      } else {
        rules.push({
          name: componentType,
          frontmatter: {
            component: componentType,
            category: blueprint.category,
            location: componentConfig.location,
          },
          content: blueprint.source?.content || blueprint.content || '',
          filePath: componentConfig.location,
        });
      }
    }

    return rules;
  }

  /**
   * Adapt a collection of rules for a specific IDE with platform configuration
   * @param {Array} rules - Array of rule objects with frontmatter and content
   * @param {string} targetIDE - Target IDE ('claude', 'cursor', 'windsurf', 'github-copilot')
   * @param {Object} projectContext - Project analysis context
   * @param {Object} platformConfig - Platform-specific configuration from blueprint
   * @returns {Object} Adapted rules with paths and content
   */
  async adaptRules(rules, targetIDE, projectContext = {}, platformConfig = {}) {
    if (this.verbose) {
      console.log(chalk.gray(`Adapting ${rules.length} rules for ${targetIDE}...`));
    }

    // Check platform compatibility first
    if (platformConfig.compatible === false) {
      return {
        paths: [],
        rules: [],
        summary: {
          generated: 0,
          skipped: rules.length,
          reason: 'Platform not compatible',
        },
      };
    }

    switch (targetIDE.toLowerCase()) {
      case 'claude-code':
      case 'claude':
      case 'claude-code-cli':
        return await this.adaptForClaude(rules, projectContext, platformConfig);

      case 'cursor':
        return await this.adaptForCursor(rules, projectContext, platformConfig);

      case 'windsurf':
        return await this.adaptForWindsurf(rules, projectContext, platformConfig);

      case 'github-copilot':
        return await this.adaptForGitHubCopilot(rules, projectContext, platformConfig);

      case 'zed':
        return await this.adaptForZed(rules, projectContext, platformConfig);

      case 'vscode':
      case 'vscode-insiders':
      case 'vscodium':
        return await this.adaptForVSCode(rules, projectContext, platformConfig);

      case 'jetbrains-ai':
      case 'intellij':
      case 'webstorm':
        return await this.adaptForJetBrains(rules, projectContext, platformConfig);

      case 'openai-codex':
        return await this.adaptForCodex(rules, projectContext, platformConfig);

      case 'opencode':
        return await this.adaptForOpenCode(rules, projectContext, platformConfig);

      case 'goose':
        return await this.adaptForGoose(rules, projectContext, platformConfig);

      case 'junie':
        return await this.adaptForJunie(rules, projectContext, platformConfig);

      case 'google-antigravity':
      case 'antigravity':
        return await this.adaptForAntigravity(rules, projectContext, platformConfig);

      case 'kimi-cli':
      case 'kimi':
        return await this.adaptForKimiCLI(rules, projectContext, platformConfig);

      case 'mistral-vibe':
      case 'mistral':
      case 'vibe':
        return await this.adaptForMistralVibe(rules, projectContext, platformConfig);

      case 'trae':
        return await this.adaptForTrae(rules, projectContext, platformConfig);

      case 'gemini-cli':
        return await this.adaptForGemini(rules, projectContext, platformConfig);

      case 'cline':
        return await this.adaptForCline(rules, projectContext, platformConfig);

      case 'roo-code':
      case 'roo':
        return await this.adaptForRooCode(rules, projectContext, platformConfig);

      case 'continue':
        return await this.adaptForContinue(rules, projectContext, platformConfig);

      case 'aider':
        return await this.adaptForAider(rules, projectContext, platformConfig);

      case 'tabnine':
        return await this.adaptForTabnine(rules, projectContext, platformConfig);

      default:
        throw new Error(`Unsupported target IDE for canonical adaptation: ${targetIDE}`);
    }
  }

  /**
   * Enforce character limits for content based on IDE type
   * @param {string} content - Content to check/truncate
   * @param {string} ideType - IDE type
   * @param {string} limitType - Type of limit (perFile, perGuideline, etc.)
   * @returns {Object} Result with content and truncation info
   */
  enforceCharacterLimits(content, ideType, limitType = 'perFile') {
    const limits = this.characterLimits[ideType.toLowerCase()];
    if (!limits) {
      return { content, truncated: false, originalLength: content.length };
    }

    const limit = limits[limitType];
    if (limit === Number.POSITIVE_INFINITY || content.length <= limit) {
      return { content, truncated: false, originalLength: content.length };
    }

    // Smart truncation at sentence boundaries
    const truncationPoint = this.findSmartTruncationPoint(content, limit);
    const truncatedContent =
      content.substring(0, truncationPoint) +
      (truncationPoint < content.length ? '\n\n*Truncated due to character limit*' : '');

    if (this.verbose) {
      console.warn(
        chalk.yellow(
          `Content truncated for ${ideType} (${content.length} → ${truncatedContent.length} chars)`
        )
      );
    }

    return {
      content: truncatedContent,
      truncated: true,
      originalLength: content.length,
      truncatedLength: truncatedContent.length,
    };
  }

  /**
   * Find smart truncation point at sentence or paragraph boundaries
   * @param {string} content - Content to truncate
   * @param {number} limit - Character limit
   * @returns {number} Truncation point
   */
  findSmartTruncationPoint(content, limit) {
    const buffer = Math.max(50, limit * 0.05); // 5% buffer or minimum 50 chars
    const targetLength = limit - buffer;

    if (content.length <= targetLength) {
      return content.length;
    }

    // Try to find good truncation points in order of preference
    const truncationPoints = [
      content.lastIndexOf('\n\n', targetLength), // Paragraph boundary
      content.lastIndexOf('.\n', targetLength), // Sentence with newline
      content.lastIndexOf('. ', targetLength), // Sentence boundary
      content.lastIndexOf('\n', targetLength), // Line boundary
      targetLength, // Hard truncation
    ];

    for (const point of truncationPoints) {
      if (point > targetLength * 0.7) {
        // Keep at least 70% of content
        return point;
      }
    }

    return targetLength; // Fallback to hard truncation
  }

  /**
   * Adapt rules for Claude Code CLI's memory system with VDK-native intelligence
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Full VDK analysis data (projectStructure, technologyData, patterns)
   * @param {Object} platformConfig - Claude-specific configuration
   * @returns {Object} Claude-native memory files and commands
   */
  async adaptForClaude(rules, projectContext, platformConfig = {}) {
    // Extract platform-specific settings with defaults
    const memory = platformConfig.memory !== false; // Default: true
    const _command = platformConfig.command !== false; // Default: true
    const priority = platformConfig.priority || 5; // Default priority
    const _namespace = platformConfig.namespace || 'project'; // Default: project
    const allowedTools = platformConfig.allowedTools || [];
    const _mcpIntegration = platformConfig.mcpIntegration;
    const adaptedFiles = [];
    const _projectName = path.basename(this.projectPath);
    const globalDir = path.join(os.homedir(), '.claude');
    const commandsDir = path.join(this.projectPath, '.claude', 'commands');
    const userCommandsDir = path.join(os.homedir(), '.claude', 'commands');

    // Skip memory generation if disabled
    if (!memory) {
      return {
        paths: [],
        rules: [],
        summary: {
          generated: 0,
          skipped: rules.length,
          reason: 'Memory disabled in platform config',
        },
      };
    }

    // Sort rules by priority (higher priority first)
    const prioritizedRules = rules.toSorted((a, b) => {
      const aPriority = a.frontmatter?.priority || priority;
      const bPriority = b.frontmatter?.priority || priority;
      return bPriority - aPriority;
    });

    // 1. Global memory (cross-project preferences) - Deploy to ~/.claude/CLAUDE.md
    const globalRules = prioritizedRules.filter(
      rule => rule.frontmatter?.category === 'core' && rule.frontmatter?.alwaysApply === true
    );

    if (globalRules.length > 0) {
      const globalContent = this.generateClaudeGlobalMemory(globalRules, {
        priority,
        allowedTools,
      });
      adaptedFiles.push({
        path: path.join(globalDir, 'CLAUDE.md'),
        content: globalContent,
        type: 'memory',
        scope: 'global',
        hierarchyLevel: 'global',
      });
    }

    // 2. Main project memory with VDK-native intelligence - Deploy to ./CLAUDE.md
    const projectName = path.basename(this.projectPath);
    const technologyData = projectContext.technologyData || projectContext.technology || {};
    const projectType = this.determineProjectType(projectContext);
    const packageManager = await this.detectPackageManager(projectContext);

    // Get technology-specific rules for smart guidelines
    const technologyRules = rules.filter(
      rule =>
        rule.frontmatter?.category === 'technology' ||
        rule.frontmatter?.category === 'technologies' ||
        rule.frontmatter?.category === 'framework' ||
        rule.frontmatter?.category === 'language' ||
        rule.frontmatter?.category === 'languages' ||
        rule.frontmatter?.category === 'stack' ||
        rule.frontmatter?.category === 'stacks'
    );

    const technologyGuidelines = await this.extractVDKTechnologyGuidelines(
      technologyRules,
      projectContext
    );

    const claudeMainContent = `# ${projectName} - Claude Code CLI Memory

## Project Overview

This is a **${projectType}** project.

### Key Information
- **Project Type**: ${projectType}
- **Primary Language**: ${technologyData.primaryLanguages?.join(', ') || 'Not detected'}
- **Frameworks**: ${technologyData.frameworks?.join(', ') || 'Not detected'}
- **Libraries**: ${technologyData.libraries?.slice(0, 3).join(', ') || 'Standard libraries'}

## Coding Preferences

### Code Style
- Use 2-space indentation for JavaScript/TypeScript
- Prefer ${technologyData.primaryLanguages?.includes('TypeScript') ? 'TypeScript strict mode' : 'modern JavaScript'}
- Follow project conventions

### Project Structure
- Follow standard module structure
- Follow conventional directory structures

### Testing
- Use jest for testing
- Write tests for all business logic, use descriptive test names

## Development Environment

### Tools & Setup
- Package manager: ${packageManager}
- Build tool: npm scripts
- Primary IDE: Claude Code CLI
- AI Assistant: Claude Code CLI

### Development Commands
- \`${packageManager} run dev\` - Start development server
- \`${packageManager} run test\` - Run tests
- \`${packageManager} run build\` - Build for production

## Technology-Specific Guidelines

${technologyGuidelines}

## Workflow Preferences

### Development Workflow
- Start with failing tests when appropriate
- Run tests before committing
- Use feature flags for incomplete features
- Plan for rollback strategies

### Communication
- Over-communicate in remote environments
- Document decisions and reasoning
- Share knowledge through code comments and docs
- Ask for clarification when requirements are unclear

---
*Generated by VDK CLI -  for Claude Code CLI*
*Technology rules: ${technologyRules.length} rules integrated*

${rules
  .filter(r => r.frontmatter?.category === 'imported' || r.frontmatter?.category === 'memory')
  .map(
    r => `## Legacy Context (${r.name})
${r.content}`
  )
  .join('\n\n')}`;

    adaptedFiles.push({
      path: path.join(this.projectPath, 'CLAUDE.md'),
      content: claudeMainContent,
      type: 'memory',
      scope: 'project',
      hierarchyLevel: 'project',
    });

    // 3. Technology-specific memory files with import structure
    const techRules = rules.filter(
      rule =>
        rule.frontmatter?.category === 'technology' ||
        rule.frontmatter?.category === 'framework' ||
        rule.frontmatter?.category === 'language'
    );

    // 3. Technology patterns are integrated into main CLAUDE.md, not separate files
    // Claude Code CLI reads CLAUDE.md as the primary project memory

    // 4. Optional: Generate CLAUDE.local.md for private/local context (gitignored)
    if (techRules.length > 0) {
      const localTechContent = this.generateClaudeLocalMemory(techRules, projectContext);
      adaptedFiles.push({
        path: path.join(this.projectPath, 'CLAUDE.local.md'),
        content: localTechContent,
        type: 'memory',
        scope: 'local',
        hierarchyLevel: 'local',
      });
    }

    // 5. Project commands (namespace: /project:)
    const taskRules = rules.filter(rule => rule.frontmatter?.category === 'task');

    for (const rule of taskRules) {
      const commandContent = this.generateClaudeSlashCommand(rule, projectContext);
      const commandName = this.getCommandName(rule.frontmatter?.description);

      adaptedFiles.push({
        path: path.join(commandsDir, `${commandName}.md`),
        content: commandContent,
        type: 'command',
        scope: 'project',
        namespace: 'project',
        commandName,
      });
    }

    // 6. User commands (namespace: /user:) - Deploy to ~/.claude/commands/
    const personalRules = rules.filter(
      rule =>
        rule.frontmatter?.category === 'assistant' || rule.frontmatter?.category === 'workflow'
    );

    for (const rule of personalRules) {
      const commandContent = this.generateClaudeSlashCommand(rule, projectContext);
      const commandName = this.getCommandName(rule.frontmatter?.description);

      adaptedFiles.push({
        path: path.join(userCommandsDir, `${commandName}.md`),
        content: commandContent,
        type: 'command',
        scope: 'user',
        namespace: 'user',
        commandName,
      });
    }

    return {
      files: adaptedFiles,
      directories: [globalDir, commandsDir, userCommandsDir].filter(Boolean), // Add directories array
      summary: {
        memoryFiles: adaptedFiles.filter(f => f.type === 'memory').length,
        commands: adaptedFiles.filter(f => f.type === 'command').length,
        totalSize: adaptedFiles.reduce((size, file) => size + file.content.length, 0),
      },
    };
  }

  /**
   * Helper: Convert legacy rule object to IR
   */
  ruleToIR(rule) {
    const parsedContent = IR.parse.markdown(rule.content || '');
    const ir = createIR('rule', rule.name || 'rule');

    ir.content = parsedContent;
    ir.content.frontmatter = ir.content.frontmatter || {};
    ir.description = parsedContent?.frontmatter?.description || '';

    // Ensure name exists
    if (!ir.name && rule.name) ir.name = rule.name;

    // Merge frontmatter from rule object
    if (rule.frontmatter) {
      ir.content.frontmatter = { ...ir.content.frontmatter, ...rule.frontmatter };
      if (rule.frontmatter.description) ir.description = rule.frontmatter.description;

      // Map conditional rules
      if (rule.frontmatter.globs) {
        ir.conditionalRules = {
          globs: Array.isArray(rule.frontmatter.globs)
            ? rule.frontmatter.globs
            : [rule.frontmatter.globs],
          activation: 'path-based',
        };
      }
    }
    return ir;
  }

  /**
   * Adapt rules for Cursor's MDC system with proper activation types
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @returns {Object} Cursor-native MDC files
   */
  async adaptForCursor(rules, _projectContext, platformConfig = {}) {
    const adaptedFiles = [];
    const rulesDir = path.join(this.projectPath, '.cursor', 'rules');

    // Extract platform-specific settings
    const priority = platformConfig.priority || 'medium';

    // Group rules by activation type for better organization
    const rulesByActivation = this.groupCursorRulesByActivation(rules);

    // Helper to process a group
    const processGroup = async (groupRules, prefix, activationType, defaultScope = 'project') => {
      for (const rule of groupRules) {
        // Convert to IR
        const ir = this.ruleToIR(rule);

        // Generate MDC content using VDK IR System
        const result = IR.generate.cursor(ir, {
          useMDC: true,
          forceActivation: activationType === 'always' ? 'always' : undefined,
        });

        const fileName = this.getCursorFileName(rule);

        adaptedFiles.push({
          path: path.join(rulesDir, `${prefix}-${fileName}.mdc`),
          content: result.content,
          type: 'rule',
          activation: activationType,
          scope: defaultScope,
          globs: rule.frontmatter?.globs || [],
          priority: priority,
        });
      }
    };

    // 1. Always rules
    await processGroup(rulesByActivation.always, 'always', 'always');

    // 2. Auto-attached rules
    await processGroup(rulesByActivation.autoAttached, 'auto', 'auto-attached');

    // 3. Agent-requested rules
    await processGroup(rulesByActivation.agentRequested, 'agent', 'agent-requested');

    // 4. Manual rules
    await processGroup(rulesByActivation.manual, 'manual', 'manual');

    return {
      files: adaptedFiles,
      summary: {
        always: rulesByActivation.always.length,
        autoAttached: rulesByActivation.autoAttached.length,
        agentRequested: rulesByActivation.agentRequested.length,
        manual: rulesByActivation.manual.length,
        totalFiles: adaptedFiles.length,
      },
    };
  }

  /**
   * Generate Cursor MDC format with proper frontmatter (FIXED IMPLEMENTATION)
   * @param {Object} rule - Rule object
   * @param {Object} projectContext - Project context
   * @returns {string} MDC formatted content
   */
  generateCursorMDC(rule, _projectContext) {
    const activationType = this.getCursorActivationType(rule);
    const globs = rule.frontmatter?.globs || [];
    const description = rule.frontmatter?.description || '';
    const cleanContent = this.stripFrontmatter(rule.content);

    return `---
type: ${activationType}
${globs.length > 0 ? `globs: ${JSON.stringify(globs)}` : ''}
${activationType === 'agent-requested' ? `description: "${description}"` : ''}
alwaysApply: ${rule.frontmatter?.alwaysApply}
---

${cleanContent}`;
  }

  /**
   * Get Cursor activation type (FIXED IMPLEMENTATION)
   * @param {Object} rule - Rule object
   * @returns {string} Activation type
   */
  getCursorActivationType(rule) {
    if (rule.frontmatter?.alwaysApply) {
      return 'always';
    }
    if (rule.frontmatter?.globs && rule.frontmatter?.globs.length > 0) {
      return 'auto-attached';
    }
    if (rule.frontmatter?.description) {
      return 'agent-requested';
    }
    return 'manual';
  }

  /**
   * Get Cursor file name using centralized filename generator
   * @param {Object} rule - Rule object
   * @returns {string} File name
   */
  getCursorFileName(rule) {
    return generateCursorFilename(rule);
  }

  /**
   * Group Cursor rules by activation type
   * @param {Array} rules - Rules to group
   * @returns {Object} Rules grouped by activation type
   */
  groupCursorRulesByActivation(rules) {
    const groups = {
      always: [],
      autoAttached: [],
      agentRequested: [],
      manual: [],
    };

    for (const rule of rules) {
      const activationType = this.getCursorActivationType(rule);
      const groupKey =
        activationType === 'auto-attached'
          ? 'autoAttached'
          : activationType === 'agent-requested'
            ? 'agentRequested'
            : activationType;

      if (groups[groupKey]) {
        groups[groupKey].push(rule);
      } else {
        groups.manual.push(rule);
      }
    }

    return groups;
  }

  /**
   * Get Cursor rule name for manual activation
   * @param {Object} rule - Rule object
   * @returns {string} Rule name for @ruleName usage
   */
  getCursorRuleName(rule) {
    const description = rule.frontmatter?.description || '';
    const category = rule.frontmatter?.category || 'rule';

    if (description) {
      return description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 20);
    }

    return category.toLowerCase();
  }

  /**
   * Adapt rules for Windsurf's memories system with proper deployment
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @returns {Object} Windsurf-native memory files
   */
  async adaptForWindsurf(rules, projectContext, platformConfig = {}) {
    // Extract platform-specific settings
    const _mode = platformConfig.mode || 'workspace'; // global or workspace
    const _xmlTag = platformConfig.xmlTag || 'context';
    const _characterLimit = platformConfig.characterLimit || 6000;
    const _priority = platformConfig.priority || 5;
    const adaptedFiles = [];
    const rulesDir = path.join(this.projectPath, '.windsurf', 'rules');
    const globalDir = path.join(os.homedir(), '.codeium', 'windsurf', 'memories');

    // 1. Global rules (organization-wide standards) - Deploy to ~/.codeium/windsurf/memories/
    const globalRules = rules.filter(
      rule => rule.frontmatter?.category === 'core' || rule.frontmatter?.alwaysApply === true
    );

    if (globalRules.length > 0) {
      let globalContent = this.generateWindsurfGlobalMemory(globalRules, projectContext);

      // Enforce 6K character limit for global rules
      if (globalContent.length > 6000) {
        if (this.verbose) {
          console.warn(chalk.yellow('Global Windsurf rules exceed 6K limit, truncating...'));
        }
        globalContent = `${globalContent.substring(0, 5900)}\n\n*Truncated due to character limit*`;
      }

      adaptedFiles.push({
        path: path.join(globalDir, 'global_rules.md'),
        content: globalContent,
        type: 'memory',
        scope: 'global',
        characterCount: globalContent.length,
        activationType: 'always-on',
      });
    }

    // 2. Workspace rules (project-specific) - Deploy to .windsurf/rules/
    const workspaceRules = rules.filter(
      rule => rule.frontmatter?.category !== 'core' && rule.frontmatter?.alwaysApply !== true
    );

    for (const rule of workspaceRules) {
      // Create IR from rule
      const ir = this.ruleToIR(rule);

      // Generate Windsurf content using VDK IR System
      const result = IR.generate.windsurf(ir);
      let windsurfContent = result.content;

      // Ensure character limit compliance (6K per file)
      if (windsurfContent.length > 6000) {
        if (this.verbose) {
          console.warn(
            chalk.yellow(`Rule ${rule.frontmatter?.description} exceeds 6K limit, truncating...`)
          );
        }
        windsurfContent = `${windsurfContent.substring(0, 5900)}\n\n*Truncated due to character limit*`;
      }

      const fileName = this.getWindsurfFileName(rule);
      const activationType = this.getWindsurfActivationType(rule);

      adaptedFiles.push({
        path: path.join(rulesDir, fileName),
        content: windsurfContent,
        type: 'rule',
        scope: 'workspace',
        characterCount: windsurfContent.length,
        activationType,
      });
    }

    // Ensure total character limit compliance (12K across all workspace rules)
    const totalChars = adaptedFiles
      .filter(f => f.scope === 'workspace')
      .reduce((total, file) => total + file.characterCount, 0);

    if (totalChars > 12000) {
      if (this.verbose) {
        console.warn(
          chalk.yellow(`⚠️ Windsurf workspace rules exceed 12K total limit (${totalChars} chars)`)
        );
      }

      // Truncate files proportionally to stay under limit
      const reductionRatio = 11000 / totalChars; // Leave some buffer
      for (const file of adaptedFiles.filter(f => f.scope === 'workspace')) {
        const targetLength = Math.floor(file.characterCount * reductionRatio);
        if (file.content.length > targetLength) {
          file.content = `${file.content.substring(0, targetLength - 50)}\n\n*Truncated for total limit*`;
          file.characterCount = file.content.length;
        }
      }
    }

    return {
      files: adaptedFiles,
      summary: {
        globalRules: adaptedFiles.filter(f => f.scope === 'global').length,
        workspaceRules: adaptedFiles.filter(f => f.scope === 'workspace').length,
        totalCharacters: adaptedFiles.reduce((total, file) => total + file.characterCount, 0),
        characterLimit: 12000,
      },
    };
  }

  /**
   * Adapt rules for GitHub Copilot's guidelines system (FIXED APPROACH)
   * Generate setup instructions instead of files as per report findings
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @returns {Object} GitHub Copilot setup instructions
   */
  async adaptForGitHubCopilot(rules, _projectContext, platformConfig = {}) {
    // Extract platform-specific settings
    const _priority = platformConfig.priority || 8;
    const _reviewType = platformConfig.reviewType || 'code-quality';
    const _scope = platformConfig.scope || 'repository';
    // Don't generate files - generate setup instructions
    const prioritizedRules = this.prioritizeRulesForCopilot(rules);
    const selectedRules = prioritizedRules.slice(0, 6); // GitHub Copilot Enterprise limit

    const guidelines = selectedRules.map((rule, index) => ({
      number: index + 1,
      name: rule.frontmatter?.description || `Rule ${index + 1}`,
      description: this.truncateToCharLimit(this.stripFrontmatter(rule.content), 600), // 600 char limit
      filePatterns: rule.frontmatter?.globs || ['**/*'],
    }));

    const instructionsContent = `# GitHub Copilot Setup Instructions

## Configure in Repository Settings
⚠️ **Enterprise Feature**: Requires GitHub Copilot Enterprise plan

## Configuration Steps
1. Go to Settings → Code & automation → Copilot → Code review
2. Add these coding guidelines:

${guidelines
  .map(
    guideline => `
### Guideline ${guideline.number}: ${guideline.name}
**Description:** ${guideline.description}
**File patterns:** ${guideline.filePatterns.join(', ')}
`
  )
  .join('')}

## Important Notes
- Guidelines only apply to code reviews, not code completion
- Each description limited to 600 characters
- File patterns use fnmatch syntax (\`*\` wildcard)
- Manual setup required in repository settings
- Maximum 6 guidelines per repository

## Alternative Options
For file-based AI rule management, consider:
- **Claude Code CLI**: Memory files and slash commands
- **Cursor**: .cursor/rules/ directory with MDC format
- **Windsurf**: .windsurf/rules/ directory with XML grouping

---
*Generated by VDK CLI - Setup Instructions Only*`;

    return {
      files: [
        {
          path: path.join(this.projectPath, 'GITHUB_COPILOT_SETUP.md'),
          content: instructionsContent,
          type: 'instructions',
          scope: 'repository',
        },
      ],
      guidelines,
      summary: {
        totalGuidelines: guidelines.length,
        maxGuidelines: 6,
        requiresManualSetup: true,
        enterpriseOnly: true,
        approach: 'instructions-only',
      },
    };
  }

  // === New Universal Adapters ===

  /**
   * Adapt rules for OpenAI Codex CLI
   * Target: AGENTS.md (Markdown, natural language, no frontmatter)
   */
  async adaptForCodex(rules, projectContext, _platformConfig = {}) {
    const agentsPath = path.join(this.projectPath, 'AGENTS.md');
    const projectName = path.basename(this.projectPath);

    // Group rules by category for natural language sections
    const sections = {
      Overview: [],
      Build: [],
      CodeStandards: [],
      Architecture: [],
      Workflow: [],
    };

    rules.forEach(rule => {
      const cat = rule.frontmatter?.category || 'other';
      if (['core', 'project'].includes(cat)) sections.Overview.push(rule);
      else if (['test', 'build', 'ci'].includes(cat)) sections.Build.push(rule);
      else if (['language', 'framework', 'style'].includes(cat)) sections.CodeStandards.push(rule);
      else if (['architecture', 'pattern'].includes(cat)) sections.Architecture.push(rule);
      else sections.Workflow.push(rule);
    });

    const contentParts = [
      `# Repository: ${projectName}`,
      '',
      `## Project Context`,
      projectContext.description || 'No description provided.',
      '',
      `## Build and Test Commands`,
      // Extract from relevant rules or defaults
      `- Build: npm run build`,
      `- Test: npm test`,
      '',
      `## Code Standards`,
      ...sections.CodeStandards.map(r => this.stripFrontmatter(r.content).trim()),
      '',
      `## Architecture`,
      ...sections.Architecture.map(r => this.stripFrontmatter(r.content).trim()),
      '',
      `## General Protocols`,
      ...sections.Workflow.map(r => this.stripFrontmatter(r.content).trim()),
    ];

    const content = contentParts.join('\n');

    return {
      files: [
        {
          path: agentsPath,
          content: content,
          type: 'agents',
          scope: 'project',
        },
      ],
      summary: {
        generated: 1,
        totalRules: rules.length,
      },
    };
  }

  /**
   * Adapt rules for Gemini CLI
   * Target: GEMINI.md (Markdown with @path imports support)
   */
  async adaptForGemini(rules, _projectContext, _config = {}) {
    const geminiPath = path.join(this.projectPath, 'GEMINI.md');
    const contextDir = path.join(this.projectPath, '.gemini', 'context');
    const files = [];

    // Main GEMINI.md acts as an index
    const indexContent = [
      `# Gemini Context for ${path.basename(this.projectPath)}`,
      '',
      `## Active Contexts`,
    ];

    for (const rule of rules) {
      const fileName = `${this.getCursorFileName(rule)}.md`; // Reuse filename logic
      const filePath = path.join(contextDir, fileName);

      files.push({
        path: filePath,
        content: this.stripFrontmatter(rule.content),
        type: 'context',
        scope: 'project',
      });

      // Add import to main file if it's a high priority rule
      if (rule.frontmatter?.alwaysApply || rule.frontmatter?.priority > 5) {
        indexContent.push(`- @.gemini/context/${fileName}`);
      }
    }

    files.push({
      path: geminiPath,
      content: indexContent.join('\n'),
      type: 'index',
      scope: 'project',
    });

    return {
      files,
      summary: {
        contextFiles: files.length - 1,
        indexCreated: true,
      },
    };
  }

  /**
   * Adapt rules for Continue
   * Target: .continuerc.json (JSON Config)
   */
  async adaptForContinue(rules, _projectContext, _config = {}) {
    const configPath = path.join(this.projectPath, '.continuerc.json');

    // Convert rules into customCommands and contextProviders
    const customCommands = [];
    const systemMessageParts = [];

    rules.forEach(rule => {
      // If it's a task/command, make it a custom command
      if (rule.frontmatter?.category === 'task') {
        customCommands.push({
          name: rule.name || 'command',
          description: rule.frontmatter.description || 'Custom command',
          prompt: this.stripFrontmatter(rule.content),
        });
      } else {
        // Otherwise append to system message
        systemMessageParts.push(this.stripFrontmatter(rule.content));
      }
    });

    const configContent = JSON.stringify(
      {
        customCommands,
        // specific system message property depends on Continue version,
        // usually handled via rules, but here we inject as global context if possible
        // or just suggest users add it. For now, we serialize to a "rules" entry.
        rules: systemMessageParts,
      },
      null,
      2
    );

    return {
      files: [
        {
          path: configPath,
          content: configContent,
          type: 'config',
          scope: 'project',
        },
      ],
      summary: {
        commands: customCommands.length,
        rulesMerged: systemMessageParts.length,
      },
    };
  }

  /**
   * Adapt rules for Aider
   * Target: .aider.conf.yml (YAML) + read-only files
   */
  async adaptForAider(rules, _projectContext, _config = {}) {
    const configPath = path.join(this.projectPath, '.aider.conf.yml');
    const conventionsPath = path.join(this.projectPath, 'CONVENTIONS.md');

    // Aider best practice: Dump all rules into a CONVENTIONS.md and have aider read it
    const conventionsContent = rules.map(r => this.stripFrontmatter(r.content)).join('\n\n---\n\n');

    const configContent = `read:
  - CONVENTIONS.md
`;

    return {
      files: [
        {
          path: conventionsPath,
          content: conventionsContent,
          type: 'conventions',
          scope: 'project',
        },
        {
          path: configPath,
          content: configContent,
          type: 'config',
          scope: 'project',
        },
      ],
      summary: {
        files: 2,
      },
    };
  }

  /**
   * Adapt rules for OpenCode
   * Targets: AGENTS.md + opencode.json
   */
  async adaptForOpenCode(rules, projectContext, _config = {}) {
    const agentsResult = await this.adaptForCodex(rules, projectContext, _config);
    const opencodeConfigPath = path.join(this.projectPath, 'opencode.json');

    const opencodeConfig = {
      $schema: 'https://opencode.ai/config.json',
      instructions: ['AGENTS.md'],
      mcp: {},
    };

    return {
      files: [
        ...(agentsResult.files || []),
        {
          path: opencodeConfigPath,
          content: JSON.stringify(opencodeConfig, null, 2),
          type: 'config',
          scope: 'project',
        },
      ],
      summary: {
        generated: (agentsResult.files || []).length + 1,
        formats: ['AGENTS.md', 'opencode.json'],
      },
    };
  }

  /**
   * Adapt rules for Goose
   * Target: AGENTS.md (plus optional .goose/config.yaml)
   */
  async adaptForGoose(rules, projectContext, _config = {}) {
    const agentsResult = await this.adaptForCodex(rules, projectContext, _config);
    const gooseConfigPath = path.join(this.projectPath, '.goose', 'config.yaml');
    const gooseConfigContent = `# Goose project configuration\nmodel: auto\nextensions: []\n`;

    return {
      files: [
        ...(agentsResult.files || []),
        {
          path: gooseConfigPath,
          content: gooseConfigContent,
          type: 'config',
          scope: 'project',
        },
      ],
      summary: {
        generated: (agentsResult.files || []).length + 1,
        formats: ['AGENTS.md', '.goose/config.yaml'],
      },
    };
  }

  /**
   * Adapt rules for Junie
   * Target: .junie/guidelines.md (primary)
   */
  async adaptForJunie(rules, _projectContext, _config = {}) {
    const junieGuidelinesPath = path.join(this.projectPath, '.junie', 'guidelines.md');
    const aiIgnorePath = path.join(this.projectPath, '.aiignore');

    const guidelinesSections = [
      '# Junie Project Guidelines',
      '',
      ...rules.map(rule => {
        const title = rule.name || rule.frontmatter?.description || 'Guideline';
        const body = this.stripFrontmatter(rule.content || '');
        return `## ${title}\n\n${body}`;
      }),
    ];

    return {
      files: [
        {
          path: junieGuidelinesPath,
          content: guidelinesSections.join('\n\n'),
          type: 'guidelines',
          scope: 'project',
        },
        {
          path: aiIgnorePath,
          content:
            '# Exclude sensitive/large paths from AI context\n.env\n.env.*\nnode_modules/\ndist/\nbuild/\n',
          type: 'ignore',
          scope: 'project',
        },
      ],
      summary: {
        generated: 2,
        formats: ['.junie/guidelines.md', '.aiignore'],
      },
    };
  }

  /**
   * Adapt rules for Google Antigravity
   * Targets: GEMINI.md + .agent/workflows/*.md
   */
  async adaptForAntigravity(rules, projectContext, _config = {}) {
    const files = [];
    const projectName = path.basename(this.projectPath);
    const workflowsDir = path.join(this.projectPath, '.agent', 'workflows');
    const geminiPath = path.join(this.projectPath, 'GEMINI.md');

    const workflowRules = rules.filter(
      rule =>
        rule.frontmatter?.component === 'workflows' || rule.frontmatter?.category === 'workflow'
    );
    const memoryRules = rules.filter(rule => !workflowRules.includes(rule));

    const mainContent = [
      `# ${projectName} - Antigravity Context`,
      '',
      ...memoryRules.map(rule => {
        const title = rule.name || rule.frontmatter?.description || 'Guideline';
        const body = this.stripFrontmatter(rule.content || '');
        return `## ${title}\n\n${body}`;
      }),
    ].join('\n\n');

    files.push({
      path: geminiPath,
      content: mainContent,
      type: 'main',
      scope: 'project',
    });

    const workflows = workflowRules.length > 0 ? workflowRules : memoryRules.slice(0, 1);
    for (const rule of workflows) {
      const baseName = this.getCursorFileName(rule)
        .replace(/\.mdc$/i, '')
        .replace(/\.md$/i, '');
      const workflowContent = this.stripFrontmatter(rule.content || '') || `# ${baseName}\n`;

      files.push({
        path: path.join(workflowsDir, `${baseName}.md`),
        content: workflowContent,
        type: 'workflow',
        scope: 'project',
      });
    }

    return {
      files,
      summary: {
        generated: files.length,
        formats: ['GEMINI.md', '.agent/workflows/*.md'],
      },
    };
  }

  /**
   * Adapt rules for Kimi CLI
   * Targets: AGENTS.md + .kimi/config.toml
   */
  async adaptForKimiCLI(rules, projectContext, _config = {}) {
    const agentsResult = await this.adaptForCodex(rules, projectContext, _config);
    const kimiConfigPath = path.join(this.projectPath, '.kimi', 'config.toml');
    const kimiConfigContent = `# Kimi CLI project configuration\nmodel = "kimi-k2.5"\ncontext_file = "AGENTS.md"\n`;

    return {
      files: [
        ...(agentsResult.files || []),
        {
          path: kimiConfigPath,
          content: kimiConfigContent,
          type: 'config',
          scope: 'project',
        },
      ],
      summary: {
        generated: (agentsResult.files || []).length + 1,
        formats: ['AGENTS.md', '.kimi/config.toml'],
      },
    };
  }

  /**
   * Adapt rules for Mistral Vibe
   * Targets: .vibe/config.toml + .vibe/agents/*.toml + .vibe/prompts/*.md
   */
  async adaptForMistralVibe(rules, _projectContext, _config = {}) {
    const files = [];
    const configPath = path.join(this.projectPath, '.vibe', 'config.toml');
    const promptPath = path.join(this.projectPath, '.vibe', 'prompts', 'project.md');
    const agentPath = path.join(this.projectPath, '.vibe', 'agents', 'vdk_project.toml');

    const mergedPrompt = [
      '# VDK Project Prompt',
      '',
      ...rules.map(rule => {
        const title = rule.name || rule.frontmatter?.description || 'Guideline';
        const body = this.stripFrontmatter(rule.content || '');
        return `## ${title}\n\n${body}`;
      }),
    ].join('\n\n');

    files.push(
      {
        path: configPath,
        content: `model = "devstral-2"\ndefault_agent = "vdk_project"\n`,
        type: 'config',
        scope: 'project',
      },
      {
        path: promptPath,
        content: mergedPrompt,
        type: 'prompt',
        scope: 'project',
      },
      {
        path: agentPath,
        content:
          `name = "vdk_project"\n` +
          `description = "VDK-generated project-aware agent"\n` +
          `system_prompt_id = "project"\n`,
        type: 'agent',
        scope: 'project',
      }
    );

    return {
      files,
      summary: {
        generated: files.length,
        formats: ['.vibe/config.toml', '.vibe/prompts/project.md', '.vibe/agents/vdk_project.toml'],
      },
    };
  }

  /**
   * Adapt rules for Trae
   * Targets: .rules/project_rules.md + .rules/user_rules.md
   */
  async adaptForTrae(rules, _projectContext, _config = {}) {
    const projectRulesPath = path.join(this.projectPath, '.rules', 'project_rules.md');
    const userRulesPath = path.join(this.projectPath, '.rules', 'user_rules.md');

    const projectRulesContent = [
      '# Project Rules',
      '',
      ...rules.map(rule => {
        const title = rule.name || rule.frontmatter?.description || 'Rule';
        const body = this.stripFrontmatter(rule.content || '');
        return `## ${title}\n\n${body}`;
      }),
    ].join('\n\n');

    const userRulesContent =
      '# User Rules\n\n- Add developer-specific preferences and temporary constraints here.\n';

    return {
      files: [
        {
          path: projectRulesPath,
          content: projectRulesContent,
          type: 'rule',
          scope: 'project',
        },
        {
          path: userRulesPath,
          content: userRulesContent,
          type: 'rule',
          scope: 'project',
        },
      ],
      summary: {
        generated: 2,
        formats: ['.rules/project_rules.md', '.rules/user_rules.md'],
      },
    };
  }

  /**
   * Adapt rules for Cline
   * Targets: .clinerules/*.md + .clinerules/workflows/*.md + .cline/skills/<skill>/SKILL.md + AGENTS.md
   */
  async adaptForCline(rules, projectContext, _config = {}) {
    const clineRulesDir = path.join(this.projectPath, '.clinerules');
    const clineWorkflowsDir = path.join(clineRulesDir, 'workflows');
    const clineSkillsDir = path.join(this.projectPath, '.cline', 'skills');

    const files = [];

    for (const rule of rules) {
      const component = rule.frontmatter?.component;
      const baseName = this.getCursorFileName(rule)
        .replace(/\.mdc$/i, '')
        .replace(/\.md$/i, '');

      if (component === 'workflows' || rule.frontmatter?.category === 'workflow') {
        const workflowContent = this.stripFrontmatter(rule.content || '') || `# ${baseName}\n`;
        files.push({
          path: path.join(clineWorkflowsDir, `${baseName}.md`),
          content: workflowContent,
          type: 'workflow',
          scope: 'project',
        });
        continue;
      }

      if (component === 'skills' || rule.frontmatter?.category === 'skill') {
        const skillName =
          baseName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'skill';
        const skillBody = this.stripFrontmatter(rule.content || '');
        const description = rule.frontmatter?.description || `Skill for ${skillName}`;
        const skillContent = `---\nname: ${skillName}\ndescription: ${description}\n---\n\n${skillBody}`;

        files.push({
          path: path.join(clineSkillsDir, skillName, 'SKILL.md'),
          content: skillContent,
          type: 'skill',
          scope: 'project',
        });
        continue;
      }

      files.push({
        path: path.join(clineRulesDir, `${baseName}.md`),
        content: rule.content || '',
        type: 'rule',
        scope: 'project',
      });
    }

    const agentsResult = await this.adaptForCodex(rules, projectContext, _config);

    return {
      files: [...files, ...(agentsResult.files || [])],
      summary: {
        rules: files.filter(f => f.type === 'rule').length,
        workflows: files.filter(f => f.type === 'workflow').length,
        skills: files.filter(f => f.type === 'skill').length,
        includesAgents: true,
      },
    };
  }

  /**
   * Adapt rules for Roo Code
   * Targets: .roo/rules/*.md and optional mode-scoped .roo/rules-<mode>/*.md
   */
  async adaptForRooCode(rules, _projectContext, _config = {}) {
    const rooBaseDir = path.join(this.projectPath, '.roo');
    const files = [];

    for (const rule of rules) {
      const baseName = this.getCursorFileName(rule)
        .replace(/\.mdc$/i, '')
        .replace(/\.md$/i, '');
      const modeSlug = rule.frontmatter?.mode || null;

      const targetDir = modeSlug
        ? path.join(
            rooBaseDir,
            `rules-${String(modeSlug)
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '-')}`
          )
        : path.join(rooBaseDir, 'rules');

      files.push({
        path: path.join(targetDir, `${baseName}.md`),
        content: this.stripFrontmatter(rule.content || ''),
        type: 'rule',
        scope: 'project',
      });
    }

    return {
      files,
      summary: {
        rules: files.length,
        modeScopedRules: files.filter(f => f.path.includes('/rules-')).length,
      },
    };
  }

  /**
   * Adapt rules for JetBrains AI
   * Target: .aiignore (Gitignore style)
   * Note: JetBrains rules are UI based, so we can only generate avoid-lists or instructions.
   */
  async adaptForJetBrains(rules, _projectContext, _config = {}) {
    const _ignorePath = path.join(this.projectPath, '.aiignore');
    // We can't really "inject" rules into JetBrains AI easily via file.
    // So we generate a setup guide.

    const instructionsPath = path.join(this.projectPath, 'JETBRAINS_SETUP.md');
    const content =
      `# JetBrains AI Setup\n\nManually add these instructions to 'Prompt Library':\n\n` +
      rules.map(r => `## ${r.name}\n${this.stripFrontmatter(r.content)}`).join('\n\n');

    return {
      files: [
        {
          path: instructionsPath,
          content,
          type: 'instructions',
          scope: 'project',
        },
      ],
      summary: {
        mode: 'manual-setup-guide',
      },
    };
  }

  /**
   * Adapt rules for Tabnine
   * Target: .tabnine/guidelines/*.md
   */
  async adaptForTabnine(rules, _projectContext, _config = {}) {
    const guidelinesDir = path.join(this.projectPath, '.tabnine', 'guidelines');
    const files = [];

    for (const rule of rules) {
      const fileName = `${this.getCursorFileName(rule)}.md`;
      files.push({
        path: path.join(guidelinesDir, fileName),
        content: this.stripFrontmatter(rule.content),
        type: 'guideline',
        scope: 'project',
      });
    }

    return {
      files,
      summary: {
        guidelines: files.length,
      },
    };
  }

  // === Claude Code CLI Memory Generators ===

  /**
   * Generate Claude Code CLI global memory for cross-project preferences
   * @param {Array} globalRules - Global core rules
   * @returns {string} Global memory content
   */
  generateClaudeGlobalMemory(_globalRules) {
    return `# Claude Code CLI User Memory

## Coding Preferences

### Code Style
- Use consistent indentation (2-space for JS/TS/JSON/YAML, 4-space for Python/Go)
- Always use semicolons in JavaScript/TypeScript
- Prefer const/let over var
- Use descriptive variable names, avoid abbreviations
- Add JSDoc comments for complex functions

### Project Structure
- Follow conventional directory structures (src/, lib/, components/, etc.)
- Keep components small and focused (single responsibility)
- Separate business logic from UI components
- Use barrel exports (index.js/ts) for clean imports

### Testing
- Write tests for all business logic
- Use descriptive test names that explain behavior
- Group related tests with describe blocks
- Mock external dependencies in unit tests

## Development Environment

### Tools & Setup
- Primary IDE: Claude Code CLI
- Package manager: pnpm (primary), npm (fallback)
- Use TypeScript for new JavaScript projects
- Use ESLint + Prettier for code formatting

### Git Workflow
- Use conventional commit messages (feat:, fix:, docs:, etc.)
- Create feature branches from main/master
- Squash commits before merging to main
- Always create pull/merge requests for code review

## Workflow Preferences

### Development Workflow
- Start with failing tests (TDD when appropriate)
- Run tests before committing
- Use feature flags for incomplete features
- Implement monitoring and observability

---
*Global Claude Code CLI preferences - Applied across all projects*`;
  }

  generateClaudeMainMemory(_coreRules, projectContext) {
    const projectName = path.basename(this.projectPath);
    const techStack = projectContext.techStack || {};

    const content = `# ${projectName} - Claude Code CLI Memory

## Project Overview

This project uses VDK CLI for AI assistant integration and follows specific patterns and conventions.

### Key Information
- **VDK CLI Integration**: Active
- **Primary Languages**: ${techStack.primaryLanguages?.join(', ') || 'Not detected'}
- **Frameworks**: ${techStack.frameworks?.join(', ') || 'Not detected'}
- **Architecture**: ${projectContext.patterns?.architecturalPatterns?.join(', ') || 'Standard'}

## Memory Hierarchy

@CLAUDE-patterns.md
@CLAUDE-personal.md

## Important Conventions
- All AI rule artifacts are stored in \`.vdk/blueprints/rules/\` directory
- Rules follow unified YAML frontmatter format
- Project follows VDK CLI naming conventions
- Memory persistence is enabled for context continuity

## VDK CLI Commands
- \`/project:analyze\` - Analyze project structure and patterns
- \`/project:refresh\` - Update VDK rules based on project changes
- \`/project:validate\` - Validate rule consistency

---
*Team-shared project memory - Last updated: ${new Date().toISOString()}*`;

    return content;
  }

  /**
   * Generate Claude Code CLI personal preferences import file
   * @returns {string} Personal preferences import content
   */
  generateClaudePersonalPrefsImport() {
    return `# Personal Preferences Import

## Import Personal Settings
@~/.claude/CLAUDE.md

## Project-Specific Overrides
- Personal preferences are imported automatically
- Project-specific settings take precedence
- Use this file to override global settings for this project

---
*Personal preferences import - Loads from ~/.claude/CLAUDE.md*`;
  }

  generateClaudeTechMemory(techRules, _projectContext) {
    const projectName = path.basename(this.projectPath);
    let content = `# ${projectName} - Technology Patterns

## Technology-Specific Guidelines

This file contains technology and framework-specific patterns for this project.

`;

    // Group rules by framework/technology
    const rulesByTech = this.groupRulesByTechnology(techRules);

    for (const [tech, rules] of Object.entries(rulesByTech)) {
      content += `## ${tech}\n\n`;

      for (const rule of rules) {
        const cleanContent = this.stripFrontmatter(rule.content);
        content += this.extractKeySections(cleanContent, [
          'patterns',
          'best practices',
          'conventions',
        ]);
        content += '\n';
      }

      content += '\n';
    }

    content += `---
*Generated by VDK CLI - Technology patterns for ${projectName}*`;

    return content;
  }

  /**
   * Generate CLAUDE.local.md content for local/private project context
   */
  generateClaudeLocalMemory(techRules, _projectContext) {
    const projectName = path.basename(this.projectPath);
    let content = `# ${projectName} - Local Development Context

## Technology-Specific Patterns
`;

    // Group rules by framework/technology
    const rulesByTech = {};
    for (const rule of techRules) {
      const tech = rule.frontmatter?.framework || rule.frontmatter?.technology || 'General';
      if (!rulesByTech[tech]) {
        rulesByTech[tech] = [];
      }
      rulesByTech[tech].push(rule);
    }

    // Generate sections for each technology
    for (const [tech, rules] of Object.entries(rulesByTech)) {
      content += `\n### ${tech}\n`;
      for (const rule of rules) {
        const cleanContent = this.stripFrontmatter(rule.content);
        content += `${cleanContent}\n\n`;
      }
    }

    content += `
## Local Development Notes
- Add your personal development notes here
- This file is gitignored and won't be shared with the team

---
*Local context - not version controlled*`;

    return content;
  }

  generateClaudeIntegrationMemory(projectContext) {
    const projectName = path.basename(this.projectPath);
    const techStack = projectContext.techStack || {};

    return `# ${projectName} - Integration Context

## Technology Stack Integration

### Detected Stack
- **Languages**: ${techStack.primaryLanguages?.join(', ') || 'Not detected'}
- **Frameworks**: ${techStack.frameworks?.join(', ') || 'Not detected'}
- **Libraries**: ${techStack.libraries?.join(', ') || 'Not detected'}
- **Build Tools**: ${techStack.buildTools?.join(', ') || 'Not detected'}

### Integration Patterns
- VDK CLI manages AI assistant rules across multiple platforms
- Claude Code CLI provides memory persistence and slash commands
- Project rules are automatically synchronized with team preferences
- Memory hierarchy: Project → Local → User preferences

### Available Commands
- \`/project:analyze\` - Analyze project structure and patterns
- \`/project:refresh\` - Update VDK rules based on project changes
- \`/project:validate\` - Validate rule consistency

---
*Integration context maintained by VDK CLI*`;
  }

  generateClaudeActiveContext(_projectContext) {
    return `# Active Development Context

## Current Session
- **Project**: ${path.basename(this.projectPath)}
- **Last Analysis**: ${new Date().toISOString()}
- **VDK Version**: Active

## Quick Reference
- Project memory files are active
- Technology patterns loaded
- Integration context available

## Session Notes
*This file can be used for temporary notes and context that shouldn't be shared with the team*

---
*Local memory file - not version controlled*`;
  }

  generateClaudeSlashCommand(rule, _projectContext) {
    const commandName = this.getCommandName(rule.frontmatter?.description);
    const cleanContent = this.stripFrontmatter(rule.content);

    return `# ${commandName}

${cleanContent}

Arguments: $ARGUMENTS

---
*Simple contextual aid with $ARGUMENTS placeholder support*`;
  }

  // === Cursor MDC Generators === (Duplicates removed - using methods from line 358)

  // === Windsurf Memory Generators ===

  generateWindsurfGlobalMemory(globalRules, _projectContext) {
    let content = `# Global Development Standards - VDK

## Organization Standards

`;

    for (const rule of globalRules) {
      const cleanContent = this.stripFrontmatter(rule.content);
      const xmlSection = this.convertToWindsurfXML(rule, cleanContent);
      content += `${xmlSection}\n\n`;
    }

    content += '*Organization-wide standards - Applied across all Windsurf workspaces*';

    return content;
  }

  generateWindsurfRule(rule, _projectContext) {
    const cleanContent = this.stripFrontmatter(rule.content);
    const _title = this.extractTitle(cleanContent) || rule.frontmatter?.description || 'Rule';
    const category = rule.frontmatter?.category || 'general';
    const xmlTag = this.getWindsurfXMLTag(category);

    return `<${xmlTag}>
${cleanContent}
</${xmlTag}>`;
  }

  convertToWindsurfXML(rule, content) {
    const category = rule.frontmatter?.category || 'general';
    const xmlTag = this.getWindsurfXMLTag(category);

    const keyContent = this.extractKeySections(content, [
      'principles',
      'guidelines',
      'patterns',
      'best practices',
    ]);

    return `<${xmlTag}>
${this.formatForWindsurf(keyContent)}
</${xmlTag}>`;
  }

  getWindsurfXMLTag(category) {
    const tagMap = {
      core: 'development-standards',
      language: 'language-standards',
      technology: 'technology-guidelines',
      framework: 'technology-guidelines',
      testing: 'testing-patterns',
      task: 'task-workflow',
      assistant: 'ai-assistance',
    };
    return tagMap[category] || 'rule';
  }

  formatForWindsurf(content) {
    // Format content for Windsurf XML sections with proper indentation
    return content
      .split('\n')
      .map(line => (line.trim() ? `- ${line.trim()}` : ''))
      .filter(line => line)
      .join('\n');
  }

  getWindsurfFileName(rule) {
    const framework = rule.frontmatter?.framework || rule.frontmatter?.category || 'general';
    const id = rule.frontmatter?.id || '';

    // Create a unique filename combining available identifiers
    let baseName = framework;
    if (id && id !== framework) {
      baseName = `${framework}-${id}`;
    }

    // Clean up the name: preserve meaningful separators, replace others with hyphens
    const cleanName = baseName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-') // Replace non-alphanumeric (except hyphens/underscores) with hyphens
      .replace(/[-_]+/g, '-') // Replace multiple consecutive separators with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Ensure we have a valid filename
    const finalName = cleanName || `windsurf-rule-${Date.now()}`;
    return `${finalName}.md`;
  }

  /**
   * Determine Windsurf activation type based on rule characteristics
   * @param {Object} rule - Rule object
   * @returns {string} Activation type
   */
  getWindsurfActivationType(rule) {
    // Manual - Via @mention in Cascade
    if (rule.frontmatter?.category === 'task') {
      return 'manual';
    }

    // Always On - Automatically applied
    if (rule.frontmatter?.alwaysApply === true) {
      return 'always-on';
    }

    // Glob - Based on file pattern matching
    if (rule.frontmatter?.globs && rule.frontmatter?.globs.length > 0) {
      return 'glob';
    }

    // Model Decision - Based on natural language description
    if (rule.frontmatter?.description) {
      return 'model-decision';
    }

    return 'model-decision'; // Default
  }

  /**
   * Generate consolidated Windsurf rules for single-file deployment
   * @param {Array} rules - Workspace rules
   * @param {Object} projectContext - Project context
   * @returns {string} Consolidated content
   */
  generateConsolidatedWindsurfRules(rules, _projectContext) {
    const projectName = path.basename(this.projectPath);
    let content = `# ${projectName} - Windsurf Project Rules

## Development Standards

`;

    // Group rules by category for better organization
    const rulesByCategory = this.groupRulesByCategory(rules);

    for (const [category, categoryRules] of Object.entries(rulesByCategory)) {
      const xmlTag = this.getWindsurfXMLTag(category);
      content += `<${xmlTag}>\n`;

      for (const rule of categoryRules) {
        const cleanContent = this.stripFrontmatter(rule.content);
        const keyPoints = this.extractKeyPoints(cleanContent);
        content += `${keyPoints.map(point => `- ${point}`).join('\n')}\n`;
      }

      content += `</${xmlTag}>\n\n`;
    }

    content += '*Consolidated project rules - Model decision activation*';

    return content;
  }

  /**
   * Group rules by category for organized display
   * @param {Array} rules - Rules to group
   * @returns {Object} Rules grouped by category
   */
  groupRulesByCategory(rules) {
    const groups = {};

    for (const rule of rules) {
      const category = rule.frontmatter?.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(rule);
    }

    return groups;
  }

  /**
   * Truncate content to character limit (HELPER for GitHub Copilot)
   * @param {string} content - Content to truncate
   * @param {number} limit - Character limit
   * @returns {string} Truncated content
   */
  truncateToCharLimit(content, limit) {
    if (content.length <= limit) {
      return content;
    }

    // Try to truncate at a sentence boundary
    const truncated = content.substring(0, limit - 3);
    const lastSentence = truncated.lastIndexOf('.');

    if (lastSentence > limit * 0.7) {
      // If we can keep at least 70% and end at sentence
      return truncated.substring(0, lastSentence + 1);
    }

    return `${truncated}...`;
  }

  // === GitHub Copilot Generators ===

  prioritizeRulesForCopilot(rules) {
    // Prioritize rules based on their effectiveness for code review
    return rules
      .filter(rule => rule.frontmatter?.category !== 'assistant') // Skip assistant-specific rules
      .toSorted((a, b) => {
        const aPriority = this.getCopilotPriority(a);
        const bPriority = this.getCopilotPriority(b);
        return bPriority - aPriority;
      });
  }

  getCopilotPriority(rule) {
    // Assign priority scores for GitHub Copilot effectiveness
    const category = rule.frontmatter?.category || 'general';
    const hasGlobs = rule.frontmatter?.globs && rule.frontmatter?.globs.length > 0;

    let score = 0;
    if (category === 'core') {
      score += 10;
    }
    if (category === 'language' || category === 'technology') {
      score += 8;
    }
    if (category === 'stack') {
      score += 6;
    }
    if (category === 'task') {
      score += 4;
    }
    if (hasGlobs) {
      score += 3;
    }
    if (rule.frontmatter?.alwaysApply === true) {
      score += 2;
    }

    return score;
  }

  generateCopilotGuideline(rule, _projectContext) {
    const title =
      this.extractTitle(this.stripFrontmatter(rule.content)) || rule.frontmatter?.description;
    const description = this.generateCopilotDescription(rule);
    const paths = rule.frontmatter?.globs || [];

    return {
      title: title.substring(0, 100), // Reasonable title length
      description: description.substring(0, 600), // GitHub Copilot limit
      paths,
    };
  }

  generateCopilotDescription(rule) {
    const cleanContent = this.stripFrontmatter(rule.content);
    const keyPoints = this.extractKeyPoints(cleanContent);

    // Create concise description focused on what Copilot should look for
    let description = rule.frontmatter?.description;

    if (keyPoints.length > 0) {
      description += `. Key points: ${keyPoints.slice(0, 3).join('. ')}`;
    }

    return description;
  }

  generateCopilotDocumentation(guidelines, _projectContext) {
    const projectName = path.basename(this.projectPath);

    let content = `# GitHub Copilot Guidelines for ${projectName}

## Overview

This directory contains GitHub Copilot Enterprise coding guidelines generated by VDK CLI.

## Active Guidelines

`;

    guidelines.forEach((guideline, index) => {
      content += `### ${index + 1}. ${guideline.title}

**Description**: ${guideline.description}

`;
      if (guideline.paths.length > 0) {
        content += `**File Patterns**: ${guideline.paths.map(p => `\`${p}\``).join(', ')}

`;
      }
    });

    content += `## Setup Instructions

1. Navigate to your repository on GitHub
2. Go to Settings → Code & automation → Copilot → Code review
3. Configure the guidelines listed above
4. Each guideline should be added with its title and description

## VDK Integration

- Guidelines updated automatically with \`vdk sync\`
- Project patterns detected and incorporated
- Maximum 6 guidelines per repository (GitHub Copilot limit)

---
*Generated by VDK CLI*`;

    return content;
  }

  // === Utility Methods ===

  stripFrontmatter(content) {
    if (content.startsWith('---')) {
      const parts = content.split('---');
      return parts.slice(2).join('---').trim();
    }
    return content;
  }

  extractTitle(content) {
    const lines = content.split('\n');
    const titleLine = lines.find(line => line.startsWith('# '));
    return titleLine ? titleLine.replace('# ', '').trim() : 'Untitled';
  }

  extractKeySections(content, sectionTypes) {
    const lines = content.split('\n');
    let result = '';
    let inTargetSection = false;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const sectionTitle = line.toLowerCase();
        inTargetSection = sectionTypes.some(type => sectionTitle.includes(type));
      }

      if (inTargetSection && !line.startsWith('#')) {
        result += `${line}\n`;
      }
    }

    return result.trim();
  }

  extractKeyPoints(content) {
    const lines = content.split('\n');
    return lines
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 10); // Filter out very short points
  }

  groupRulesByTechnology(rules) {
    const groups = {};

    for (const rule of rules) {
      const tech = rule.frontmatter?.framework || rule.frontmatter?.category || 'General';
      if (!groups[tech]) {
        groups[tech] = [];
      }
      groups[tech].push(rule);
    }

    return groups;
  }

  getCommandName(description) {
    return description
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim();
  }

  /**
   * Adapt rules for Zed Editor
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @param {Object} platformConfig - Zed-specific configuration
   * @returns {Object} Zed-native configuration
   */
  async adaptForZed(rules, _projectContext, platformConfig = {}) {
    const adaptedFiles = [];
    const mode = platformConfig.mode || 'project'; // global or project
    const aiFeatures = platformConfig.aiFeatures !== false; // Default: true
    const collaborative = platformConfig.collaborative !== false; // Default: true
    const performance = platformConfig.performance || 'high'; // high, medium, low

    const baseDir =
      mode === 'global'
        ? path.join(os.homedir(), '.config', 'zed')
        : path.join(this.projectPath, '.zed');

    const aiRulesDir = path.join(baseDir, 'ai-rules');

    for (const rule of rules) {
      const ruleContent = this.stripFrontmatter(rule.content);
      const title = rule.frontmatter?.title || this.extractTitle(rule.content);
      const cleanTitle = title
        .trim()
        .replace(/[^a-z0-9-]/gi, '-') // Replace non-alphanumeric (except hyphens) with hyphens
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase();
      const filename = cleanTitle ? `${cleanTitle}.md` : `rule-${Date.now()}.md`;

      adaptedFiles.push({
        path: path.join(aiRulesDir, filename),
        content: ruleContent,
        type: 'ai-rule',
        scope: mode,
        aiFeatures: aiFeatures && rule.frontmatter?.aiFeatures !== false,
        collaborative: collaborative && rule.frontmatter?.collaborative !== false,
        performance,
      });
    }

    return {
      files: adaptedFiles,
      summary: {
        generated: adaptedFiles.length,
        mode,
        aiFeatures,
        collaborative,
        performance,
      },
    };
  }

  /**
   * Adapt rules for VS Code family (VS Code, Insiders, VSCodium)
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @param {Object} platformConfig - VS Code-specific configuration
   * @returns {Object} VS Code-native configuration
   */
  async adaptForVSCode(rules, _projectContext, platformConfig = {}) {
    const adaptedFiles = [];
    const extension = platformConfig.extension || null;
    const settings = platformConfig.settings || {};
    const _commands = platformConfig.commands || [];
    const mcpIntegration = platformConfig.mcpIntegration;

    // Determine config directory based on VS Code variant
    let configDir = '.vscode';
    if (platformConfig.configPath) {
      configDir = platformConfig.configPath;
    }

    const aiRulesDir = path.join(this.projectPath, configDir, 'ai-rules');

    // Generate rule files
    for (const rule of rules) {
      const ruleContent = this.stripFrontmatter(rule.content);
      const title = rule.frontmatter?.title || this.extractTitle(rule.content);
      const cleanTitle = title
        .trim()
        .replace(/[^a-z0-9-]/gi, '-') // Replace non-alphanumeric (except hyphens) with hyphens
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase();
      const filename = cleanTitle ? `${cleanTitle}.md` : `rule-${Date.now()}.md`;

      adaptedFiles.push({
        path: path.join(aiRulesDir, filename),
        content: ruleContent,
        type: 'ai-rule',
      });
    }

    // Generate MCP configuration if enabled
    if (mcpIntegration) {
      const mcpConfig = {
        servers: {},
        globalShortcuts: settings,
      };

      adaptedFiles.push({
        path: path.join(this.projectPath, configDir, 'mcp.json'),
        content: JSON.stringify(mcpConfig, null, 2),
        type: 'mcp-config',
      });
    }

    return {
      files: adaptedFiles,
      summary: {
        generated: adaptedFiles.length,
        extension,
        mcpIntegration,
        configDir,
      },
    };
  }

  /**
   * Adapt rules for generic platforms
   * @param {Array} rules - Standardized rules
   * @param {Object} projectContext - Project context
   * @param {Object} platformConfig - Generic platform configuration
   * @returns {Object} Generic platform configuration
   */
  async adaptForGeneric(rules, projectContext, platformConfig = {}) {
    const adaptedFiles = [];
    const configPath = platformConfig.configPath || '.vdk';
    const rulesPath = platformConfig.rulesPath || '.vdk/blueprints/rules';
    const priority = platformConfig.priority || 5;

    const baseDir = path.join(this.projectPath, configPath);
    const rulesDir = path.join(this.projectPath, rulesPath);

    // Sort rules by priority
    const prioritizedRules = rules.toSorted((a, b) => {
      const aPriority = a.frontmatter?.priority || priority;
      const bPriority = b.frontmatter?.priority || priority;
      return bPriority - aPriority;
    });

    // Generate rule files
    for (const rule of prioritizedRules) {
      const ruleContent = this.stripFrontmatter(rule.content);
      const title = rule.frontmatter?.title || this.extractTitle(rule.content);
      const cleanTitle = title
        .trim()
        .replace(/[^a-z0-9-]/gi, '-') // Replace non-alphanumeric (except hyphens) with hyphens
        .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .toLowerCase();
      const filename = cleanTitle ? `${cleanTitle}.md` : `rule-${Date.now()}.md`;

      adaptedFiles.push({
        path: path.join(rulesDir, filename),
        content: ruleContent,
        type: 'ai-rule',
        priority: rule.frontmatter?.priority || priority,
      });
    }

    // Generate generic configuration
    const genericConfig = {
      version: '3.0.0',
      platform: 'generic-ai',
      rules: {
        directory: rulesPath,
        priority,
        count: adaptedFiles.length,
      },
      project: {
        name: path.basename(this.projectPath),
        technologies: projectContext.technologies || [],
        framework: projectContext.framework || null,
      },
      generatedAt: new Date().toISOString(),
    };

    adaptedFiles.push({
      path: path.join(baseDir, 'config.json'),
      content: JSON.stringify(genericConfig, null, 2),
      type: 'config',
    });

    return {
      files: adaptedFiles,
      summary: {
        generated: adaptedFiles.length - 1, // Exclude config file
        config: 1,
        priority,
        configPath,
        rulesPath,
      },
    };
  }

  // ============================================================================
  // VDK-Native Intelligence Methods (Universal for all platforms)
  // ============================================================================

  /**
   * Determine project type from VDK technology analysis
   * @param {Object} vdkAnalysis - VDK analysis data
   * @returns {string} Human-readable project type
   */
  determineProjectType(projectContext) {
    const technologyData = projectContext.technologyData || projectContext.technology || {};
    const frameworks = technologyData.frameworks || [];
    const languages = technologyData.primaryLanguages || [];
    const stacks = technologyData.stacks || [];
    const _projectStructure = projectContext.projectStructure || projectContext.structure || {};

    // Check for CLI tool indicators FIRST (highest priority)
    if (this.isCLIProject(projectContext)) {
      return 'Node.js CLI Application';
    }

    // Check for documentation/content sites
    if (stacks.includes('Astro Content Stack') && frameworks.includes('Starlight')) {
      return 'Astro Starlight Documentation Site';
    }

    // Check for web frameworks (only if not a CLI)
    if (frameworks.includes('Astro')) {
      return 'Astro Application';
    }
    if (frameworks.includes('Next.js') && frameworks.includes('Supabase')) {
      return 'Next.js + Supabase Full-Stack Application';
    }
    if (frameworks.includes('Next.js')) {
      return 'Next.js Application';
    }
    if (frameworks.includes('React')) {
      return 'React Application';
    }
    if (frameworks.includes('Vue.js')) {
      return 'Vue.js Application';
    }
    if (languages.includes('TypeScript')) {
      return 'TypeScript Application';
    }
    if (languages.includes('JavaScript')) {
      return 'JavaScript Application';
    }

    return 'Software Project';
  }

  /**
   * Check if this is a CLI project based on package.json and structure
   */
  isCLIProject(projectContext) {
    const technologyData = projectContext.technologyData || projectContext.technology || {};
    const projectStructure = projectContext.projectStructure || projectContext.structure || {};

    // Check for CLI indicators in package.json
    if (technologyData.packageInfo) {
      const pkg = technologyData.packageInfo;

      // Has bin field in package.json
      if (pkg.bin) {
        return true;
      }

      // Has CLI-related keywords
      const keywords = pkg.keywords || [];
      const cliKeywords = ['cli', 'command-line', 'terminal', 'tool', 'utility'];
      if (cliKeywords.some(keyword => keywords.includes(keyword))) {
        return true;
      }

      // Has CLI-related dependencies
      const deps = [...(pkg.dependencies || []), ...(pkg.devDependencies || [])];
      const cliDeps = ['commander', 'yargs', 'inquirer', 'chalk', 'ora', 'boxen'];
      if (cliDeps.some(dep => deps.includes(dep))) {
        return true;
      }
    }

    // Check for executable files in project root
    const rootFiles = projectStructure.files || [];
    const hasExecutable = rootFiles.some(
      file =>
        file.name === 'cli.js' ||
        file.name === 'cli.ts' ||
        file.name.startsWith('bin/') ||
        (file.executable && file.name.match(/\.(js|ts)$/))
    );

    if (hasExecutable) {
      return true;
    }

    return false;
  }

  /**
   * Extract VDK technology-specific guidelines from blueprint rules
   * @param {Array} technologyRules - Technology-related blueprint rules
   * @param {Object} vdkAnalysis - VDK analysis data
   * @returns {string} Formatted technology guidelines
   */
  async extractVDKTechnologyGuidelines(technologyRules, projectContext) {
    if (!technologyRules || technologyRules.length === 0) {
      return `### General Guidelines
- Follow established patterns in the codebase
- Maintain consistency with existing code
- Use project-specific conventions`;
    }

    const technologyData = projectContext.technologyData || projectContext.technology || {};
    const frameworks = technologyData.frameworks || [];
    const languages = technologyData.primaryLanguages || [];
    const libraries = technologyData.libraries || [];

    if (this.verbose) {
      console.log(
        `🔍 Processing ${technologyRules.length} technology rules for VDK-native guidelines`
      );
    }

    const guidelines = [];

    // Extract framework-specific guidelines
    for (const framework of frameworks) {
      const frameworkRules = this.findMatchingRules(technologyRules, framework);
      if (frameworkRules.length > 0) {
        guidelines.push(`### ${framework} Guidelines`);
        for (const rule of frameworkRules.slice(0, 3)) {
          const extractedContent = this.extractActionableContent(rule.content, projectContext);
          if (extractedContent) {
            guidelines.push(extractedContent);
          }
        }
        guidelines.push('');
      }
    }

    // Extract language-specific guidelines
    for (const language of languages) {
      const languageRules = this.findMatchingRules(technologyRules, language);
      if (languageRules.length > 0) {
        guidelines.push(`### ${language} Guidelines`);
        for (const rule of languageRules.slice(0, 2)) {
          const extractedContent = this.extractActionableContent(rule.content, projectContext);
          if (extractedContent) {
            guidelines.push(extractedContent);
          }
        }
        guidelines.push('');
      }
    }

    // Extract library-specific guidelines
    for (const library of libraries.slice(0, 3)) {
      // Limit to top 3 libraries
      const libraryRules = this.findMatchingRules(technologyRules, library);
      if (libraryRules.length > 0) {
        guidelines.push(`### ${library} Guidelines`);
        for (const rule of libraryRules.slice(0, 2)) {
          const extractedContent = this.extractActionableContent(rule.content, projectContext);
          if (extractedContent) {
            guidelines.push(extractedContent);
          }
        }
        guidelines.push('');
      }
    }

    return guidelines.length > 0
      ? guidelines.join('\n')
      : `### Project-Specific Guidelines
- Follow patterns established in this ${frameworks.join('/')} codebase
- Maintain consistency with existing ${languages.join('/')} code
- Reference VDK blueprints: ${technologyRules.length} rules available`;
  }

  /**
   * Find blueprint rules matching a technology name
   * @param {Array} rules - Blueprint rules to search
   * @param {string} technology - Technology name to match
   * @returns {Array} Matching rules
   */
  findMatchingRules(rules, technology) {
    const techLower = technology.toLowerCase();
    const aliases = {
      'tailwind css': ['tailwind', 'tailwindcss'],
      'next.js': ['nextjs'],
      'shadcn/ui': ['shadcn', 'shadcnui'],
    };

    const searchTerms = [techLower];
    if (aliases[techLower]) {
      searchTerms.push(...aliases[techLower]);
    }

    return rules.filter(rule =>
      searchTerms.some(
        term => rule.name?.toLowerCase().includes(term) || rule.path?.toLowerCase().includes(term)
      )
    );
  }

  /**
   * Extract actionable content from blueprint rules
   * @param {string} content - Rule content
   * @param {Object} vdkAnalysis - VDK analysis for context
   * @returns {string} Extracted actionable guidelines
   */
  extractActionableContent(content, _projectContext) {
    if (!content) return null;

    try {
      // Remove frontmatter
      const withoutFrontmatter = this.stripFrontmatter(content);
      const lines = withoutFrontmatter.split('\n');
      const relevantLines = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Look for actionable guidelines (bullet points with action words)
        if (
          (trimmed.startsWith('- ') || trimmed.startsWith('* ')) &&
          this.isActionableGuideline(trimmed)
        ) {
          relevantLines.push(trimmed);
        }
        // Capture numbered lists that are guidelines
        else if (trimmed.match(/^\d+\.\s/) && this.isActionableGuideline(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s/, '');
          relevantLines.push(`- ${content}`);
        }

        // Limit content extraction
        if (relevantLines.length >= 8) break;
      }

      return relevantLines.length > 0 ? relevantLines.join('\n') : null;
    } catch (error) {
      if (this.verbose) {
        console.warn(`Failed to extract content from rule: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Check if a line contains actionable guidelines
   * @param {string} line - Line to check
   * @returns {boolean} True if actionable
   */
  isActionableGuideline(line) {
    const actionableWords = [
      'use',
      'avoid',
      'prefer',
      'should',
      'must',
      'always',
      'never',
      'implement',
      'ensure',
      'configure',
      'follow',
      'apply',
      'keep',
      'optimize',
      'test',
      'validate',
      'structure',
      'organize',
    ];

    return actionableWords.some(word => line.toLowerCase().includes(word)) && line.length > 20;
  }

  /**
   * Detect package manager from VDK analysis
   * @param {Object} vdkAnalysis - VDK analysis data
   * @returns {Promise<string>} Package manager name
   */
  async detectPackageManager(projectContext) {
    const projectPath =
      projectContext.projectStructure?.root || projectContext.structure?.root || this.projectPath;

    try {
      // Check for lock files in order of preference
      if (await this.fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
        return 'pnpm';
      }
      if (await this.fileExists(path.join(projectPath, 'yarn.lock'))) {
        return 'yarn';
      }
      if (await this.fileExists(path.join(projectPath, 'bun.lockb'))) {
        return 'bun';
      }
      if (await this.fileExists(path.join(projectPath, 'package-lock.json'))) {
        return 'npm';
      }
      return 'npm';
    } catch {
      return 'npm';
    }
  }

  /**
   * Helper to check if file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // V3.0 COMPONENT ADAPTATION METHODS
  // ============================================================================

  /**
   * Adapt components (agents, rules, commands, skills) for target platform
   * @param {Object} components - Components to adapt
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted components
   */
  async adaptComponents(components, targetPlatform, projectContext = {}) {
    const adapted = {
      main: null,
      agents: [],
      rules: [],
      commands: [],
      skills: [],
      workflows: [],
      settings: null,
      files: [],
      directories: [],
    };

    // Adapt agents
    if (components.agents && components.agents.length > 0) {
      adapted.agents = await this.adaptAgents(components.agents, targetPlatform, projectContext);
    }

    // Adapt rules
    if (components.rules && components.rules.length > 0) {
      adapted.rules = await this.adaptRulesV3(components.rules, targetPlatform, projectContext);
    }

    // Adapt commands
    if (components.commands && components.commands.length > 0) {
      adapted.commands = await this.adaptCommands(
        components.commands,
        targetPlatform,
        projectContext
      );
    }

    // Adapt skills
    if (components.skills && components.skills.length > 0) {
      adapted.skills = await this.adaptSkills(components.skills, targetPlatform, projectContext);
    }

    // Adapt workflows
    if (components.workflows && components.workflows.length > 0) {
      adapted.workflows = await this.adaptWorkflows(
        components.workflows,
        targetPlatform,
        projectContext
      );
    }

    // Adapt main file
    if (components.main) {
      adapted.main = await this.adaptMainFile(components.main, targetPlatform, projectContext);
    }

    // Adapt settings
    if (components.settings) {
      adapted.settings = await this.adaptSettings(
        components.settings,
        targetPlatform,
        projectContext
      );
    }

    return adapted;
  }

  /**
   * Adapt agents for target platform
   * @param {Array} agents - Agent components
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Array>} Adapted agents
   */
  async adaptAgents(agents, targetPlatform, projectContext) {
    const adapted = [];

    for (const agent of agents) {
      const adaptedAgent = await this.adaptAgent(agent, targetPlatform, projectContext);
      if (adaptedAgent) {
        adapted.push(adaptedAgent);
      }
    }

    return adapted;
  }

  /**
   * Adapt single agent for target platform
   * @param {Object} agent - Agent component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted agent
   */
  async adaptAgent(agent, targetPlatform, projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'claude-code':
        return this.adaptAgentForClaude(agent, projectContext);
      case 'cursor':
        return this.adaptAgentForCursor(agent, projectContext);
      case 'windsurf':
        return this.adaptAgentForWindsurf(agent, projectContext);
      default:
        return agent; // Return as-is for unsupported platforms
    }
  }

  /**
   * Adapt agent for Claude Code
   * @param {Object} agent - Agent component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted agent
   */
  adaptAgentForClaude(agent, _projectContext) {
    // Claude Code agents support full frontmatter
    return {
      name: agent.name,
      content: agent.content,
      frontmatter: {
        name: agent.name,
        description: agent.description || '',
        tools: agent.tools || ['Read', 'Grep', 'Glob'],
        model: agent.model || 'sonnet',
        triggers: agent.triggers || [],
      },
      format: 'markdown',
      location: `.claude/agents/${agent.name}.md`,
    };
  }

  /**
   * Adapt agent for Cursor (as rule with agent-requested activation)
   * @param {Object} agent - Agent component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted agent as Cursor rule
   */
  adaptAgentForCursor(agent, _projectContext) {
    // Cursor doesn't have agents, convert to agent-requested rule
    return {
      name: agent.name,
      content: agent.content,
      frontmatter: {
        description: agent.description || `${agent.name} agent`,
        alwaysApply: false, // Agent-requested mode
      },
      format: 'mdc',
      location: `.cursor/rules/${agent.name}.mdc`,
    };
  }

  /**
   * Adapt agent for Windsurf (as rule)
   * @param {Object} agent - Agent component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted agent as Windsurf rule
   */
  adaptAgentForWindsurf(agent, _projectContext) {
    // Windsurf doesn't have agents, convert to rule
    return {
      name: agent.name,
      content: agent.content,
      frontmatter: {
        description: agent.description || `${agent.name} agent`,
        mode: 'always',
      },
      format: 'markdown',
      location: `.windsurf/rules/${agent.name}.md`,
    };
  }

  /**
   * Adapt rules for v3.0 (renamed from adaptRules to avoid conflict)
   * @param {Array} rules - Rule components
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Array>} Adapted rules
   */
  async adaptRulesV3(rules, targetPlatform, projectContext) {
    const adapted = [];

    for (const rule of rules) {
      const adaptedRule = await this.adaptRule(rule, targetPlatform, projectContext);
      if (adaptedRule) {
        adapted.push(adaptedRule);
      }
    }

    return adapted;
  }

  /**
   * Adapt single rule for target platform
   * @param {Object} rule - Rule component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted rule
   */
  async adaptRule(rule, targetPlatform, projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'claude-code':
        return this.adaptRuleForClaude(rule, projectContext);
      case 'cursor':
        return this.adaptRuleForCursor(rule, projectContext);
      case 'windsurf':
        return this.adaptRuleForWindsurf(rule, projectContext);
      default:
        return rule;
    }
  }

  /**
   * Adapt rule for Claude Code
   * @param {Object} rule - Rule component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted rule
   */
  adaptRuleForClaude(rule, _projectContext) {
    return {
      name: rule.name,
      content: rule.content,
      frontmatter: {
        name: rule.name,
        description: rule.description || '',
        paths: rule.paths || rule.globs || [],
      },
      format: 'markdown',
      location: `.claude/rules/${rule.name}.md`,
    };
  }

  /**
   * Adapt rule for Cursor
   * @param {Object} rule - Rule component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted rule
   */
  adaptRuleForCursor(rule, _projectContext) {
    return {
      name: rule.name,
      content: rule.content,
      frontmatter: {
        description: rule.description || '',
        globs: rule.globs || rule.paths || [],
        alwaysApply: rule.alwaysApply,
      },
      format: 'mdc',
      location: `.cursor/rules/${rule.name}.mdc`,
    };
  }

  /**
   * Adapt rule for Windsurf
   * @param {Object} rule - Rule component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted rule
   */
  adaptRuleForWindsurf(rule, _projectContext) {
    return {
      name: rule.name,
      content: rule.content,
      frontmatter: {
        description: rule.description || '',
        globs: rule.globs || rule.paths || [],
        mode: rule.globs && rule.globs.length > 0 ? 'glob' : 'always',
      },
      format: 'markdown',
      location: `.windsurf/rules/${rule.name}.md`,
    };
  }

  /**
   * Adapt commands for target platform
   * @param {Array} commands - Command components
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Array>} Adapted commands
   */
  async adaptCommands(commands, targetPlatform, projectContext) {
    const adapted = [];

    for (const command of commands) {
      const adaptedCommand = await this.adaptCommand(command, targetPlatform, projectContext);
      if (adaptedCommand) {
        adapted.push(adaptedCommand);
      }
    }

    return adapted;
  }

  /**
   * Adapt single command for target platform
   * @param {Object} command - Command component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted command
   */
  async adaptCommand(command, targetPlatform, projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'claude-code':
        return this.adaptCommandForClaude(command, projectContext);
      case 'cursor':
        return null; // Cursor doesn't support commands
      case 'windsurf':
        return null; // Windsurf doesn't support commands
      default:
        return null;
    }
  }

  /**
   * Adapt command for Claude Code
   * @param {Object} command - Command component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted command
   */
  adaptCommandForClaude(command, _projectContext) {
    return {
      name: command.name,
      content: command.content,
      frontmatter: {
        name: command.name,
        description: command.description || '',
        allowedTools: command.allowedTools || ['Read'],
        argumentHint: command.argumentHint || '',
      },
      format: 'markdown',
      location: `.claude/commands/${command.name}.md`,
    };
  }

  /**
   * Adapt skills for target platform
   * @param {Array} skills - Skill components
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Array>} Adapted skills
   */
  async adaptSkills(skills, targetPlatform, projectContext) {
    const adapted = [];

    for (const skill of skills) {
      const adaptedSkill = await this.adaptSkill(skill, targetPlatform, projectContext);
      if (adaptedSkill) {
        adapted.push(adaptedSkill);
      }
    }

    return adapted;
  }

  /**
   * Adapt single skill for target platform
   * @param {Object} skill - Skill component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted skill
   */
  async adaptSkill(skill, targetPlatform, projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'claude-code':
        return this.adaptSkillForClaude(skill, projectContext);
      default:
        return null; // Most platforms don't support skills
    }
  }

  /**
   * Adapt skill for Claude Code
   * @param {Object} skill - Skill component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted skill
   */
  adaptSkillForClaude(skill, _projectContext) {
    return {
      name: skill.name,
      content: skill.content,
      format: 'markdown',
      location: `.claude/skills/${skill.name}.md`,
    };
  }

  /**
   * Adapt workflows for target platform
   * @param {Array} workflows - Workflow components
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Array>} Adapted workflows
   */
  async adaptWorkflows(workflows, targetPlatform, projectContext) {
    const adapted = [];

    for (const workflow of workflows) {
      const adaptedWorkflow = await this.adaptWorkflow(workflow, targetPlatform, projectContext);
      if (adaptedWorkflow) {
        adapted.push(adaptedWorkflow);
      }
    }

    return adapted;
  }

  /**
   * Adapt single workflow for target platform
   * @param {Object} workflow - Workflow component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted workflow
   */
  async adaptWorkflow(workflow, targetPlatform, projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'windsurf':
        return this.adaptWorkflowForWindsurf(workflow, projectContext);
      default:
        return null; // Only Windsurf supports workflows
    }
  }

  /**
   * Adapt workflow for Windsurf
   * @param {Object} workflow - Workflow component
   * @param {Object} projectContext - Project context
   * @returns {Object} Adapted workflow
   */
  adaptWorkflowForWindsurf(workflow, _projectContext) {
    return {
      name: workflow.name,
      content: workflow.content,
      format: 'yaml',
      location: `.windsurf/workflows/${workflow.name}.yaml`,
    };
  }

  /**
   * Adapt main file for target platform
   * @param {Object} main - Main component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted main file
   */
  async adaptMainFile(main, targetPlatform, _projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'claude-code':
        return { content: main.content, location: 'CLAUDE.md' };
      case 'cursor':
        return { content: main.content, location: '.cursor/rules/main.mdc' };
      case 'github-copilot':
        return { content: main.content, location: '.github/copilot-instructions.md' };
      case 'gemini-cli':
        return { content: main.content, location: 'GEMINI.md' };
      case 'openai-codex':
        return { content: main.content, location: 'AGENTS.md' };
      default:
        return null;
    }
  }

  /**
   * Adapt settings for target platform
   * @param {Object} settings - Settings component
   * @param {string} targetPlatform - Target platform
   * @param {Object} projectContext - Project context
   * @returns {Promise<Object>} Adapted settings
   */
  async adaptSettings(settings, targetPlatform, _projectContext) {
    switch (targetPlatform.toLowerCase()) {
      case 'claude-code':
        return { content: settings.content, location: '.claude/settings.json' };
      case 'gemini-cli':
        return { content: settings.content, location: '.gemini/settings.json' };
      default:
        return null;
    }
  }
}
