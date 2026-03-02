/**
 * Base Parser
 * Abstract base class for platform-specific parsers
 */

import fs from 'fs-extra';
import path from 'node:path';
import { createIRBundle } from '../ir/types.js';

/**
 * Base Parser class
 */
export class BaseParser {
  constructor(platformId, basePath) {
    this.platformId = platformId;
    this.basePath = basePath;
  }

  /**
   * Parse platform configuration into IR
   * Must be implemented by subclasses
   */
  async parse() {
    throw new Error('parse() must be implemented by subclass');
  }

  /**
   * Detect if platform configuration exists
   */
  async detect() {
    throw new Error('detect() must be implemented by subclass');
  }

  /**
   * Get platform-specific file locations
   */
  getFileLocations() {
    throw new Error('getFileLocations() must be implemented by subclass');
  }

  /**
   * Read file with error handling
   */
  async readFile(filePath) {
    try {
      const fullPath = path.resolve(this.basePath, filePath);
      if (!(await fs.pathExists(fullPath))) {
        return null;
      }
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    const fullPath = path.resolve(this.basePath, filePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath, extension) {
    try {
      const fullPath = path.resolve(this.basePath, dirPath);
      if (!(await fs.pathExists(fullPath))) {
        return [];
      }

      const files = await fs.readdir(fullPath);
      if (extension) {
        return files.filter(f => f.endsWith(extension));
      }
      return files;
    } catch (error) {
      console.error(`Error listing files in ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Resolve file references
   */
  async resolveFileReference(refPath) {
    const fullPath = path.resolve(this.basePath, refPath);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
    return null;
  }

  /**
   * Create success result
   */
  createSuccessResult(ir) {
    return {
      success: true,
      ir,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Create error result
   */
  createErrorResult(errors, warnings = []) {
    return {
      success: false,
      errors,
      warnings,
    };
  }

  /**
   * Add warning to result
   */
  addWarning(result, warning) {
    result.warnings.push(warning);
  }

  /**
   * Add error to result
   */
  addError(result, error) {
    result.errors.push(error);
    result.success = false;
  }

  /**
   * Get source format from file extension
   */
  getSourceFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.md':
        return 'markdown';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.json':
        return 'json';
      case '.toml':
        return 'toml';
      default:
        return 'markdown';
    }
  }

  /**
   * Normalize path separators
   */
  normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Get relative path from base
   */
  getRelativePath(filePath) {
    return path.relative(this.basePath, filePath);
  }

  /**
   * Parse glob patterns from frontmatter or content
   */
  parseGlobPatterns(patterns) {
    if (typeof patterns === 'string') {
      return [patterns];
    }
    return patterns;
  }

  /**
   * Parse tool permissions from string or array
   */
  parseToolPermissions(tools) {
    if (typeof tools === 'string') {
      return tools.split(',').map(t => t.trim());
    }
    return tools;
  }

  /**
   * Extract triggers from description
   */
  extractTriggersFromDescription(description) {
    const triggers = [];

    // Look for PROACTIVELY keyword
    if (description.includes('PROACTIVELY')) {
      triggers.push('PROACTIVELY');
    }

    // Extract keywords in quotes or after "when"
    const whenMatch = description.match(/when\s+([^.]+)/i);
    if (whenMatch) {
      const keywords = whenMatch[1].split(/,|\s+and\s+|\s+or\s+/);
      triggers.push(...keywords.map(k => k.trim()));
    }

    return triggers;
  }

  /**
   * Validate parsed IR
   */
  validateIR(ir) {
    const errors = [];

    if (!ir.id) errors.push('Missing id');
    if (!ir.type) errors.push('Missing type');
    if (!ir.name) errors.push('Missing name');
    if (!ir.description) errors.push('Missing description');
    if (!ir.content) errors.push('Missing content');

    return errors;
  }

  /**
   * Validate IR collection
   */
  validateCollection(collection) {
    const errors = [];

    // Validate each component
    if (collection.main) {
      errors.push(...this.validateIR(collection.main).map(e => `main: ${e}`));
    }
    if (collection.agents) {
      collection.agents.forEach((agent, i) => {
        errors.push(...this.validateIR(agent).map(e => `agent[${i}]: ${e}`));
      });
    }
    if (collection.rules) {
      collection.rules.forEach((rule, i) => {
        errors.push(...this.validateIR(rule).map(e => `rule[${i}]: ${e}`));
      });
    }
    if (collection.commands) {
      collection.commands.forEach((command, i) => {
        errors.push(...this.validateIR(command).map(e => `command[${i}]: ${e}`));
      });
    }
    if (collection.skills) {
      collection.skills.forEach((skill, i) => {
        errors.push(...this.validateIR(skill).map(e => `skill[${i}]: ${e}`));
      });
    }
    if (collection.workflows) {
      collection.workflows.forEach((workflow, i) => {
        errors.push(...this.validateIR(workflow).map(e => `workflow[${i}]: ${e}`));
      });
    }
    if (collection.settings) {
      errors.push(...this.validateIR(collection.settings).map(e => `settings: ${e}`));
    }
    if (collection.mcpConfig) {
      errors.push(...this.validateIR(collection.mcpConfig).map(e => `mcpConfig: ${e}`));
    }

    return errors;
  }

  /**
   * Create empty collection
   */
  createEmptyCollection() {
    return createIRBundle();
  }

  /**
   * Log parsing progress
   */
  log(message, level = 'info') {
    const prefix = `[${this.platformId}]`;
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }
}

/**
 * Parser registry for managing platform parsers
 */
export class ParserRegistry {
  constructor() {
    this.parsers = new Map();
  }

  /**
   * Register a parser
   */
  register(platformId, parserClass) {
    this.parsers.set(platformId, parserClass);
  }

  /**
   * Get parser for platform
   */
  getParser(platformId, basePath) {
    const ParserClass = this.parsers.get(platformId);
    if (!ParserClass) {
      return null;
    }
    return new ParserClass(platformId, basePath);
  }

  /**
   * Check if parser exists for platform
   */
  hasParser(platformId) {
    return this.parsers.has(platformId);
  }

  /**
   * Get all registered platforms
   */
  getPlatforms() {
    return Array.from(this.parsers.keys());
  }

  /**
   * Detect platform from directory
   */
  async detectPlatform(basePath) {
    for (const [platformId, ParserClass] of this.parsers.entries()) {
      const parser = new ParserClass(platformId, basePath);
      if (await parser.detect()) {
        return platformId;
      }
    }
    return null;
  }

  /**
   * Detect all platforms in directory
   */
  async detectAllPlatforms(basePath) {
    const detected = [];
    for (const [platformId, ParserClass] of this.parsers.entries()) {
      const parser = new ParserClass(platformId, basePath);
      if (await parser.detect()) {
        detected.push(platformId);
      }
    }
    return detected;
  }
}

/**
 * Global parser registry instance
 */
export const parserRegistry = new ParserRegistry();
