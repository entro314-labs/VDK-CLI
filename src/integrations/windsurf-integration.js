/**
 * Windsurf Context Platform Integration Module
 * --------------------------------------------
 * Context Platform Integration: Windsurf IDE
 *
 * Windsurf is Codeium's AI-native IDE with multi-model support (Claude, GPT, etc.).
 * Like Cursor, it creates and manages its own context format (.windsurf/rules/) that is
 * model-agnostic - the same rules work regardless of which AI model is active.
 *
 * Context Format: Windsurf-native format (.windsurf/rules/)
 * Multi-Model: Claude, GPT, and other AI backends
 * Priority: HIGH (Context-creating platform)
 * Plugin: Also available as extension for VS Code/JetBrains with same context format
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

/**
 * Windsurf AI Editor configuration and integration utilities
 */
export class WindsurfContextIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Windsurf', projectPath);
    this.priority = 'high';
    this.windsurfConfigPath = path.join(projectPath, '.windsurf');
    this.globalWindsurfConfigPath = path.join(os.homedir(), '.codeium', 'windsurf');
  }

  /**
   * Get Windsurf configuration paths (updated for native memories system)
   * @returns {Object} Configuration paths for Windsurf
   */
  getConfigPaths() {
    return {
      // Project-specific configurations
      projectConfig: path.join(this.windsurfConfigPath, 'config.json'),
      projectSettings: path.join(this.windsurfConfigPath, 'settings.json'),
      rulesDirectory: path.join(this.windsurfConfigPath, 'rules'),
      workspaceConfig: path.join(this.windsurfConfigPath, 'workspace.json'),
      aiConfig: path.join(this.windsurfConfigPath, 'ai_settings.json'),

      // Native Windsurf memories system
      globalMemories: path.join(os.homedir(), '.codeium', 'windsurf', 'memories'),
      globalRulesFile: path.join(
        os.homedir(),
        '.codeium',
        'windsurf',
        'memories',
        'global_rules.md'
      ),

      // Global configurations
      globalConfig: path.join(this.globalWindsurfConfigPath, 'config.json'),
      globalMcp: path.join(this.globalWindsurfConfigPath, 'mcp_config.json'),
      projectMcp: path.join(this.windsurfConfigPath, 'mcp_config.json'),
      codeiumConfig: path.join(os.homedir(), '.codeium', 'config'),
    };
  }

  /**
   * Detect if Windsurf is actively being used in the project
   * @returns {Object} Detection result with details
   */
  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    // 1. Check for project-specific .windsurf directory and key files
    this.checkPaths(
      detection,
      {
        'Project has .windsurf directory': this.windsurfConfigPath,
        'Found .windsurf/config.json': paths.projectConfig,
        'Found .windsurf/settings.json': paths.projectSettings,
        'Found .windsurf/workspace.json': paths.workspaceConfig,
        'Found .windsurf/ai_settings.json': paths.aiConfig,
        'Found .windsurf/rules directory': paths.rulesDirectory,
        'Found .windsurf/mcp_config.json': paths.projectMcp,
      },
      'high',
      true // isProjectSpecific = true
    );

    // 1b. Check for global Windsurf configuration
    this.checkPaths(
      detection,
      {
        'Global Windsurf memories': paths.globalMemories,
      },
      'medium'
    );

    // 2. Check for global Windsurf/Codeium installation
    const platformPaths = this.getPlatformPaths();
    const globalPaths = {
      'Windsurf.app (macOS)': platformPaths.applications
        ? path.join(platformPaths.applications, 'Windsurf.app')
        : null,
      'Codeium.app (macOS)': platformPaths.applications
        ? path.join(platformPaths.applications, 'Codeium.app')
        : null,
      'Global .codeium directory': platformPaths.home
        ? path.join(platformPaths.home, '.codeium')
        : null,
      'Codeium AppData (Windows)': platformPaths.appData
        ? path.join(platformPaths.appData, 'Codeium')
        : null,
      'Windsurf AppData (Windows)': platformPaths.appData
        ? path.join(platformPaths.appData, 'Windsurf')
        : null,
    };

    const filteredGlobalPaths = Object.fromEntries(
      Object.entries(globalPaths).filter(([, path]) => path !== null)
    );
    this.checkPaths(detection, filteredGlobalPaths, 'low');

    // 3. Check for Windsurf command availability
    const commands = ['windsurf', 'codeium'];
    commands.forEach(command => {
      if (this.commandExists(command)) {
        detection.indicators.push(`${command} CLI command is available`);
        if (detection.confidence === 'none') {
          detection.confidence = 'medium';
        }

        const version = this.getCommandVersion(command, '--version');
        if (version) {
          detection.indicators.push(`${command} version: ${version}`);
        }
      }
    });

    // 4. Check for Windsurf-specific workspace indicators
    const workspaceIndicators = ['.windsurf/', '.windsurf/rules/', '.codeium/'];

    workspaceIndicators.forEach(indicator => {
      const indicatorPath = path.join(this.projectPath, indicator);
      if (this.directoryExists(indicatorPath)) {
        detection.indicators.push(`Workspace has ${indicator}`);
        detection.isUsed = true;
        if (detection.confidence === 'none' || detection.confidence === 'low') {
          detection.confidence = 'medium';
        }
      }
    });

    // 5. Check for Codeium API configuration
    try {
      const codeiumConfigPath = path.join(os.homedir(), '.codeium', 'config');
      if (this.fileExists(codeiumConfigPath)) {
        detection.indicators.push('Codeium API configuration found');
        if (detection.confidence === 'none') {
          detection.confidence = 'low';
        }
      }
    } catch {
      // Skip if homedir is not available
    }

    // 6. Check .gitignore for Windsurf patterns
    const gitignorePatterns = this.checkGitignore(['.windsurf', '.codeium']);
    if (gitignorePatterns.length > 0) {
      detection.indicators.push(
        `Windsurf paths found in .gitignore: ${gitignorePatterns.join(', ')}`
      );
    }

    // 6. Check for recent Windsurf log activity
    const windsurfLogPaths = [
      platformPaths.logs ? path.join(platformPaths.logs, 'Windsurf') : null,
      platformPaths.logs ? path.join(platformPaths.logs, 'Codeium') : null,
      platformPaths.home ? path.join(platformPaths.home, '.codeium', 'logs') : null,
    ].filter(Boolean);

    windsurfLogPaths.forEach(logPath => {
      this.checkRecentActivity(detection, logPath, 'Recent Windsurf logs', 7);
    });

    // 7. Add standard recommendations based on confidence level
    this.addStandardRecommendations(detection, 'Windsurf', 'https://codeium.com/windsurf');

    return detection;
  }

  /**
   * Initialize Windsurf configuration for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const paths = this.getConfigPaths();

    try {
      // Create .windsurf directory structure
      await this.ensureDirectory(this.windsurfConfigPath);
      await this.ensureDirectory(paths.rulesDirectory);

      // Create project-specific Windsurf configuration
      if (!this.fileExists(paths.projectConfig)) {
        const windsurfConfig = {
          codeium: {
            enabled: true,
            supercomplete: true,
            chat: true,
            search: true,
          },
          ai: {
            modelPreferences: {
              chat: 'claude-3-5-sonnet',
              autocomplete: 'codeium',
              explanation: 'gpt-4',
            },
            features: {
              contextAwareness: true,
              projectScanning: true,
              documentationGeneration: true,
            },
          },
          vdk: {
            enabled: true,
            version: '1.0.0',
            integration: 'windsurf',
            rulesPath: '.windsurf/rules',
          },
          workspace: {
            autoSave: true,
            formatOnSave: true,
            linting: true,
          },
        };

        await this.writeJsonFile(paths.projectConfig, windsurfConfig);
      }

      // Create AI-specific settings
      await this.createWindsurfAISettings(options);

      // Create MCP configuration for Windsurf
      await this.createWindsurfMCPConfig(options);

      // Create Windsurf-specific AI rules
      await this.createWindsurfAIRules(options);

      // Create workspace configuration
      await this.createWindsurfWorkspaceConfig(options);

      return true;
    } catch (error) {
      console.error('Failed to initialize Windsurf configuration:', error.message);
      return false;
    }
  }

  /**
   * Create Windsurf AI settings configuration
   * @param {Object} options - Configuration options
   */
  async createWindsurfAISettings(_options = {}) {
    const paths = this.getConfigPaths();

    if (this.fileExists(paths.aiConfig)) {
      return; // Don't overwrite existing AI config
    }

    const aiSettings = {
      codeium: {
        enableSupercomplete: true,
        enableChat: true,
        enableSearch: true,
        contextLines: 100,
        maxSuggestions: 5,
      },
      models: {
        primary: 'claude-3-5-sonnet',
        fallback: 'gpt-4',
        autocomplete: 'codeium-proprietary',
      },
      features: {
        explainCode: true,
        generateTests: true,
        documentCode: true,
        refactorCode: true,
        findBugs: true,
      },
      projectAwareness: {
        enabled: true,
        includeFiles: ['README.md', 'package.json', '*.config.*', '.vdk/rules/**'],
        excludePatterns: ['node_modules/**', 'dist/**', '*.log', '.git/**'],
      },
    };

    await this.writeJsonFile(paths.aiConfig, aiSettings);
  }

  /**
   * Create MCP configuration for Windsurf
   * @param {Object} options - Configuration options
   */
  async createWindsurfMCPConfig(options = {}) {
    const paths = this.getConfigPaths();

    if (this.fileExists(paths.projectMcp)) {
      return; // Don't overwrite existing MCP config
    }

    const mcpConfig = {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', this.projectPath],
          env: {},
        },
        git: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-git', '--repository', this.projectPath],
          env: {},
        },
        codeium: {
          command: 'codeium-server',
          args: ['--project-path', this.projectPath],
          env: {
            CODEIUM_API_KEY: `\${CODEIUM_API_KEY}`,
          },
        },
      },
      vdk: {
        enabled: true,
        projectName: options.projectName || path.basename(this.projectPath),
        rulesPath: '.windsurf/rules',
        integration: 'windsurf',
      },
    };

    await this.writeJsonFile(paths.projectMcp, mcpConfig);
  }

  /**
   * Create Windsurf workspace configuration
   * @param {Object} options - Configuration options
   */
  async createWindsurfWorkspaceConfig(options = {}) {
    const paths = this.getConfigPaths();

    if (this.fileExists(paths.workspaceConfig)) {
      return; // Don't overwrite existing workspace config
    }

    const workspaceConfig = {
      folders: [
        {
          path: '.',
        },
      ],
      settings: {
        'codeium.enabled': true,
        'ai.chat.enabled': true,
        'ai.supercomplete.enabled': true,
        'files.autoSave': 'onWindowChange',
        'editor.formatOnSave': true,
        'editor.codeActionsOnSave': {
          'source.fixAll': true,
          'source.organizeImports': true,
        },
      },
      extensions: {
        recommendations: ['codeium.codeium', 'ms-vscode.vscode-typescript-next'],
      },
      vdk: {
        projectName: options.projectName || path.basename(this.projectPath),
        rulesDirectory: '.windsurf/rules',
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.writeJsonFile(paths.workspaceConfig, workspaceConfig);
  }

  /**
   * Create Windsurf-specific AI rules following official format
   * @param {Object} options - Configuration options
   */
  async createWindsurfAIRules(options = {}) {
    const paths = this.getConfigPaths();
    const rulesPath = paths.rulesDirectory;

    // Create global rules file (proper Windsurf format)
    await this.createGlobalRules(options);

    // Create workspace rules (following 6K character limit)
    const windsurfRulePath = path.join(rulesPath, 'vdk-integration.md');

    if (this.fileExists(windsurfRulePath)) {
      return; // Don't overwrite existing rules
    }

    // Create workspace rule following Windsurf format (under 6K chars)
    const windsurfRuleContent = `# VDK Integration - Windsurf Rules

## VDK-Specific Guidelines for Windsurf

<development-standards>
- Follow existing project architecture patterns
- Use VDK CLI for AI rule generation and management
- Maintain consistent naming conventions across files
- Leverage Codeium's context awareness for better suggestions
</development-standards>

<ai-workflow>
- **Supercomplete**: Multi-line code generation and boilerplate
- **Chat**: Complex reasoning and architecture discussions
- **Search**: Find existing patterns in codebase
- **Context Scanning**: Let Codeium analyze project structure
</ai-workflow>

<model-selection>
- **Claude 3.5 Sonnet**: System design and complex reasoning
- **GPT-4**: General coding tasks and documentation
- **Codeium**: Fast autocomplete and pattern matching
</model-selection>

<vdk-integration>
- Rules stored in \`.windsurf/rules/\` directory
- Global rules in \`~/.codeium/windsurf/memories/\`
- Update with VDK CLI when project evolves
- Character limits: 6K per file, 12K total
</vdk-integration>

<quality-standards>
- Proper error handling and logging patterns
- Tests for new functionality
- Documentation updates
- Security best practices
- Performance considerations
</quality-standards>

*Generated by VDK CLI - Keep under 6K characters*`;

    await fs.promises.writeFile(windsurfRulePath, windsurfRuleContent, 'utf8');
  }

  /**
   * Create global Windsurf rules following native memories format
   * @param {Object} options - Configuration options
   */
  async createGlobalRules(_options = {}) {
    const paths = this.getConfigPaths();

    // Ensure the global memories directory exists
    await this.ensureDirectory(paths.globalMemories);

    if (this.fileExists(paths.globalRulesFile)) {
      return; // Don't overwrite existing global rules
    }

    const globalRulesContent = `# Global Windsurf Rules - VDK

## Organization Standards

<coding-standards>
- Use consistent indentation (2 spaces for JS/TS, 4 for Python)
- Follow conventional commit messages (feat:, fix:, docs:)
- Prefer descriptive variable names over abbreviations
- Add meaningful comments for complex logic
- Use TypeScript for new JavaScript projects
</coding-standards>

<security-requirements>
- Never commit secrets or API keys
- Validate all user inputs
- Use environment variables for configuration
- Implement proper authentication patterns
- Keep dependencies updated
</security-requirements>

<documentation-standards>
- Write clear README files with setup instructions
- Document API endpoints with examples
- Include code examples in documentation
- Update docs when code changes
- Use JSDoc for complex functions
</documentation-standards>

<vdk-integration>
- VDK CLI generates project-aware AI rules
- Rules follow platform-specific formats
- Automatic detection of IDE configurations
- Memory management for project context
</vdk-integration>

*Organization-wide standards - Applied across all Windsurf workspaces*`;

    await fs.promises.writeFile(paths.globalRulesFile, globalRulesContent, 'utf8');
  }

  /**
   * Check if Windsurf has specific features enabled
   * @returns {Promise<Object>} Feature availability status
   */
  async getWindsurfFeatures() {
    const paths = this.getConfigPaths();
    const features = {
      codeiumEnabled: false,
      supercompleteEnabled: false,
      chatEnabled: false,
      searchEnabled: false,
      mcpConfigured: false,
      rulesConfigured: false,
      workspaceConfigured: false,
    };

    try {
      if (this.fileExists(paths.projectConfig)) {
        const config = await this.readJsonFile(paths.projectConfig);
        features.codeiumEnabled = config?.codeium?.enabled;
        features.supercompleteEnabled = config?.codeium?.supercomplete;
        features.chatEnabled = config?.codeium?.chat;
        features.searchEnabled = config?.codeium?.search;
      }

      features.mcpConfigured = this.fileExists(paths.projectMcp);
      features.rulesConfigured = await this.directoryExistsAsync(paths.rulesDirectory);
      features.workspaceConfigured = this.fileExists(paths.workspaceConfig);
    } catch {
      // Features remain false if we can't read config
    }

    return features;
  }

  /**
   * Get Windsurf status summary
   * @returns {Promise<Object>} Status summary object
   */
  async getStatusSummary() {
    const detection = this.getCachedDetection();
    const features = await this.getWindsurfFeatures();
    const paths = this.getConfigPaths();

    return {
      isConfigured: detection.isUsed,
      confidence: detection.confidence,
      features,
      configPaths: paths,
      recommendations: detection.recommendations,
    };
  }

  // ============================================================================
  // V3.0 COMPONENT METHODS
  // ============================================================================

  /**
   * Get all component paths for Windsurf platform
   * @returns {Object} Component paths by type
   */
  getComponentPaths() {
    return {
      main: null, // Windsurf doesn't have a main file
      agents: null, // Windsurf doesn't have agents
      rules: path.join(this.windsurfConfigPath, 'rules'),
      commands: null, // Windsurf doesn't have commands
      skills: null, // Windsurf doesn't have skills
      workflows: path.join(this.windsurfConfigPath, 'workflows'),
      settings: path.join(this.windsurfConfigPath, 'settings.json'),
      mcpConfig: path.join(this.windsurfConfigPath, 'mcp.json'),
    };
  }

  /**
   * Get platform constraints for Windsurf
   * @returns {Object} Platform constraints
   */
  getPlatformConstraints() {
    return {
      maxCharacters: 6000, // 6000 char limit per rule
      maxFiles: null,
      maxDepth: null,
      supportsFileReferences: true,
      supportsYAMLFrontmatter: true,
      supportsAgents: false,
      supportsRules: true,
      supportsCommands: false,
      supportsSkills: false,
      supportsWorkflows: true,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }

  /**
   * Parse rule component with Windsurf format
   * @param {string} filePath - Path to rule file
   * @returns {Promise<Object>} Parsed rule component
   */
  async parseRuleComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const frontmatter = this.extractFrontmatter(content);

      const rule = {
        type: 'rule',
        name: path.basename(filePath, '.md'),
        file: filePath,
        content,
        format: 'markdown',
      };

      if (frontmatter) {
        rule.frontmatter = frontmatter;
        rule.description = frontmatter.description || '';
        rule.globs = frontmatter.globs || [];
        rule.mode = frontmatter.mode || (rule.globs.length > 0 ? 'glob' : 'always');
      }

      return rule;
    } catch (error) {
      console.error(`Error parsing rule ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse rules directory
   * @param {string} dirPath - Path to rules directory
   * @returns {Promise<Array>} Array of parsed rule components
   */
  async parseRuleComponents(dirPath) {
    const rules = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return rules;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dirPath, file);
        const rule = await this.parseRuleComponent(filePath);

        if (rule) {
          rules.push(rule);
        }
      }
    } catch (error) {
      console.error(`Error parsing rules directory ${dirPath}:`, error);
    }

    return rules;
  }

  /**
   * Parse workflow component
   * @param {string} filePath - Path to workflow file
   * @returns {Promise<Object>} Parsed workflow component
   */
  async parseWorkflowComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');

      const workflow = {
        type: 'workflow',
        name: path.basename(filePath, '.yaml'),
        file: filePath,
        content,
        format: 'yaml',
      };

      return workflow;
    } catch (error) {
      console.error(`Error parsing workflow ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse workflows directory
   * @param {string} dirPath - Path to workflows directory
   * @returns {Promise<Array>} Array of parsed workflow components
   */
  async parseWorkflowComponents(dirPath) {
    const workflows = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return workflows;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (!(file.endsWith('.yaml') || file.endsWith('.yml'))) continue;

        const filePath = path.join(dirPath, file);
        const workflow = await this.parseWorkflowComponent(filePath);

        if (workflow) {
          workflows.push(workflow);
        }
      }
    } catch (error) {
      console.error(`Error parsing workflows directory ${dirPath}:`, error);
    }

    return workflows;
  }

  /**
   * Generate rule component file
   * @param {Object} rule - Rule data
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Path to generated file
   */
  async generateRuleComponent(rule, _options = {}) {
    const rulesDir = path.join(this.windsurfConfigPath, 'rules');
    await this.ensureDirectory(rulesDir);

    const fileName = `${rule.name}.md`;
    const filePath = path.join(rulesDir, fileName);

    // Build frontmatter
    const frontmatter = {
      description: rule.description || '',
      globs: rule.globs || [],
      mode: rule.mode || (rule.globs && rule.globs.length > 0 ? 'glob' : 'always'),
    };

    // Build content
    let content = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        content += `${key}:\n`;
        value.forEach(item => {
          content += `  - ${item}\n`;
        });
      } else {
        content += `${key}: ${value}\n`;
      }
    }
    content += '---\n\n';
    content += rule.content || '';

    // Check character limit
    if (content.length > 6000) {
      console.warn(`Rule ${rule.name} exceeds 6000 character limit (${content.length} chars)`);
      content = `${content.substring(0, 5900)}\n\n...(truncated)`;
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Generate workflow component file
   * @param {Object} workflow - Workflow data
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Path to generated file
   */
  async generateWorkflowComponent(workflow, _options = {}) {
    const workflowsDir = path.join(this.windsurfConfigPath, 'workflows');
    await this.ensureDirectory(workflowsDir);

    const fileName = `${workflow.name}.yaml`;
    const filePath = path.join(workflowsDir, fileName);

    await fs.promises.writeFile(filePath, workflow.content, 'utf8');
    return filePath;
  }

  /**
   * Generate all components for Windsurf
   * @param {Object} components - Components to generate
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateComponents(components, options = {}) {
    const result = {
      success: true,
      files: [],
      errors: [],
    };

    try {
      // Generate rules
      if (components.rules && components.rules.length > 0) {
        for (const rule of components.rules) {
          try {
            const filePath = await this.generateRuleComponent(rule, options);
            result.files.push({ type: 'rule', path: filePath });
          } catch (error) {
            result.errors.push(`Failed to generate rule ${rule.name}: ${error.message}`);
          }
        }
      }

      // Convert agents to rules (Windsurf doesn't have agents)
      if (components.agents && components.agents.length > 0) {
        for (const agent of components.agents) {
          try {
            const ruleFromAgent = {
              name: agent.name,
              description: agent.description || `${agent.name} agent`,
              content: agent.content,
              globs: [],
              mode: 'always',
            };
            const filePath = await this.generateRuleComponent(ruleFromAgent, options);
            result.files.push({ type: 'rule', path: filePath, convertedFrom: 'agent' });
          } catch (error) {
            result.errors.push(`Failed to convert agent ${agent.name}: ${error.message}`);
          }
        }
      }

      // Generate workflows
      if (components.workflows && components.workflows.length > 0) {
        for (const workflow of components.workflows) {
          try {
            const filePath = await this.generateWorkflowComponent(workflow, options);
            result.files.push({ type: 'workflow', path: filePath });
          } catch (error) {
            result.errors.push(`Failed to generate workflow ${workflow.name}: ${error.message}`);
          }
        }
      }

      // Generate settings if provided
      if (components.settings) {
        try {
          const settingsPath = path.join(this.windsurfConfigPath, 'settings.json');
          await this.writeJsonFile(settingsPath, components.settings.content);
          result.files.push({ type: 'settings', path: settingsPath });
        } catch (error) {
          result.errors.push(`Failed to generate settings: ${error.message}`);
        }
      }

      // Generate MCP config if provided
      if (components.mcpConfig) {
        try {
          const mcpPath = path.join(this.windsurfConfigPath, 'mcp.json');
          await this.writeJsonFile(mcpPath, components.mcpConfig.content);
          result.files.push({ type: 'mcp-config', path: mcpPath });
        } catch (error) {
          result.errors.push(`Failed to generate MCP config: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Component generation failed: ${error.message}`);
    }

    return result;
  }
}
