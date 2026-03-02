/**
 * DependencyResolver
 * ------------------
 * Resolve blueprint dependencies with conflict detection
 */

export class DependencyResolver {
  constructor() {
    this.blueprints = new Map();
    this.resolved = [];
    this.resolving = new Set();
  }

  /**
   * Add blueprint to resolver
   */
  addBlueprint(id, manifest) {
    this.blueprints.set(id, {
      id,
      manifest,
      dependencies: this.extractDependencies(manifest),
    });
  }

  /**
   * Extract dependencies from manifest
   */
  extractDependencies(manifest) {
    return {
      requires: (manifest.requires || []).map(dep =>
        typeof dep === 'string' ? { id: dep, version: '*' } : dep
      ),
      suggests: manifest.suggests || [],
      conflicts: manifest.conflicts || [],
      supersedes: manifest.supersedes || [],
    };
  }

  /**
   * Resolve dependencies for a blueprint
   */
  async resolve(blueprintId) {
    if (this.resolved.includes(blueprintId)) {
      return { success: true, order: this.resolved };
    }

    if (this.resolving.has(blueprintId)) {
      throw new Error(`Circular dependency detected: ${blueprintId}`);
    }

    const blueprint = this.blueprints.get(blueprintId);
    if (!blueprint) {
      throw new Error(`Blueprint not found: ${blueprintId}`);
    }

    this.resolving.add(blueprintId);

    // Check conflicts
    const conflicts = this.checkConflicts(blueprint);
    if (conflicts.length > 0) {
      throw new Error(`Conflicts detected: ${conflicts.join(', ')}`);
    }

    // Resolve required dependencies first
    for (const dep of blueprint.dependencies.requires) {
      if (!this.blueprints.has(dep.id)) {
        throw new Error(`Required dependency not found: ${dep.id}`);
      }

      // Check version compatibility
      if (!this.isVersionCompatible(dep.id, dep.version)) {
        throw new Error(`Version incompatible: ${dep.id} requires ${dep.version}`);
      }

      await this.resolve(dep.id);
    }

    this.resolving.delete(blueprintId);

    if (!this.resolved.includes(blueprintId)) {
      this.resolved.push(blueprintId);
    }

    return {
      success: true,
      order: this.resolved,
      suggested: blueprint.dependencies.suggests,
    };
  }

  /**
   * Check for conflicts
   */
  checkConflicts(blueprint) {
    const conflicts = [];

    for (const conflictId of blueprint.dependencies.conflicts) {
      if (this.resolved.includes(conflictId)) {
        conflicts.push(conflictId);
      }
    }

    return conflicts;
  }

  /**
   * Check version compatibility
   */
  isVersionCompatible(blueprintId, requiredVersion) {
    if (requiredVersion === '*') return true;

    const blueprint = this.blueprints.get(blueprintId);
    if (!blueprint) return false;

    const version = blueprint.manifest.version;

    // Simple version check (can be enhanced with semver library)
    if (requiredVersion.startsWith('>=')) {
      const minVersion = requiredVersion.slice(2);
      return this.compareVersions(version, minVersion) >= 0;
    }

    if (requiredVersion.startsWith('^')) {
      const baseVersion = requiredVersion.slice(1);
      const [major] = baseVersion.split('.');
      const [currentMajor] = version.split('.');
      return major === currentMajor && this.compareVersions(version, baseVersion) >= 0;
    }

    return version === requiredVersion;
  }

  /**
   * Compare versions (simple implementation)
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }

    return 0;
  }

  /**
   * Get installation order
   */
  getInstallationOrder() {
    return this.resolved;
  }

  /**
   * Reset resolver
   */
  reset() {
    this.resolved = [];
    this.resolving.clear();
  }

  /**
   * Build dependency graph
   */
  buildGraph() {
    const graph = {};

    for (const [id, blueprint] of this.blueprints) {
      graph[id] = {
        requires: blueprint.dependencies.requires.map(d => d.id),
        suggests: blueprint.dependencies.suggests,
        conflicts: blueprint.dependencies.conflicts,
      };
    }

    return graph;
  }
}
