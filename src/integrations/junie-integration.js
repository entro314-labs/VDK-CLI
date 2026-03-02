/**
 * Junie Integration Module
 * ------------------------
 * Detects and manages integration with JetBrains Junie.
 *
 * Junie project-level markers include:
 * - .junie/guidelines.md (primary project guidance)
 * - .junie/mcp/ (project MCP configuration)
 * - .aiignore (AI access exclusions)
 * - optional AGENTS.md compatibility path
 */

import fs from 'node:fs';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class JunieIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Junie', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      junieDirectory: path.join(this.projectPath, '.junie'),
      guidelinesFile: path.join(this.projectPath, '.junie', 'guidelines.md'),
      mcpDirectory: path.join(this.projectPath, '.junie', 'mcp'),
      aiIgnoreFile: path.join(this.projectPath, '.aiignore'),
      agentsFile: path.join(this.projectPath, 'AGENTS.md'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found .junie directory': paths.junieDirectory,
        'Found .junie/guidelines.md': paths.guidelinesFile,
        'Found .junie/mcp directory': paths.mcpDirectory,
        'Found .aiignore': paths.aiIgnoreFile,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found AGENTS.md (Junie-compatible)': paths.agentsFile,
      },
      'medium',
      true
    );

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Junie not detected. Add .junie/guidelines.md for project-level Junie guidance.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.junieDirectory);
      await this.ensureDirectory(paths.mcpDirectory);

      if (!this.fileExists(paths.guidelinesFile)) {
        const content = `# Junie Project Guidelines\n\n- Follow repository coding conventions and architecture boundaries.\n- Keep changes focused, tested, and easy to review.\n- Prefer deterministic workflows and explicit error handling.\n`;
        await fs.promises.writeFile(paths.guidelinesFile, content, 'utf8');
      }

      if (!this.fileExists(paths.aiIgnoreFile)) {
        const content = `# Exclude sensitive/large paths from AI context\n.env\n.env.*\nnode_modules/\ndist/\nbuild/\n`;
        await fs.promises.writeFile(paths.aiIgnoreFile, content, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Junie integration at ${paths.junieDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Junie integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();
    return {
      main: paths.guidelinesFile,
      agents: null,
      rules: null,
      commands: null,
      skills: null,
      workflows: null,
      settings: paths.aiIgnoreFile,
      mcpConfig: paths.mcpDirectory,
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
      supportsRules: true,
      supportsCommands: false,
      supportsSkills: false,
      supportsWorkflows: false,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default JunieIntegration;
