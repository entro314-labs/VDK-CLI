/**
 * ACP Integration Module
 * ----------------------
 * Detects and manages integration with ACP (Agent Client Protocol) context bundles.
 *
 * ACP context/config highlights:
 * - .acp/manifest.json (protocol metadata)
 * - .acp/context/*.md (project context/rules)
 * - ACP.md (project entrypoint for ACP-aware clients)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class ACPIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('ACP', projectPath);
    this.priority = 'high';
  }

  getConfigPaths() {
    const projectACPDir = path.join(this.projectPath, '.acp');

    return {
      projectACPDir,
      projectManifest: path.join(projectACPDir, 'manifest.json'),
      projectContextDir: path.join(projectACPDir, 'context'),
      projectAgentsDir: path.join(projectACPDir, 'agents'),
      projectCommandsDir: path.join(projectACPDir, 'commands'),
      projectSkillsDir: path.join(projectACPDir, 'skills'),
      projectWorkflowsDir: path.join(projectACPDir, 'workflows'),
      projectContextIndex: path.join(projectACPDir, 'context', 'project.md'),
      projectACPMain: path.join(this.projectPath, 'ACP.md'),
      globalACPDir: path.join(os.homedir(), '.config', 'acp'),
      globalManifest: path.join(os.homedir(), '.config', 'acp', 'manifest.json'),
      globalZedSettings: path.join(os.homedir(), '.config', 'zed', 'settings.json'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    this.checkPaths(
      detection,
      {
        'Found .acp directory': paths.projectACPDir,
        'Found .acp/manifest.json': paths.projectManifest,
        'Found .acp/context directory': paths.projectContextDir,
        'Found ACP.md entrypoint': paths.projectACPMain,
      },
      'high',
      true
    );

    this.checkPaths(
      detection,
      {
        'Found global ACP config': paths.globalACPDir,
        'Found global ACP manifest': paths.globalManifest,
      },
      'low'
    );

    if (this.commandExists('zed')) {
      detection.indicators.push('Zed command is available (ACP-capable host)');
      if (detection.confidence === 'none') {
        detection.confidence = 'low';
      }
    }

    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'ACP not detected. Initialize with .acp/manifest.json and .acp/context/project.md.'
      );
    } else {
      detection.recommendations.push(
        'Keep ACP context in .acp/context/*.md and metadata in .acp/manifest.json.'
      );
    }

    return detection;
  }

  async initialize(options = {}) {
    const { verbose = false } = options;
    const paths = this.getConfigPaths();

    try {
      await fs.promises.mkdir(paths.projectACPDir, { recursive: true });
      await fs.promises.mkdir(paths.projectContextDir, { recursive: true });
      await fs.promises.mkdir(paths.projectAgentsDir, { recursive: true });
      await fs.promises.mkdir(paths.projectCommandsDir, { recursive: true });
      await fs.promises.mkdir(paths.projectSkillsDir, { recursive: true });
      await fs.promises.mkdir(paths.projectWorkflowsDir, { recursive: true });

      if (!this.fileExists(paths.projectManifest)) {
        const manifest = {
          protocol: 'acp',
          schemaVersion: '1.0.0',
          generatedBy: 'vdk-cli',
          generatedAt: new Date().toISOString(),
          project: {
            name: options.projectName || path.basename(this.projectPath),
          },
          entries: [],
        };

        await fs.promises.writeFile(
          paths.projectManifest,
          JSON.stringify(manifest, null, 2),
          'utf8'
        );
      }

      if (!this.fileExists(paths.projectContextIndex)) {
        const indexContent = `# ACP Context Index\n\nProject: ${options.projectName || path.basename(this.projectPath)}\n`;
        await fs.promises.writeFile(paths.projectContextIndex, indexContent, 'utf8');
      }

      if (!this.fileExists(paths.projectACPMain)) {
        const mainContent =
          '# ACP\n\nPrimary ACP manifest: `.acp/manifest.json`\n\nPrimary context index: `.acp/context/project.md`\n';
        await fs.promises.writeFile(paths.projectACPMain, mainContent, 'utf8');
      }

      if (verbose) {
        console.log(`Initialized ACP integration at ${paths.projectACPDir}`);
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize ACP integration: ${error.message}`);
      }
      return false;
    }
  }

  getComponentPaths() {
    const paths = this.getConfigPaths();

    return {
      main: paths.projectContextIndex,
      agents: paths.projectAgentsDir,
      rules: paths.projectContextDir,
      commands: paths.projectCommandsDir,
      skills: paths.projectSkillsDir,
      workflows: paths.projectWorkflowsDir,
      settings: paths.projectManifest,
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
      supportsCommands: true,
      supportsSkills: true,
      supportsWorkflows: true,
      supportsMCP: false,
      globPatternSyntax: 'minimatch',
    };
  }

  async parseMainComponent(filePath) {
    const parsed = await super.parseMainComponent(filePath);
    if (!parsed) {
      return null;
    }

    return Object.assign({}, parsed, { platform: 'acp' });
  }

  async generateComponents(components, _options = {}) {
    const result = {
      success: true,
      files: [],
      errors: [],
      warnings: [],
    };

    const paths = this.getConfigPaths();

    try {
      await fs.promises.mkdir(paths.projectACPDir, { recursive: true });
      await fs.promises.mkdir(paths.projectContextDir, { recursive: true });
      await fs.promises.mkdir(paths.projectAgentsDir, { recursive: true });
      await fs.promises.mkdir(paths.projectCommandsDir, { recursive: true });
      await fs.promises.mkdir(paths.projectSkillsDir, { recursive: true });
      await fs.promises.mkdir(paths.projectWorkflowsDir, { recursive: true });

      if (components.main?.content) {
        await fs.promises.writeFile(paths.projectContextIndex, components.main.content, 'utf8');
        result.files.push({ type: 'main', path: paths.projectContextIndex });
      }

      const writeList = async (items, dirPath, typeLabel) => {
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }

        for (const item of items) {
          const safeName = this.toSafeFileName(
            item?.name || `${typeLabel}-${result.files.length + 1}`
          );
          const content = String(item?.content || '');
          const filePath = path.join(dirPath, `${safeName}.md`);
          await fs.promises.writeFile(filePath, content, 'utf8');
          result.files.push({ type: typeLabel, path: filePath });
        }
      };

      await writeList(components.rules, paths.projectContextDir, 'rule');
      await writeList(components.agents, paths.projectAgentsDir, 'agent');
      await writeList(components.commands, paths.projectCommandsDir, 'command');
      await writeList(components.skills, paths.projectSkillsDir, 'skill');
      await writeList(components.workflows, paths.projectWorkflowsDir, 'workflow');

      if (components.settings?.content) {
        const settingsContent =
          typeof components.settings.content === 'string'
            ? components.settings.content
            : JSON.stringify(components.settings.content, null, 2);

        await fs.promises.writeFile(paths.projectManifest, settingsContent, 'utf8');
        result.files.push({ type: 'settings', path: paths.projectManifest });
      }

      if (!this.fileExists(paths.projectACPMain)) {
        const mainContent =
          '# ACP\n\nPrimary ACP manifest: `.acp/manifest.json`\n\nPrimary context index: `.acp/context/project.md`\n';
        await fs.promises.writeFile(paths.projectACPMain, mainContent, 'utf8');
        result.files.push({ type: 'main', path: paths.projectACPMain });
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Component generation failed: ${error.message}`);
    }

    return result;
  }

  toSafeFileName(name) {
    const normalizedName = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/[-_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalizedName || 'acp-context';
  }
}

export default ACPIntegration;
