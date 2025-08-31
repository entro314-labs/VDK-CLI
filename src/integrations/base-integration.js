/**
 * Base Integration Module
 * ---------------------
 * Abstract base class for all VDK integrations (IDEs, AI tools, platforms)
 * Provides common interface and functionality for integration detection,
 * configuration, and management.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Base class for all VDK integrations
 * All integration modules should extend this class
 */
export class BaseIntegration {
  constructor(name, projectPath = process.cwd()) {
    this.name = name
    this.projectPath = projectPath
    this.configPath = null
    this.globalConfigPath = null

    // Detection result cache
    this._detectionCache = null
    this._detectionCacheTime = null
    this._cacheValidityMs = 30000 // 30 seconds
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Detect if this integration is being used in the project
   * @returns {Object} Detection result with isUsed, confidence, indicators, recommendations
   */
  detectUsage() {
    throw new Error(`detectUsage() must be implemented by ${this.name} integration`)
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Get integration-specific configuration paths
   * @returns {Object} Configuration paths relevant to this integration
   */
  getConfigPaths() {
    throw new Error(`getConfigPaths() must be implemented by ${this.name} integration`)
  }

  /**
   * Abstract method - must be implemented by subclasses
   * Initialize integration configuration for VDK
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(_options = {}) {
    throw new Error(`initialize() must be implemented by ${this.name} integration`)
  }

  /**
   * Get cached detection result or run fresh detection
   * @param {boolean} force - Force fresh detection ignoring cache
   * @returns {Object} Detection result
   */
  getCachedDetection(force = false) {
    const now = Date.now()
    const cacheExpired = !this._detectionCacheTime || now - this._detectionCacheTime > this._cacheValidityMs

    if (force || !this._detectionCache || cacheExpired) {
      this._detectionCache = this.detectUsage()
      this._detectionCacheTime = now
    }

    return this._detectionCache
  }

  /**
   * Check if integration is currently being used
   * @returns {boolean} True if integration is active
   */
  isActive() {
    const detection = this.getCachedDetection()
    return detection.isUsed && detection.confidence !== 'none'
  }

  /**
   * Get confidence level of integration detection
   * @returns {string} Confidence level: none, low, medium, high
   */
  getConfidence() {
    const detection = this.getCachedDetection()
    return detection.confidence
  }

  /**
   * Get recommendations for this integration
   * @returns {Array<string>} List of recommendations
   */
  getRecommendations() {
    const detection = this.getCachedDetection()
    return detection.recommendations || []
  }

  /**
   * Get detection indicators for this integration
   * @returns {Array<string>} List of indicators found
   */
  getIndicators() {
    const detection = this.getCachedDetection()
    return detection.indicators || []
  }

  /**
   * Common helper: Check if directory exists (synchronous)
   * @param {string} dirPath - Directory path to check
   * @returns {boolean} True if directory exists
   */
  directoryExists(dirPath) {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Common helper: Check if directory exists (asynchronous)
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<boolean>} True if directory exists
   */
  async directoryExistsAsync(dirPath) {
    try {
      const stats = await fs.promises.stat(dirPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Common helper: Check if file exists (synchronous)
   * @param {string} filePath - File path to check
   * @returns {boolean} True if file exists
   */
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    } catch {
      return false
    }
  }

  /**
   * Common helper: Check if file exists (asynchronous)
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExistsAsync(filePath) {
    try {
      const stats = await fs.promises.stat(filePath)
      return stats.isFile()
    } catch {
      return false
    }
  }

  /**
   * Common helper: Check if command is available in PATH
   * @param {string} command - Command to check
   * @returns {boolean} True if command is available
   */
  commandExists(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' })
      return true
    } catch {
      return false
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
      })
      return output.trim()
    } catch {
      return null
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
      return []
    }

    try {
      const files = fs.readdirSync(dirPath)
      const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000

      return files.filter((file) => {
        const filePath = path.join(dirPath, file)
        try {
          const stats = fs.statSync(filePath)
          return stats.mtime.getTime() > cutoffTime
        } catch {
          return false
        }
      })
    } catch {
      return []
    }
  }

  /**
   * Common detection helper: Create detection result structure
   * @param {Object} options - Detection options
   * @returns {Object} Standard detection result structure
   */
  createDetectionResult(options = {}) {
    return {
      isUsed: options.isUsed,
      confidence: options.confidence || 'none', // none, low, medium, high
      indicators: options.indicators || [],
      recommendations: options.recommendations || [],
    }
  }

