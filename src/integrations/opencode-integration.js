/**
 * OpenCode Integration Module
 * ---------------------------
 * Detects and manages integration with OpenCode.
 *
 * OpenCode context/config highlights:
 * - AGENTS.md project memory/rules
 * - opencode.json/opencode.jsonc configuration
 * - .opencode/* directories (agents, commands, skills, plugins)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class OpenCodeIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('OpenCode', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      projectAgents: path.join(this.projectPath, 'AGENTS.md'),
      projectConfigJson: path.join(this.projectPath, 'opencode.json'),
      projectConfigJsonc: path.join(this.projectPath, 'opencode.jsonc'),
      projectOpenCodeDirectory: path.join(this.projectPath, '.opencode'),
      projectAgentsDirectory: path.join(this.projectPath, '.opencode', 'agents'),
      projectCommandsDirectory: path.join(this.projectPath, '.opencode', 'commands'),
      projectSkillsDirectory: path.join(this.projectPath, '.opencode', 'skills'),
      globalConfig: path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
      globalAgents: path.join(os.homedir(), '.config', 'opencode', 'AGENTS.md'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found opencode.json': paths.projectConfigJson,
        'Found opencode.jsonc': paths.projectConfigJsonc,
        'Found .opencode directory': paths.projectOpenCodeDirectory,
        'Found .opencode/agents directory': paths.projectAgentsDirectory,
        'Found .opencode/commands directory': paths.projectCommandsDirectory,
        'Found .opencode/skills directory': paths.projectSkillsDirectory,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found AGENTS.md (OpenCode primary rules file)': paths.projectAgents,
      },
      'medium',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global OpenCode config': paths.globalConfig,
        'Found global OpenCode AGENTS.md': paths.globalAgents,
      },
      'low'
    );

    if (this.commandExists('opencode')) {
      detection.indicators.push('OpenCode CLI command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'OpenCode not detected. Add opencode.json + AGENTS.md or initialize with opencode /init.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.projectOpenCodeDirectory);
      await this.ensureDirectory(paths.projectAgentsDirectory);
      this.ensureDirectory(paths.projectCommandsDirectory);
      this.ensureDirectory(paths.projectSkillsDirectory);

      if (!this.fileExists(paths.projectAgents)) {
        const agents = `# Repository: ${options.projectName || path.basename(this.projectPath)}\n\n## Build and Test Commands\n- Build: ${options.buildCommand || 'npm run build'}\n- Test: ${options.testCommand || 'npm test'}\n\n## Coding Standards\n- Follow repository conventions and existing architecture patterns.\n- Validate changes with tests/checks before completion.\n`;
        await fs.promises.writeFile(paths.projectAgents, agents, 'utf8');
      }

      if (
        !(this.fileExists(paths.projectConfigJson) || this.fileExists(paths.projectConfigJsonc))
      ) {
        const config = {
          $schema: 'https://opencode.ai/config.json',
          instructions: ['AGENTS.md'],
          mcp: {},
        };
        this.writeJsonFile(paths.projectConfigJson, config);
      }

      if (verbose) {
        console.log(`Initialized OpenCode integration at ${paths.projectOpenCodeDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize OpenCode integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();

    return {
      main: paths.projectAgents,
      agents: paths.projectAgentsDirectory,
      rules: null,
      commands: paths.projectCommandsDirectory,
      skills: paths.projectSkillsDirectory,
      workflows: null,
      settings: this.fileExists(paths.projectConfigJson)
        ? paths.projectConfigJson
        : paths.projectConfigJsonc,
      mcpConfig: this.fileExists(paths.projectConfigJson)
        ? paths.projectConfigJson
        : paths.projectConfigJsonc,
    };
  }

  getPlatformConstraints() {
    return {
      maxCharacters: null,
      maxFiles: null,
      maxDepth: null,
      supportsFileReferences: true,
      supportsYAMLFrontmatter: true,
      supportsAgents: true,
      supportsRules: true,
      supportsCommands: true,
      supportsSkills: true,
      supportsWorkflows: false,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default OpenCodeIntegration;
