/**
 * Trae Integration Module
 * -----------------------
 * Detects and manages integration with Trae IDE.
 *
 * Trae context/config highlights:
 * - .rules/project_rules.md
 * - .rules/user_rules.md
 */

import fs from 'node:fs';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class TraeIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Trae', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      projectRulesDirectory: path.join(this.projectPath, '.rules'),
      projectRulesFile: path.join(this.projectPath, '.rules', 'project_rules.md'),
      userRulesFile: path.join(this.projectPath, '.rules', 'user_rules.md'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found .rules directory': paths.projectRulesDirectory,
        'Found .rules/project_rules.md': paths.projectRulesFile,
        'Found .rules/user_rules.md': paths.userRulesFile,
      },
      'high',
      true
    );

    if (this.commandExists('trae')) {
      detection.indicators.push('Trae command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Trae not detected. Add .rules/project_rules.md for project-level Trae context.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.projectRulesDirectory);

      if (!this.fileExists(paths.projectRulesFile)) {
        const projectName = options.projectName || path.basename(this.projectPath);
        const rulesContent = `# ${projectName} Project Rules\n\n- Follow repository coding conventions and architecture boundaries.\n- Keep changes focused and easy to review.\n- Validate with tests/checks before completion.\n`;
        await fs.promises.writeFile(paths.projectRulesFile, rulesContent, 'utf8');
      }

      if (!this.fileExists(paths.userRulesFile)) {
        const userContent = `# Personal Rules\n\n- Add developer-specific preferences here.\n`;
        await fs.promises.writeFile(paths.userRulesFile, userContent, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Trae integration at ${paths.projectRulesDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Trae integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();
    return {
      main: paths.projectRulesFile,
      agents: null,
      rules: paths.projectRulesDirectory,
      commands: null,
      skills: null,
      workflows: null,
      settings: paths.userRulesFile,
      mcpConfig: null,
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

export default TraeIntegration;
