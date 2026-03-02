/**
 * Kimi CLI Integration Module
 * ---------------------------
 * Detects and manages integration with Moonshot Kimi CLI.
 *
 * Kimi context/config highlights:
 * - AGENTS.md (project context)
 * - .kimi/config.toml (project config)
 * - ~/.kimi/config.toml (global config)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class KimiCLIIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Kimi CLI', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      projectAgents: path.join(this.projectPath, 'AGENTS.md'),
      projectKimiDirectory: path.join(this.projectPath, '.kimi'),
      projectConfig: path.join(this.projectPath, '.kimi', 'config.toml'),
      globalConfig: path.join(os.homedir(), '.kimi', 'config.toml'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found AGENTS.md (Kimi-compatible)': paths.projectAgents,
        'Found .kimi directory': paths.projectKimiDirectory,
        'Found .kimi/config.toml': paths.projectConfig,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global Kimi config (~/.kimi/config.toml)': paths.globalConfig,
      },
      'low'
    );

    if (this.commandExists('kimi')) {
      detection.indicators.push('Kimi CLI command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Kimi CLI not detected. Add AGENTS.md and optional .kimi/config.toml for project integration.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.projectKimiDirectory);

      if (!this.fileExists(paths.projectAgents)) {
        const projectName = options.projectName || path.basename(this.projectPath);
        const agentsContent = `# Repository: ${projectName}\n\n## Build and Test Commands\n- Build: ${options.buildCommand || 'npm run build'}\n- Test: ${options.testCommand || 'npm test'}\n\n## Coding Standards\n- Follow repository conventions and existing architecture patterns.\n- Validate changes with tests/checks before completion.\n`;
        await fs.promises.writeFile(paths.projectAgents, agentsContent, 'utf8');
      }

      if (!this.fileExists(paths.projectConfig)) {
        const configContent = `# Kimi CLI project configuration\nmodel = "kimi-k2.5"\ncontext_file = "AGENTS.md"\n`;
        await fs.promises.writeFile(paths.projectConfig, configContent, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Kimi CLI integration at ${paths.projectKimiDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Kimi CLI integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();
    return {
      main: paths.projectAgents,
      agents: null,
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

export default KimiCLIIntegration;
