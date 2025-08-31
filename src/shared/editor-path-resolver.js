/**
 * Editor Path Resolver for VDK CLI
 * -----------------------
 * ES module to standardize access to editor configuration paths
 * and MCP server settings across different editor environments.
 *
 * This module provides a consistent interface for:
 * 1. Resolving global and project-specific editor configuration paths
 * 2. Accessing MCP server configurations
 * 3. Expanding platform-specific paths (like ~ on Unix systems)
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Import centralized IDE configurations
import { IDE_CONFIGURATIONS } from './ide-configuration.js'

/**
 * Expands a path with tilde to absolute path
 * @param {string} filePath - Path that may contain tilde (~)
 * @returns {string} Resolved absolute path
 */
function expandPath(filePath) {
  if (!filePath) {
    return ''
  }

  // Replace ~ with user's home directory
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.substring(1))
  }

  return filePath
}

/**
 * Get the MCP configuration file path for a specific IDE
 * @param {string} ideId - IDE identifier from ide-configuration.js
 * @param {string} projectPath - Path to the project root
 * @param {boolean} preferGlobal - Whether to prefer global config over project-specific
 * @returns {object} Object containing both projectConfig and globalConfig paths
 */
function getMCPConfigPaths(ideId, projectPath, preferGlobal = false) {
  const ideConfig =
    IDE_CONFIGURATIONS.find((ide) => ide.id === ideId) || IDE_CONFIGURATIONS.find((ide) => ide.id === 'generic')

  const result = {
    projectConfig: null,
    globalConfig: null,
    activeConfig: null,
  }

  // Set project-specific config path if available
  if (ideConfig.mcpConfigFile) {
    result.projectConfig = path.join(projectPath, ideConfig.mcpConfigFile)
  }

  // Set global config path if available
  if (ideConfig.globalConfigPath) {
    result.globalConfig = expandPath(ideConfig.globalConfigPath)
  }

  // Determine which config is active based on preference and existence
  if (preferGlobal && result.globalConfig && fs.existsSync(result.globalConfig)) {
    result.activeConfig = result.globalConfig
  } else if (result.projectConfig && fs.existsSync(result.projectConfig)) {
    result.activeConfig = result.projectConfig
  } else if (result.globalConfig && fs.existsSync(result.globalConfig)) {
    result.activeConfig = result.globalConfig
  } else if (result.projectConfig) {
    // Return project path even if it doesn't exist yet
    result.activeConfig = result.projectConfig
  }

  return result
}

/**
 * Get the MCP configuration content for a specific IDE
 * @param {string} ideId - IDE identifier from ide-configuration.js
 * @param {string} projectPath - Path to the project root
 * @returns {object|null} Parsed MCP configuration or null if not found
 */
function getMCPConfiguration(ideId, projectPath) {
  const configPaths = getMCPConfigPaths(ideId, projectPath)

  if (configPaths.activeConfig && fs.existsSync(configPaths.activeConfig)) {
    try {
      const configContent = fs.readFileSync(configPaths.activeConfig, 'utf8')
      return JSON.parse(configContent)
    } catch (error) {
      console.error(`Error reading MCP configuration: ${error.message}`)
      return null
    }
  }

  return null
}

/**
 * Get a map of all known editor configuration paths
 * @param {string} projectPath - Path to the project root
 * @returns {object} Map of editor IDs to their configuration paths
 */
function getAllEditorConfigPaths(projectPath) {
  const editorPaths = {}

  IDE_CONFIGURATIONS.forEach((ide) => {
    const mcpPaths = getMCPConfigPaths(ide.id, projectPath)

    editorPaths[ide.id] = {
      name: ide.name,
      projectConfigPath: mcpPaths.projectConfig ? path.relative(projectPath, mcpPaths.projectConfig) : null,
      globalConfigPath: mcpPaths.globalConfig,
      activeConfigPath: mcpPaths.activeConfig ? path.relative(projectPath, mcpPaths.activeConfig) : null,
      rulesFolder: ide.rulesFolder,
    }
  })

  return editorPaths
}

/**
 * Generate the content for the MCP configuration file in 03-mcp-configuration.mdc
 * based on the available MCP configurations from different editors
 *
 * @param {string} projectPath - Path to the project root
 * @returns {string} Generated MCP configuration content
 */
