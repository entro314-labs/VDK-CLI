/**
 * Cline Integration Module
 * ------------------------
 * Detects and manages integration with Cline across IDE hosts.
 *
 * Cline supports:
 * - .clinerules/ (project rules)
 * - .clinerules/workflows/ (workflow files)
 * - .cline/skills/ (project skills)
 * - .clineignore (context exclusion)
 * - AGENTS.md (cross-tool compatibility)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class ClineIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Cline', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      rulesDirectory: path.join(this.projectPath, '.clinerules'),
      workflowsDirectory: path.join(this.projectPath, '.clinerules', 'workflows'),
      hooksDirectory: path.join(this.projectPath, '.clinerules', 'hooks'),
      projectSkillsDirectory: path.join(this.projectPath, '.cline', 'skills'),
      ignoreFile: path.join(this.projectPath, '.clineignore'),
      projectAgents: path.join(this.projectPath, 'AGENTS.md'),
      globalRulesDirectory: path.join(os.homedir(), 'Documents', 'Cline', 'Rules'),
      globalWorkflowsDirectory: path.join(os.homedir(), 'Documents', 'Cline', 'Workflows'),
      fallbackGlobalRulesDirectory: path.join(os.homedir(), 'Cline', 'Rules'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found .clinerules directory': paths.rulesDirectory,
        'Found .clinerules/workflows directory': paths.workflowsDirectory,
        'Found .clinerules/hooks directory': paths.hooksDirectory,
        'Found .cline/skills directory': paths.projectSkillsDirectory,
        'Found .clineignore': paths.ignoreFile,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found AGENTS.md (Cline-compatible)': paths.projectAgents,
      },
      'medium',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global Cline Rules directory': paths.globalRulesDirectory,
        'Found global Cline Workflows directory': paths.globalWorkflowsDirectory,
        'Found fallback global Cline Rules directory': paths.fallbackGlobalRulesDirectory,
      },
      'low'
    );

    if (this.commandExists('cline')) {
      detection.indicators.push('Cline CLI command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Cline not detected. Configure .clinerules/ for project-level rules or install Cline extension/CLI.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.rulesDirectory);
      await this.ensureDirectory(paths.workflowsDirectory);
      this.ensureDirectory(paths.projectSkillsDirectory);

      const starterRulePath = path.join(paths.rulesDirectory, 'project-guidelines.md');
      if (!this.fileExists(starterRulePath)) {
        const starterRule = `# Project Guidelines\n\n- Follow repository conventions and coding standards.\n- Prefer explicit error handling with actionable messages.\n- Keep changes focused and test-covered.\n`;
        await fs.promises.writeFile(starterRulePath, starterRule, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Cline integration at ${paths.rulesDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Cline integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();

    return {
      main: paths.projectAgents,
      agents: null,
      rules: paths.rulesDirectory,
      commands: null,
      skills: paths.projectSkillsDirectory,
      workflows: paths.workflowsDirectory,
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
      supportsAgents: false,
      supportsRules: true,
      supportsCommands: false,
      supportsSkills: true,
      supportsWorkflows: true,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default ClineIntegration;
