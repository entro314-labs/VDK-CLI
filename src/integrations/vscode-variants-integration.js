/**
 * VS Code Variants Integration
 * ----------------------------
 * Detects and manages integration with VS Code, VS Code Insiders, and VSCodium
 * Handles extensions, settings, and MCP configuration for each variant.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BaseIntegration } from './base-integration.js';

/**
 * Base class for VS Code variant integrations
 */
class VSCodeVariantIntegration extends BaseIntegration {
  constructor(name, variant, projectPath = process.cwd()) {
    super(name, projectPath);
    this.variant = variant;
    this.configFolder = this.getConfigFolder();
  }

  /**
   * Get configuration folder for this variant
   */
  getConfigFolder() {
    switch (this.variant) {
      case 'vscode':
        return '.vscode';
      case 'vscode-insiders':
        return '.vscode-insiders';
      case 'vscodium':
        return '.vscode-oss';
      default:
        return '.vscode';
    }
  }

  /**
   * Get global configuration path for this variant
   */
  getGlobalConfigPath() {
    const homeDir = os.homedir();

    switch (process.platform) {
      case 'darwin': // macOS
        switch (this.variant) {
          case 'vscode':
            return path.join(
              homeDir,
              'Library',
              'Application Support',
              'Code',
              'User',
              'settings.json'
            );
          case 'vscode-insiders':
            return path.join(
              homeDir,
              'Library',
              'Application Support',
              'Code - Insiders',
              'User',
              'settings.json'
            );
          case 'vscodium':
            return path.join(
              homeDir,
              'Library',
              'Application Support',
              'VSCodium',
              'User',
              'settings.json'
            );
        }
        break;
      case 'linux':
        switch (this.variant) {
          case 'vscode':
            return path.join(homeDir, '.config', 'Code', 'User', 'settings.json');
          case 'vscode-insiders':
            return path.join(homeDir, '.config', 'Code - Insiders', 'User', 'settings.json');
          case 'vscodium':
            return path.join(homeDir, '.config', 'VSCodium', 'User', 'settings.json');
        }
        break;
      case 'win32': {
        // Windows
        const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
        switch (this.variant) {
          case 'vscode':
            return path.join(appData, 'Code', 'User', 'settings.json');
          case 'vscode-insiders':
            return path.join(appData, 'Code - Insiders', 'User', 'settings.json');
          case 'vscodium':
            return path.join(appData, 'VSCodium', 'User', 'settings.json');
        }
        break;
      }
    }

    // Fallback
    return path.join(homeDir, '.config', 'Code', 'User', 'settings.json');
  }

  /**
   * Detect VS Code variant usage
   */
  detectUsage() {
    const detection = this.createDetectionResult();

    // Check for project configuration folder (project-specific)
    const configPath = path.join(this.projectPath, this.configFolder);
    const projectPaths = {
      [`Found ${this.configFolder} configuration folder`]: configPath,
    };

    // Add common VS Code files to project-specific check
    const configFiles = ['settings.json', 'launch.json', 'tasks.json', 'extensions.json'];
    for (const file of configFiles) {
      const filePath = path.join(configPath, file);
      projectPaths[`Found ${this.configFolder}/${file}`] = filePath;
    }

    // Add MCP configuration
    const mcpPath = path.join(configPath, 'mcp.json');
    projectPaths['MCP configuration found'] = mcpPath;

    this.checkPaths(detection, projectPaths, 'high', true); // isProjectSpecific = true

    // Check for global configuration
    const globalConfig = this.getGlobalConfigPath();
    this.checkPaths(
      detection,
      {
        'Global configuration detected': globalConfig,
      },
      'medium'
    ); // Global = not project-specific

    // Check for running process
    try {
      const isRunning = this.isProcessRunning();
      if (isRunning) {
        detection.indicators.push(`${this.name} process is running`);
        if (detection.confidence === 'none') {
          detection.confidence = 'medium';
        }
      }
    } catch (_error) {
      // Process detection failed - not critical
    }

    // Add recommendations
    if (detection.confidence !== 'none') {
      detection.recommendations.push(
        `Use ${this.configFolder}/ai-rules/ folder for VDK Blueprint rules`
      );
      detection.recommendations.push('Install AI-related extensions for  coding assistance');

      if (!fs.existsSync(path.join(this.projectPath, this.configFolder, 'ai-rules'))) {
        detection.recommendations.push(
          `Create ${this.configFolder}/ai-rules/ directory for AI integration`
        );
      }
    }

    // Add MCP recommendation if not configured
    if (detection.isUsed && !detection.indicators.some(i => i.includes('MCP configuration'))) {
      detection.recommendations.push('Consider setting up MCP configuration for AI integration');
    }

    return detection;
  }

  /**
   * Check if the VS Code variant process is running
   */
  isProcessRunning() {
    try {
      const { execSync } = require('node:child_process');
      const processes = execSync('ps aux', { encoding: 'utf8' });

      const processNames = {
        vscode: ['code', 'Code'],
        'vscode-insiders': ['code-insiders', 'Code - Insiders'],
        vscodium: ['codium', 'VSCodium'],
      };

      const names = processNames[this.variant] || ['code'];
      return names.some(name => processes.includes(name));
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get configuration paths
   */
  getConfigPaths() {
    const configPath = path.join(this.projectPath, this.configFolder);

    return {
      projectConfig: configPath,
      rulesPath: path.join(configPath, 'ai-rules'),
      settingsFile: path.join(configPath, 'settings.json'),
      extensionsFile: path.join(configPath, 'extensions.json'),
      mcpConfig: path.join(configPath, 'mcp.json'),
      globalConfig: this.getGlobalConfigPath(),
    };
  }

  /**
   * Initialize VS Code variant integration
   */
  async initialize(options = {}) {
    const { verbose = false } = options;

    try {
      const configPaths = this.getConfigPaths();

      // Create project config directory if it doesn't exist
      if (!fs.existsSync(configPaths.projectConfig)) {
        fs.mkdirSync(configPaths.projectConfig, { recursive: true });
        if (verbose) {
          console.log(`Created config directory: ${configPaths.projectConfig}`);
        }
      }

      // Create ai-rules directory if it doesn't exist
      if (!fs.existsSync(configPaths.rulesPath)) {
        fs.mkdirSync(configPaths.rulesPath, { recursive: true });
        if (verbose) {
          console.log(`Created rules directory: ${configPaths.rulesPath}`);
        }
      }

      return true;
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize ${this.name} integration: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Get integration summary
   */
  getSummary() {
    const detection = this.getCachedDetection();
    const configPaths = this.getConfigPaths();

    return {
      name: this.name,
      variant: this.variant,
      isActive: detection.isUsed,
      confidence: detection.confidence,
      configPath: configPaths.projectConfig,
      rulesPath: configPaths.rulesPath,
      mcpSupported: true,
      extensionSystem: true,
    };
  }
}

/**
 * VS Code Integration
 */
export class VSCodeIntegration extends VSCodeVariantIntegration {
  constructor(projectPath = process.cwd()) {
    super('VS Code', 'vscode', projectPath);
  }
}

/**
 * VS Code Insiders Integration
 */
export class VSCodeInsidersIntegration extends VSCodeVariantIntegration {
  constructor(projectPath = process.cwd()) {
    super('VS Code Insiders', 'vscode-insiders', projectPath);
  }
}

/**
 * VSCodium Integration
 */
export class VSCodiumIntegration extends VSCodeVariantIntegration {
  constructor(projectPath = process.cwd()) {
    super('VSCodium', 'vscodium', projectPath);
  }
}

export { VSCodeInsidersIntegration as default };
