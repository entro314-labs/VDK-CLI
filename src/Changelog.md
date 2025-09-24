# Changelog

All notable changes to VDK CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-07-30

### 📋 Release Summary

Release latest includes 2 commits (1 docs, 1 feature). Complexity: high. Affected areas: configuration, documentation, other, source, build.

**Business Impact**: minor
**Complexity**: high

### Added

- Complete codebase and project structure for VDK CLI
- 189 new files totaling 40,860 lines including CLI source code (cli.js)
- Installation and release scripts (install.sh, release.sh)
- Comprehensive documentation (README.md, GUIDE.md, ROADMAP.md, VDK_OVERVIEW.md, CONTRIBUTING.md)
- GitHub workflow and templates
- JavaScript CLI entry point with dotenv, commander support
- Package.json with bin entry for 'vdk' command

### Changed

- Updated repository references from 'idominikosgr' to 'entro314-labs' across 154 files
- Added new documentation files: VDK_AI_ASSISTANT_COMPATIBILITY_REPORT.md, VDK_DOCUMENTATION.md
- Updated installation instructions, badges, and URLs to new organization
- Minor dependency version bump for 'dotenv' in pnpm-lock.yaml
- Updated code comments and API URLs in JavaScript source files

### Removed

- Large 'GUIDE.md' file (net reduction of over 20,000 lines)

---

## [Unreleased] - 2025-07-13

### 📋 Release Summary

Release includes 4 new features, 1 bug fix, extensive refactoring

**Business Impact**: major
**Complexity**: high
**Deployment Requirements**: Database migration required

### 🚀 Features

#### CLI Reliability Improvements

- Fixed infinite loop issues in CLI interactions
- Removed conflicting readline interface
- Added detection for non-interactive environments
-  error handling for automated/scripted use cases

#### Template and Setup Standardization

- Refactored handlebar templates for consistency
- Updated references from 'VibeCodingRules' to 'Vibe-Coding-Rules'
- Introduced interactive setup wizard (setup-wizard.js)
- Improved project configuration experience

#### Project Planning and Documentation

- Added detailed ROADMAP.md outlining future development goals
- Updated README to reference roadmap
-  core agent documentation rules for clarity

#### Project Rebranding

- Renamed project from DevRulesPlus to CodePilotRules
- Updated all documentation, scripts, and setup files
- Maintained consistency across codebase

### 🐛 Bug Fixes

- Fixed execution order in installation script
- Ensured dependencies install before CLI execution
- Improved script reliability and error prevention

### ♻️ Code Refactoring

#### Documentation and Repository Cleanup

- Updated .gitignore to exclude additional documentation files
- Streamlined documentation with obsolete scripts removed
- Improved user guides for clarity and accuracy
- Standardized repository references across project files

#### Major Architectural Changes

- **BREAKING CHANGE**: Comprehensive refactor affecting 208 files
- Reduced codebase size and complexity (+2820/-12538 lines)
- Database schema and configuration updates
- Introduced new roadmap and publishing workflow

#### Branding Evolution

- Complete rebranding from 'Vibe Coding Rules' to 'VDK CLI'
- Updated environment variables, configuration, and project metadata
- Added new documentation (CLI Reference, Getting Started)

#### Rule System Enhancements

- Extensive reorganization of configuration and rule files
- Added installation and sync system documentation
- Updated setup wizard and package scripts
- Comprehensive 'Vibe Coding Rules' for AI assistant standardization

#### Initial Foundation

- **BREAKING CHANGE**: Initial project setup with 109 files, 19,000 lines
- Core agent instructions and project context templates
- Language-specific best practices (TypeScript, Python, Swift, Kotlin, C++)
- AI assistant integrations (Cursor, Copilot, Windsurf)
- Model Context Protocol (MCP) servers configuration

### ⚠️ Migration Requirements

- Review database schema changes before deployment
- Update environment variables to new naming conventions
- Follow new INSTALLATION.md and SYNC-SYSTEM.md guides
- Update CI/CD pipelines referencing old project names
- Full regression testing recommended due to scope of changes

### 🎯 Affected Areas

- Database, configuration, documentation, source code, assets, scripts

---

## [2.0.0] - 2025-07-31

### Major Improvements ✨

- ** Technology Detection**: Accurately detects 20+ technology-specific rules including Tailwind CSS, shadcn/ui, Supabase, TypeScript configurations
- **Intelligent Package Manager Detection**: Automatically detects pnpm, yarn, npm, bun based on lock files
- **Advanced Build Tool Recognition**: Detects Turbopack, Vite, Next.js with version-specific features
- **Smart IDE Detection**:  IDE detection without configuration folders, supports VS Code, Cursor, Windsurf, JetBrains, Zed

### New Features 🚀

