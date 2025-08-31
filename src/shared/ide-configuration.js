/**
 * IDE Configuration for VDK CLI
 * -----------------------
 * ES module to share IDE configurations between project-scanner and CLI commands.
 * This module centralizes IDE configuration information.
 */

// Import centralized configuration constants
import fs from 'node:fs'
import path from 'node:path'

/**
 * IDE configuration mapping
 * Centralizes information about supported IDEs, their configuration paths
 * and rule storage locations.
 */
const IDE_CONFIGURATIONS = [
  {
    id: 'vscode',
    name: 'VS Code',
    configFolder: '.vscode',
    rulesFolder: '.vscode/ai-rules',
    configFiles: ['.vscode/settings.json', '.vscode/extensions.json'],
    mcpConfigFile: '.vscode/mcp.json',
    description: 'Traditional IDE: Uses extensions/plugins for AI integration.',
    priority: 'medium',
    type: 'traditional-ide',
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
    id: 'vscodium',
    name: 'VSCodium',
    configFolder: '.vscode-oss',
    rulesFolder: '.vscode-oss/ai-rules',
    configFiles: ['~/.config/VSCodium/User/settings.json', '~/.config/VSCodium/User/keybindings.json'],
    globalConfigPath: '~/.config/VSCodium/User/settings.json',
    logPath: '~/.config/VSCodium/logs',
    description: 'Open source distribution of VS Code with telemetry removed.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    configFolder: '.cursor',
    rulesFolder: '.cursor/rules',
    configFiles: ['.cursor/settings.json'],
    mcpConfigFile: '.cursor/mcp.json',
    ignoreFile: '.cursorignore',
    globalConfigPath: '~/.cursor/mcp.json',
    description: 'Context Platform: Cursor IDE with multi-model AI support (Claude, GPT, etc.) and MDC format.',
    priority: 'high',
    type: 'context-platform',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    configFolder: '.windsurf',
    rulesFolder: '.windsurf/rules',
    configFiles: ['.windsurf/config.json'],
    mcpConfigFile: '~/.codeium/windsurf/mcp_config.json',
    description: 'Context Platform: Windsurf IDE with multi-model AI support and native rule format.',
    priority: 'high',
    type: 'context-platform',
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
    id: 'claude-code-cli',
    name: 'Claude Code CLI',
    configFolder: '.claude',
    rulesFolder: '.claude/commands',
    configFiles: ['.claude/settings.json', '.claude/settings.local.json'],
    globalConfigPath: '~/.claude/settings.json',
    enterpriseConfigPath: '/Library/Application Support/ClaudeCode/policies.json',
    description: 'Context Platform: Claude Code CLI - works across multiple IDEs via plugins.',
    priority: 'high',
    type: 'context-platform',
  },
  {
    id: 'zed',
    name: 'Zed Editor',
    configFolder: '.zed',
    rulesFolder: '.zed/ai-rules',
    configFiles: ['~/.config/zed/settings.json', '~/.config/zed/keymap.json'],
    globalConfigPath: '~/.config/zed/settings.json',
    logPath: '~/Library/Logs/Zed/Zed.log',
    description: 'Traditional IDE: Supports AI extensions and features.',
    priority: 'medium',
    type: 'traditional-ide',
  },
  {
    id: 'jetbrains',
    name: 'JetBrains IDEs',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml'],
    mcpConfigPath: '~/.cache/JetBrains/*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null, // Configured through IDE Settings UI
    description: 'Traditional IDE: Built-in AI assistant and MCP support.',
    priority: 'medium',
    type: 'traditional-ide',
  },
  {
    id: 'intellij',
    name: 'IntelliJ IDEA',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/modules.xml'],
    mcpConfigPath: '~/.cache/JetBrains/IntelliJIdea*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'IntelliJ IDEA with AI assistant integration and file templates.',
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/webServers.xml'],
    mcpConfigPath: '~/.cache/JetBrains/WebStorm*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'WebStorm with Node.js and TypeScript AI integration.',
  },
  {
    id: 'pycharm',
    name: 'PyCharm',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/misc.xml'],
    mcpConfigPath: '~/.cache/JetBrains/PyCharm*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'PyCharm with Python virtual environment and AI integration.',
  },
  {
    id: 'phpstorm',
    name: 'PHPStorm',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/php.xml'],
    mcpConfigPath: '~/.cache/JetBrains/PhpStorm*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'PHPStorm with PHP and Composer AI integration.',
  },
  {
    id: 'rubymine',
    name: 'RubyMine',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/runConfigurations.xml'],
    mcpConfigPath: '~/.cache/JetBrains/RubyMine*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'RubyMine with Ruby on Rails AI integration.',
  },
  {
    id: 'clion',
    name: 'CLion',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', 'CMakeLists.txt'],
    mcpConfigPath: '~/.cache/JetBrains/CLion*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'CLion with CMake and C/C++ debugger AI integration.',
  },
  {
    id: 'datagrip',
    name: 'DataGrip',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/dataSources.xml'],
    mcpConfigPath: '~/.cache/JetBrains/DataGrip*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'DataGrip with database AI integration and SQL inspections.',
  },
  {
    id: 'goland',
    name: 'GoLand',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', 'go.mod'],
    mcpConfigPath: '~/.cache/JetBrains/GoLand*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'GoLand with Go modules AI integration.',
  },
  {
    id: 'rider',
    name: 'Rider',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', '.idea/.idea.*.dir/.idea/indexLayout.xml'],
    mcpConfigPath: '~/.cache/JetBrains/Rider*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'Rider with .NET and Unity AI integration.',
  },
  {
    id: 'android-studio',
    name: 'Android Studio',
    configFolder: '.idea',
    rulesFolder: '.idea/ai-rules',
    configFiles: ['.idea/workspace.xml', 'build.gradle', 'app/build.gradle'],
    mcpConfigPath: '~/.cache/Google/AndroidStudio*/mcp',
    settingsPath: 'Settings | Tools | AI Assistant | Model Context Protocol (MCP)',
    mcpConfigFile: null,
    description: 'Android Studio with Android SDK and Gradle AI integration.',
  },
  {
    id: 'openai',
    name: 'OpenAI API Tools',
    configFolder: '.openai',
    rulesFolder: '.openai/rules',
    configFiles: ['.openai/config.json'],
    description:
      'Configuration for OpenAI API-based development tools (Note: Original Codex API deprecated March 2023).',
  },
  {
    id: 'generic-ai',
    name: 'Generic AI Platform',
    configFolder: '.ai',
    rulesFolder: '.ai/rules',
    configFiles: ['.ai/config.json'],
    description: 'Works with most AI coding assistants and platforms.',
  },
  {
    id: 'generic',
    name: 'Generic AI Tool',
    configFolder: '.ai',
    rulesFolder: '.ai/rules',
    configFiles: ['.ai/config.json'],
    description: 'Works with most AI coding assistants and is the VDK CLI standard.',
  },
]

