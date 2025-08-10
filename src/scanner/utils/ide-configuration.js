/**
 * IDE Configuration Module
 * -----------------------
 * Centralizes IDE/tool configuration mappings to ensure consistent integration
 * between project-scanner and CLI tools.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * IDE configuration mapping
 * Centralizes information about supported IDEs, their configuration paths
 * and rule storage locations.
 */
export const IDE_CONFIGURATIONS = [
  {
    id: 'vscode',
    name: 'VS Code',
    configFolder: '.vscode',
    rulesFolder: '.vscode/ai-rules',
    configFiles: ['.vscode/settings.json', '.vscode/extensions.json'],
    mcpConfigFile: '.vscode/mcp.json',
    description: 'Works with VS Code AI extensions.',
  },
  {
    id: 'vscode-insiders',
    name: 'VS Code Insiders',
    configFolder: '.vscode-insiders',
    rulesFolder: '.vscode-insiders/ai-rules',
    configFiles: ['.vscode-insiders/settings.json', '.vscode-insiders/extensions.json'],
    mcpConfigFile: '.vscode-insiders/mcp.json',
    description: 'Works with VS Code Insiders AI extensions.',
  },
  {
    id: 'cursor',
    name: 'Cursor AI',
    configFolder: '.cursor',
    rulesFolder: '.ai/rules',
    configFiles: ['.cursor/settings.json'],
    mcpConfigFile: '.cursor/mcp.json',
    ignoreFile: '.cursorignore',
    globalConfigPath: '~/.cursor/mcp.json',
    description: 'Optimized for Cursor AI Editor with automatic rule detection.',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    configFolder: '.windsurf',
    rulesFolder: '.windsurf/rules',
    configFiles: ['.windsurf/config.json'],
    mcpConfigFile: '~/.codeium/windsurf/mcp_config.json',
    description: 'Specifically formatted for Windsurf AI integration.',
  },
  {
    id: 'windsurf-next',
    name: 'Windsurf Next',
    configFolder: '.windsurf-next',
    rulesFolder: '.windsurf-next/rules',
    configFiles: ['.windsurf-next/config.json'],
    mcpConfigFile: '~/.codeium/windsurf-next/mcp_config.json',
    description: 'Specifically formatted for Windsurf Next AI integration.',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    configFolder: '.github/copilot',
    rulesFolder: '.github/copilot/rules',
    configFiles: ['.github/copilot/config.json'],
    description: 'Structure for GitHub Copilot integration.',
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    configFolder: '.claude-desktop',
    rulesFolder: '.claude-desktop/rules',
    configFiles: ['.claude-desktop/config.json'],
    mcpConfigFile: '~/Library/Application Support/Claude/claude_desktop_config.json',
    logPath: '~/Library/Logs/Claude/mcp-server-*.log',
    description: 'Optimized for Claude Desktop integration.',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    configFolder: '.claude',
    rulesFolder: '.claude/commands',
    configFiles: ['.claude/settings.json', '.claude/settings.local.json'],
    globalConfigPath: '~/.claude/settings.json',
    enterpriseConfigPath: '/Library/Application Support/ClaudeCode/policies.json',
    description: 'Optimized for Claude Code integration.',
  },
  {
    id: 'zed',
    name: 'Zed Editor',
    configFolder: '.zed',
    rulesFolder: '.zed/ai-rules',
    configFiles: ['~/.zed/settings.json', '~/.zed/keymap.json'],
    logPath: '~/Library/Logs/Zed/Zed.log',
    description: 'For use with Zed Editor AI features.',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains IDEs',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml'],
    mcpConfigPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    description: 'Compatible with JetBrains AI assistant integration.',
  },
  {
    id: 'openai',
    name: 'OpenAI Codex',
    configFolder: '.openai',
    rulesFolder: '.openai/rules',
    configFiles: ['.openai/config.json'],
    description: 'Structure for OpenAI Codex integration.',
  },
  {
    id: 'generic',
    name: 'Generic AI Tool',
    configFolder: '.ai',
    rulesFolder: '.ai/rules',
    configFiles: ['.ai/config.json'],
    description: 'Works with most AI coding assistants and is the VDK standard.',
  },
]

/**
 * Get IDE configuration by ID
 * @param {string} id - IDE identifier
 * @returns {Object} IDE configuration object or null if not found
 */
export function getIDEConfigById(id) {
  return IDE_CONFIGURATIONS.find((ide) => ide.id === id) || null
}

/**
 * Get IDE configuration paths
 * @param {string} id - IDE identifier
 * @param {string} projectPath - Project root path
 * @returns {Object} Configuration paths or default paths if IDE not found
 */
export function getIDEConfigPaths(id, projectPath) {
  const config = getIDEConfigById(id) || IDE_CONFIGURATIONS.find((ide) => ide.id === 'generic')

  return {
    configPath: path.join(projectPath, config.configFolder),
    rulePath: path.join(projectPath, config.rulesFolder),
  }
}

/**
 * Detect IDEs in a project based on configuration files
 * @param {string} projectPath - Project root path
 * @returns {Array} List of detected IDE configurations
 */
export function detectIDEs(projectPath) {
  const detectedIDEs = []

  for (const ide of IDE_CONFIGURATIONS) {
    const configPath = path.join(projectPath, ide.configFolder)
    if (fs.existsSync(configPath)) {
      detectedIDEs.push(ide)
      continue
    }

    // If config folder doesn't exist, check specific config files
    if (ide.configFiles && ide.configFiles.length > 0) {
      const configFileExists = ide.configFiles.some((filePath) =>
        fs.existsSync(path.join(projectPath, filePath))
      )
      if (configFileExists) {
        detectedIDEs.push(ide)
      }
    }
  }

  return detectedIDEs
}

/**
 * Create rule directory for IDE if it doesn't exist
 * @param {string} id - IDE identifier
 * @param {string} projectPath - Project root path
 * @returns {string} Path to rule directory
 */
export function ensureRuleDirectory(id, projectPath) {
  const config = getIDEConfigById(id) || IDE_CONFIGURATIONS.find((ide) => ide.id === 'generic')

  const rulePath = path.join(projectPath, config.rulesFolder)
  if (!fs.existsSync(rulePath)) {
    fs.mkdirSync(rulePath, { recursive: true })
  }

  return rulePath
}

export default {
  IDE_CONFIGURATIONS,
  getIDEConfigById,
  getIDEConfigPaths,
  detectIDEs,
  ensureRuleDirectory,
}
