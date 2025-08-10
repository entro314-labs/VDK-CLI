/**
 * Generic IDE Integration Module
 * ---------------------------
 * Provides integration with multiple IDEs through unified detection and configuration.
 * Handles VS Code, Cursor, Windsurf, JetBrains, and other editors.
 */

import fs from 'node:fs'
import path from 'node:path'

import { detectIDEs, ensureRuleDirectory, IDE_CONFIGURATIONS } from '../shared/ide-configuration.js'
import { BaseIntegration } from './base-integration.js'

/**
 * Generic IDE integration that detects and manages multiple IDEs
 */
export class GenericIDEIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Generic IDE', projectPath)
    this.detectedIDEs = []
    this.ideConfigurations = IDE_CONFIGURATIONS
  }

  /**
   * Detect IDE usage in the project using modernized detection
   * @returns {Promise<Object>} Detection result with details
   */
  async detectUsage() {
    const detection = {
      isUsed: false,
      confidence: 'none',
      indicators: [],
      recommendations: [],
      detectedIDEs: [],
    }

    try {
      // Use the modernized detectIDEs function
      const detectedIDEConfigs = await detectIDEs(this.projectPath)

      for (const ideConfig of detectedIDEConfigs) {
        const ideDetection = await this.detectSpecificIDE(ideConfig)
        if (ideDetection.isUsed) {
          detection.detectedIDEs.push(ideDetection)
          detection.isUsed = true
          detection.indicators.push(...ideDetection.indicators)

          // Upgrade confidence based on strongest detection
          if (ideDetection.confidence === 'high' && detection.confidence !== 'high') {
            detection.confidence = 'high'
          } else if (ideDetection.confidence === 'medium' && detection.confidence === 'none') {
            detection.confidence = 'medium'
          } else if (ideDetection.confidence === 'low' && detection.confidence === 'none') {
            detection.confidence = 'low'
          }
        }
      }
    } catch (error) {
      console.warn(`IDE detection error: ${error.message}`)
    }

    // Generate recommendations
    if (detection.detectedIDEs.length === 0) {
      detection.recommendations.push(
        'No IDE configurations detected. VDK works with VS Code, Cursor, Windsurf, and other editors'
      )
      detection.recommendations.push('Run: vdk init to set up rules for your preferred IDE')
    } else if (detection.confidence === 'low') {
      detection.recommendations.push('IDE configurations detected but not fully configured')
      detection.recommendations.push('Run: vdk init --ide-integration to set up IDE rules')
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('IDE configurations found - consider optimizing rule setup')
      detection.recommendations.push('Review generated rules in your IDE for optimal AI assistance')
    } else {
      detection.recommendations.push('IDE integrations are well configured')
      detection.recommendations.push('Consider updating rules periodically as your project evolves')
    }

    return detection
  }

  /**
   * Detect usage of a specific IDE using modern async methods
   * @param {Object} ide - IDE configuration object
   * @returns {Promise<Object>} Detection result for this IDE
   */
  async detectSpecificIDE(ide) {
    const detection = {
      id: ide.id,
      name: ide.name,
      isUsed: false,
      confidence: 'none',
      indicators: [],
      configPath: null,
      rulesPath: null,
    }

    // Check for config folder
    const configPath = path.join(this.projectPath, ide.configFolder)
    if (await this.directoryExistsAsync(configPath)) {
      detection.indicators.push(`${ide.name} config directory found`)
      detection.configPath = configPath
      detection.isUsed = true
      detection.confidence = 'medium'
    }

    // Check for specific config files
    if (ide.configFiles) {
      for (const configFile of ide.configFiles) {
        const fullPath = configFile.startsWith('~')
          ? this.expandPath(configFile)
          : path.join(this.projectPath, configFile)

        if (await this.fileExistsAsync(fullPath)) {
          detection.indicators.push(`${ide.name} config file: ${configFile}`)
          detection.isUsed = true
          if (detection.confidence === 'none') {
            detection.confidence = 'low'
          }
        }
      }
    }

    // Check for rules directory
    const rulesPath = path.join(this.projectPath, ide.rulesFolder)
    if (await this.directoryExistsAsync(rulesPath)) {
      detection.indicators.push(`${ide.name} rules directory found`)
      detection.rulesPath = rulesPath
      detection.confidence = 'high'

      // Check if rules directory has content
      try {
        const ruleFiles = await fs.promises.readdir(rulesPath)
        const mdFiles = ruleFiles.filter((f) => f.endsWith('.md'))
        if (mdFiles.length > 0) {
          detection.indicators.push(`${ide.name} has ${mdFiles.length} rule files`)
        }
      } catch {
        // Ignore read errors
      }
    }

    // Check for IDE-specific ignore files
    if (ide.ignoreFile) {
      const ignorePath = path.join(this.projectPath, ide.ignoreFile)
      if (await this.fileExistsAsync(ignorePath)) {
        detection.indicators.push(`${ide.name} ignore file found`)
        if (detection.confidence === 'none') {
          detection.confidence = 'low'
        }
      }
    }

    return detection
  }

  /**
   * Get configuration paths for detected IDEs
   * @returns {Object} Configuration paths grouped by IDE
   */
  getConfigPaths() {
    const paths = {}
    const detectionResult = this.getCachedDetection()

    if (detectionResult.detectedIDEs) {
      for (const ideDetection of detectionResult.detectedIDEs) {
        const ide = this.ideConfigurations.find((i) => i.id === ideDetection.id)
        if (ide) {
          paths[ide.id] = {
            name: ide.name,
            configFolder: path.join(this.projectPath, ide.configFolder),
            rulesFolder: path.join(this.projectPath, ide.rulesFolder),
            configFiles:
              ide.configFiles?.map((f) =>
                f.startsWith('~') ? this.expandPath(f) : path.join(this.projectPath, f)
              ) || [],
          }
        }
      }
    }

    return paths
  }

  /**
   * Initialize IDE configurations for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const { verbose = false } = options
    const detectionResult = this.getCachedDetection()

    if (!detectionResult.isUsed) {
      if (verbose) {
        console.log('No IDEs detected - setting up generic configuration')
      }
      // Set up generic .ai/rules configuration
      await this.setupGenericConfiguration(options)
      return true
    }

    let success = true
    const paths = this.getConfigPaths()

    for (const [ideId, idePaths] of Object.entries(paths)) {
      try {
        if (verbose) {
          console.log(`Setting up ${idePaths.name} integration...`)
        }

        // Ensure rules directory exists using modernized method
        await ensureRuleDirectory(ideId, this.projectPath)

        // Create initial rule structure if needed
        await this.createInitialRules(idePaths.rulesFolder, ideId)

        if (verbose) {
          console.log(`✅ ${idePaths.name} integration configured`)
        }
      } catch (error) {
        if (verbose) {
          console.log(`❌ Failed to configure ${idePaths.name}: ${error.message}`)
        }
        success = false
      }
    }

    return success
  }

  /**
   * Set up generic .ai/rules configuration
   * @param {Object} options - Configuration options
   */
  async setupGenericConfiguration(options = {}) {
    const genericRulesPath = path.join(this.projectPath, '.ai', 'rules')
    await this.ensureDirectory(genericRulesPath)
    await this.createInitialRules(genericRulesPath, 'generic', options)
  }

  /**
   * Create initial rule structure for an IDE
   * @param {string} rulesPath - Path to rules directory
   * @param {string} ideId - IDE identifier
   * @param {Object} options - Configuration options
   */
  async createInitialRules(rulesPath, ideId) {
    // Creates basic rules structure as needed
    const vdkConfigPath = path.join(rulesPath, '.vdk-config.json')

    if (!this.fileExists(vdkConfigPath)) {
      const config = {
        ide: ideId,
        rulesFormat: 'md',
        lastUpdated: new Date().toISOString(),
        vdkVersion: '1.0.0',
      }

      await this.writeJsonFile(vdkConfigPath, config)
    }
  }

  /**
   * Get detected IDEs information
   * @returns {Array} Array of detected IDE objects
   */
  getDetectedIDEs() {
    const detection = this.getCachedDetection()
    return detection.detectedIDEs || []
  }

  /**
   * Check if a specific IDE is detected
   * @param {string} ideId - IDE identifier
   * @returns {boolean} True if IDE is detected
   */
  isIDEDetected(ideId) {
    const detectedIDEs = this.getDetectedIDEs()
    return detectedIDEs.some((ide) => ide.id === ideId)
  }

  /**
   * Get the primary detected IDE (highest confidence)
   * @returns {Object|null} Primary IDE detection or null
   */
  getPrimaryIDE() {
    const detectedIDEs = this.getDetectedIDEs()
    if (detectedIDEs.length === 0) {
      return null
    }

    // Sort by confidence and return the highest
    const sorted = [...detectedIDEs].sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1, none: 0 }
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    })

    return sorted[0]
  }

  /**
   * Expand tilde paths to absolute paths
   * @param {string} filePath - Path that may contain tilde
   * @returns {string} Expanded absolute path
   */
  expandPath(filePath) {
    if (filePath.startsWith('~')) {
      const platformPaths = this.getPlatformPaths()
      return path.join(platformPaths.home, filePath.substring(1))
    }
    return filePath
  }
}
