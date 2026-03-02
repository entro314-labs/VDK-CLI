/**
 * Continue.dev Integration Module
 * --------------------------------
 * Context Platform Integration: Continue.dev
 *
 * Continue offers flexible configuration through YAML, JSON, or TypeScript.
 * Uses ~/.continue/config.yaml as primary config with project-level overrides.
 * Context Format: config.yaml with models, context providers, rules, and prompts
 * Priority: HIGH (Multi-provider flexibility)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class ContinueIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Continue.dev', projectPath);
    this.continueConfigPath = path.join(os.homedir(), '.continue');
  }

  getConfigPaths() {
    return {
      globalConfigYaml: path.join(this.continueConfigPath, 'config.yaml'),
      globalConfigJson: path.join(this.continueConfigPath, 'config.json'),
      globalConfigTs: path.join(this.continueConfigPath, 'config.ts'),
      projectConfig: path.join(this.projectPath, '.continuerc.json'),
      projectIgnore: path.join(this.projectPath, '.continueignore'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    // Check for global Continue config
    this.checkPaths(
      detection,
      {
        'Found ~/.continue/config.yaml': paths.globalConfigYaml,
        'Found ~/.continue/config.json': paths.globalConfigJson,
        'Found ~/.continue/config.ts': paths.globalConfigTs,
      },
      'medium'
    );

    // Check for project-level config
    this.checkPaths(
      detection,
      {
        'Found .continuerc.json': paths.projectConfig,
        'Found .continueignore': paths.projectIgnore,
      },
      'high',
      true
    );

    // Check for continue command
    if (this.commandExists('continue')) {
      detection.indicators.push('Continue CLI is installed');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    return detection;
  }

  async initialize(options = {}) {
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(this.continueConfigPath);

      // Create config.yaml following Continue.dev conventions
      const configContent = `name: ${options.projectName || 'Development'} Configuration
version: 1.0.0
schema: v1

# Model definitions
models:
  - name: Claude Sonnet
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }}
    roles: [chat, edit, apply]
    defaultCompletionOptions:
      temperature: 0.7
      maxTokens: 4096

# Context providers
context:
  - provider: file
  - provider: code
  - provider: diff
  - provider: terminal
  - provider: repo-map
    params:
      includeSignatures: true

# System rules
rules:
  - Give concise, direct responses without preamble
  - Always include error handling in code examples
  - Use ${options.primaryLanguage || 'TypeScript'} unless explicitly told otherwise

# Custom prompts
prompts:
  - name: test
    description: Generate unit tests for selected code
    prompt: |
      Write comprehensive unit tests for this code.
      Use ${options.testFramework || 'Jest'}.
      Include edge cases and error scenarios.
      Target 80%+ coverage.

  - name: review
    description: Perform code review
    prompt: |
      Review this code for:
      - Security vulnerabilities
      - Performance issues
      - Code style violations
      - Missing error handling
`;

      if (!this.fileExists(paths.globalConfigYaml)) {
        await fs.promises.writeFile(paths.globalConfigYaml, configContent, 'utf8');
      }

      // Create .continueignore
      const ignoreContent = `# Dependencies
node_modules/
.venv/
vendor/

# Build outputs
dist/
build/
target/
*.min.js

# Package locks
package-lock.json
yarn.lock
pnpm-lock.yaml

# Logs
*.log
logs/

# Environment files
.env*
`;

      const ignorePath = paths.projectIgnore;
      if (!this.fileExists(ignorePath)) {
        await fs.promises.writeFile(ignorePath, ignoreContent, 'utf8');
      }

      await this.ensureGitignoreEntry('.continuerc.local.json');

      return true;
    } catch (error) {
      console.error('Failed to initialize Continue.dev configuration:', error.message);
      return false;
    }
  }

  // ============================================================================
  // V3.0 COMPONENT METHODS
  // ============================================================================

  getComponentPaths() {
    return {
      main: path.join(this.continueConfigPath, 'config.yaml'),
      agents: null, // Continue doesn't have agents
      rules: path.join(this.continueConfigPath, 'config.yaml'), // Rules in config
      commands: null, // Prompts are similar to commands
      skills: null,
      workflows: null,
      settings: path.join(this.continueConfigPath, 'config.yaml'),
      mcpConfig: path.join(this.continueConfigPath, 'config.yaml'), // MCP in config
    };
  }

  getPlatformConstraints() {
    return {
      maxCharacters: null,
      maxFiles: null,
      maxDepth: null,
      supportsFileReferences: true,
      supportsYAMLFrontmatter: false,
      supportsAgents: false,
      supportsRules: true, // Via rules array in config
      supportsCommands: true, // Via prompts
      supportsSkills: false,
      supportsWorkflows: false,
      supportsMCP: true, // Via mcpServers in config
      globPatternSyntax: null,
    };
  }

  async parseMainComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');

      return {
        type: 'main',
        name: 'config',
        file: filePath,
        content,
        format: 'yaml',
        platform: 'continue',
      };
    } catch (error) {
      console.error(`Error parsing config ${filePath}:`, error);
      return null;
    }
  }

  async generateComponents(components, options = {}) {
    const result = {
      success: true,
      files: [],
      errors: [],
      warnings: [],
    };

    try {
      // Continue uses config.yaml for everything
      if (components.main || components.rules || components.settings) {
        try {
          const configPath = path.join(this.continueConfigPath, 'config.yaml');
          const content = components.main?.content || '';
          await fs.promises.writeFile(configPath, content, 'utf8');
          result.files.push({ type: 'main', path: configPath });
        } catch (error) {
          result.errors.push(`Failed to generate config.yaml: ${error.message}`);
        }
      }

      // Project-level overrides
      if (components.settings && options.projectLevel) {
        try {
          const projectConfigPath = path.join(this.projectPath, '.continuerc.json');
          await this.writeJsonFile(projectConfigPath, components.settings.content);
          result.files.push({ type: 'project-config', path: projectConfigPath });
        } catch (error) {
          result.errors.push(`Failed to generate .continuerc.json: ${error.message}`);
        }
      }

      // Warn about unsupported components
      if (components.agents && components.agents.length > 0) {
        result.warnings.push(
          `Continue.dev doesn't support agents. ${components.agents.length} agents will be converted to prompts.`
        );
      }
      if (components.workflows && components.workflows.length > 0) {
        result.warnings.push(
          `Continue.dev doesn't support workflows. ${components.workflows.length} workflows will be ignored.`
        );
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Component generation failed: ${error.message}`);
    }

    return result;
  }
}
