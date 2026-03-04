/**
 * Base Integration Module
 * ---------------------
 * Abstract base class for all VDK integrations (IDEs, AI tools, platforms)
 * Provides common interface and functionality for integration detection,
 * configuration, and management.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Base class for all VDK integrations
 * All integration modules should extend this class
 */
export class BaseIntegration {
  constructor(name, projectPath = process.cwd()) {
    this.name = name;
    this.projectPath = projectPath;
    this.priority = 'medium';
    this.configPath = null;
    this.globalConfigPath = null;

    // Detection result cache
    this._detectionCache = null;
    this._detectionCacheTime = null;
    this._cacheValidityMs = 30000; // 30 seconds
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Detect if this integration is being used in the project
   * @returns {Object} Detection result with isUsed, confidence, indicators, recommendations
   */
  detectUsage() {
    throw new Error(`detectUsage() must be implemented by ${this.name} integration`);
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Get integration-specific configuration paths
   * @returns {Object} Configuration paths relevant to this integration
   */
  getConfigPaths() {
    throw new Error(`getConfigPaths() must be implemented by ${this.name} integration`);
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Initialize integration configuration for VDK
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(_options = {}) {
    throw new Error(`initialize() must be implemented by ${this.name} integration`);
  }

  /**
   * Get cached detection result or run fresh detection
   * @param {boolean} force - Force fresh detection ignoring cache
   * @returns {Object} Detection result
   */
  getCachedDetection(force = false) {
    const now = Date.now();
    const cacheExpired =
      !this._detectionCacheTime || now - this._detectionCacheTime > this._cacheValidityMs;

    if (force || !this._detectionCache || cacheExpired) {
      this._detectionCache = this.detectUsage();
      this._detectionCacheTime = now;
    }

    return this._detectionCache;
  }

  /**
   * Check if integration is currently being used
   * @returns {boolean} True if integration is active
   */
  isActive() {
    const detection = this.getCachedDetection();
    return detection.isUsed && detection.confidence !== 'none';
  }

  /**
   * Get confidence level of integration detection
   * @returns {string} Confidence level: none, low, medium, high
   */
  getConfidence() {
    const detection = this.getCachedDetection();
    return detection.confidence;
  }

  /**
   * Get recommendations for this integration
   * @returns {Array<string>} List of recommendations
   */
  getRecommendations() {
    const detection = this.getCachedDetection();
    return detection.recommendations || [];
  }

  /**
   * Get detection indicators for this integration
   * @returns {Array<string>} List of indicators found
   */
  getIndicators() {
    const detection = this.getCachedDetection();
    return detection.indicators || [];
  }

  /**
   * Common helper: Check if directory exists (synchronous)
   * @param {string} dirPath - Directory path to check
   * @returns {boolean} True if directory exists
   */
  directoryExists(dirPath) {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Common helper: Check if directory exists (asynchronous)
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<boolean>} True if directory exists
   */
  async directoryExistsAsync(dirPath) {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Common helper: Check if file exists (synchronous)
   * @param {string} filePath - File path to check
   * @returns {boolean} True if file exists
   */
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Common helper: Check if file exists (asynchronous)
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExistsAsync(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Common helper: Check if command is available in PATH
   * @param {string} command - Command to check
   * @returns {boolean} True if command is available
   */
  commandExists(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Common helper: Get command version
   * @param {string} command - Command to get version for
   * @param {string} versionFlag - Flag to get version (default: --version)
   * @returns {string|null} Version string or null if failed
   */
  getCommandVersion(command, versionFlag = '--version') {
    try {
      const output = execSync(`${command} ${versionFlag}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return output.trim();
    } catch {
      return null;
    }
  }

  /**
   * Common helper: Check for recent file activity
   * @param {string} dirPath - Directory to check
   * @param {number} daysBack - How many days back to check (default: 7)
   * @returns {Array<string>} List of recently modified files
   */
  getRecentActivity(dirPath, daysBack = 7) {
    if (!this.directoryExists(dirPath)) {
      return [];
    }

    try {
      const files = fs.readdirSync(dirPath);
      const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

      return files.filter(file => {
        const filePath = path.join(dirPath, file);
        try {
          const stats = fs.statSync(filePath);
          return stats.mtime.getTime() > cutoffTime;
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }

  /**
   * Common detection helper: Create detection result structure
   * @param {Object} options - Detection options
   * @returns {Object} Standard detection result structure
   */
  createDetectionResult(options = {}) {
    return {
      isUsed: options.isUsed ?? false,
      confidence: options.confidence || 'none', // none, low, medium, high
      indicators: options.indicators || [],
      recommendations: options.recommendations || [],
      hasProjectSpecificConfig: options.hasProjectSpecificConfig ?? false, // true if based on project files
    };
  }

  /**
   * Common detection helper: Check multiple paths and add indicators
   * @param {Object} detection - Detection result object to modify
   * @param {Object} pathsToCheck - Object with description: path pairs
   * @param {string} confidenceLevel - Confidence to set when paths are found
   * @returns {Object} Updated detection result
   */
  checkPaths(detection, pathsToCheck, confidenceLevel = 'medium', isProjectSpecific = false) {
    let foundAny = false;

    for (const [description, checkPath] of Object.entries(pathsToCheck)) {
      if (this.fileExists(checkPath) || this.directoryExists(checkPath)) {
        detection.indicators.push(description);
        foundAny = true;
      }
    }

    if (foundAny) {
      detection.isUsed = true;

      // Track if project-specific config was found
      if (isProjectSpecific) {
        detection.hasProjectSpecificConfig = true;
      }

      // Only update confidence if it's higher than current confidence
      const confidenceOrder = { none: 0, low: 1, medium: 2, high: 3 };
      const currentConfidence = confidenceOrder[detection.confidence] || 0;
      const newConfidence = confidenceOrder[confidenceLevel] || 0;

      if (newConfidence > currentConfidence) {
        detection.confidence = confidenceLevel;
      }
    }

    return detection;
  }

  /**
   * Common detection helper: Check for recent activity and add indicators
   * @param {Object} detection - Detection result object to modify
   * @param {string} dirPath - Directory to check for activity
   * @param {string} activityDescription - Description of the activity type
   * @param {number} daysBack - Days to check back (default: 7)
   * @returns {Object} Updated detection result
   */
  checkRecentActivity(detection, dirPath, activityDescription, daysBack = 7) {
    const recentFiles = this.getRecentActivity(dirPath, daysBack);
    if (recentFiles.length > 0) {
      detection.indicators.push(`${activityDescription} (${recentFiles.length} recent files)`);
      if (detection.confidence === 'none') {
        detection.confidence = 'low';
      }
      if (!detection.isUsed) {
        detection.isUsed = true;
      }
    }
    return detection;
  }

  /**
   * Common detection helper: Add standard recommendations based on confidence level
   * @param {Object} detection - Detection result object to modify
   * @param {string} integrationName - Name of the integration for URLs/commands
   * @param {string} installUrl - URL for installation instructions
   * @returns {Object} Updated detection result
   */
  addStandardRecommendations(detection, integrationName, installUrl = null) {
    const name = integrationName || this.name;

    switch (detection.confidence) {
      case 'none':
        if (installUrl) {
          detection.recommendations.push(`${name} not detected. Install from: ${installUrl}`);
        } else {
          detection.recommendations.push(
            `${name} not detected. Consider installing for better AI assistance`
          );
        }
        break;
      case 'low':
        detection.recommendations.push(
          `${name} may be installed but not configured for this project`
        );
        detection.recommendations.push('Run: vdk init --ide-integration to configure integration');
        break;
      case 'medium':
        detection.recommendations.push(`${name} appears to be configured`);
        detection.recommendations.push(
          'Consider optimizing .vdk/blueprints/rules for better AI assistance'
        );
        break;
      case 'high':
        detection.recommendations.push(`${name} is actively configured and being used`);
        detection.recommendations.push(
          'Consider creating custom AI rules for your specific project patterns'
        );
        break;
    }

    return detection;
  }

  /**
   * Common helper: Ensure directory exists, create if not
   * @param {string} dirPath - Directory path to ensure
   * @returns {boolean} True if directory exists or was created
   */
  async ensureDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        await fs.promises.mkdir(dirPath, { recursive: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Common helper: Read JSON file safely
   * @param {string} filePath - Path to JSON file
   * @returns {Object|null} Parsed JSON or null if failed
   */
  readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Common helper: Write JSON file safely
   * @param {string} filePath - Path to write JSON file
   * @param {Object} data - Data to write
   * @returns {boolean} True if successful
   */
  async writeJsonFile(filePath, data) {
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get standard platform-specific paths
   * @returns {Object} Object containing common platform paths
   */
  getPlatformPaths() {
    const home = os.homedir();
    const platform = os.platform();

    return {
      home,
      platform,
      config:
        platform === 'win32'
          ? path.join(home, 'AppData', 'Roaming')
          : platform === 'darwin'
            ? path.join(home, 'Library', 'Application Support')
            : path.join(home, '.config'),

      logs:
        platform === 'win32'
          ? path.join(home, 'AppData', 'Local', 'Logs')
          : platform === 'darwin'
            ? path.join(home, 'Library', 'Logs')
            : path.join(home, '.local', 'share', 'logs'),

      cache:
        platform === 'win32'
          ? path.join(home, 'AppData', 'Local', 'Cache')
          : platform === 'darwin'
            ? path.join(home, 'Library', 'Caches')
            : path.join(home, '.cache'),
    };
  }

  /**
   * Common helper: Check gitignore for patterns
   * @param {Array<string>} patterns - Patterns to check for
   * @returns {Array<string>} Found patterns in gitignore
   */
  checkGitignore(patterns) {
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    if (!this.fileExists(gitignorePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      return patterns.filter(pattern => content.includes(pattern));
    } catch {
      return [];
    }
  }

  /**
   * Common helper: Ensure gitignore entry exists
   * @param {string} entry - Entry to add to .gitignore
   * @returns {Promise<boolean>} True if successful
   */
  async ensureGitignoreEntry(entry) {
    const gitignorePath = path.join(this.projectPath, '.gitignore');

    try {
      let content = '';
      if (this.fileExists(gitignorePath)) {
        content = await fs.promises.readFile(gitignorePath, 'utf8');
      }

      // Check if entry already exists
      if (content.includes(entry)) {
        return true;
      }

      // Add entry with proper spacing
      const newContent = `${content + (content && !content.endsWith('\n') ? '\n' : '') + entry}\n`;
      await fs.promises.writeFile(gitignorePath, newContent, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get integration summary for reporting
   * @returns {Object} Summary of integration status
   */
  getSummary() {
    const _detection = this.getCachedDetection();
    return {
      name: this.name,
      isActive: this.isActive(),
      confidence: this.getConfidence(),
      indicatorCount: this.getIndicators().length,
      recommendationCount: this.getRecommendations().length,
      lastChecked: this._detectionCacheTime
        ? new Date(this._detectionCacheTime).toISOString()
        : null,
    };
  }

  // ============================================================================
  // V3.0 COMPONENT METHODS
  // ============================================================================

  /**
   * Get all component paths for this platform
   * Must be implemented by subclasses for v3.0 support
   * @returns {Object} Component paths by type
   */
  getComponentPaths() {
    throw new Error(`getComponentPaths() must be implemented by ${this.name} integration`);
  }

  /**
   * Parse all components from the platform configuration
   * @returns {Promise<Object>} Parsed components organized by type
   */
  async parseComponents() {
    const components = {
      main: null,
      agents: [],
      rules: [],
      commands: [],
      skills: [],
      workflows: [],
      settings: null,
      mcpConfig: null,
    };

    try {
      const componentPaths = this.getComponentPaths();

      // Parse main file
      if (componentPaths.main && (await this.fileExistsAsync(componentPaths.main))) {
        components.main = await this.parseMainComponent(componentPaths.main);
      }

      // Parse agents
      if (componentPaths.agents) {
        components.agents = await this.parseAgentComponents(componentPaths.agents);
      }

      // Parse rules
      if (componentPaths.rules) {
        components.rules = await this.parseRuleComponents(componentPaths.rules);
      }

      // Parse commands
      if (componentPaths.commands) {
        components.commands = await this.parseCommandComponents(componentPaths.commands);
      }

      // Parse skills
      if (componentPaths.skills) {
        components.skills = await this.parseSkillComponents(componentPaths.skills);
      }

      // Parse workflows
      if (componentPaths.workflows) {
        components.workflows = await this.parseWorkflowComponents(componentPaths.workflows);
      }

      // Parse settings
      if (componentPaths.settings && (await this.fileExistsAsync(componentPaths.settings))) {
        components.settings = await this.parseSettingsComponent(componentPaths.settings);
      }

      // Parse MCP config
      if (componentPaths.mcpConfig && (await this.fileExistsAsync(componentPaths.mcpConfig))) {
        components.mcpConfig = await this.parseMCPComponent(componentPaths.mcpConfig);
      }

      return components;
    } catch (error) {
      console.error(`Error parsing components for ${this.name}:`, error);
      return components;
    }
  }

  /**
   * Parse main component file
   * @param {string} filePath - Path to main file
   * @returns {Promise<Object>} Parsed main component
   */
  async parseMainComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return {
        type: 'main',
        name: path.basename(filePath),
        file: filePath,
        content,
        format: this.getFileFormat(filePath),
      };
    } catch (error) {
      console.error(`Error parsing main component ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse agent components from directory
   * @param {string} dirPath - Path to agents directory
   * @returns {Promise<Array>} Array of parsed agent components
   */
  async parseAgentComponents(dirPath) {
    return await this.parseComponentDirectory(dirPath, 'agent', ['.md', '.markdown']);
  }

  /**
   * Parse rule components from directory
   * @param {string} dirPath - Path to rules directory
   * @returns {Promise<Array>} Array of parsed rule components
   */
  async parseRuleComponents(dirPath) {
    return await this.parseComponentDirectory(dirPath, 'rule', ['.md', '.markdown', '.mdc']);
  }

  /**
   * Parse command components from directory
   * @param {string} dirPath - Path to commands directory
   * @returns {Promise<Array>} Array of parsed command components
   */
  async parseCommandComponents(dirPath) {
    return await this.parseComponentDirectory(dirPath, 'command', ['.md', '.markdown']);
  }

  /**
   * Parse skill components from directory
   * @param {string} dirPath - Path to skills directory
   * @returns {Promise<Array>} Array of parsed skill components
   */
  async parseSkillComponents(dirPath) {
    return await this.parseComponentDirectory(dirPath, 'skill', ['.md', '.markdown']);
  }

  /**
   * Parse workflow components from directory
   * @param {string} dirPath - Path to workflows directory
   * @returns {Promise<Array>} Array of parsed workflow components
   */
  async parseWorkflowComponents(dirPath) {
    return await this.parseComponentDirectory(dirPath, 'workflow', ['.yaml', '.yml', '.md']);
  }

  /**
   * Parse settings component
   * @param {string} filePath - Path to settings file
   * @returns {Promise<Object>} Parsed settings component
   */
  async parseSettingsComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const format = this.getFileFormat(filePath);

      let parsed = content;
      if (format === 'json') {
        parsed = JSON.parse(content);
      }

      return {
        type: 'settings',
        name: path.basename(filePath),
        file: filePath,
        content: parsed,
        format,
      };
    } catch (error) {
      console.error(`Error parsing settings component ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse MCP configuration component
   * @param {string} filePath - Path to MCP config file
   * @returns {Promise<Object>} Parsed MCP component
   */
  async parseMCPComponent(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);

      return {
        type: 'mcp-config',
        name: path.basename(filePath),
        file: filePath,
        content: parsed,
        format: 'json',
      };
    } catch (error) {
      console.error(`Error parsing MCP component ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Generic component directory parser
   * @param {string} dirPath - Directory path
   * @param {string} componentType - Type of component
   * @param {Array<string>} extensions - Valid file extensions
   * @returns {Promise<Array>} Array of parsed components
   */
  async parseComponentDirectory(dirPath, componentType, extensions = ['.md']) {
    const components = [];

    try {
      if (!(await this.directoryExistsAsync(dirPath))) {
        return components;
      }

      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!extensions.includes(ext)) continue;

        const filePath = path.join(dirPath, file);
        const stat = await fs.promises.stat(filePath);

        if (!stat.isFile()) continue;

        const content = await fs.promises.readFile(filePath, 'utf8');
        const component = {
          type: componentType,
          name: path.basename(file, ext),
          file: filePath,
          content,
          format: this.getFileFormat(filePath),
        };

        // Extract frontmatter if present
        const frontmatter = this.extractFrontmatter(content);
        if (frontmatter) {
          component.frontmatter = frontmatter;
        }

        components.push(component);
      }
    } catch (error) {
      console.error(`Error parsing ${componentType} directory ${dirPath}:`, error);
    }

    return components;
  }

  /**
   * Extract YAML frontmatter from markdown content
   * @param {string} content - Markdown content
   * @returns {Object|null} Parsed frontmatter or null
   */
  extractFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);

    if (!match) return null;

    try {
      const frontmatterText = match[1];
      const frontmatter = {};
      const lines = frontmatterText.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        // Simple parsing - handle strings, numbers, booleans, arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim().replace(/['"]/g, ''));
        } else if (value === 'true') {
          frontmatter[key] = true;
        } else if (value === 'false') {
          frontmatter[key] = false;
        } else if (/^\d+$/.test(value)) {
          frontmatter[key] = parseInt(value, 10);
        } else {
          frontmatter[key] = value.replace(/^["']|["']$/g, '');
        }
      }

      return frontmatter;
    } catch (error) {
      console.error('Error parsing frontmatter:', error);
      return null;
    }
  }

  /**
   * Get file format from extension
   * @param {string} filePath - File path
   * @returns {string} Format identifier
   */
  getFileFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.md':
      case '.markdown':
        return 'markdown';
      case '.mdc':
        return 'mdc';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.json':
        return 'json';
      case '.toml':
        return 'toml';
      default:
        return 'text';
    }
  }

  /**
   * Generate components for this platform
   * @param {Object} components - Components to generate
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateComponents(_components, _options = {}) {
    throw new Error(`generateComponents() must be implemented by ${this.name} integration`);
  }

  /**
   * Validate component structure
   * @param {Object} component - Component to validate
   * @returns {Object} Validation result
   */
  validateComponent(component) {
    const errors = [];
    const warnings = [];

    if (!component.type) {
      errors.push('Component missing type');
    }

    if (!component.name) {
      errors.push('Component missing name');
    }

    if (!component.content) {
      warnings.push('Component has no content');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get platform constraints for validation
   * @returns {Object} Platform constraints
   */
  getPlatformConstraints() {
    return {
      maxCharacters: null,
      maxFiles: null,
      maxDepth: null,
      supportsFileReferences: true,
      supportsYAMLFrontmatter: true,
      supportsAgents: false,
      supportsRules: false,
      supportsCommands: false,
      supportsSkills: false,
      supportsWorkflows: false,
      supportsMCP: false,
      globPatternSyntax: 'minimatch',
    };
  }
}
