/**
 * Zed Editor Integration
 * ----------------------
 * Detects and manages integration with Zed Editor
 * Handles AI features, collaborative features, and high-performance configurations.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BaseIntegration } from './base-integration.js'

/**
 * Zed Editor integration for VDK
 */
export class ZedIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('Zed Editor', projectPath)
  }

  /**
   * Detect Zed Editor usage in the project
   */
  detectUsage() {
    const indicators = []
    const recommendations = []
    let confidence = 'none'

    // Check for .zed folder
    const zedPath = path.join(this.projectPath, '.zed')
    if (fs.existsSync(zedPath)) {
      indicators.push('Found .zed configuration folder')
      confidence = 'high'

      // Check for Zed configuration files
      const configFile = path.join(zedPath, 'settings.json')
      if (fs.existsSync(configFile)) {
        indicators.push('Zed settings.json found')
      }
    }

    // Check for global Zed configuration
    const globalConfigPath = this.getGlobalConfigPath()
    if (fs.existsSync(globalConfigPath)) {
      indicators.push('Global Zed configuration detected')
      if (confidence === 'none') confidence = 'medium'
    }

    // Check for Zed process running
    try {
      const isZedRunning = this.isZedRunning()
      if (isZedRunning) {
        indicators.push('Zed process is currently running')
        if (confidence === 'none') confidence = 'medium'
      }
    } catch (error) {
      // Process detection failed - not critical
    }

    // Check for Zed-specific files
    const zedFiles = [
      '.zed/keymap.json',
      '.zed/themes/',
      '.zed/extensions.json'
    ]

    for (const file of zedFiles) {
      if (fs.existsSync(path.join(this.projectPath, file))) {
        indicators.push(`Found ${file}`)
        if (confidence === 'none') confidence = 'low'
      }
    }

    // Recommendations based on detection
    if (confidence !== 'none') {
      recommendations.push('Use .zed/ai-rules/ folder for VDK Blueprint rules')
      recommendations.push('Enable Zed AI features in settings for enhanced code assistance')
      recommendations.push('Consider enabling collaborative features for team development')
      
      if (!fs.existsSync(path.join(this.projectPath, '.zed', 'ai-rules'))) {
        recommendations.push('Create .zed/ai-rules/ directory for AI integration')
      }
    } else {
      recommendations.push('Install Zed Editor for high-performance code editing with AI features')
    }

    return {
      isUsed: confidence !== 'none',
      confidence,
      indicators,
      recommendations
    }
  }

  /**
   * Get global Zed configuration path
   */
  getGlobalConfigPath() {
    const homeDir = os.homedir()
    
    // Zed configuration path varies by OS
    switch (process.platform) {
      case 'darwin': // macOS
        return path.join(homeDir, 'Library', 'Application Support', 'Zed', 'settings.json')
      case 'linux':
        return path.join(homeDir, '.config', 'zed', 'settings.json')
      case 'win32': // Windows
        return path.join(homeDir, 'AppData', 'Roaming', 'Zed', 'settings.json')
      default:
        return path.join(homeDir, '.config', 'zed', 'settings.json')
    }
  }

  /**
   * Check if Zed is currently running
   */
  isZedRunning() {
    try {
      const { execSync } = require('node:child_process')
      const processes = execSync('ps aux', { encoding: 'utf8' })
      
      return processes.toLowerCase().includes('zed') || 
             processes.toLowerCase().includes('zed-editor')
    } catch (error) {
      return false
    }
  }

  /**
   * Get configuration paths
   */
  getConfigPaths() {
    return {
      projectConfig: path.join(this.projectPath, '.zed'),
      rulesPath: path.join(this.projectPath, '.zed', 'ai-rules'),
      globalConfig: this.getGlobalConfigPath(),
      settingsFile: path.join(this.projectPath, '.zed', 'settings.json'),
      keymapFile: path.join(this.projectPath, '.zed', 'keymap.json')
    }
  }

  /**
   * Initialize Zed integration
   */
  async initialize(options = {}) {
    const { verbose = false } = options

    try {
      const configPaths = this.getConfigPaths()

      // Create .zed directory if it doesn't exist
      if (!fs.existsSync(configPaths.projectConfig)) {
        fs.mkdirSync(configPaths.projectConfig, { recursive: true })
        if (verbose) {
          console.log(`Created Zed config directory: ${configPaths.projectConfig}`)
        }
      }

      // Create ai-rules directory if it doesn't exist
      if (!fs.existsSync(configPaths.rulesPath)) {
        fs.mkdirSync(configPaths.rulesPath, { recursive: true })
        if (verbose) {
          console.log(`Created rules directory: ${configPaths.rulesPath}`)
        }
      }

      // Create basic settings file if it doesn't exist
      if (!fs.existsSync(configPaths.settingsFile)) {
        const defaultSettings = {
          "ai": {
            "enabled": true,
            "inline_completions": true
          },
          "collaborative": {
            "enabled": false
          },
          "performance": "high"
        }

        fs.writeFileSync(configPaths.settingsFile, JSON.stringify(defaultSettings, null, 2))
        if (verbose) {
          console.log(`Created default settings file: ${configPaths.settingsFile}`)
        }
      }

      return true
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize Zed integration: ${error.message}`)
      }
      return false
    }
  }

  /**
   * Get integration summary
   */
  getSummary() {
    const detection = this.getCachedDetection()
    const configPaths = this.getConfigPaths()

    return {
      name: this.name,
      isActive: detection.isUsed,
      confidence: detection.confidence,
      configPath: configPaths.projectConfig,
      rulesPath: configPaths.rulesPath,
      aiFeatures: true,
      collaborative: true,
      performance: 'high'
    }
  }
}

export default ZedIntegration