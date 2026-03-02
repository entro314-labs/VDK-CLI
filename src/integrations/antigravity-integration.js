/**
 * Google Antigravity Integration Module
 * -------------------------------------
 * Detects and manages integration with Google Antigravity.
 *
 * Antigravity context/config highlights:
 * - GEMINI.md (shared Gemini-compatible memory carrier)
 * - .agent/workflows/ (project workflow carrier)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class AntigravityIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Google Antigravity', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    return {
      projectGemini: path.join(this.projectPath, 'GEMINI.md'),
      projectAgentDirectory: path.join(this.projectPath, '.agent'),
      projectWorkflowsDirectory: path.join(this.projectPath, '.agent', 'workflows'),
      globalGemini: path.join(os.homedir(), '.gemini', 'GEMINI.md'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found GEMINI.md (Antigravity-compatible)': paths.projectGemini,
        'Found .agent directory': paths.projectAgentDirectory,
        'Found .agent/workflows directory': paths.projectWorkflowsDirectory,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global GEMINI.md (~/.gemini/GEMINI.md)': paths.globalGemini,
      },
      'low'
    );

    if (this.commandExists('antigravity')) {
      detection.indicators.push('Antigravity CLI command is available');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'Antigravity not detected. Add GEMINI.md and optional .agent/workflows for project integration.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await this.ensureDirectory(paths.projectWorkflowsDirectory);

      if (!this.fileExists(paths.projectGemini)) {
        const projectName = options.projectName || path.basename(this.projectPath);
        const geminiContent = `# ${projectName} - Antigravity Context\n\n## Development Guidelines\n- Follow repository conventions and architecture boundaries.\n- Keep changes focused, tested, and reviewable.\n- Prefer explicit error handling and deterministic workflows.\n`;
        await fs.promises.writeFile(paths.projectGemini, geminiContent, 'utf8');
      }

      const defaultWorkflow = path.join(paths.projectWorkflowsDirectory, 'project-flow.md');
      if (!this.fileExists(defaultWorkflow)) {
        const workflowContent = `# Project Workflow\n\n1. Analyze current implementation and constraints.\n2. Plan incremental changes with verification points.\n3. Implement and validate before finalizing.\n`;
        await fs.promises.writeFile(defaultWorkflow, workflowContent, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized Antigravity integration at ${paths.projectAgentDirectory}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Antigravity integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();
    return {
      main: paths.projectGemini,
      agents: null,
      rules: null,
      commands: null,
      skills: null,
      workflows: paths.projectWorkflowsDirectory,
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
      supportsYAMLFrontmatter: false,
      supportsAgents: false,
      supportsRules: true,
      supportsCommands: false,
      supportsSkills: false,
      supportsWorkflows: true,
      supportsMCP: true,
      globPatternSyntax: 'minimatch',
    };
  }
}

export default AntigravityIntegration;
