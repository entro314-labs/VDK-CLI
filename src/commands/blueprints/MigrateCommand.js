/**
 * MigrateCommand
 * -----------------------
 * Migrates v2.x blueprints to v3.0 component architecture.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { validateBlueprint } from '../../utils/schema-validator.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class MigrateCommand extends BaseCommand {
  constructor() {
    super('migrate', 'Migrate blueprints to v3.0 schema');
  }

  configureOptions(command) {
    return command
      .argument('<file>', 'Path to the blueprint file (json)')
      .option('-o, --output <path>', 'Output path (defaults to overwriting input)')
      .option('-d, --dry-run', 'Preview migration without saving', false)
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    const filePath = options.args[0];
    const absolutePath = path.resolve(process.cwd(), filePath);

    try {
      if (options.verbose) {
        this.logInfo(`Reading blueprint: ${absolutePath}`);
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      const blueprint = JSON.parse(content);

      if (blueprint.schemaVersion === '3.0') {
        this.logSuccess('Blueprint is already v3.0 compliant.');
        return;
      }

      this.logInfo(`Migrating blueprint from v${blueprint.schemaVersion || '2.x'} to v3.0...`);

      const migrated = this.migrateToV3(blueprint);

      // Validate migrated content
      const validation = await validateBlueprint(migrated);
      if (!validation.valid) {
        this.logWarning('Migrated blueprint has validation issues:');
        validation.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
        if (!options.dryRun) {
          this.logInfo(
            'Proceeding with save despite validation warnings (manual fix may be required).'
          );
        }
      } else {
        this.logSuccess('Migrated blueprint is valid v3.0.');
      }

      if (options.dryRun) {
        console.log(chalk.gray('\n--- Preview ---\n'));
        console.log(JSON.stringify(migrated, null, 2));
        console.log(chalk.gray('\n---------------\n'));
        this.logInfo('Dry run complete. No changes written.');
        return;
      }

      const outputPath = options.output
        ? path.resolve(process.cwd(), options.output)
        : absolutePath;
      await fs.writeFile(outputPath, JSON.stringify(migrated, null, 2), 'utf8');

      this.logSuccess(`Blueprint migrated and saved to: ${outputPath}`);
    } catch (error) {
      this.exitWithError(`Migration failed: ${error.message}`, error);
    }
  }

  migrateToV3(blueprint) {
    const v3 = {
      schemaVersion: '3.0',
      id: blueprint.id || blueprint.metadata?.id || 'unknown-id',
      version: blueprint.version || '1.0.0',
      title: blueprint.title || blueprint.metadata?.title || 'Untitled',
      description: blueprint.description || blueprint.metadata?.description || '',
      category: blueprint.category || blueprint.metadata?.category || 'General',
      metadata: {
        created: new Date().toISOString(),
        source: 'vdk-migrate',
        originalVersion: blueprint.schemaVersion || '2.x',
        ...blueprint.metadata,
      },
      platforms: {},
    };

    // Known platforms to check for in top-level or 'platforms' object
    const knownPlatforms = [
      'claude-code',
      'cursor',
      'windsurf',
      'github-copilot',
      'continue',
      'aider',
      'openai-codex',
      'gemini-cli',
    ];

    // Check existing platforms object if it represents v2.1 structure
    const sourcePlatforms = blueprint.platforms || blueprint;

    for (const platform of knownPlatforms) {
      if (sourcePlatforms[platform]) {
        v3.platforms[platform] = this.migratePlatformConfig(sourcePlatforms[platform], platform);
      }
    }

    return v3;
  }

  migratePlatformConfig(config, _platformName) {
    const components = {
      enabled: true,
    };

    // Migrate 'rules' (files/globs) -> components.rules
    if (config.rules || config.files) {
      const rules = config.rules || config.files;
      if (Array.isArray(rules)) {
        components.rules = {
          enabled: true,
          manifests: rules.map(r => {
            if (typeof r === 'string') return { file: r, name: path.basename(r, path.extname(r)) };
            return r; // Already an object?
          }),
        };
      }
    }

    // Migrate 'agents' -> components.agents
    if (config.agents) {
      if (Array.isArray(config.agents)) {
        components.agents = {
          enabled: true,
          manifests: config.agents.map(a => {
            if (typeof a === 'string') return { file: a, name: path.basename(a, path.extname(a)) };
            return a;
          }),
        };
      }
    }

    // Migrate 'commands' -> components.commands
    if (config.commands) {
      if (Array.isArray(config.commands)) {
        components.commands = {
          enabled: true,
          manifests: config.commands.map(c => {
            if (typeof c === 'string') return { file: c, name: path.basename(c, path.extname(c)) };
            return c;
          }),
        };
      }
    }

    // Migrate 'skills' -> components.skills
    if (config.skills) {
      if (Array.isArray(config.skills)) {
        components.skills = {
          enabled: true,
          manifests: config.skills.map(s => {
            if (typeof s === 'string') return { file: s, name: path.basename(s, path.extname(s)) };
            return s;
          }),
        };
      }
    }

    // Preserve other config
    const { rules, agents, commands, skills, files, ...otherConfig } = config;

    return {
      ...otherConfig,
      components,
    };
  }
}
