/**
 * Plugin Registry
 * ===============
 * Manages VDK plugins (load, register, execute hooks).
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

export class PluginRegistry extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.hooks = new Map();
  }

  /**
   * Register a plugin
   * @param {Object} plugin - Plugin definition
   */
  register(plugin) {
    if (!(plugin.id && plugin.version)) {
      throw new Error('Plugin must have id and version');
    }

    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin ${plugin.id} already registered, overwriting.`);
    }

    this.plugins.set(plugin.id, {
      ...plugin,
      enabled: true,
      registeredAt: new Date(),
    });

    this.emit('plugin:registered', plugin.id);
  }

  /**
   * Execute a hook across all plugins
   * @param {string} hookName - Name of the hook
   * @param {Object} context - Context to pass to plugins
   */
  async executeHook(hookName, context) {
    const results = [];

    for (const [id, plugin] of this.plugins) {
      if (!plugin.enabled) continue;

      const hook = plugin.hooks?.[hookName];
      if (typeof hook === 'function') {
        try {
          const result = await hook(context);
          results.push({ pluginId: id, result });
        } catch (error) {
          console.error(`Error executing hook ${hookName} in plugin ${id}:`, error);
          results.push({ pluginId: id, error });
        }
      }
    }

    return results;
  }

  /**
   * Load plugins from a directory
   */
  async loadFromDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() || entry.name.endsWith('.js')) {
          const pluginPath = path.join(dirPath, entry.name);
          try {
            const pluginModule = await import(pluginPath);
            const plugin = pluginModule.default || pluginModule;
            this.register(plugin);
          } catch (err) {
            console.warn(`Failed to load plugin from ${pluginPath}:`, err.message);
          }
        }
      }
    } catch {
      // Directory might not exist, ignore
    }
  }
}

export const pluginRegistry = new PluginRegistry();
