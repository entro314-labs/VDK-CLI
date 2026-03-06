/**
 * Schema Validator Utility
 * -----------------------
 * Centralized validation for VDK schemas including commands and blueprints
 * using the shared AI context schema validator package.
 */

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { fileSystem, pathUtils } from './file-system.js';

const require = createRequire(import.meta.url);

const SCHEMA_PACKAGE_CANDIDATES = ['@vdkit/ai-context-schema', 'ai-context-schema'];

let schemaPackageName = null;
let SchemaValidator = null;

for (const candidate of SCHEMA_PACKAGE_CANDIDATES) {
  try {
    ({ SchemaValidator } = require(candidate));
    schemaPackageName = candidate;
    break;
  } catch {
    // Try next candidate
  }
}

if (!SchemaValidator || !schemaPackageName) {
  throw new Error(
    `Could not resolve schema validator package. Tried: ${SCHEMA_PACKAGE_CANDIDATES.join(', ')}`
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.dirname(require.resolve(`${schemaPackageName}/package.json`));

// Cache schema validator instances
const validatorCache = new Map();

/**
 * Load schema from file
 */
async function loadSchemaDefinition(schemaName) {
  try {
    // Resolve absolute path to the schema in the package
    // schemas/vdk/blueprint-schema.json
    let subPath = `schemas/vdk/${schemaName}.json`;
    if (!schemaName.includes('/')) {
      // default to vdk folder for bare names
      subPath = `schemas/vdk/${schemaName}.json`;
    }

    const schemaPath = path.join(SCHEMAS_DIR, subPath);
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    throw new Error(`Failed to load schema '${schemaName}': ${error.message}`, { cause: error });
  }
}

/**
 * Get or create a validator for a specific schema
 */
async function getValidator(schemaName) {
  if (validatorCache.has(schemaName)) {
    return validatorCache.get(schemaName);
  }

  const schemaDefinition = await loadSchemaDefinition(schemaName);
  const validator = new SchemaValidator(schemaDefinition);
  validatorCache.set(schemaName, validator);
  return validator;
}

/**
 * Validate data against schema package validator
 */
export async function validateSchema(data, schemaName) {
  const validator = await getValidator(schemaName);

  // adapt validateSchema from package: it takes (schema, filePath)
  // we treat our 'data' as the 'schema' argument since SchemaValidator validates Schema Instances
  const result = await validator.validateSchema(data, 'memory');

  return {
    valid: result.valid,
    errors: [
      ...result.errors.map(e => (typeof e === 'string' ? e : `${e.type}: ${e.message}`)),
      ...(result.warnings || []).map(w => `WARNING: ${w.type}: ${w.message}`),
    ],
  };
}

/**
 * Validate Claude Code command
 */
export async function validateCommand(commandData) {
  return await validateSchema(commandData, 'command-schema');
}

/**
 * Validate VDK Blueprint
 */
export async function validateBlueprint(blueprintData) {
  return await validateSchema(blueprintData, 'blueprint-schema');
}

/**
 * Get all available schemas
 */
export async function getAvailableSchemas() {
  try {
    const files = await fs.readdir(SCHEMAS_DIR);
    return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
  } catch (error) {
    console.warn(`Could not read schemas directory: ${error.message}`);
    return [];
  }
}

/**
 * Clear schema cache (useful for testing)
 */
export function clearSchemaCache() {
  validatorCache.clear();
}

/**
 * Common validation functions
 */
export const validators = {
  /**
   * Validate email format
   */
  email(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate URL format
   */
  url(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate file path exists
   */
  async filePath(path) {
    return await fileSystem.exists(path);
  },

  /**
   * Validate directory path exists
   */
  async directoryPath(path) {
    return await fileSystem.isDirectory(path);
  },

  /**
   * Validate JSON string
   */
  json(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate YAML frontmatter
   */
  yamlFrontmatter(content) {
    try {
      const parsed = matter(content);
      return parsed.data !== null && typeof parsed.data === 'object';
    } catch {
      return false;
    }
  },

  /**
   * Validate rule ID format
   */
  ruleId(id) {
    // Rule IDs should be kebab-case strings
    const ruleIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return typeof id === 'string' && ruleIdRegex.test(id);
  },

  /**
   * Validate blueprint category
   */
  blueprintCategory(category) {
    const validCategories = [
      'core',
      'language',
      'framework',
      'tool',
      'task',
      'security',
      'assistant',
      'custom',
    ];
    return validCategories.includes(category);
  },

  /**
   * Validate semantic version
   */
  semver(version) {
    const semverRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(version);
  },

  /**
   * Validate platform name
   */
  platform(platform) {
    const validPlatforms = [
      'cursor',
      'windsurf',
      'claude-code',
      'vscode',
      'jetbrains',
      'zed',
      'generic',
    ];
    return validPlatforms.includes(platform);
  },
};

/**
 * Validation result formatting
 */
export const formatters = {
  /**
   * Format validation errors for console output
   */
  formatErrors(errors, filePath = null) {
    if (errors.length === 0) return '';

    let output = '';
    if (filePath) {
      output += `Errors in ${filePath}:\n`;
    }

    errors.forEach(error => {
      output += `  • ${error}\n`;
    });

    return output;
  },

  /**
   * Format validation summary
   */
  formatSummary(results) {
    return {
      total: results.valid.length + results.invalid.length,
      valid: results.valid.length,
      invalid: results.invalid.length,
      warnings: results.warnings?.length || 0,
      duplicates: results.duplicateIds?.size || 0,
    };
  },
};

/**
 * File validation helpers
 */
export const fileValidation = {
  /**
   * Validate MDC file structure and content
   */
  async validateMDCFile(content) {
    const errors = [];

    try {
      const parsed = matter(content);

      // Check for YAML frontmatter
      if (!parsed.data || typeof parsed.data !== 'object') {
        errors.push('No YAML frontmatter found');
        return { valid: false, errors };
      }

      // Check for content after frontmatter
      if (!parsed.content || parsed.content.trim().length === 0) {
        errors.push('No content found after frontmatter');
      }

      // Validate frontmatter fields using the schema validator
      // We assume it's a blueprint
      const validation = await validateBlueprint(parsed.data);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    } catch (error) {
      errors.push(`Failed to parse file: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate multiple MDC files
   */
  async validateMDCFiles(filePaths) {
    const results = {
      valid: [],
      invalid: [],
      warnings: [],
      duplicateIds: new Map(),
    };

    const ruleIds = new Map();

    for (const filePath of filePaths) {
      try {
        const content = await fileSystem.readFile(filePath);
        const validation = await this.validateMDCFile(content);

        if (validation.valid) {
          results.valid.push(filePath);

          // Check for duplicate rule IDs
          const parsed = matter(content);
          const ruleId = parsed.data.id;

          if (ruleId) {
            if (ruleIds.has(ruleId)) {
              results.duplicateIds.set(ruleId, {
                current: filePath,
                existing: ruleIds.get(ruleId),
              });
            } else {
              ruleIds.set(ruleId, filePath);
            }
          }
        } else {
          results.invalid.push({
            file: filePath,
            errors: validation.errors,
          });
        }
      } catch (error) {
        results.invalid.push({
          file: filePath,
          errors: [`Failed to read file: ${error.message}`],
        });
      }
    }

    return results;
  },

  /**
   * Validate directory structure
   */
  async validateDirectory(dirPath, expectedStructure = []) {
    const errors = [];

    if (!(await fileSystem.exists(dirPath))) {
      errors.push(`Directory does not exist: ${dirPath}`);
      return { valid: false, errors };
    }

    if (!(await fileSystem.isDirectory(dirPath))) {
      errors.push(`Path is not a directory: ${dirPath}`);
      return { valid: false, errors };
    }

    for (const expectedPath of expectedStructure) {
      const fullPath = pathUtils.join(dirPath, expectedPath);
      if (!(await fileSystem.exists(fullPath))) {
        errors.push(`Missing expected file/directory: ${expectedPath}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Standard validation patterns for CLI commands
 * Use these patterns in command getValidationRules() methods
 */
export const standardPatterns = {
  /**
   * Standard project validation pattern
   */
  projectValidation: {
    projectPath: {
      type: 'string',
      pathType: 'directory',
    },
    outputPath: {
      type: 'string',
      pathType: 'writeable',
    },
    verbose: {
      type: 'boolean',
    },
  },

  /**
   * Standard IDE validation pattern
   */
  ideValidation: {
    ide: {
      type: 'string',
      enum: ['vscode', 'jetbrains', 'cursor', 'windsurf', 'zed', 'generic'],
      validate: value => {
        if (value) {
          return value.toLowerCase() === value ? true : 'IDE name must be lowercase';
        }
        return true;
      },
    },
  },

  /**
   * Standard categories validation pattern
   */
  categoriesValidation: {
    categories: {
      type: 'array',
      validate: categories => {
        if (categories) {
          const validCategories = ['development', 'testing', 'workflow', 'deployment', 'analysis'];
          const invalidCategories = categories.filter(cat => !validCategories.includes(cat));
          if (invalidCategories.length > 0) {
            return `Invalid categories: ${invalidCategories.join(', ')}. Valid options: ${validCategories.join(', ')}`;
          }
        }
        return true;
      },
    },
  },

  /**
   * Standard VDK initialization check
   */
  vdkInitializedValidation: async options => {
    const path = await import('node:path');
    const { commandContext } = await import('../commands/shared/CommandContext.js');

    const vdkConfigPath = path.join(options.projectPath, 'vdk.config.json');
    const configExists = await commandContext.pathExists(vdkConfigPath);
    if (!configExists) {
      return `VDK not initialized in this project. Run 'vdk init' first.\nExpected config file: ${vdkConfigPath}`;
    }
    return true;
  },
};

export default {
  validateSchema,
  validateCommand,
  validateBlueprint,
  getAvailableSchemas,
  clearSchemaCache,
  validators,
  formatters,
  fileValidation,
  standardPatterns,
};
