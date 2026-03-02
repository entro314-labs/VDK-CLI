/**
 * Schema v3 Migrator
 * ==================
 * Converts AI Context Schema v2.x blueprints to v3.0 format
 *
 * Breaking Changes:
 * - schemaVersion: "3.0" required
 * - platforms restructured with components architecture
 * - Component-level manifests for agents, rules, commands, skills
 * - New source and metadata objects
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { generateBlueprintId } from '../../utils/filename-generator.js';
import { validateBlueprint } from '../../utils/schema-validator.js';

export class SchemaV3Migrator {
  constructor(options = {}) {
    this.verbose = options.verbose;
    this.force = options.force;
  }

  /**
   * Migrate blueprint files from v2.x to v3.0
   */
  async migrateBlueprints(inputPath, outputPath, options = {}) {
    const results = {
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      files: [],
    };

    try {
      await fs.mkdir(outputPath, { recursive: true });
      const files = await this.findBlueprintFiles(inputPath);

      for (const filePath of files) {
        try {
          const result = await this.migrateSingleBlueprint(filePath, outputPath, options);
          results.processed++;

          if (result.migrated) {
            results.migrated++;
          } else {
            results.skipped++;
          }

          results.files.push(result);

          if (this.verbose) {
            console.log(`${result.migrated ? '✓' : '→'} ${path.basename(filePath)}`);
          }
        } catch (error) {
          results.errors++;
          results.files.push({
            file: path.basename(filePath),
            migrated: false,
            error: error.message,
          });

          if (this.verbose) {
            console.error(`✗ ${path.basename(filePath)}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`v3 migration failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Migrate a single blueprint file to v3.0
   */
  async migrateSingleBlueprint(filePath, outputPath, options = {}) {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = matter(content);
    const originalData = { ...parsed.data };

    // Check if already v3.0
    if (this.isV3Format(originalData)) {
      const forceMigration = options.force || this.force;
      if (!forceMigration) {
        return {
          file: path.basename(filePath),
          migrated: false,
          reason: 'Already in v3.0 format',
        };
      }
    }

    // Perform v2 → v3 migration
    const migratedData = this.migrateV2ToV3(originalData, filePath);

    // Validate migrated data
    const validation = await validateBlueprint(migratedData);
    if (!validation.valid && this.verbose) {
      console.warn(`Validation warnings for ${path.basename(filePath)}:`, validation.errors);
    }

    // Write migrated file
    const outputFile = path.join(outputPath, path.basename(filePath));
    const migratedContent = matter.stringify(parsed.content, migratedData);
    await fs.writeFile(outputFile, migratedContent, 'utf8');

    return {
      file: path.basename(filePath),
      migrated: true,
      changes: this.getChangeSummary(originalData, migratedData),
    };
  }

  /**
   * Check if blueprint is already v3.0 format
   */
  isV3Format(frontmatter) {
    return frontmatter.schemaVersion === '3.0';
  }

  /**
   * Migrate v2.x frontmatter to v3.0
   */
  migrateV2ToV3(v2Data, filePath) {
    const v3Data = {
      // Required v3.0 fields
      schemaVersion: '3.0',
      id:
        v2Data.id ||
        generateBlueprintId(v2Data.title || path.basename(filePath, path.extname(filePath))),
      title: v2Data.title || 'Untitled',
      description: v2Data.description || '',
      version: this.normalizeVersion(v2Data.version),
      category: v2Data.category || 'core',

      // Optional metadata preserved from v2
      ...(v2Data.lastUpdated && { lastUpdated: v2Data.lastUpdated }),
      ...(v2Data.complexity && { complexity: v2Data.complexity }),
      ...(v2Data.scope && { scope: v2Data.scope }),
      ...(v2Data.audience && { audience: v2Data.audience }),
      ...(v2Data.maturity && { maturity: v2Data.maturity }),
      ...(v2Data.tags && { tags: v2Data.tags }),
      ...(v2Data.author && { author: v2Data.author }),
      ...(v2Data.license && { license: v2Data.license }),

      // Migrate platforms to v3.0 components architecture
      platforms: this.migratePlatforms(v2Data.platforms || {}, v2Data),

      // Add source tracking
      source: {
        format: 'vdk-blueprint-v2',
        migratedAt: new Date().toISOString(),
        originalVersion: v2Data.version || 'unknown',
      },
    };

    return v3Data;
  }

  /**
   * Migrate platforms object from v2 flat structure to v3 components architecture
   */
  migratePlatforms(v2Platforms, v2Data) {
    const v3Platforms = {};

    for (const [platformId, v2Config] of Object.entries(v2Platforms)) {
      if (!v2Config?.compatible) {
        continue;
      }

      v3Platforms[platformId] = {
        components: this.inferComponents(platformId, v2Config, v2Data),
      };
    }

    return v3Platforms;
  }

  /**
   * Infer v3 component structure from v2 platform config
   */
  inferComponents(platformId, v2Config, v2Data) {
    const components = {};

    // Determine component type from v2 metadata
    const isAgent = v2Config.agent || v2Data.category === 'assistants';
    const isCommand = v2Config.command || v2Data.category === 'commands';
    const isSkill = v2Config.skill || v2Data.category === 'skills';
    const isWorkflow = v2Config.workflow || v2Data.category === 'workflows';

    switch (platformId) {
      case 'claude-code':
        if (isAgent) {
          components.agents = {
            type: 'claude-agent',
            location: '.claude/agents/',
            enabled: true,
            manifests: [
              {
                name: this.sanitizeComponentName(v2Data.title),
                file: `${this.sanitizeComponentName(v2Data.title)}.md`,
                tools: v2Config.allowedTools || [],
                model: v2Config.model || 'sonnet',
                triggers: v2Config.triggers || [],
              },
            ],
          };
        } else if (isCommand) {
          components.commands = {
            type: 'claude-command',
            location: '.claude/commands/',
            enabled: true,
            manifests: [
              {
                name: this.sanitizeComponentName(v2Data.title),
                file: `${this.sanitizeComponentName(v2Data.title)}.md`,
                triggers: v2Config.triggers || [],
              },
            ],
          };
        } else if (isSkill) {
          components.skills = {
            type: 'claude-skill',
            location: '.claude/skills/',
            enabled: true,
          };
        } else {
          // Default to rules
          components.rules = {
            type: 'claude-rule',
            location: '.claude/rules/',
            enabled: true,
            manifests: [
              {
                name: this.sanitizeComponentName(v2Data.title),
                file: `${this.sanitizeComponentName(v2Data.title)}.md`,
              },
            ],
          };
        }

        // Add main CLAUDE.md if memory is enabled
        if (v2Config.memory) {
          components.main = {
            type: 'claude-main',
            location: 'CLAUDE.md',
            enabled: true,
          };
        }

        // Add settings if tools are restricted
        if (v2Config.allowedTools || v2Config.mcpIntegration) {
          components.settings = {
            type: 'claude-settings',
            location: '.claude/settings.json',
            enabled: true,
            config: {
              ...(v2Config.allowedTools && { allowedTools: v2Config.allowedTools }),
              ...(v2Config.mcpIntegration !== undefined && {
                mcpIntegration: v2Config.mcpIntegration,
              }),
            },
          };
        }
        break;

      case 'cursor':
        components.rules = {
          type: 'cursor-rule',
          location: '.cursor/rules/',
          enabled: true,
          manifests: [
            {
              name: this.sanitizeComponentName(v2Data.title),
              file: `${this.sanitizeComponentName(v2Data.title)}.mdc`,
              activation: v2Config.activation || 'manual',
              ...(v2Config.globs && { globs: v2Config.globs }),
            },
          ],
        };
        break;

      case 'windsurf':
        if (isWorkflow) {
          components.workflows = {
            type: 'windsurf-workflow',
            location: '.windsurf/workflows/',
            enabled: true,
          };
        } else {
          components.rules = {
            type: 'windsurf-rule',
            location: '.windsurf/rules/',
            enabled: true,
            manifests: [
              {
                name: this.sanitizeComponentName(v2Data.title),
                file: `${this.sanitizeComponentName(v2Data.title)}.md`,
              },
            ],
          };
        }
        break;

      case 'github-copilot':
        components.instructions = {
          type: 'copilot-instructions',
          location: '.github/copilot-instructions.md',
          enabled: true,
          characterLimit: 3000,
        };
        break;

      default:
        // Generic platform component
        components.rules = {
          type: `${platformId}-rule`,
          location: `.${platformId}/`,
          enabled: true,
        };
    }

    return components;
  }

  /**
   * Normalize version string
   */
  normalizeVersion(v2Version) {
    if (!v2Version) return '1.0.0';
    if (typeof v2Version === 'string') {
      // Remove ">=" or other operators
      return v2Version.replace(/[><=]+/g, '');
    }
    return String(v2Version);
  }

  /**
   * Sanitize component name for file names
   */
  sanitizeComponentName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get summary of changes made during migration
   */
  getChangeSummary(v2Data, _v3Data) {
    const changes = [];

    changes.push('Added schemaVersion: "3.0"');

    if (!v2Data.schemaVersion) {
      changes.push('Migrated from implicit v2.x to explicit v3.0');
    }

    if (v2Data.platforms) {
      changes.push('Restructured platforms with components architecture');
      changes.push(`Migrated ${Object.keys(v2Data.platforms).length} platform configurations`);
    }

    changes.push('Added source tracking metadata');

    return changes;
  }

  /**
   * Find all blueprint files in a directory
   */
  async findBlueprintFiles(dirPath) {
    const files = [];

    async function walk(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden dirs
          if (
            entry.name === 'node_modules' ||
            (entry.name.startsWith('.') && entry.name !== '.claude')
          ) {
            continue;
          }
          await walk(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdc')) {
          files.push(fullPath);
        }
      }
    }

    await walk(dirPath);
    return files;
  }
}

export default SchemaV3Migrator;
