/**
 * Mistral Vibe Integration Module
 * -------------------------------
 * Detects and manages integration with Mistral Vibe CLI.
 *
 * Mistral Vibe context/config highlights:
 * - .vibe/config.toml
 * - .vibe/agents/*.toml
 * - .vibe/prompts/*.md
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class MistralVibeIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Mistral Vibe', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      projectVibeDirectory: path.join(this.projectPath, '.vibe'),
      projectConfig: path.join(this.projectPath, '.vibe', 'config.toml'),
      projectAgentsDirectory: path.join(this.projectPath, '.vibe', 'agents'),
      projectPromptsDirectory: path.join(this.projectPath, '.vibe', 'prompts'),
      globalConfig: path.join(os.homedir(), '.vibe', 'config.toml'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found .vibe directory': paths.projectVibeDirectory,
        'Found .vibe/config.toml': paths.projectConfig,
        'Found .vibe/agents directory': paths.projectAgentsDirectory,
        'Found .vibe/prompts directory': paths.projectPromptsDirectory,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global Vibe config (~/.vibe/config.toml)': paths.globalConfig,
      },
      'low'
    );

    if (this.commandExists('vibe')) {
      detection.indicators.push('Mistral Vibe CLI command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Mistral Vibe not detected. Add .vibe/config.toml and optional .vibe/agents + .vibe/prompts.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.projectAgentsDirectory);
      await this.ensureDirectory(paths.projectPromptsDirectory);

      if (!this.fileExists(paths.projectConfig)) {
        const configContent = `# Mistral Vibe project configuration\nmodel = "devstral-2"\ndefault_agent = "vdk_project"\n`;
        await fs.promises.writeFile(paths.projectConfig, configContent, 'utf8');
      }

      const promptPath = path.join(paths.projectPromptsDirectory, 'project.md');
      if (!this.fileExists(promptPath)) {
        const projectName = options.projectName || path.basename(this.projectPath);
        const promptContent = `# ${projectName} Project Prompt\n\n- Follow repository conventions and architecture boundaries.\n- Keep changes focused, tested, and reviewable.\n- Prefer explicit error handling and deterministic workflows.\n`;
        await fs.promises.writeFile(promptPath, promptContent, 'utf8');
      }

      const agentPath = path.join(paths.projectAgentsDirectory, 'vdk_project.toml');
      if (!this.fileExists(agentPath)) {
        const agentContent = `name = "vdk_project"\ndescription = "VDK-generated project-aware agent"\nsystem_prompt_id = "project"\n`;
        await fs.promises.writeFile(agentPath, agentContent, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Mistral Vibe integration at ${paths.projectVibeDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Mistral Vibe integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();
    return {
      main: path.join(paths.projectPromptsDirectory, 'project.md'),
      agents: paths.projectAgentsDirectory,
      rules: null,
      commands: null,
      skills: null,
      workflows: null,
      settings: paths.projectConfig,
      mcpConfig: paths.projectConfig,
    };
  }

  getPlatformConstraints() {
    return {
      maxCharacters: null,
      maxFiles: null,
      maxDepth: null,
      supportsFileReferences: true,
      supportsYAMLFrontmatter: false,
      supportsAgents: true,
      supportsRules: true,
      supportsCommands: false,
      supportsSkills: false,
      supportsWorkflows: false,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default MistralVibeIntegration;
