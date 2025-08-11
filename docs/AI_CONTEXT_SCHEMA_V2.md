# AI Context Schema v2.1.0 - VDK CLI Integration

## Overview

VDK CLI has been fully migrated to support the AI Context Schema v2.1.0, providing universal compatibility across 33+ AI coding assistants and platforms. This document outlines the new capabilities and how to use them.

## What's New in Schema v2.1.0

### 1. Universal Platform Support

Blueprints now support detailed configuration for each AI platform:

```yaml
platforms:
  claude:
    compatible: true
    memory: true
    command: true
    priority: 5
    allowedTools: ["Read", "Write", "Edit"]
    mcpIntegration: true
  cursor:
    compatible: true
    activation: "auto-attached"
    globs: ["**/*.js", "**/*.ts"]
    priority: "medium"
  windsurf:
    compatible: true
    mode: "workspace"
    characterLimit: 6000
    priority: 7
  zed:
    compatible: true
    mode: "project"
    aiFeatures: true
```

### 2. Enhanced Metadata

Rich metadata support for better blueprint discovery and management:

```yaml
# Identification and Classification
author: "Your Name"
contributors: ["Contributor 1", "Contributor 2"]
tags: ["javascript", "react", "testing"]
complexity: "medium"         # simple, medium, complex
scope: "project"            # file, component, feature, project, system
audience: "developer"       # developer, architect, team-lead, junior, senior, any
maturity: "stable"          # experimental, beta, stable, deprecated

# Links and Resources
discussionUrl: "https://github.com/your-org/discussions/123"
repositoryUrl: "https://github.com/your-org/blueprints"
license: "MIT"

# Content Organization
contentSections: ["introduction", "implementation", "examples"]
```

### 3. Blueprint Relationships

Define dependencies and conflicts between blueprints:

```yaml
# Dependencies
requires: ["basic-typescript-setup", "jest-configuration"]
suggests: ["eslint-config", "prettier-setup"]

# Conflicts and Replacements
conflicts: ["old-test-setup"]
supersedes: ["legacy-typescript-config"]
```

### 4. Advanced Platform Features

#### Character Limits and Truncation
Automatic content optimization per platform:
- **Windsurf**: 6,000 characters per file
- **GitHub Copilot**: 600 characters per guideline
- **Claude**: Unlimited with memory management

#### File Pattern Matching
Auto-activation based on file patterns:
```yaml
platforms:
  cursor:
    globs: ["**/*.test.js", "**/*.spec.ts"]
    activation: "auto-attached"
```

#### Priority System
Control context priority across platforms:
```yaml
platforms:
  claude:
    priority: 5    # 1-10 scale
  windsurf:
    priority: 8    # Higher priority = more important context
```

## Using the Enhanced CLI Commands

### 1. Create Blueprints with New Schema

#### Interactive Mode
```bash
vdk create --interactive
```

Follow the prompts to create a blueprint with full schema v2.1.0 support.

#### Command Line Mode
```bash
vdk create \
  --name "react-testing-setup" \
  --title "React Testing Configuration" \
  --description "Complete testing setup for React applications" \
  --category "stack" \
  --complexity "medium" \
  --scope "project" \
  --audience "developer" \
  --maturity "stable" \
  --author "Your Name" \
  --tags testing react jest
```

### 2. Validate Blueprint Schema

#### Validate Single File
```bash
vdk validate --file ./blueprints/my-blueprint.mdc --verbose
```

#### Validate Directory
```bash
vdk validate --path ./.ai/rules --check-dependencies --check-platforms
```

#### Schema Compatibility Check
```bash
vdk validate --verbose
```

### 3. Enhanced Project Initialization

The `vdk init` command now leverages the new schema for better platform detection and configuration:

```bash
# Initialize with advanced platform configuration
vdk init --verbose --categories development testing workflow

# Interactive platform selection
vdk init --interactive

# Deep scanning with new schema features
vdk init --deep --ide-integration
```

## Platform-Specific Features

### Claude Code Integration
```yaml
platforms:
  claude:
    compatible: true
    memory: true              # Include in CLAUDE.md memory files
    command: true             # Generate slash commands
    namespace: "project"      # Command namespace: project, user
    priority: 5               # Memory priority 1-10
    allowedTools: ["Read", "Write", "Edit", "Bash"]
    mcpIntegration: true      # Enable MCP server configuration
```