  /**
   * Common detection helper: Check multiple paths and add indicators
   * @param {Object} detection - Detection result object to modify
   * @param {Object} pathsToCheck - Object with description: path pairs
   * @param {string} confidenceLevel - Confidence to set when paths are found
   * @returns {Object} Updated detection result
   */
  checkPaths(detection, pathsToCheck, confidenceLevel = 'medium') {
    let foundAny = false

    for (const [description, checkPath] of Object.entries(pathsToCheck)) {
      if (this.fileExists(checkPath) || this.directoryExists(checkPath)) {
        detection.indicators.push(description)
        foundAny = true
      }
    }

    if (foundAny) {
      detection.isUsed = true
      detection.confidence = confidenceLevel
    }

    return detection
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
    const recentFiles = this.getRecentActivity(dirPath, daysBack)
    if (recentFiles.length > 0) {
      detection.indicators.push(`${activityDescription} (${recentFiles.length} recent files)`)
      if (detection.confidence === 'none') {
        detection.confidence = 'low'
      }
      if (!detection.isUsed) {
        detection.isUsed = true
      }
    }
    return detection
  }

  /**
   * Common detection helper: Add standard recommendations based on confidence level
   * @param {Object} detection - Detection result object to modify
   * @param {string} integrationName - Name of the integration for URLs/commands
   * @param {string} installUrl - URL for installation instructions
   * @returns {Object} Updated detection result
   */
  addStandardRecommendations(detection, integrationName, installUrl = null) {
    const name = integrationName || this.name

    switch (detection.confidence) {
      case 'none':
        if (installUrl) {
          detection.recommendations.push(`${name} not detected. Install from: ${installUrl}`)
        } else {
          detection.recommendations.push(`${name} not detected. Consider installing for better AI assistance`)
        }
        break
      case 'low':
        detection.recommendations.push(`${name} may be installed but not configured for this project`)
        detection.recommendations.push('Run: vdk init --ide-integration to configure integration')
        break
      case 'medium':
        detection.recommendations.push(`${name} appears to be configured`)
        detection.recommendations.push('Consider optimizing .vdk/rules for better AI assistance')
        break
      case 'high':
        detection.recommendations.push(`${name} is actively configured and being used`)
        detection.recommendations.push('Consider creating custom AI rules for your specific project patterns')
        break
    }

    return detection
  }

  /**
   * Common helper: Ensure directory exists, create if not
   * @param {string} dirPath - Directory path to ensure
   * @returns {boolean} True if directory exists or was created
   */
  async ensureDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        await fs.promises.mkdir(dirPath, { recursive: true })
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Common helper: Read JSON file safely
   * @param {string} filePath - Path to JSON file
   * @returns {Object|null} Parsed JSON or null if failed
   */
  readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
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
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  }

  /**
   * Get standard platform-specific paths
   * @returns {Object} Object containing common platform paths
   */
  getPlatformPaths() {
    const home = os.homedir()
    const platform = os.platform()

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
    }
  }

  /**
   * Common helper: Check gitignore for patterns
   * @param {Array<string>} patterns - Patterns to check for
   * @returns {Array<string>} Found patterns in gitignore
   */
  checkGitignore(patterns) {
    const gitignorePath = path.join(this.projectPath, '.gitignore')
    if (!this.fileExists(gitignorePath)) {
      return []
    }

    try {
      const content = fs.readFileSync(gitignorePath, 'utf8')
      return patterns.filter((pattern) => content.includes(pattern))
    } catch {
      return []
    }
  }

  /**
   * Common helper: Ensure gitignore entry exists
   * @param {string} entry - Entry to add to .gitignore
   * @returns {Promise<boolean>} True if successful
   */
  async ensureGitignoreEntry(entry) {
    const gitignorePath = path.join(this.projectPath, '.gitignore')

    try {
      let content = ''
      if (this.fileExists(gitignorePath)) {
        content = await fs.promises.readFile(gitignorePath, 'utf8')
      }

      // Check if entry already exists
      if (content.includes(entry)) {
        return true
      }

      // Add entry with proper spacing
      const newContent = `${content + (content && !content.endsWith('\n') ? '\n' : '') + entry}\n`
      await fs.promises.writeFile(gitignorePath, newContent, 'utf8')
      return true
    } catch {
      return false
    }
  }

  /**
   * Get integration summary for reporting
   * @returns {Object} Summary of integration status
   */
  getSummary() {
    const _detection = this.getCachedDetection()
    return {
      name: this.name,
      isActive: this.isActive(),
      confidence: this.getConfidence(),
      indicatorCount: this.getIndicators().length,
      recommendationCount: this.getRecommendations().length,
      lastChecked: this._detectionCacheTime ? new Date(this._detectionCacheTime).toISOString() : null,
    }
  }
}
