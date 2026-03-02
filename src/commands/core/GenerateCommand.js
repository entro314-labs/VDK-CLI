/**
 * GenerateCommand
 * ---------------
 * Handles 'vdk generate' command - Generate platform-specific AI context files.
 * Creates Claude agents, Cursor rules, Copilot instructions, etc.
 */

import path from 'node:path';
import fs from 'fs-extra';
import { createIR, validateIR } from '../../ir/types.js';
import { RuleGenerator } from '../../scanner/core/RuleGenerator.js';
import { BaseCommand } from '../base/BaseCommand.js';

export class GenerateCommand extends BaseCommand {
  constructor() {
    super('generate', 'Generate platform-specific AI context files');
    // Initialize RuleGenerator to access its centralized adapters
    this.generator = new RuleGenerator({ verbose: false }); // Verbose toggle in execute
  }

  /**
   * Define command options
   */
  configureOptions(command) {
    return command
      .option('-t, --type <type>', 'Component type: agent, rule, command, skill, workflow')
      .option('-n, --name <name>', 'Component name')
      .option('-p, --platform <platform>', 'Target platform', 'claude-code')
      .option('-d, --description <desc>', 'Component description')
      .option('-g, --globs <patterns...>', 'Glob patterns for conditional activation')
      .option('--triggers <triggers...>', 'Trigger strings for commands')
      .option(
        '--template <template>',
        'Use a template: minimal, standard, comprehensive',
        'standard'
      )
      .option('-o, --output <path>', 'Output directory')
      .option('--dry-run', 'Preview without writing files', false)
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  /**
   * Get validation rules
   */
  getValidationRules() {
    return {
      defaults: {
        platform: 'claude-code',
        template: 'standard',
        dryRun: false,
        verbose: false,
      },
      fields: {
        type: {
          type: 'string',
          enum: ['agent', 'rule', 'command', 'skill', 'workflow', 'main'],
        },
        platform: {
          type: 'string',
          enum: ['claude-code', 'cursor', 'github-copilot', 'windsurf'],
        },
        template: {
          type: 'string',
          enum: ['minimal', 'standard', 'comprehensive'],
        },
      },
    };
  }

  /**
   * Execute the generate command
   */
  async execute(options) {
    this.showHeader();
    await this.validateOptions(options, this.getValidationRules());

    // Update generator verbosity
    this.generator.verbose = options.verbose;

    // Validate required options
    if (!options.type) {
      this.logError('Component type is required. Use --type <type>');
      this.showGenerateHelp();
      return { success: false };
    }

    if (!options.name) {
      this.logError('Component name is required. Use --name <name>');
      return { success: false };
    }

    // Check platform support for component type
    const supportCheck = this.checkPlatformSupport(options.platform, options.type);
    if (!supportCheck.supported) {
      this.logWarning(supportCheck.message);
      if (supportCheck.alternative) {
        this.logInfo(`💡 ${supportCheck.alternative}`);
      }
    }

    const spinner = this.createSpinner(`Generating ${options.type} for ${options.platform}...`);
    spinner.start();

    try {
      // Create IR from options
      const ir = this.createIRFromOptions(options);

      // Validate IR
      const validation = validateIR(ir);
      if (!validation.valid) {
        spinner.warn('Generated IR has validation warnings');
        for (const error of validation.errors) {
          this.logWarning(`  ⚠️ ${error}`);
        }
      }

      // Generate for platform
      const result = await this.generateForPlatform(ir, options);

      spinner.succeed(`Generated ${options.type}: ${options.name}`);

      // Show result
      if (options.dryRun) {
        this.logInfo('\n📄 [DRY RUN] Would create:');
        this.logInfo(`   Path: ${result.filePath}`);
        this.logInfo('   Content:');
        console.log('---');
        console.log(result.content);
        console.log('---');
      } else {
        this.logSuccess(`Created: ${this.formatPath(result.filePath)}`);
      }

      return {
        success: true,
        type: options.type,
        platform: options.platform,
        filePath: result.filePath,
        ir,
      };
    } catch (error) {
      spinner.fail('Generation failed');
      this.logError(error.message);
      if (options.verbose) {
        console.error(error);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Create IR from command options
   */
  createIRFromOptions(options) {
    const ir = createIR(options.type, options.name);

    ir.description = options.description || `${options.name} ${options.type}`;

    // Apply template content
    const template = this.getTemplate(options.type, options.template);
    ir.content = {
      raw: template.content,
      format: 'markdown',
      sections: template.sections,
      hasFrontmatter: false,
    };

    // Add triggers for commands
    if (options.triggers) {
      ir.triggers = options.triggers;
    }

    // Add globs for conditional rules
    if (options.globs) {
      ir.conditionalRules = {
        globs: options.globs,
        activation: 'path-based',
      };
    }

    ir.tags = [];

    return ir;
  }

  /**
   * Get template for component type
   */
  getTemplate(type, templateLevel) {
    const templates = {
      agent: {
        minimal: {
          content: `# Agent: {{name}}\n\nThis agent helps with specific tasks.\n\n## Behavior\n\n- Focus on the assigned task\n- Ask for clarification when needed`,
          sections: [{ title: 'Agent', level: 1, content: '' }],
        },
        standard: {
          content: `# Agent: {{name}}\n\n{{description}}\n\n## Capabilities\n\n- PROACTIVELY identify relevant tasks\n- Use available tools effectively\n- Maintain context across interactions\n\n## Behavior Guidelines\n\n- Always explain your reasoning\n- Ask for clarification on ambiguous requests\n- Provide examples when helpful\n\n## Tools\n\n- Read: Access file contents\n- Edit: Modify files\n- Search: Find relevant code`,
          sections: [
            { title: 'Agent', level: 1, content: '' },
            { title: 'Capabilities', level: 2, content: '' },
            { title: 'Behavior Guidelines', level: 2, content: '' },
            { title: 'Tools', level: 2, content: '' },
          ],
        },
        comprehensive: {
          content: `# Agent: {{name}}\n\n{{description}}\n\n## Purpose\n\nThis agent specializes in [specific domain].\n\n## Capabilities\n\n- PROACTIVELY identify and address relevant tasks\n- Use all available tools effectively\n- Maintain comprehensive context\n- Learn from interactions\n\n## Behavior Guidelines\n\n### Communication\n- Be clear and concise\n- Explain reasoning step-by-step\n- Ask clarifying questions\n\n### Problem Solving\n- Break down complex problems\n- Consider multiple approaches\n- Validate solutions\n\n## Tools\n\n- **Read**: Access file contents\n- **Edit**: Modify files with precision\n- **Search**: Find relevant code and patterns\n- **Bash**: Execute commands when needed\n\n## Constraints\n\n- Always respect project conventions\n- Never modify without understanding impact\n- Escalate uncertain decisions`,
          sections: [],
        },
      },
      rule: {
        minimal: {
          content: `# {{name}}\n\n{{description}}`,
          sections: [],
        },
        standard: {
          content: `# {{name}}\n\n{{description}}\n\n## Guidelines\n\n- Follow project conventions\n- Maintain code quality\n\n## Examples\n\n\`\`\`\n// Example code\n\`\`\``,
          sections: [],
        },
        comprehensive: {
          content: `# {{name}}\n\n{{description}}\n\n## Overview\n\nThese guidelines ensure consistency and quality.\n\n## Guidelines\n\n### Must Do\n- Follow established patterns\n- Write clear documentation\n- Add appropriate tests\n\n### Must Avoid\n- Introducing breaking changes without migration\n- Skipping error handling\n- Ignoring type safety\n\n## Examples\n\n### Good Example\n\`\`\`\n// Good pattern\n\`\`\`\n\n### Bad Example\n\`\`\`\n// Avoid this pattern\n\`\`\``,
          sections: [],
        },
      },
      command: {
        minimal: {
          content: `# Command: {{name}}\n\nTrigger: /{{name}}\n\n{{description}}`,
          sections: [],
        },
        standard: {
          content: `---\ntriggers:\n  - /{{name}}\n---\n\n# Command: {{name}}\n\n{{description}}\n\n## Usage\n\n\`/{{name}} [arguments]\`\n\n## Behavior\n\nWhen triggered, this command will:\n1. Parse arguments\n2. Execute the action\n3. Report results`,
          sections: [],
        },
        comprehensive: {
          content: `---\ntriggers:\n  - /{{name}}\n  - /{{name}}-alt\ntools:\n  - Read\n  - Edit\n  - Bash\n---\n\n# Command: {{name}}\n\n{{description}}\n\n## Usage\n\n\`/{{name}} [options] [arguments]\`\n\n### Options\n\n- \`--flag\`: Description\n- \`--param <value>\`: Description\n\n## Behavior\n\n1. **Input Validation**: Verify arguments\n2. **Execution**: Perform the action\n3. **Output**: Report results\n\n## Examples\n\n\`\`\`\n/{{name}} --flag argument\n\`\`\``,
          sections: [],
        },
      },
      skill: {
        minimal: {
          content: `# Skill: {{name}}\n\n{{description}}`,
          sections: [],
        },
        standard: {
          content: `# Skill: {{name}}\n\n{{description}}\n\n## Capabilities\n\nThis skill enables:\n- Capability 1\n- Capability 2\n\n## Usage\n\nApply this skill when dealing with [context].`,
          sections: [],
        },
        comprehensive: {
          content: `# Skill: {{name}}\n\n{{description}}\n\n## Overview\n\nThis skill provides expertise in [domain].\n\n## Capabilities\n\n- **Primary**: Main capability\n- **Secondary**: Supporting capability\n\n## When to Apply\n\n- Context 1\n- Context 2\n\n## Examples\n\n### Example 1\n\n[Description]\n\n### Example 2\n\n[Description]`,
          sections: [],
        },
      },
      workflow: {
        minimal: {
          content: `# Workflow: {{name}}\n\n{{description}}\n\n## Steps\n\n1. Step one\n2. Step two`,
          sections: [],
        },
        standard: {
          content: `# Workflow: {{name}}\n\n{{description}}\n\n## Prerequisites\n\n- Prerequisite 1\n\n## Steps\n\n### Step 1: [Title]\n\n[Description]\n\n### Step 2: [Title]\n\n[Description]\n\n## Verification\n\n- Check result 1\n- Check result 2`,
          sections: [],
        },
        comprehensive: {
          content: `---\nname: {{name}}\ndescription: {{description}}\ntriggers:\n  - manual\n---\n\n# Workflow: {{name}}\n\n{{description}}\n\n## Prerequisites\n\n- [ ] Prerequisite 1\n- [ ] Prerequisite 2\n\n## Steps\n\n### Step 1: [Title]\n\n**Purpose**: [Why this step]\n\n**Actions**:\n1. Action 1\n2. Action 2\n\n**Verification**: [How to verify]\n\n### Step 2: [Title]\n\n**Purpose**: [Why this step]\n\n**Actions**:\n1. Action 1\n2. Action 2\n\n**Verification**: [How to verify]\n\n## Rollback\n\nIf something goes wrong:\n1. Rollback step 1\n2. Rollback step 2`,
          sections: [],
        },
      },
    };

    const typeTemplates = templates[type] || templates.rule;
    const template = typeTemplates[templateLevel] || typeTemplates.standard;

    // Replace placeholders
    return {
      content: template.content.replace(/\{\{name\}\}/g, '').replace(/\{\{description\}\}/g, ''),
      sections: template.sections,
    };
  }

  /**
   * Generate for specific platform
   */
  async generateForPlatform(ir, options) {
    // Access adapters via RuleGenerator's centralized registry
    const adapter = this.generator.ruleAdapters[options.platform];

    if (!adapter) {
      throw new Error(`Unsupported platform: ${options.platform}`);
    }

    const result = adapter.generateFromIR(ir, options);

    // Write file unless dry run
    if (!options.dryRun) {
      const outputDir = options.output || process.cwd();
      const fullPath = path.join(outputDir, result.filePath);

      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, result.content, 'utf-8');

      result.fullPath = fullPath;
    }

    return result;
  }

  /**
   * Check if platform supports component type
   */
  checkPlatformSupport(platform, type) {
    const support = {
      'claude-code': ['agent', 'rule', 'command', 'skill', 'main', 'settings'],
      cursor: ['rule'],
      'github-copilot': ['rule', 'main'],
      windsurf: ['rule', 'workflow'],
    };

    const platformSupport = support[platform] || [];

    if (platformSupport.includes(type)) {
      return { supported: true };
    }

    return {
      supported: false,
      message: `${platform} does not natively support ${type}s`,
      alternative: `Will be converted to ${platformSupport[0] || 'rule'} format`,
    };
  }

  /**
   * Show generation help
   */
  showGenerateHelp() {
    this.logInfo('\nUsage examples:');
    this.logInfo('  vdk generate --type agent --name "code-review" --platform claude-code');
    this.logInfo('  vdk generate --type rule --name "typescript-best-practices" --globs "*.ts"');
    this.logInfo('  vdk generate --type command --name "deploy" --triggers "/deploy" "/ship"');
    this.logInfo('  vdk generate --type workflow --name "release" --platform windsurf');
    this.logInfo('\nComponent types:');
    this.logInfo('  agent     - Autonomous AI agent (Claude Code)');
    this.logInfo('  rule      - Context rules (all platforms)');
    this.logInfo('  command   - Slash commands (Claude Code)');
    this.logInfo('  skill     - Reusable skills (Claude Code)');
    this.logInfo('  workflow  - Procedural workflows (Windsurf)');
  }
}

export default GenerateCommand;