/**
 * Get IDE configuration by ID
 * @param {string} id - IDE identifier
 * @returns {Object} IDE configuration object or null if not found
 */
function getIDEConfigById(id) {
  return IDE_CONFIGURATIONS.find((ide) => ide.id === id) || null
}

/**
 * Get IDE configuration paths
 * @param {string} id - IDE identifier
 * @param {string} projectPath - Project root path
 * @returns {Object} Configuration paths or default paths if IDE not found
 */
function getIDEConfigPaths(id, projectPath) {
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
function detectIDEs(projectPath) {
  const detectedIDEs = []

  for (const ide of IDE_CONFIGURATIONS) {
    const configPath = path.join(projectPath, ide.configFolder)
    if (fs.existsSync(configPath)) {
      detectedIDEs.push(ide)
      continue
    }

    // If config folder doesn't exist, check specific config files
    if (ide.configFiles && ide.configFiles.length > 0) {
      const configFileExists = ide.configFiles.some((filePath) => {
        // Handle files with wildcards or relative paths
        if (filePath.includes('~')) {
          return false // Skip global config files in project detection
        }
        return fs.existsSync(path.join(projectPath, filePath))
      })
      if (configFileExists) {
        detectedIDEs.push(ide)
      }
    }
  }

  return detectedIDEs
}

/**
 * Detect specific JetBrains IDEs based on project characteristics
 * @param {string} projectPath - Project root path
 * @returns {Array} List of detected JetBrains IDEs with confidence scores
 */
function detectSpecificJetBrainsIDEs(projectPath) {
  const detectedIDEs = []

  // Check if .idea folder exists first
  const ideaPath = path.join(projectPath, '.idea')
  if (!fs.existsSync(ideaPath)) {
    return detectedIDEs
  }

  // IDE-specific detection patterns
  const ideDetectionPatterns = {
    intellij: {
      files: ['.idea/modules.xml', '.idea/compiler.xml', 'src/main/java/', 'pom.xml', 'build.gradle'],
      indicators: ['Java', 'Maven', 'Gradle', 'Kotlin'],
      confidence: 0.8,
    },
    webstorm: {
      files: ['.idea/webServers.xml', '.idea/jsLibraryMappings.xml', 'package.json', 'tsconfig.json'],
      indicators: ['Node.js', 'TypeScript', 'JavaScript', 'React', 'Vue'],
      confidence: 0.9,
    },
    pycharm: {
      files: ['.idea/misc.xml', 'requirements.txt', 'setup.py', 'pyproject.toml', '__pycache__/'],
      indicators: ['Python', 'Django', 'Flask'],
      confidence: 0.9,
    },
    phpstorm: {
      files: ['.idea/php.xml', 'composer.json', 'composer.lock', '*.php'],
      indicators: ['PHP', 'Laravel', 'Symfony'],
      confidence: 0.9,
    },
    rubymine: {
      files: ['.idea/runConfigurations.xml', 'Gemfile', 'Gemfile.lock', 'config.ru'],
      indicators: ['Ruby', 'Rails', 'Bundler'],
      confidence: 0.9,
    },
    clion: {
      files: ['CMakeLists.txt', '.idea/cmake.xml', 'Makefile', '*.cpp', '*.c', '*.h'],
      indicators: ['C++', 'C', 'CMake'],
      confidence: 0.8,
    },
    datagrip: {
      files: ['.idea/dataSources.xml', '.idea/sqldialects.xml', '*.sql'],
      indicators: ['SQL', 'Database'],
      confidence: 0.7,
    },
    goland: {
      files: ['go.mod', 'go.sum', '.idea/go.xml', '*.go'],
      indicators: ['Go', 'Golang'],
      confidence: 0.9,
    },
    rider: {
      files: ['.idea/.idea.*.dir/', '*.sln', '*.csproj', 'global.json'],
      indicators: ['.NET', 'C#', 'Unity'],
      confidence: 0.8,
    },
    'android-studio': {
      files: ['build.gradle', 'app/build.gradle', '.idea/gradle.xml', 'AndroidManifest.xml'],
      indicators: ['Android', 'Gradle', 'Kotlin'],
      confidence: 0.9,
    },
  }

  // Check each IDE pattern
  for (const [ideId, pattern] of Object.entries(ideDetectionPatterns)) {
    let matchCount = 0
    const totalPatterns = pattern.files.length

    for (const filePattern of pattern.files) {
      const filePath = path.join(projectPath, filePattern)

      if (filePattern.includes('*')) {
        // Handle wildcard patterns
        const dir = path.dirname(filePath)
        const fileName = path.basename(filePattern)

        try {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir)
            const hasMatch = files.some((file) => {
              const regex = new RegExp(fileName.replace('*', '.*'))
              return regex.test(file)
            })
            if (hasMatch) matchCount++
          }
        } catch (error) {
          // Ignore directory read errors
        }
      } else if (fs.existsSync(filePath)) {
        matchCount++
      }
    }

    // Calculate confidence score
    const matchRatio = matchCount / totalPatterns
    const confidence = matchRatio >= 0.3 ? pattern.confidence * matchRatio : 0

    if (confidence > 0.5) {
      const ideConfig = IDE_CONFIGURATIONS.find((ide) => ide.id === ideId)
      if (ideConfig) {
        detectedIDEs.push({
          ...ideConfig,
          confidence,
          matchCount,
          totalPatterns,
          indicators: pattern.indicators,
        })
      }
    }
  }

  // Sort by confidence (highest first)
  return detectedIDEs.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Create rule directory for IDE if it doesn't exist
 * @param {string} id - IDE identifier
 * @param {string} projectPath - Project root path
 * @returns {string} Path to rule directory
 */
function ensureRuleDirectory(id, projectPath) {
  const config = getIDEConfigById(id) || IDE_CONFIGURATIONS.find((ide) => ide.id === 'generic')

  const rulePath = path.join(projectPath, config.rulesFolder)
  if (!fs.existsSync(rulePath)) {
    fs.mkdirSync(rulePath, { recursive: true })
  }

  return rulePath
}

/**
 * Format IDE options for display in the CLI
 * @returns {Array} List of IDE options with name and description
 */
function getIDEOptionsForCLI() {
  return IDE_CONFIGURATIONS.map((ide) => ({
    name: ide.name,
    folder: ide.rulesFolder,
    description: ide.description,
    id: ide.id,
  }))
}

// Export functions for use in CLI
export {
  detectIDEs,
  detectSpecificJetBrainsIDEs,
  ensureRuleDirectory,
  getIDEConfigById,
  getIDEConfigPaths,
  getIDEOptionsForCLI,
  IDE_CONFIGURATIONS,
}
