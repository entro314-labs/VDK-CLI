/**
 * PluginPackager
 * --------------
 * Package and distribute component bundles as plugins
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { BlueprintManifest } from './BlueprintManifest.js';

export class PluginPackager {
  constructor(pluginPath) {
    this.pluginPath = pluginPath;
    this.manifest = null;
    this.files = [];
  }

  /**
   * Initialize plugin from directory
   */
  async initialize() {
    // Look for manifest file
    const manifestFiles = ['plugin.yaml', 'plugin.yml', 'plugin.json', 'manifest.yaml'];

    for (const filename of manifestFiles) {
      const manifestPath = path.join(this.pluginPath, filename);
      try {
        await fs.access(manifestPath);
        this.manifest = new BlueprintManifest(manifestPath);
        await this.manifest.load();
        break;
      } catch {}
    }

    if (!this.manifest) {
      throw new Error('No plugin manifest found');
    }

    // Validate manifest
    const validation = this.manifest.validate();
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
    }

    // Scan for component files
    await this.scanComponents();

    return this.manifest;
  }

  /**
   * Scan for component files
   */
  async scanComponents() {
    const platforms = this.manifest.getSupportedPlatforms();

    for (const platform of platforms) {
      const components = this.manifest.getPlatformComponents(platform);

      if (!components) continue;

      for (const [componentType, config] of Object.entries(components)) {
        if (config.manifests) {
          for (const manifest of config.manifests) {
            const filePath = path.join(this.pluginPath, manifest.file);
            this.files.push({
              type: componentType,
              platform,
              file: manifest.file,
              path: filePath,
              name: manifest.name,
            });
          }
        }
      }
    }
  }

  /**
   * Package plugin into distributable format
   */
  async package(outputPath) {
    const packageData = {
      manifest: this.manifest.manifest,
      files: {},
      metadata: {
        packagedAt: new Date().toISOString(),
        totalFiles: this.files.length,
        platforms: this.manifest.getSupportedPlatforms(),
      },
    };

    // Read and include all component files
    for (const file of this.files) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        packageData.files[file.file] = {
          type: file.type,
          platform: file.platform,
          name: file.name,
          content,
        };
      } catch (error) {
        throw new Error(`Failed to read file ${file.file}: ${error.message}`, { cause: error });
      }
    }

    // Write package file
    const packagePath = path.join(outputPath, `${this.manifest.manifest.id}.vdk-plugin.json`);
    await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2), 'utf8');

    return {
      packagePath,
      manifest: this.manifest.manifest,
      fileCount: this.files.length,
    };
  }

  /**
   * Validate plugin structure
   */
  async validate() {
    const issues = [];

    // Validate manifest
    const manifestValidation = this.manifest.validate();
    if (!manifestValidation.valid) {
      issues.push(...manifestValidation.errors);
    }

    // Check if all referenced files exist
    for (const file of this.files) {
      try {
        await fs.access(file.path);
      } catch {
        issues.push(`File not found: ${file.file}`);
      }
    }

    // Check for required metadata
    const metadata = this.manifest.getMetadata();
    if (!metadata.author) issues.push('Missing author');
    if (!metadata.license) issues.push('Missing license');
    if (!metadata.description) issues.push('Missing description');

    return {
      valid: issues.length === 0,
      issues,
      fileCount: this.files.length,
      platforms: this.manifest.getSupportedPlatforms(),
    };
  }

  /**
   * Extract plugin package
   */
  static async extract(packagePath, outputPath) {
    const content = await fs.readFile(packagePath, 'utf8');
    const packageData = JSON.parse(content);

    // Create output directory
    await fs.mkdir(outputPath, { recursive: true });

    // Write manifest
    const manifestPath = path.join(outputPath, 'plugin.json');
    await fs.writeFile(manifestPath, JSON.stringify(packageData.manifest, null, 2), 'utf8');

    // Extract files
    const extractedFiles = [];
    for (const [filename, fileData] of Object.entries(packageData.files)) {
      const filePath = path.join(outputPath, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, fileData.content, 'utf8');
      extractedFiles.push(filePath);
    }

    return {
      manifest: packageData.manifest,
      files: extractedFiles,
      outputPath,
    };
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      ...this.manifest.getMetadata(),
      fileCount: this.files.length,
      platforms: this.manifest.getSupportedPlatforms(),
      dependencies: this.manifest.getDependencies(),
    };
  }
}