function generateMCPConfigurationContent(projectPath) {
  let content = ''
  const editorPaths = getAllEditorConfigPaths(projectPath)

  // Add the editor paths section
  content += '## Editor Configuration Paths\n\n'

  Object.keys(editorPaths).forEach((ideId) => {
    const editor = editorPaths[ideId]
    if (!editor.name) {
      return
    }

    content += `### ${editor.name}\n`

    if (editor.projectConfigPath) {
      content += `- **Project Config**: \`${editor.projectConfigPath}\`\n`
    }

    if (editor.globalConfigPath) {
      content += `- **Global Config**: \`${editor.globalConfigPath}\`\n`
    }

    if (editor.rulesFolder) {
      content += `- **Rules Folder**: \`${editor.rulesFolder}\`\n`
    }

    content += '\n'
  })

  // Try to find and include MCP servers from configs
  const mcpServers = []

  Object.keys(editorPaths).forEach((ideId) => {
    const config = getMCPConfiguration(ideId, projectPath)
    if (config?.servers) {
      Object.keys(config.servers).forEach((serverName) => {
        const server = config.servers[serverName]
        if (!mcpServers.some((s) => s.name === serverName)) {
          mcpServers.push({
            name: serverName,
            config: server,
            source: editorPaths[ideId].name,
          })
        }
      })
    }
  })

  // Add the MCP servers section if any were found
  if (mcpServers.length > 0) {
    content += '## Available MCP Servers\n\n'

    mcpServers.forEach((server) => {
      content += `### ${server.name}\n`
      content += `Source: ${server.source}\n`

      if (server.config.description) {
        content += `Purpose: ${server.config.description}\n`
      }

      if (server.config.commands) {
        content += 'Key Commands: '
        content += Object.keys(server.config.commands)
          .map((cmd) => `\`${cmd}\``)
          .join(', ')
        content += '\n'
      }

      content += '\n'
    })
  }

  return content
}

/**
 * Update the MCP configuration file (03-mcp-configuration.mdc) with the latest
 * editor paths and MCP server information
 *
 * @param {string} projectPath - Path to the project root
 * @param {string} rulePath - Path to the rule directory
 * @returns {boolean} Success status
 */
function updateMCPConfigurationFile(projectPath, rulePath) {
  const mcpFilePath = path.join(rulePath, '03-mcp-configuration.mdc')

  // Check if the file exists
  if (!fs.existsSync(mcpFilePath)) {
    console.error(`MCP configuration file not found: ${mcpFilePath}`)
    return false
  }

  try {
    // Read the existing file
    const existingContent = fs.readFileSync(mcpFilePath, 'utf8')

    // Generate the new configuration content
    const newContent = generateMCPConfigurationContent(projectPath)

    // Find the position to insert the content
    // Look for the marker section or create it at the end of the file
    const markerRegex = /## Editor Configuration Paths\s+[\s\S]*?(?=##|$)/

    let updatedContent = ''

    if (markerRegex.test(existingContent)) {
      // Replace the existing section
      updatedContent = existingContent.replace(markerRegex, newContent)
    } else {
      // Find a good place to insert the section
      const insertPositions = [
        existingContent.indexOf('## Available MCP Servers'),
        existingContent.indexOf('## MCP Technology Integration'),
        existingContent.indexOf('## Code Generation Patterns'),
        existingContent.indexOf('---\nNOTE TO AI:'),
      ].filter((pos) => pos !== -1)

      if (insertPositions.length > 0) {
        // Insert before the earliest section found
        const pos = Math.min(...insertPositions)
        updatedContent = `${existingContent.slice(0, pos) + newContent}\n${existingContent.slice(pos)}`
      } else {
        // Append to the end if no good position is found
        updatedContent = `${existingContent}\n\n${newContent}`
      }
    }

    // Write the updated content back to the file
    fs.writeFileSync(mcpFilePath, updatedContent, 'utf8')

    return true
  } catch (error) {
    console.error(`Error updating MCP configuration file: ${error.message}`)
    return false
  }
}

// Export functions for use in other modules
export {
  expandPath,
  generateMCPConfigurationContent,
  getAllEditorConfigPaths,
  getMCPConfigPaths,
  getMCPConfiguration,
  updateMCPConfigurationFile,
}