### Cursor Integration
```yaml
platforms:
  cursor:
    compatible: true
    activation: "auto-attached"    # auto-attached, agent-requested, manual, always
    globs: ["**/*.js", "**/*.ts"]  # File patterns for auto-activation
    priority: "medium"             # high, medium, low
    fileTypes: ["javascript", "typescript"]
```

### Windsurf Integration
```yaml
platforms:
  windsurf:
    compatible: true
    mode: "workspace"         # global, workspace
    xmlTag: "react-setup"     # XML tag for formatting
    characterLimit: 6000      # Character limit (0-10000)
    priority: 7               # Context priority 1-10
```

### GitHub Copilot Integration
```yaml
platforms:
  githubCopilot:
    compatible: true
    guidelineStyle: "concise"     # concise, detailed
    priority: 8                   # Priority 1-10
    maxGuidelines: 5              # Maximum number of guidelines
```

## Migration from Legacy Format

### Automatic Detection
VDK CLI automatically detects and offers to migrate legacy formats:

```bash
vdk migrate --dry-run    # Preview migration changes
vdk migrate              # Perform migration
```

### Manual Schema Updates
For existing blueprints, add the new required fields:

```yaml
# Add to existing blueprint frontmatter
complexity: "medium"
scope: "project" 
audience: "developer"
maturity: "stable"
platforms:
  claude: { compatible: true }
  cursor: { compatible: true }
  windsurf: { compatible: true }
```

## Validation and Quality Assurance

### Schema Validation
All blueprints are validated against the official AI Context Schema v2.1.0:

- **Metadata validation**: Required fields, format checking
- **Platform compatibility**: Ensure platform configurations are valid
- **Relationship validation**: Check dependencies and conflicts
- **Content validation**: Verify blueprint structure and content

### Best Practices

1. **Use Descriptive Metadata**
   ```yaml
   tags: ["specific", "searchable", "keywords"]
   complexity: "medium"  # Be realistic about complexity
   audience: "developer" # Target your audience
   ```

2. **Configure Platform-Specific Settings**
   ```yaml
   platforms:
     cursor:
       globs: ["**/*.{test,spec}.{js,ts}"]  # Specific file patterns
       activation: "auto-attached"          # Appropriate activation mode
   ```

3. **Manage Dependencies**
   ```yaml
   requires: ["typescript-config"]  # Essential dependencies only
   suggests: ["eslint-prettier"]    # Nice-to-have enhancements
   ```

4. **Version Management**
   ```yaml
   version: "1.0.0"         # Semantic versioning
   lastUpdated: "2025-01-15" # Keep dates current
   ```

## Troubleshooting

### Common Validation Errors

1. **Date Format Issues**
   ```yaml
   # ❌ Wrong
   created: "2025-01-15T10:30:00Z"
   
   # ✅ Correct
   created: "2025-01-15"
   ```

2. **Tag Format Issues**
   ```yaml
   # ❌ Wrong
   tags: ["React", "Testing_Setup"]
   
   # ✅ Correct  
   tags: ["react", "testing-setup"]
   ```

3. **Platform Configuration Issues**
   ```yaml
   # ❌ Wrong
   platforms:
     cursor:
       priority: "very-high"
   
   # ✅ Correct
   platforms:
     cursor:
       priority: "high"
   ```

### Getting Help

- Run `vdk validate --verbose` to see detailed error messages
- Check the TODO-MIGRATION-GAPS.md file for known limitations
- Use `vdk create --interactive` for guided blueprint creation

## Future Enhancements

The following features are planned for future releases:

1. **Dependency Resolution**: Automatic blueprint dependency management
2. **Platform Configuration Flow**: Extract platform configs from frontmatter during rule generation
3. **Advanced Validation**: Cross-reference validation with VDK-Blueprints repository
4. **Blueprint Marketplace**: Enhanced discovery and sharing capabilities

---

*For more information, see the [VDK CLI Documentation](../README.md) and the [AI Context Schema Specification](https://ai-context-schema.org/)*