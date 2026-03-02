/**
 * CommandContext
 * -----------------------
 * Shared context and utilities for all VDK CLI commands.
 * Provides consistent environment setup and common dependencies.
 *
 * ARCHITECTURE NOTE: This has been refactored to reduce singleton coupling while
 * maintaining backwards compatibility. Uses internal service injection pattern.
 */

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createIntegrationManager } from '../../integrations/index.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Service container for dependency injection
 */
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  register(name, factory, singleton = false) {
    this.services.set(name, { factory, singleton });
  }

  resolve(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }

    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory());
      }
      return this.singletons.get(name);
    }

    return service.factory();
  }

  clear() {
    this.singletons.clear();
  }
}

export class CommandContext {
  constructor(serviceContainer = null) {
    this.initialized = false;
    this.cliDir = null;
    this.packageInfo = null;
    this.integrationManager = null;
    this.services = serviceContainer || new ServiceContainer();

    // Register default services
    this._registerDefaultServices();
  }

  /**
   * Register default services in the container
   * @private
   */
  _registerDefaultServices() {
    // File system service
    this.services.register(
      'fileSystem',
      () => ({
        readFile: fs.readFile,
        writeFile: fs.writeFile,
        access: fs.access,
        mkdir: fs.mkdir,
        readdir: fs.readdir,
      }),
      true
    );

    // Path service
    this.services.register(
      'pathService',
      () => ({
        resolve: path.resolve,
        join: path.join,
        relative: path.relative,
        dirname: path.dirname,
      }),
      true
    );

    // Environment service
    this.services.register(
      'environment',
      () => ({
        loadConfig: configPath => dotenv.config({ path: configPath }),
        cwd: () => process.cwd(),
      }),
      true
    );
  }

  /**
   * Initialize the command context
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const pathService = this.services.resolve('pathService');
      const environment = this.services.resolve('environment');

      // Get CLI directory (VDK CLI root)
      this.cliDir = pathService.resolve(__dirname, '../../..');

      // Load environment variables
      environment.loadConfig(pathService.join(this.cliDir, '.env.local'));
      environment.loadConfig(pathService.join(this.cliDir, '.env'));

      // Load package information
      this.packageInfo = require(pathService.join(this.cliDir, 'package.json'));

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize CommandContext: ${error.message}`);
    }
  }

  /**
   * Get package version
   */
  getVersion() {
    this.ensureInitialized();
    return this.packageInfo.version;
  }

  /**
   * Get CLI directory path
   */
  getCliDirectory() {
    this.ensureInitialized();
    return this.cliDir;
  }

  /**
   * Create integration manager for a project
   */
  async createIntegrationManager(projectPath = process.cwd()) {
    const environment = this.services.resolve('environment');
    const resolvedProjectPath = projectPath || environment.cwd();

    if (!this.integrationManager || this.integrationManager.projectPath !== resolvedProjectPath) {
      this.integrationManager = createIntegrationManager(resolvedProjectPath);
    }
    return this.integrationManager;
  }

  /**
   * Read and parse VDK configuration file
   */
  async readVdkConfig(projectPath = process.cwd(), configPath = 'vdk.config.json') {
    const pathService = this.services.resolve('pathService');
    const fileSystem = this.services.resolve('fileSystem');
    const environment = this.services.resolve('environment');

    const resolvedProjectPath = projectPath || environment.cwd();
    const fullConfigPath = pathService.resolve(resolvedProjectPath, configPath);

    try {
      await fileSystem.access(fullConfigPath);
      const configContent = await fileSystem.readFile(fullConfigPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      // Return null for missing or invalid config files - this is expected behavior
      return null;
    }
  }

  /**
   * Write VDK configuration file
   */
  async writeVdkConfig(config, projectPath = process.cwd(), configPath = 'vdk.config.json') {
    const pathService = this.services.resolve('pathService');
    const fileSystem = this.services.resolve('fileSystem');
    const environment = this.services.resolve('environment');

    const resolvedProjectPath = projectPath || environment.cwd();
    const fullConfigPath = pathService.resolve(resolvedProjectPath, configPath);

    try {
      await fileSystem.writeFile(fullConfigPath, JSON.stringify(config, null, 2));
      return fullConfigPath;
    } catch (error) {
      throw new Error(`Failed to write VDK configuration to ${fullConfigPath}: ${error.message}`);
    }
  }

  /**
   * Ensure rules directory exists
   */
  async ensureRulesDirectory(rulesPath) {
    const pathService = this.services.resolve('pathService');
    const fileSystem = this.services.resolve('fileSystem');

    const resolvedPath = pathService.resolve(rulesPath);
    try {
      await fileSystem.mkdir(resolvedPath, { recursive: true });
      return resolvedPath;
    } catch (error) {
      throw new Error(`Failed to create rules directory ${resolvedPath}: ${error.message}`);
    }
  }

  /**
   * List files in directory with filtering
   */
  async listFiles(directoryPath, filter = null) {
    const fileSystem = this.services.resolve('fileSystem');

    try {
      const files = await fileSystem.readdir(directoryPath, { recursive: true });
      return filter ? files.filter(filter) : files;
    } catch (error) {
      // Return empty array for missing directories - this is expected behavior
      return [];
    }
  }

  /**
   * Check if path exists
   */
  async pathExists(filePath) {
    const fileSystem = this.services.resolve('fileSystem');

    try {
      await fileSystem.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve path relative to current working directory
   */
  resolvePath(relativePath) {
    const pathService = this.services.resolve('pathService');
    return pathService.resolve(relativePath);
  }

  /**
   * Get relative path for display purposes
   */
  getRelativePath(absolutePath, basePath = process.cwd()) {
    const pathService = this.services.resolve('pathService');
    const environment = this.services.resolve('environment');

    const resolvedBasePath = basePath || environment.cwd();
    return pathService.relative(resolvedBasePath, absolutePath);
  }

  /**
   * Ensure context is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('CommandContext must be initialized before use');
    }
  }

  /**
   * Clean up resources and clear caches
   * Useful for testing and preventing memory leaks
   */
  cleanup() {
    this.services.clear();
    this.integrationManager = null;
    this.initialized = false;
  }

  /**
   * Create a new context instance with custom services (for testing)
   * @param {ServiceContainer} serviceContainer - Custom service container
   * @returns {CommandContext} New context instance
   */
  static createWithServices(serviceContainer) {
    return new CommandContext(serviceContainer);
  }

  /**
   * Get the service container (for advanced usage)
   * @returns {ServiceContainer} Service container instance
   */
  getServiceContainer() {
    return this.services;
  }

  /**
   * Register a custom service in the container
   * @param {string} name - Service name
   * @param {Function} factory - Service factory function
   * @param {boolean} singleton - Whether service should be singleton
   */
  registerService(name, factory, singleton = false) {
    this.services.register(name, factory, singleton);
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean} True if service is registered
   */
  hasService(name) {
    return this.services.services.has(name);
  }
}

// Export singleton instance for backwards compatibility
// New code should consider using dependency injection instead
export const commandContext = new CommandContext();

// Export ServiceContainer for advanced usage
export { ServiceContainer };
