# Supported IDEs and AI Tools

> **Last Updated**: January 2025  
> **VDK CLI Version**: 2.9.0+

This document provides an exhaustive list of **33+ IDEs, editors, and AI assistants** supported by the VDK CLI framework for generating project-specific AI coding rules and integrations with enhanced schema support.

## Code Editors & IDEs

### Microsoft Visual Studio Code Family

#### ✅ VS Code (Stable)
- **Configuration**: `.vscode/` folder
- **AI Rules**: `.vscode/ai-rules/`
- **MCP Support**: ✅ via `.vscode/mcp.json`
- **Auto-detection**: Settings and extensions files
- **Status**: **Fully Supported** ✅

#### ✅ VS Code Insiders
- **Configuration**: `.vscode-insiders/` folder  
- **AI Rules**: `.vscode-insiders/ai-rules/`
- **MCP Support**: ✅ via `.vscode-insiders/mcp.json`
- **Auto-detection**: Settings and extensions files
- **Status**: **Fully Supported** ✅

#### ✅ VSCodium
- **Configuration**: `~/.config/VSCodium/User/` (global), `.vscode-oss/` (project)
- **AI Rules**: `.vscode-oss/ai-rules/`
- **Extensions**: `~/.vscode-oss/extensions/`
- **Auto-detection**: VSCodium settings files
- **Status**: **Fully Supported** ✅
- **Notes**: Open source VS Code distribution with telemetry removed

### AI-First Editors

#### ✅ Cursor AI
- **Configuration**: `.cursor/` folder
- **AI Rules**: `.ai/rules/` 
- **MCP Support**: ✅ via `.cursor/mcp.json`
- **Special Files**: `.cursorignore`
- **Global Config**: `~/.cursor/mcp.json`
- **Status**: **Fully Supported** ✅
- **Notes**: AI-first editor with automatic rule detection

#### ✅ Windsurf
- **Configuration**: `.windsurf/` folder
- **AI Rules**: `.windsurf/rules/`
- **MCP Support**: ✅ via `~/.codeium/windsurf/mcp_config.json`
- **Status**: **Fully Supported** ✅
- **Notes**: Codeium's AI-powered editor

#### ✅ Windsurf Next
- **Configuration**: `.windsurf-next/` folder
- **AI Rules**: `.windsurf-next/rules/`
- **MCP Support**: ✅ via `~/.codeium/windsurf-next/mcp_config.json`
- **Status**: **Fully Supported** ✅
- **Notes**: Next-generation Windsurf editor

### Modern Editors

#### ✅ Zed Editor
- **Configuration**: `~/.config/zed/settings.json` (global), `.zed/` (project)
- **AI Rules**: `.zed/ai-rules/`
- **Config Files**: `settings.json`, `keymap.json`
- **Logs**: `~/Library/Logs/Zed/Zed.log`
- **Status**: **Fully Supported** ✅
- **Notes**: High-performance collaborative editor with AI features

### JetBrains IDEs

VDK provides individual detection and configuration for each JetBrains IDE with project-specific optimizations:

#### ✅ IntelliJ IDEA
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.idea/modules.xml`, `.idea/compiler.xml`, Java project files
- **MCP Support**: ✅ via `~/.cache/JetBrains/IntelliJIdea*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Java/Kotlin/Maven/Gradle integration

#### ✅ WebStorm
- **Configuration**: `.idea/` folder  
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.idea/webServers.xml`, `package.json`, TypeScript configs
- **MCP Support**: ✅ via `~/.cache/JetBrains/WebStorm*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Node.js/TypeScript/React integration

#### ✅ PyCharm
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.idea/misc.xml`, `requirements.txt`, Python project files
- **MCP Support**: ✅ via `~/.cache/JetBrains/PyCharm*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Python virtual environment support

#### ✅ PHPStorm
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.idea/php.xml`, `composer.json`, PHP files
- **MCP Support**: ✅ via `~/.cache/JetBrains/PhpStorm*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: PHP/Composer integration

#### ✅ RubyMine
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.idea/runConfigurations.xml`, `Gemfile`, Ruby files
- **MCP Support**: ✅ via `~/.cache/JetBrains/RubyMine*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Rails framework support

#### ✅ CLion
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `CMakeLists.txt`, `.idea/cmake.xml`, C/C++ files
- **MCP Support**: ✅ via `~/.cache/JetBrains/CLion*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: CMake/debugger integration

#### ✅ DataGrip
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.idea/dataSources.xml`, `.idea/sqldialects.xml`, SQL files
- **MCP Support**: ✅ via `~/.cache/JetBrains/DataGrip*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Database-specific SQL integration

#### ✅ GoLand
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `go.mod`, `go.sum`, `.idea/go.xml`, Go files
- **MCP Support**: ✅ via `~/.cache/JetBrains/GoLand*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Go modules support

