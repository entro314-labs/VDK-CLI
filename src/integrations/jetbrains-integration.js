/**
 * JetBrains IDE Integration
 * -------------------------
 * Detects and manages integration with JetBrains IDEs (IntelliJ, WebStorm, PyCharm, etc.)
 * Handles MCP configuration, file templates, and AI assistant integration.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BaseIntegration } from './base-integration.js'

/**
 * JetBrains IDE integration for VDK
 */
export class JetBrainsIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('JetBrains IDEs', projectPath)
    this.supportedIDEs = [
      'IntelliJIdea',
      'WebStorm',
      'PyCharm',
      'PhpStorm',
      'RubyMine',
      'CLion',
      'DataGrip',
      'GoLand',
      'Rider',
      'AndroidStudio',
    ]
  }

  /**
   * Detect JetBrains IDE usage in the project
   */
  detectUsage() {
    const indicators = []
    const recommendations = []
    let confidence = 'none'

    // Check for .idea folder
    const ideaPath = path.join(this.projectPath, '.idea')
    if (fs.existsSync(ideaPath)) {
      indicators.push('Found .idea configuration folder')
      confidence = 'high'

      // Check for specific IDE indicators
      const detectedIDEs = this.detectSpecificIDEs()
      if (detectedIDEs.length > 0) {
        indicators.push(`Detected IDEs: ${detectedIDEs.join(', ')}`)
      }

      // Check for AI assistant configuration
      const hasAIConfig = this.checkAIAssistantConfig()
      if (hasAIConfig) {
        indicators.push('AI Assistant configuration detected')
      } else {
        recommendations.push('Configure AI Assistant in Settings | Tools | AI Assistant')
      }

      // Check for MCP support
      const mcpPath = this.getMCPConfigPath()
      if (mcpPath && fs.existsSync(mcpPath)) {
        indicators.push('MCP configuration found')
      } else {
        recommendations.push('Consider setting up Model Context Protocol (MCP) for enhanced AI integration')
      }
    }

    // Check for JetBrains process running
    try {
      const runningProcesses = this.getRunningJetBrainsProcesses()
      if (runningProcesses.length > 0) {
        indicators.push(`Running JetBrains processes: ${runningProcesses.join(', ')}`)
        if (confidence === 'none') confidence = 'medium'
      }
    } catch (error) {
      // Process detection failed - not critical
    }

    // Additional recommendations
    if (confidence !== 'none') {
      recommendations.push('Use .idea/ai-rules/ folder for VDK Blueprint rules')
      recommendations.push('Enable relevant code inspections for your project language')
    }

    return {
      isUsed: confidence !== 'none',
      confidence,
      indicators,
      recommendations,
    }
  }

  /**
   * Detect specific JetBrains IDEs
   */
  detectSpecificIDEs() {
    const detectedIDEs = []
    const ideaPath = path.join(this.projectPath, '.idea')

    if (!fs.existsSync(ideaPath)) return detectedIDEs

    // Check for IDE-specific configuration files
    const ideIndicators = {
      'IntelliJ IDEA': ['.idea/modules.xml', '.idea/compiler.xml'],
      WebStorm: ['.idea/webServers.xml', '.idea/jsLibraryMappings.xml'],
      PyCharm: ['.idea/misc.xml', '.idea/inspectionProfiles/'],
      PHPStorm: ['.idea/php.xml', '.idea/blade.xml'],
      RubyMine: ['.idea/runConfigurations.xml'],
      CLion: ['CMakeLists.txt', '.idea/cmake.xml'],
      DataGrip: ['.idea/dataSources.xml', '.idea/sqldialects.xml'],
      GoLand: ['go.mod', '.idea/go.xml'],
      Rider: ['.idea/.idea.*.dir/', '*.sln'],
      'Android Studio': ['build.gradle', 'app/build.gradle', '.idea/gradle.xml'],
    }

    for (const [ide, indicators] of Object.entries(ideIndicators)) {
      const hasIndicators = indicators.some((indicator) => {
        const fullPath = path.isAbsolute(indicator) ? indicator : path.join(this.projectPath, indicator)
        return fs.existsSync(fullPath)
      })

      if (hasIndicators) {
        detectedIDEs.push(ide)
      }
    }

    return detectedIDEs
  }

  /**
   * Check for AI Assistant configuration
   */
  checkAIAssistantConfig() {
    // Check for AI-related configuration in .idea folder
    const ideaPath = path.join(this.projectPath, '.idea')
    if (!fs.existsSync(ideaPath)) return false

    // Look for AI assistant or MCP related files
    const aiConfigFiles = ['.idea/ai-assistant.xml', '.idea/mcp.xml', '.idea/ai-rules/']

    return aiConfigFiles.some((file) => fs.existsSync(path.join(this.projectPath, file)))
  }

  /**
   * Get MCP configuration path
   */
  getMCPConfigPath() {
    const homeDir = os.homedir()
    const cacheDir = path.join(homeDir, '.cache', 'JetBrains')

    try {
      if (fs.existsSync(cacheDir)) {
        const jetbrainsVersions = fs
          .readdirSync(cacheDir)
          .filter((dir) => this.supportedIDEs.some((ide) => dir.includes(ide)))

        if (jetbrainsVersions.length > 0) {
          return path.join(cacheDir, jetbrainsVersions[0], 'mcp')
        }
      }
    } catch (error) {
      // Ignore errors in path detection
    }

    return null
  }

  /**
   * Get running JetBrains processes
   */
  getRunningJetBrainsProcesses() {
    try {
      const { execSync } = require('node:child_process')
      const processes = execSync('ps aux', { encoding: 'utf8' })

      const jetbrainsProcesses = []
      const lines = processes.split('\n')

      for (const line of lines) {
        for (const ide of this.supportedIDEs) {
          if (line.toLowerCase().includes(ide.toLowerCase())) {
            jetbrainsProcesses.push(ide)
            break
          }
        }
      }

      return [...new Set(jetbrainsProcesses)] // Remove duplicates
    } catch (error) {
      return []
    }
  }

  /**
   * Get configuration paths
   */
  getConfigPaths() {
    return {
      projectConfig: path.join(this.projectPath, '.idea'),
      rulesPath: path.join(this.projectPath, '.idea', 'ai-rules'),
      mcpConfig: this.getMCPConfigPath(),
      workspaceConfig: path.join(this.projectPath, '.idea', 'workspace.xml'),
    }
  }

  /**
   * Initialize JetBrains integration
   */
  async initialize(options = {}) {
    const { verbose = false } = options

    try {
      const configPaths = this.getConfigPaths()

      // Create ai-rules directory if it doesn't exist
      if (!fs.existsSync(configPaths.rulesPath)) {
        fs.mkdirSync(configPaths.rulesPath, { recursive: true })
        if (verbose) {
          console.log(`Created rules directory: ${configPaths.rulesPath}`)
        }
      }

      return true
    } catch (error) {
      if (verbose) {
        console.error(`Failed to initialize JetBrains integration: ${error.message}`)
      }
      return false
    }
  }

  /**
   * Get integration summary
   */
  getSummary() {
    const detection = this.getCachedDetection()
    const detectedIDEs = this.detectSpecificIDEs()

    return {
      name: this.name,
      isActive: detection.isUsed,
      confidence: detection.confidence,
      detectedIDEs,
      configPath: path.join(this.projectPath, '.idea'),
      rulesPath: path.join(this.projectPath, '.idea', 'ai-rules'),
      mcpSupported: true,
    }
  }
}

export default JetBrainsIntegration
