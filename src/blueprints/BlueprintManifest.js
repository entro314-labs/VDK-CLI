/**
 * BlueprintManifest
 * -----------------
 * Blueprint v3.0 manifest system with component-level blueprints and dependencies
 */

import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { CANONICAL_KINDS, resolveCanonicalKind } from '../shared/canonical-kind.js';

export class BlueprintManifest {
  constructor(manifestPath) {
    this.manifestPath = manifestPath;
    this.manifest = null;
  }

  /**
   * Load and parse blueprint manifest
   */
  async load() {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf8');

      // Support both YAML and JSON
      if (this.manifestPath.endsWith('.yaml') || this.manifestPath.endsWith('.yml')) {
        this.manifest = yaml.load(content);
      } else {
        this.manifest = JSON.parse(content);
      }

      return this.manifest;
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  /**
   * Validate manifest structure
   */
  validate() {
    const errors = [];

    if (!this.manifest) {
      errors.push('Manifest not loaded');
      return { valid: false, errors };
    }

    // Required fields
    if (!this.manifest.schemaVersion) errors.push('Missing schemaVersion');
    if (!this.manifest.id) errors.push('Missing id');
    if (!this.manifest.kind) errors.push('Missing kind');
    if (!this.manifest.title) errors.push('Missing title');
    if (!this.manifest.version) errors.push('Missing version');

    // Validate canonical kind
    const kindResolution = resolveCanonicalKind({
      kind: this.manifest.kind,
      componentType: this.manifest?.metadata?.componentType,
    });

    if (!kindResolution) {
      errors.push(
        `Invalid kind: ${this.manifest.kind}. Must be one of: ${CANONICAL_KINDS.join(', ')}`
      );
    } else {
      this.manifest.kind = kindResolution.canonicalKind;
    }

    // Validate version format (semver)
    if (this.manifest.version && !/^\d+\.\d+\.\d+/.test(this.manifest.version)) {
      errors.push('Version must be in semver format (e.g., 1.0.0)');
    }

    // Validate platforms structure
    if (this.manifest.platforms) {
      for (const [platform, config] of Object.entries(this.manifest.platforms)) {
        if (!config.components) {
          errors.push(`Platform ${platform} missing components`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get dependencies
   */
  getDependencies() {
    return {
      requires: this.manifest.requires || [],
      suggests: this.manifest.suggests || [],
      conflicts: this.manifest.conflicts || [],
      supersedes: this.manifest.supersedes || [],
    };
  }

  /**
   * Get platform components
   */
  getPlatformComponents(platform) {
    if (!this.manifest.platforms?.[platform]) {
      return null;
    }

    return this.manifest.platforms[platform].components;
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms() {
    return Object.keys(this.manifest.platforms || {});
  }

  /**
   * Get metadata
   */
  getMetadata() {
    return {
      id: this.manifest.id,
      kind: this.manifest.kind,
      title: this.manifest.title,
      description: this.manifest.description,
      version: this.manifest.version,
      author: this.manifest.author,
      license: this.manifest.license,
      tags: this.manifest.tags || [],
      category: this.manifest.category,
      complexity: this.manifest.complexity,
      maturity: this.manifest.maturity,
      lastUpdated: this.manifest.lastUpdated,
    };
  }

  /**
   * Create a new manifest
   */
  static create(options) {
    const kindResolution = resolveCanonicalKind({
      kind: options.kind,
      componentType: options?.metadata?.componentType,
    });

    const manifest = {
      schemaVersion: '3.0',
      id: options.id,
      kind: kindResolution?.canonicalKind || options.kind,
      title: options.title,
      description: options.description || '',
      version: options.version || '1.0.0',
      author: options.author,
      license: options.license || 'MIT',

      requires: options.requires || [],
      suggests: options.suggests || [],
      conflicts: options.conflicts || [],
      supersedes: options.supersedes || [],

      platforms: options.platforms || {},

      tags: options.tags || [],
      category: options.category,
      complexity: options.complexity || 'medium',
      maturity: options.maturity || 'stable',
      lastUpdated: new Date().toISOString().split('T')[0],

      install: options.install || {},
      config: options.config || {},
    };

    return manifest;
  }

  /**
   * Save manifest to file
   */
  async save(outputPath, format = 'yaml') {
    const content =
      format === 'yaml'
        ? yaml.dump(this.manifest, { indent: 2 })
        : JSON.stringify(this.manifest, null, 2);

    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
  }
}
