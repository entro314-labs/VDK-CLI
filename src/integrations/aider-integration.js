/**
 * Aider CLI Integration Module
 * -----------------------------
 * Context Platform Integration: Aider CLI
 *
 * Aider is a CLI tool for pair programming with AI.
 * Uses .aider.conf.yml with hierarchical configuration precedence.
 * Context Format: .aider.conf.yml with model config, git integration, and context files
 * Priority: HIGH (CLI power users)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BaseIntegration } from './base-integration.js';

export class AiderIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Aider', projectPath);
  }

  getConfigPaths() {
    return {
      globalConfig: path.join(os.homedir(), '.aider.conf.yml'),
      projectConfig: path.join(this.projectPath, '.aider.conf.yml'),
      projectIgnore: path.join(this.projectPath, '.aiderignore'),
      projectMd: path.join(this.projectPath, '.aider.project.md'),
    };
  }

  detectUsage() {
    const detection = this.createDetectionResult();
    const paths = this.getConfigPaths();

    // Check for project-level config
    this.checkPaths(
      detection,
      {
        'Found .aider.conf.yml': paths.projectConfig,
        'Found .aiderignore': paths.projectIgnore,
        'Found .aider.project.md': paths.projectMd,
      },
      'high',
      true
    );

    // Check for global config
    this.checkPaths(
      detection,
      {
        'Found ~/.aider.conf.yml': paths.globalConfig,
      },
      'medium'
    );

    // Check for aider command
    if (this.commandExists('aider')) {
      detection.indicators.push('Aider CLI is installed');
      if (detection.confidence === 'none') {
        detection.confidence = 'medium';
      }
    }

    return detection;
  }

  async initialize(options = {}) {
    const paths = this.getConfigPaths();

    try {
      // Create .aider.conf.yml following Aider conventions
      const configContent = `# Model Configuration
model: ${options.model || 'claude-3-5-sonnet-20241022'}
weak-model: gpt-4o-mini
editor-model: gpt-4o-mini

# Edit Behavior
edit-format: diff
architect: false
auto-commits: true
dirty-commits: true

# Git Integration
attribute-co-authored-by: true
git-commit-verify: false
auto-lint: true

# Linting Commands
lint-cmd:
  - "${options.primaryLanguage || 'python'}: ${options.lintCommand || 'ruff check --fix {files}'}"

# Test Commands
test-cmd:
  - "${options.primaryLanguage || 'python'}: ${options.testCommand || 'pytest {files}'}"

# Context Files (read-only, always included)
read:
  - CONVENTIONS.md
  - README.md

# Repository Map
map-tokens: 2048
map-refresh: auto

# Output Preferences
dark-mode: false
stream: true
show-diffs: true
pretty: true
`;

      if (!this.fileExists(paths.projectConfig)) {
        await fs.promises.writeFile(paths.projectConfig, configContent, 'utf8');
      }

      // Create .aiderignore
      const ignoreContent = `# Dependencies
node_modules/
.venv/
vendor/

# Build outputs
dist/
build/
target/
*.min.js
*.bundle.js

# Package locks (too large, low value)
package-lock.json
yarn.lock
pnpm-lock.yaml

# Python cache
__pycache__/
*.pyc
.pytest_cache/

# Tests (unless specifically working on them)
tests/fixtures/
test/snapshots/

# Generated files
*.generated.ts
*_pb2.py
`;

      if (!this.fileExists(paths.projectIgnore)) {
        await fs.promises.writeFile(paths.projectIgnore, ignoreContent, 'utf8');
      }

      // Create .aider.project.md for project context
      const projectMdContent = `# ${options.projectName || 'Project'} Context

## Overview
${options.description || 'Project description'}

## Technology Stack
- ${options.primaryLanguage || 'Primary language'}
- ${options.framework || 'Framework/libraries'}
- ${options.database || 'Database system'}

## Development Guidelines
- Follow ${options.primaryLanguage || 'language'} best practices
- Write comprehensive tests
- Document complex logic
- Use conventional commits

## Architecture
${options.architecture || 'Project architecture overview'}
`;

      if (!this.fileExists(paths.projectMd)) {
        await fs.promises.writeFile(paths.projectMd, projectMdContent, 'utf8');
      }

      await this.ensureGitignoreEntry('.aider*');

      return true;
    } catch (error) {
      console.error('Failed to initialize Aider configuration:', error.message);
      return false;
    }
  }

  // ============================================================================
  // V3.0 COMPONENT METHODS
  // ============================================================================

  getComponentPaths() {
    return {
      main: path.join(this.projectPath, '.aider.project.md'),
      agents: null, // Aider has architect mode, not separate agents
      rules: path.join(this.projectPath, '.aider.conf.yml'), // Rules in config
      commands: null,
      skills: null,
      workflows: null,
      settings: path.join(this.projectPath, '.aider.conf.yml'),
      mcpConfig: null,
    };
  }

  getPlatformConstraints() {
    return {
      maxCharacters: null,
      maxFiles: null,
      maxDepth: null,
      supportsFileReferences: true, // Via read: array
      supportsYAMLFrontmatter: false,
      supportsAgents: false, // Has architect mode instead
      supportsRules: true, // Via config file
      supportsCommands: false,
      supportsSkills: false,
      supportsWorkflows: false,
      supportsMCP: false,
      globPatternSyntax: 'gitignore', // .aiderignore uses gitignore syntax
    };
  }

  async parseMainComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');

      return {
        type: 'main',
        name: 'project',
        file: filePath,
        content,
        format: 'markdown',
        platform: 'aider',
      };
    } catch (error) {
      console.error(`Error parsing project file ${filePath}:`, error);
      return null;
    }
  }

  async generateComponents(components, options = {}) {
    const result = {
      success: true,
      files: [],
      errors: [],
      warnings: [],
    };

    try {
      // Generate .aider.conf.yml
      if (components.settings || components.rules) {
        try {
          const configPath = path.join(this.projectPath, '.aider.conf.yml');
          const content = components.settings?.content || '';
          await fs.promises.writeFile(configPath, content, 'utf8');
          result.files.push({ type: 'settings', path: configPath });
        } catch (error) {
          result.errors.push(`Failed to generate .aider.conf.yml: ${error.message}`);
        }
      }

      // Generate .aider.project.md
      if (components.main) {
        try {
          const projectMdPath = path.join(this.projectPath, '.aider.project.md');
          await fs.promises.writeFile(projectMdPath, components.main.content, 'utf8');
          result.files.push({ type: 'main', path: projectMdPath });
        } catch (error) {
          result.errors.push(`Failed to generate .aider.project.md: ${error.message}`);
        }
      }

      // Generate .aiderignore
      if (options.generateIgnore) {
        try {
          const ignorePath = path.join(this.projectPath, '.aiderignore');
          const ignoreContent = `# Generated by VDK
node_modules/
dist/
build/
*.min.js
`;
          await fs.promises.writeFile(ignorePath, ignoreContent, 'utf8');
          result.files.push({ type: 'ignore', path: ignorePath });
        } catch (error) {
          result.errors.push(`Failed to generate .aiderignore: ${error.message}`);
        }
      }

      // Warn about unsupported components
      if (components.agents && components.agents.length > 0) {
        result.warnings.push(
          `Aider uses architect mode instead of agents. ${components.agents.length} agents will be merged into project context.`
        );
      }
      if (components.commands && components.commands.length > 0) {
        result.warnings.push(
          `Aider doesn't support custom commands. ${components.commands.length} commands will be ignored.`
        );
      }
      if (components.workflows && components.workflows.length > 0) {
        result.warnings.push(
          `Aider doesn't support workflows. ${components.workflows.length} workflows will be ignored.`
        );
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Component generation failed: ${error.message}`);
    }

    return result;
  }
}