- **Library-Specific Guidelines**: Dedicated processing for UI libraries like shadcn/ui and Radix UI
- **Comprehensive Rule Coverage**: Increased rule limit from 10 to 20 for better technology coverage
- **Real Script Extraction**: Reads actual npm/pnpm scripts from package.json instead of defaults
- **AI Assistant Integration**: Added AI Assistant field to generated configurations

### Bug Fixes 🐛

- **GitHub Copilot Adapter**: Resolved "Cannot read properties of undefined" errors with optional chaining
- **Rule Matching**: Improved framework and library matching with better aliases and normalization
- **Content Extraction**: shadcn/ui and other library guidelines now properly appear in CLAUDE.md files
- **Error Handling**: Graceful degradation for edge cases and invalid paths

### Technical Improvements 🔧

- **Rule Scoring**:  relevance scoring algorithm with platform-specific filtering
- **Content Processing**: Mobile patterns properly excluded from web projects
- **Template Processing**: Better extraction of actionable guidelines from remote rules
- **Error Recovery**: Continues operation with missing dependencies or invalid configurations

### Added

- Comprehensive MDX documentation system
- Blueprint specifications for all rule formats
- IDE configuration reference guides
- GitHub repository documentation templates

### Changed

- Improved project documentation structure
-  integration guides with practical examples

---

## [1.0.0] - 2024-01-15

### Added

- Initial release of VDK CLI
- Project analysis and pattern detection engine
- Multi-format rule generation (Markdown, MDC, XML, JSON)
- AI assistant integrations:
  - Claude Code with memory management
  - Cursor with MDC format support
  - Windsurf with XML-enhanced rules
  - GitHub Copilot with JSON configuration
  - Generic Markdown format for any AI assistant
- VDK Hub for team collaboration and rule sharing
- Watch mode for continuous project monitoring
- Comprehensive CLI with 20+ commands
- Project templates for popular frameworks
- Rule validation and error checking
- Integration auto-detection and setup
- Configuration management system

### Core Features

- **Project Scanner**: Intelligent analysis of codebase structure, patterns, conventions
- **Rule Generator**: Context-aware rule creation based on project analysis
- **Integration Manager**: Seamless setup and management of AI assistant integrations
- **Hub Client**: Team collaboration through rule sharing and synchronization
- **Watch System**: Real-time monitoring and automatic rule updates
- **Validation Engine**: Comprehensive rule and configuration validation

### Supported Frameworks

- **Frontend**: React, Vue, Angular, Svelte, Next.js, Nuxt.js, SvelteKit
- **Backend**: Node.js, Express, FastAPI, Django, Rails
- **Languages**: TypeScript, JavaScript, Python, Go, Rust
- **Tools**: Tailwind CSS, Prisma, tRPC, GraphQL, Docker

### CLI Commands

- `vdk init` - Initialize VDK in project with intelligent detection
- `vdk scan` - Analyze project and generate rules
- `vdk deploy` - Deploy rules to VDK Hub
- `vdk update` - Update rules from hub
- `vdk status` - Check project and integration status
- `vdk integrations` - Manage AI assistant integrations
- `vdk claude-code` - Claude Code specific management
- `vdk cursor` - Cursor IDE integration management
- `vdk windsurf` - Windsurf IDE integration management
- `vdk config` - Configuration management
- `vdk validate` - Validate rules and setup
- `vdk hub` - Hub collaboration commands
- `vdk watch` - Enable watch mode
- `vdk doctor` - Diagnose and troubleshoot issues
- `vdk clean` - Clean up generated files and caches

### Integration Features

- **Claude Code**: Memory file management, custom commands, watch mode
- **Cursor**: MDC format with directives, auto-completion, rule validation
- **Windsurf**: XML-enhanced rules, multi-agent support, persona routing
- **GitHub Copilot**: JSON configuration, VS Code integration, pattern learning
- **Auto-detection**: Automatic IDE detection and setup suggestions
- **Multi-integration**: Support for multiple AI assistants simultaneously

### Hub Features

- Team creation and management
- Rule sharing and discovery
- Version control and rollback
- Public and private deployments
- Search and filtering
- Analytics and usage insights
- Collaborative rule development

---

## [0.9.0] - 2024-01-01

### Added

- Beta release for early adopters
- Core project analysis engine
- Basic rule generation
- Initial Claude Code integration
- Simple CLI interface

### Changed

- Refactored scanner architecture
- Improved pattern detection algorithms

### Fixed

- Memory leaks in large project scanning
- Rule generation edge cases

---

## [0.8.0] - 2023-12-15

### Added

- Alpha release for testing
- Proof of concept implementation
- Basic framework detection
- Simple rule templates

---

## Known Issues

- Large TypeScript projects (>10k files) may experience slower scanning
- Windows path handling edge cases in monorepo scenarios
- Hub sync conflicts in high-concurrency team environments

---

_Generated using [ai-github-changelog-generator-cli-mcp](https://github.com/entro314-labs/AI-github-changelog-generator-cli-mcp) - AI-powered changelog generation for Git repositories_
