/**
 * Roo Code Integration Module
 * ---------------------------
 * Detects and manages integration with Roo Code.
 *
 * Roo Code project-level markers include:
 * - .roo/ directory
 * - .roo/rules/ and mode-scoped .roo/rules-<mode>/ directories
 * - .roomodes file
 */

import fs from 'node:fs';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class RooCodeIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Roo Code', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      rooDirectory: path.join(this.projectPath, '.roo'),
      rulesDirectory: path.join(this.projectPath, '.roo', 'rules'),
      skillsDirectory: path.join(this.projectPath, '.roo', 'skills'),
      roomodesFile: path.join(this.projectPath, '.roomodes'),
      rooIgnoreFile: path.join(this.projectPath, '.rooignore'),
      agentsFile: path.join(this.projectPath, 'AGENTS.md'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found .roo directory': paths.rooDirectory,
        'Found .roo/rules directory': paths.rulesDirectory,
        'Found .roo/skills directory': paths.skillsDirectory,
        'Found .roomodes file': paths.roomodesFile,
        'Found .rooignore': paths.rooIgnoreFile,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found AGENTS.md (Roo-compatible)': paths.agentsFile,
      },
      'medium',
      true
    );

    // Detect mode-scoped rules directories like .roo/rules-code, .roo/rules-debug
    if (this.directoryExists(paths.rooDirectory)) {
      try {
        const entries = fs.readdirSync(paths.rooDirectory, { withFileTypes: true });
        const modeRuleDirs = entries
          .filter(entry => entry.isDirectory() && entry.name.startsWith('rules-'))
          .map(entry => entry.name);

        if (modeRuleDirs.length > 0) {
          detection.indicators.push(
            `Found mode-scoped Roo rules directories: ${modeRuleDirs.join(', ')}`
          );
          detection.isUsed = true;
          if (detection.confidence === 'none') {
            detection.confidence = 'high';
          }
          detection.hasProjectSpecificConfig = true;
        }
      } catch {
        // Ignore directory read failures
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Roo Code not detected. Add .roo/rules or .roomodes to enable project-level Roo context.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.rooDirectory);
      await this.ensureDirectory(paths.rulesDirectory);

      const starterRulePath = path.join(paths.rulesDirectory, 'project-guidelines.md');
      if (!this.fileExists(starterRulePath)) {
        const starterRule = `# Roo Project Guidelines\n\n- Follow repository coding conventions and architecture boundaries.\n- Validate changes with tests or checks before completing tasks.\n- Keep context files concise and actionable.\n`;
        await fs.promises.writeFile(starterRulePath, starterRule, 'utf8');
      }

      if (!this.fileExists(paths.roomodesFile)) {
        const starterModes = `customModes: []\n`;
        await fs.promises.writeFile(paths.roomodesFile, starterModes, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Roo Code integration at ${paths.rulesDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Roo Code integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();

    return {
      main: paths.roomodesFile,
      agents: null,
      rules: paths.rulesDirectory,
      commands: null,
      skills: paths.skillsDirectory,
      workflows: null,
      settings: null,
      mcpConfig: null,
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
      supportsCommands: false,
      supportsSkills: true,
      supportsWorkflows: false,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default RooCodeIntegration;