#### ✅ Rider
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `.sln` files, `.csproj` files, `.idea/.idea.*.dir/`
- **MCP Support**: ✅ via `~/.cache/JetBrains/Rider*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: .NET/Unity integration

#### ✅ Android Studio
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **Detection**: `build.gradle`, `app/build.gradle`, `.idea/gradle.xml`
- **MCP Support**: ✅ via `~/.cache/Google/AndroidStudio*/mcp`
- **Status**: **Fully Supported** ✅
- **Optimizations**: Android SDK/Gradle integration

#### ✅ JetBrains IDEs (Generic)
- **Configuration**: `.idea/` folder
- **AI Rules**: `.idea/ai-rules/`
- **MCP Support**: ✅ via Settings → Tools → AI Assistant → Model Context Protocol
- **MCP Cache**: `~/.cache/JetBrains/*/mcp`
- **Status**: **Fully Supported** ✅
- **Notes**: Fallback detection for any JetBrains IDE

## AI Assistants & Services

### Anthropic Claude

#### ✅ Claude Code
- **Configuration**: `.claude/` folder
- **AI Rules**: `.claude/commands/`
- **Settings**: `.claude/settings.json`, `.claude/settings.local.json`
- **Global Config**: `~/.claude/settings.json`
- **Enterprise**: `/Library/Application Support/ClaudeCode/policies.json`
- **Status**: **Fully Supported** ✅
- **Notes**: Official Anthropic CLI tool

#### ✅ Claude Desktop
- **Configuration**: `.claude-desktop/` folder
- **AI Rules**: `.claude-desktop/rules/`
- **MCP Support**: ✅ via `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Logs**: `~/Library/Logs/Claude/mcp-server-*.log`
- **Status**: **Fully Supported** ✅

### GitHub Services

#### ✅ GitHub Copilot
- **Configuration**: `.github/copilot/` folder
- **AI Rules**: `.github/copilot/rules/`
- **Status**: **Fully Supported** ✅
- **Notes**: Works with GitHub Copilot Enterprise features

### OpenAI Tools

#### ⚠️ OpenAI API Tools
- **Configuration**: `.openai/` folder
- **AI Rules**: `.openai/rules/`
- **Status**: **Limited Support** ⚠️
- **Notes**: Original Codex API deprecated March 2023. Configuration maintained for other OpenAI API-based tools.

### Generic Integration

#### ✅ Generic AI Platform
- **Configuration**: `.ai/` folder
- **AI Rules**: `.ai/rules/`
- **Config Files**: `config.json`, `context.json`, `prompts.json`
- **Auto-detection**: AI-related environment variables, config patterns
- **Status**: **Fully Supported** ✅
- **Notes**: Enhanced platform with context management and priority settings

#### ✅ Generic AI Tool
- **Configuration**: `.ai/` folder
- **AI Rules**: `.ai/rules/`
- **Status**: **Fully Supported** ✅
- **Notes**: Standard VDK configuration that works with most AI coding assistants

## Integration Features

### Model Context Protocol (MCP) Support
The following platforms support MCP for enhanced AI context:
- ✅ VS Code (all variants: Stable, Insiders, VSCodium)
- ✅ Cursor AI  
- ✅ Windsurf (all variants: Standard, Next)
- ✅ JetBrains IDEs (all 11 IDEs with 2025.1+ versions)
- ✅ Claude Desktop
- ✅ Claude Code

### Enhanced Auto-Detection Capabilities
VDK CLI provides intelligent platform detection through:
- **Configuration Folders**: `.vscode`, `.idea`, `.cursor`, `.zed`, etc.
- **Settings Files**: `settings.json`, `workspace.xml`, IDE-specific configs  
- **Project Characteristics**: Language files, framework configs, build systems
- **Confidence Scoring**: Intelligent ranking of detected IDEs by project fit
- **Global Configuration**: User-level IDE settings and extensions
- **Process Detection**: Running IDE processes for active usage confirmation

### Rule Generation Features
All supported platforms receive:
- 📋 Project-specific coding rules
- 🏗️ Architecture pattern detection  
- 🔍 Technology stack analysis
- 📚 Framework-specific guidelines
- 🔒 Security best practices
- 📊 Performance optimization rules

## Platform Status Legend

| Symbol | Status | Description |
|--------|--------|-------------|
| ✅ | **Fully Supported** | Complete integration with all features |
| ⚠️ | **Limited Support** | Basic support with some limitations |
| ❌ | **Deprecated** | No longer supported or obsolete |
| 🔄 | **In Development** | Support being actively developed |

## Getting Started

To initialize VDK for your detected IDEs:

```bash
# Auto-detect and initialize all IDEs in current project
vdk init

# Initialize specific IDE or platform  
vdk init --ide vscode
vdk init --ide intellij
vdk init --ide zed

# List all supported IDEs
vdk list-ides

# Generate rules for specific IDE with enhanced detection
vdk scan --ide jetbrains
vdk scan --ide webstorm  # Specific JetBrains IDE
vdk scan --ide generic-ai
```

## Configuration Verification

To verify your IDE integration:

```bash
# Check detected IDEs
vdk detect

# Validate configuration
vdk validate

# Test rule generation
vdk scan --dry-run
```

## Enterprise Features

### Multi-IDE Support
- Simultaneous support for multiple IDEs in one project
- Shared rule synchronization across IDE configurations
- Team-wide consistency enforcement

### Security & Compliance
- Enterprise policy integration (JetBrains, Claude Code)
- Security rule validation
- Audit trail for rule modifications

### Advanced Integrations
- Custom rule templates
- Platform-specific optimizations
- Memory-aware rule generation for resource-constrained platforms

---

**Need Support?** 
- 📖 [Documentation](https://github.com/your-repo/vdk-cli/docs)
- 🐛 [Report Issues](https://github.com/your-repo/vdk-cli/issues)
- 💬 [Community Discussions](https://github.com/your-repo/vdk-cli/discussions)

> **Note**: This list is continuously updated. For the most current support status, run `vdk --version` and `vdk list-ides` to see platform-specific capabilities in your version.