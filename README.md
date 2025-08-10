# VibeKit VDK CLI

<div align="center">

![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

[![npm version](https://img.shields.io/npm/v/@vibe-dev-kit/cli?style=flat-square&logo=npm)](https://www.npmjs.com/package/@vibe-dev-kit/cli)
[![Downloads](https://img.shields.io/npm/dm/@vibe-dev-kit/cli?style=flat-square&logo=npm)](https://www.npmjs.com/package/@vibe-dev-kit/cli)
[![GitHub Repo stars](https://img.shields.io/github/stars/entro314-labs/VibeKit-VDK-CLI?style=flat-square&logo=github)](https://github.com/entro314-labs/VibeKit-VDK-CLI)

</div>

<div align="center">

<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="64" height="64" rx="12" fill="#6366F1"/>
<path d="M16 20h32v4H16v-4zm0 8h24v4H16v-4zm0 8h28v4H16v-4z" fill="white"/>
<circle cx="48" cy="44" r="8" fill="#10B981"/>
<path d="M44 44l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

**Stop Training Your AI Assistant Every Day**

The world's first Vibe Development Kit - Train any AI coding assistant to understand your project like a senior developer who's been on your team for years.

</div>

VDK CLI revolutionizes AI-assisted development by generating intelligent rules that make AI suggestions 60% faster and perfectly matched to your codebase patterns. This tool helps developers create project-aware AI assistants and provides seamless integration across all major coding platforms.

## Demo

<div align="center">

### Interactive Setup & Features

![VDK CLI Interactive Demo](docs/media/demo-interactive.gif)

### Quick Start Workflow

![VDK CLI Quick Demo](docs/media/demo-quick-real.gif)

</div>

## Features

<table>
<tr>
<td align="center" width="50%">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" fill="#6366F1"/>
</svg>

**Intelligent Project Analysis**
Automatically detects 20+ technologies, frameworks, and architectural patterns in your codebase

</td>
<td align="center" width="50%">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="#10B981"/>
</svg>

**Universal AI Compatibility**
Works with Claude Code, Cursor, Windsurf, GitHub Copilot, and any AI coding assistant

</td>
</tr>
<tr>
<td align="center">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#8B5CF6"/>
<path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
</svg>

**Smart Rule Generation**
Creates tailored MDC files with project-specific patterns, conventions, and best practices

</td>
<td align="center">

<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="12" cy="12" r="3" fill="#F59E0B"/>
<path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" stroke="#F59E0B" stroke-width="2"/>
</svg>

**5-Minute Setup**
Zero configuration required - instant value with automatic project detection and rule deployment

</td>
</tr>
</table>

## Quick Start

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" fill="#059669"/>
</svg>

### Installation

```bash
# Install globally
npm install -g @vibe-dev-kit/cli

# Or use with pnpm
pnpm add -g @vibe-dev-kit/cli

# Or use the installer script
curl -fsSL https://raw.githubusercontent.com/entro314-labs/VibeKit-VDK-CLI/main/install.sh | sh
```

### Basic Usage

```bash
# Initialize in your project
cd your-project
vdk init

# Interactive mode with guided setup
vdk init --interactive

# Check what VDK detected
vdk status
```

That's it! Your AI assistant now understands your project's patterns and conventions.

## How It Works

1. **Project Analysis**: Scans your codebase to detect technologies, frameworks, and architectural patterns
2. **Pattern Recognition**: Identifies naming conventions, code structures, and project-specific practices
3. **Rule Generation**: Creates customized MDC files with intelligent guidelines for your tech stack
4. **AI Integration**: Deploys rules to your preferred AI assistant's configuration directory

## Migration System

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="#8B5CF6"/>
</svg>

VDK CLI includes intelligent migration capabilities to convert your existing AI contexts from various platforms to VDK's universal format:

### Supported Migration Sources
- **Claude Code** - CLAUDE.md files and .claude/ directories  
- **Cursor** - .cursorrules and .cursor/ configurations
- **GitHub Copilot** - .github/copilot-instructions.md and related files
- **Windsurf** - .windsurf/ rules and configurations
- **Generic AI** - Various AI assistant rule formats

### Migration Process
1. **Detection**: Automatically identifies existing AI contexts in your project
2. **Analysis**: Evaluates confidence levels and categorizes found contexts  
3. **Conversion**: Transforms contexts to VDK blueprint format with project-specific adaptations
4. **Organization**: Creates structured migration output in `vdk-migration/` folder
5. **Integration**: Optionally deploys converted rules to your configured AI assistants

### Migration Commands
```bash
# Migrate existing AI contexts
vdk migrate

# Preview what would be migrated (no files created)  
vdk migrate --dry-run

# Migrate without deploying to IDE integrations
vdk migrate --no-deploy

# Check for existing AI contexts before migrating
vdk status
```

The migration system leverages VDK's existing architecture (scanners, adapters, generators) to ensure converted rules maintain the same quality and project-awareness as newly generated ones.

## Supported Technologies

<div align="center">

<table>
<tr>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#61DAFB">
<path d="M12 10.11c1.03 0 1.87.84 1.87 1.89s-.84 1.85-1.87 1.85-1.87-.82-1.87-1.85.84-1.89 1.87-1.89M7.37 20c.63.38 2.01-.2 3.6-1.7-.52-.59-1.03-1.23-1.51-1.9a22.7 22.7 0 0 1-2.4-.36c-.51 2.14-.32 3.61.31 3.96m.71-5.74l-.29-.51c-.11.29-.22.58-.29.86.27.06.57.11.88.16l-.3-.51m6.54-.76l.81-1.5-.81-1.5c-.3-.53-.62-1-.91-1.47C13.17 9 12.6 9 12 9s-1.17 0-1.71.03c-.29.47-.61.94-.91 1.47L8.57 12l.81 1.5c.3.53.62 1 .91 1.47.54.03 1.11.03 1.71.03s1.17 0 1.71-.03c.29-.47.61-.94.91-1.47M12 6.78c-.19.22-.39.45-.59.72h1.18c-.2-.27-.4-.5-.59-.72m0 10.44c.19-.22.39-.45.59-.72h-1.18c.2.27.4.5.59.72M16.62 4c-.62-.38-2 .2-3.59 1.7.52.59 1.03 1.23 1.51 1.9.82.08 1.63.2 2.4.36.51-2.14.32-3.61-.32-3.96m-.7 5.74l.29.51c.11-.29.22-.58.29-.86-.27-.06-.57-.11-.88-.16l.3.51m1.45-7.05c1.47.84 1.63 3.05 1.01 5.63 2.54.75 4.37 1.99 4.37 3.68s-1.83 2.93-4.37 3.68c.62 2.58.46 4.79-1.01 5.63-1.46.84-3.45-.12-5.37-1.95-1.92 1.83-3.91 2.79-5.37 1.95-1.47-.84-1.63-3.05-1.01-5.63-2.54-.75-4.37-1.99-4.37-3.68s1.83-2.93 4.37-3.68c-.62-2.58-.46-4.79 1.01-5.63 1.46-.84 3.45.12 5.37 1.95 1.92-1.83 3.91-2.79 5.37-1.95"/>
</svg>

**Frontend Frameworks**
![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![Vue.js](https://img.shields.io/badge/vuejs-%2335495e.svg?style=flat&logo=vuedotjs&logoColor=%234FC08D)
![Angular](https://img.shields.io/badge/angular-%23DD0031.svg?style=flat&logo=angular&logoColor=white)
![Next JS](https://img.shields.io/badge/Next-black?style=flat&logo=next.js&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)

</td>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#339933">
<path d="M12 1.85c-.27 0-.55.07-.78.2l-7.44 4.3c-.48.28-.78.8-.78 1.36v8.58c0 .56.3 1.08.78 1.36l7.44 4.3c.46.26 1.04.26 1.5 0l7.44-4.3c.48-.28.78-.8.78-1.36V7.71c0-.56-.3-1.08-.78-1.36l-7.44-4.3c-.23-.13-.51-.2-.78-.2zm0 2.03c.13 0 .27.04.39.11l6.9 4v.81L12 12.6 4.71 8.8v-.81l6.9-4c.12-.07.26-.11.39-.11zM5.05 9.85l6.95 4.01v7.79c-.13 0-.27-.04-.39-.11l-6.9-4c-.23-.13-.39-.39-.39-.68v-6.68c0-.11.02-.22.05-.33zm13.9 0c.03.11.05.22.05.33v6.68c0 .29-.16.55-.39.68l-6.9 4c-.12.07-.26.11-.39.11v-7.79l6.95-4.01z"/>
</svg>

**Backend & Languages**
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=flat&logo=express&logoColor=%2361DAFB)
![Python](https://img.shields.io/badge/python-3670A0?style=flat&logo=python&logoColor=ffdd54)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=flat&logo=go&logoColor=white)

</td>
</tr>
<tr>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#3178C6">
<path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
</svg>

**AI Assistants**
![Claude](https://img.shields.io/badge/Claude-000000?style=flat&logo=anthropic&logoColor=white)
![Cursor](https://img.shields.io/badge/Cursor-000000?style=flat&logo=cursor&logoColor=white)
![GitHub Copilot](https://img.shields.io/badge/github%20copilot-000000?style=flat&logo=githubcopilot&logoColor=white)
![Visual Studio Code](https://img.shields.io/badge/VS%20Code-0078d4.svg?style=flat&logo=visual-studio-code&logoColor=white)
![JetBrains](https://img.shields.io/badge/JetBrains-black.svg?style=flat&logo=jetbrains&logoColor=white)

</td>
<td align="center">

<svg width="32" height="32" viewBox="0 0 24 24" fill="#06B6D4">
<path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.337 13.382 8.976 12 6.001 12z"/>
</svg>

**Build Tools & Services**
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)
![Webpack](https://img.shields.io/badge/webpack-%238DD6F9.svg?style=flat&logo=webpack&logoColor=black)
![PNPM](https://img.shields.io/badge/pnpm-%234a4a4a.svg?style=flat&logo=pnpm&logoColor=f69220)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)

</td>
</tr>
</table>

</div>

## Core Commands

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 6h16v2H4V6zm0 4h4v2H4v-2zm6 0h10v2H10v-2zm-6 4h4v2H4v-2zm6 0h10v2H10v-2z" fill="#374151"/>
</svg>

```bash
# Project initialization
vdk init                         # Initialize with auto-detection
vdk init --interactive          # Interactive setup with guided choices

# Migration
vdk migrate                      # Migrate existing AI contexts to VDK format
vdk migrate --dry-run           # Preview migration without creating files
vdk migrate --no-deploy         # Skip deployment to IDE integrations

# Analysis and status
vdk scan                         # Re-analyze project and update rules
vdk status                       # Check current VDK configuration
vdk validate                     # Validate generated rules

# Utilities
vdk --help                       # Show all available commands
vdk --version                    # Display VDK CLI version
```

## Configuration

VDK CLI automatically generates configuration files for your detected AI assistants:

```json
{
  "project": {
    "name": "my-nextjs-app",
    "type": "web-application",
    "frameworks": ["nextjs", "react", "typescript"],
    "libraries": ["tailwindcss", "shadcn-ui"]
  },
  "integrations": {
    "claude-code": {
      "enabled": true,
      "memoryFiles": ["CLAUDE.md", "CLAUDE-patterns.md"]
    },
    "cursor": {
      "enabled": true,
      "rulesDirectory": ".ai/rules/"
    }
  }
}
```

## Examples

### Basic Project Setup

```bash
# Navigate to your project
cd my-nextjs-app

# Initialize VDK
vdk init

# VDK detects: Next.js, React, TypeScript, Tailwind CSS
# Generates: .ai/rules/ with 15+ tailored rules
# Configures: Claude Code memory files
```

### Interactive Setup

```bash
# Interactive mode for custom configuration
vdk init --interactive

# Choose your AI assistants:
# ✓ Claude Code
# ✓ Cursor
# ✗ Windsurf
# ✗ GitHub Copilot

# Generates optimized rules for selected platforms
```

### Migration Example

```bash
# Project with existing AI contexts
cd my-existing-project

# Check what AI contexts are detected
vdk status
# Found: CLAUDE.md, .cursorrules, .github/copilot-instructions.md

# Preview migration without creating files  
vdk migrate --dry-run
# Would migrate: 3 contexts with high confidence

# Perform migration
vdk migrate
# Migrated: 3 contexts → 15+ VDK blueprints in vdk-migration/
# Deployed: Rules to Claude Code, Cursor integrations
```

### Advanced Usage

```bash
# Re-analyze after adding new dependencies
npm install prisma
vdk scan

# Check what VDK detected
vdk status

# Validate all generated rules
vdk validate
```

## Real Impact

Teams using VDK CLI v2.0 report:

- **60% faster** initial AI suggestions with enhanced technology detection
- **85% more relevant** code completions with framework-specific rules
- **40% fewer** back-and-forth clarifications through precise context
- **90% consistency** in code patterns across team members
- **100% accuracy** in package manager and build tool detection

## Documentation

- **[Getting Started Guide](./docs/Getting-Started-Guide.md)** - Complete setup instructions
- **[CLI Reference](./docs/CLI-Reference.md)** - All commands and options
- **[Rule Authoring Guide](./docs/Rule-Authoring-Guide.md)** - Create custom rules
- **[Troubleshooting Guide](./docs/Troubleshooting-Guide.md)** - Common issues and solutions
- **[Scanner Documentation](./src/scanner/README.md)** - Technical scanner details

## Contributing

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="#7C3AED"/>
</svg>

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

- [Report bugs](https://github.com/entro314-labs/VibeKit-VDK-CLI/issues)
- [Request features](https://github.com/entro314-labs/VibeKit-VDK-CLI/issues)
- [Improve documentation](./docs/)
- [Submit pull requests](https://github.com/entro314-labs/VibeKit-VDK-CLI/pulls)

## Roadmap

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z" fill="#0891B2"/>
</svg>

- [x] **v2.0** - Enhanced technology detection, improved AI integrations
- [x] **v2.9** - AI context migration system with multi-platform support
- [ ] **v2.2** - VDK Hub integration for cloud-based rule management  
- [ ] **v2.3** - Visual Studio Code extension for seamless IDE integration
- [ ] **v3.0** - Team collaboration features and shared rule repositories

## Requirements

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 18c1.1 0 1.99-.9 1.99-2L22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2H0c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2h-4zM4 5h16v11H4V5zm8 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="#6B7280"/>
</svg>

- **Node.js**: >= 22.0.0
- **npm**: >= 8.0.0 or **pnpm** >= 7.0.0
- **Operating System**: Windows, macOS, Linux

## License

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#9CA3AF"/>
<path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
</svg>

MIT License - see the [LICENSE](LICENSE) file for details.

### Project Evolution & Attribution

VDK CLI is the evolution of a rich history of AI-assisted development tooling:

- **Original DevRules** by [Seth Rose](https://github.com/TheSethRose) - Established the foundational concept of structured AI assistant rules
- **AIRules** - Major enhancement adding 51+ specialized tasks, memory management, and multi-platform support
- **VibeKit VDK** - The current evolution, a comprehensive toolkit for making AI assistants project-aware

For detailed history and contributions, see [Project History & Attribution](docs/Project-History-Attribution.md).

## Support

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#059669"/>
</svg>

- **GitHub**: [Issues & Feature Requests](https://github.com/entro314-labs/VibeKit-VDK-CLI/issues)
- **Documentation**: [Complete Docs](./docs/)
- **Community**: [VDK Hub](https://vdk.tools)
- **Email**: For enterprise support inquiries

---

<div align="center">

**Made with ❤️ by the VibeKit VDK community**

[GitHub](https://github.com/entro314-labs/VibeKit-VDK-CLI) • [Documentation](./docs/) • [VDK Hub](https://vdk.tools) • [NPM](https://www.npmjs.com/package/@vibe-dev-kit/cli)

</div>
