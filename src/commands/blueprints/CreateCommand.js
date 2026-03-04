/**
 * CreateCommand
 * -----------------------
 * Create a new blueprint with canonical AI Context Schema v3 structure.
 * Supports both interactive and non-interactive modes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

const DEFAULT_KIND = 'conditional-rule';

function createCanonicalPlatformConfig(platformId) {
  switch (platformId) {
    case 'claude-code':
      return {
        components: {
          main: {
            type: 'claude-main',
            location: 'CLAUDE.md',
            enabled: true,
          },
        },
      };
    case 'cursor':
      return {
        components: {
          rules: {
            type: 'cursor-rule',
            location: '.cursor/rules/',
            enabled: true,
            format: 'mdc',
            manifests: [],
          },
        },
      };
    case 'windsurf':
      return {
        components: {
          rules: {
            type: 'windsurf-rule',
            location: '.windsurf/rules/',
            enabled: true,
            manifests: [],
          },
        },
      };
    case 'github-copilot':
      return {
        components: {
          'repo-level': {
            type: 'copilot-repo',
            location: '.github/copilot-instructions.md',
            enabled: true,
          },
        },
      };
    case 'openai-codex':
      return {
        components: {
          agents: {
            type: 'agents-md',
            location: 'AGENTS.md',
            enabled: true,
          },
        },
      };
    case 'gemini-cli':
      return {
        components: {
          main: {
            type: 'gemini-main',
            location: 'GEMINI.md',
            enabled: true,
          },
        },
      };
    case 'continue':
      return {
        components: {
          config: {
            type: 'continue-config',
            location: '~/.continue/config.yaml',
            enabled: true,
          },
        },
      };
    case 'aider':
      return {
        components: {
          config: {
            type: 'aider-config',
            location: '.aider.conf.yml',
            enabled: true,
          },
        },
      };
    case 'tabnine':
      return {
        components: {
          guidelines: {
            type: 'tabnine-guideline',
            location: '.tabnine/guidelines/',
            enabled: true,
          },
        },
      };
    case 'zed':
      return {
        components: {
          settings: {
            type: 'zed-settings',
            location: '~/.config/zed/settings.json',
            enabled: true,
          },
        },
      };
    case 'jetbrains':
      return {
        components: {
          aiignore: {
            type: 'aiignore',
            location: '.aiignore',
            enabled: true,
          },
        },
      };
    default:
      return {
        enabled: true,
        components: {},
      };
  }
}

function buildCanonicalPlatforms(platformIds = []) {
  const selected =
    Array.isArray(platformIds) && platformIds.length > 0
      ? platformIds
      : ['claude-code', 'cursor', 'windsurf'];

  return selected.reduce((acc, platformId) => {
    acc[platformId] = createCanonicalPlatformConfig(platformId);
    return acc;
  }, {});
}

export class CreateCommand extends BaseCommand {
  constructor() {
    super('create', 'Create a new blueprint with canonical AI Context Schema v3 structure');
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .option('-n, --name <name>', 'Blueprint name')
      .option('-t, --title <title>', 'Blueprint title')
      .option('-d, --description <description>', 'Blueprint description')
      .option(
        '--kind <kind>',
        'Canonical kind (project-memory, conditional-rule, skill, command, workflow, agent, hook, mcp-integration, plugin-distribution)',
        DEFAULT_KIND
      )
      .option('-c, --category <category>', 'Blueprint category', 'tool')
      .option('-a, --author <author>', 'Blueprint author')
      .option('--tags <tags...>', 'Blueprint tags (space-separated)')
      .option('--complexity <level>', 'Complexity level (simple, medium, complex)', 'medium')
      .option(
        '--scope <scope>',
        'Impact scope (file, component, feature, project, system)',
        'project'
      )
      .option(
        '--audience <audience>',
        'Target audience (developer, architect, team-lead, junior, senior, any)',
        'developer'
      )
      .option(
        '--maturity <level>',
        'Maturity level (experimental, beta, stable, deprecated)',
        'beta'
      )
      .option('-o, --output <path>', 'Output file path', './.vdk/blueprints/rules')
      .option('--interactive', 'Interactive blueprint creation', false);
  }

  /**
   * Execute the create command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    try {
      let blueprintData = {};

      if (options.interactive) {
        blueprintData = await this.createInteractive();
      } else {
        blueprintData = await this.createFromOptions(options);
      }

      const filePath = await this.writeBlueprintFile(blueprintData, options.output);

      this.logSuccess(`Blueprint created: ${this.formatPath(filePath)}`);
      this.logInfo(
        `Run ${this.colorPrimary(`vdk validate --file ${filePath}`)} to validate the blueprint`
      );

      this.trackSuccess({
        blueprintName: blueprintData.name,
        interactive: options.interactive,
        category: blueprintData.category,
      });

      return { success: true, filePath, blueprintData };
    } catch (error) {
      this.exitWithError(`Blueprint creation failed: ${error.message}`, error);
    }
  }

  /**
   * Interactive blueprint creation
   */
  async createInteractive() {
    const { select, input, multiselect, confirm } = await import('@clack/prompts');

    const blueprintData = {};

    blueprintData.name = await input({
      message: 'Blueprint name (kebab-case):',
      placeholder: 'my-awesome-blueprint',
      validate: value => {
        if (!value) return 'Name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Name must be kebab-case (lowercase, hyphens only)';
        return undefined;
      },
    });

    blueprintData.title = await input({
      message: 'Blueprint title:',
      placeholder: 'My Awesome Blueprint',
    });

    blueprintData.description = await input({
      message: 'Description:',
      placeholder: 'A brief description of what this blueprint does',
    });

    blueprintData.category = await select({
      message: 'Category:',
      options: [
        { value: 'core', label: 'Core' },
        { value: 'language', label: 'Language' },
        { value: 'technology', label: 'Technology' },
        { value: 'stack', label: 'Stack' },
        { value: 'task', label: 'Task' },
        { value: 'assistant', label: 'Assistant' },
        { value: 'tool', label: 'Tool' },
        { value: 'project', label: 'Project' },
        { value: 'agent-system', label: 'Agent System' },
        { value: 'command', label: 'Command' },
        { value: 'skill', label: 'Skill' },
        { value: 'workflow', label: 'Workflow' },
        { value: 'rule', label: 'Rule' },
        { value: 'plugin', label: 'Plugin' },
      ],
    });

    blueprintData.kind = await select({
      message: 'Canonical kind:',
      initialValue: DEFAULT_KIND,
      options: [
        { value: 'project-memory', label: 'project-memory' },
        { value: 'conditional-rule', label: 'conditional-rule' },
        { value: 'skill', label: 'skill' },
        { value: 'command', label: 'command' },
        { value: 'workflow', label: 'workflow' },
        { value: 'agent', label: 'agent' },
        { value: 'hook', label: 'hook' },
        { value: 'mcp-integration', label: 'mcp-integration' },
        { value: 'plugin-distribution', label: 'plugin-distribution' },
      ],
    });

    blueprintData.complexity = await select({
      message: 'Complexity level:',
      options: [
        { value: 'simple', label: 'Simple' },
        { value: 'medium', label: 'Medium' },
        { value: 'complex', label: 'Complex' },
      ],
    });

    blueprintData.scope = await select({
      message: 'Impact scope:',
      options: [
        { value: 'file', label: 'File' },
        { value: 'component', label: 'Component' },
        { value: 'feature', label: 'Feature' },
        { value: 'project', label: 'Project' },
        { value: 'system', label: 'System' },
      ],
    });

    blueprintData.audience = await select({
      message: 'Target audience:',
      options: [
        { value: 'developer', label: 'Developer' },
        { value: 'architect', label: 'Architect' },
        { value: 'team-lead', label: 'Team Lead' },
        { value: 'junior', label: 'Junior' },
        { value: 'senior', label: 'Senior' },
        { value: 'any', label: 'Any' },
      ],
    });

    blueprintData.maturity = await select({
      message: 'Maturity level:',
      options: [
        { value: 'experimental', label: 'Experimental' },
        { value: 'beta', label: 'Beta' },
        { value: 'stable', label: 'Stable' },
        { value: 'deprecated', label: 'Deprecated' },
      ],
    });

    const tagsInput = await input({
      message: 'Tags (comma-separated):',
      placeholder: 'javascript, react, typescript',
    });
    blueprintData.tags = tagsInput ? tagsInput.split(',').map(t => t.trim().toLowerCase()) : [];

    blueprintData.author = await input({
      message: 'Author:',
      placeholder: 'Your name or organization',
    });

    const addPlatforms = await confirm({
      message: 'Configure platform-specific settings?',
      initialValue: false,
    });

    if (addPlatforms) {
      const selectedPlatforms = await multiselect({
        message: 'Select target platforms:',
        options: [
          { value: 'claude-code', label: 'Claude Code' },
          { value: 'cursor', label: 'Cursor' },
          { value: 'windsurf', label: 'Windsurf' },
          { value: 'github-copilot', label: 'GitHub Copilot' },
          { value: 'openai-codex', label: 'OpenAI Codex' },
          { value: 'gemini-cli', label: 'Gemini CLI' },
          { value: 'continue', label: 'Continue' },
          { value: 'aider', label: 'Aider' },
          { value: 'tabnine', label: 'Tabnine' },
          { value: 'zed', label: 'Zed' },
          { value: 'jetbrains', label: 'JetBrains' },
        ],
      });

      blueprintData.platforms = buildCanonicalPlatforms(selectedPlatforms);
    } else {
      blueprintData.platforms = buildCanonicalPlatforms();
    }

    return blueprintData;
  }

  /**
   * Create blueprint from command line options
   */
  async createFromOptions(options) {
    if (!options.name) {
      this.exitWithError('Blueprint name is required. Use --name or --interactive');
    }

    return {
      name: options.name,
      title: options.title || options.name,
      description: options.description || `${options.title || options.name} blueprint`,
      kind: options.kind || DEFAULT_KIND,
      category: options.category,
      complexity: options.complexity,
      scope: options.scope,
      audience: options.audience,
      maturity: options.maturity,
      author: options.author,
      tags: options.tags || [],
      platforms: buildCanonicalPlatforms(),
    };
  }

  /**
   * Generate blueprint file content
   */
  generateBlueprintContent(blueprintData) {
    const now = new Date().toISOString().split('T')[0];

    // Add required fields
    const completeData = {
      schemaVersion: '3.0',
      id: blueprintData.name,
      title: blueprintData.title || blueprintData.name,
      description: blueprintData.description || `${blueprintData.name} blueprint`,
      version: '1.0.0',
      kind: blueprintData.kind || DEFAULT_KIND,
      category: blueprintData.category,
      complexity: blueprintData.complexity,
      scope: blueprintData.scope,
      audience: blueprintData.audience,
      maturity: blueprintData.maturity,
      author: blueprintData.author,
      tags: blueprintData.tags,
      created: now,
      lastUpdated: now,
      platforms: blueprintData.platforms,
    };

    const body = `# ${completeData.title}

## Description

${completeData.description}

## Implementation

Add your implementation details here...

## Usage

Describe how to use this blueprint...

## Examples

Provide examples of the blueprint in action...

---

*Generated with VDK CLI - AI Context Schema v3.0*
`;

    return matter.stringify(body, completeData, {
      lineWidth: 120,
    });
  }

  /**
   * Write blueprint file to disk
   */
  async writeBlueprintFile(blueprintData, outputPath) {
    const resolvedOutputPath = path.resolve(outputPath);
    await fs.mkdir(resolvedOutputPath, { recursive: true });

    const filePath = path.join(resolvedOutputPath, `${blueprintData.name}.mdc`);
    const content = this.generateBlueprintContent(blueprintData);

    await fs.writeFile(filePath, content);

    return filePath;
  }
}
