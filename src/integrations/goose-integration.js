/**
 * Goose Integration Module
 * ------------------------
 * Detects and manages integration with Goose (Block).
 *
 * Goose project-level markers include:
 * - AGENTS.md (project context compatibility)
 * - .goose/ directory (project-local Goose config/conventions)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class GooseIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Goose', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      projectAgents: path.join(this.projectPath, 'AGENTS.md'),
      projectGooseDirectory: path.join(this.projectPath, '.goose'),
      projectGooseConfig: path.join(this.projectPath, '.goose', 'config.yaml'),
      globalGooseDirectory: path.join(os.homedir(), '.config', 'goose'),
      globalGooseConfig: path.join(os.homedir(), '.config', 'goose', 'config.yaml'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found AGENTS.md (Goose-compatible)': paths.projectAgents,
        'Found .goose directory': paths.projectGooseDirectory,
        'Found .goose/config.yaml': paths.projectGooseConfig,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global Goose directory': paths.globalGooseDirectory,
        'Found global Goose config': paths.globalGooseConfig,
      },
      'low'
    );

    if (this.commandExists('goose')) {
      detection.indicators.push('Goose CLI command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Goose not detected. Add AGENTS.md and optional .goose/config.yaml for project integration.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.projectGooseDirectory);

      if (!this.fileExists(paths.projectAgents)) {
        const projectName = options.projectName || path.basename(this.projectPath);
        const agents = `# Repository: ${projectName}\n\n## Build and Test Commands\n- Build: ${options.buildCommand || 'npm run build'}\n- Test: ${options.testCommand || 'npm test'}\n\n## Code Standards\n- Follow repository conventions and keep changes scoped.\n- Validate with tests/checks before completion.\n`;
        await fs.promises.writeFile(paths.projectAgents, agents, 'utf8');
      }

      if (!this.fileExists(paths.projectGooseConfig)) {
        const config = `# Goose project configuration\nmodel: ${options.model || 'auto'}\nextensions: []\n`;
        await fs.promises.writeFile(paths.projectGooseConfig, config, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Goose integration at ${paths.projectGooseDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Goose integration: ${error.message}`);
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
      settings: paths.projectGooseConfig,
      mcpConfig: paths.projectGooseConfig,
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
      supportsSkills: true,
      supportsWorkflows: false,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default GooseIntegration;
