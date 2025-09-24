---
id: "your-command-id"                    # Unique identifier (kebab-case, required)
name: "Your Command Name"                # Display name (1-50 chars, required)
description: "Brief description of what this command does for Claude Code"  # 10-200 chars, required
target: "claude-code"                    # Target platform (required)
commandType: "custom-slash"              # slash, custom-slash, mcp, workflow, hook (required)
version: "1.0.0"                         # Semantic version (optional)
scope: "project"                         # user, project, global (default: project)

# === Claude Code Specific Configuration ===
claudeCode:
  slashCommand: "/project:your-command"  # Actual slash command to use
  arguments:
    supports: true                       # Whether command accepts arguments
    placeholder: "$ARGUMENTS"            # Placeholder in command content
    examples: ["src/components", "api/users", "--verbose"]
  fileReferences:
    supports: true                       # Whether command supports @file syntax
    autoInclude: ["CLAUDE.md", "package.json"]  # Files to auto-include
  bashCommands:
    supports: true                       # Whether command executes bash
    commands: ["git status", "npm test"] # Commands to run with !prefix
  mcpIntegration:
    requiredServers: ["git", "postgres"] # Required MCP servers
    optionalServers: ["github"]          # Optional enhancing servers
  memoryFiles: ["CLAUDE.md", "docs/coding-standards.md"]
  hooks:
    preExecution: ["validate-environment"]
    postExecution: ["cleanup-temp-files"]

# === Permissions ===
permissions:
  allowedTools: ["Read", "Write", "Bash(git:*)", "Bash(npm:*)", "mcp__git__*"]
  requiredApproval: false               # Whether manual approval needed

# === Examples ===
examples:
  - usage: "/project:your-command src/components"
    description: "Process all components in src/components directory"
    context: "When refactoring component architecture"
    expectedOutcome: "Updates component files with consistent patterns"
  - usage: "/project:your-command api/users --verbose"
    description: "Process API with detailed output"
    context: "When debugging API issues"
    expectedOutcome: "Detailed analysis and fixes for user API endpoints"

# === Installation ===
installation:
  dependencies: ["git", "@modelcontextprotocol/server-git"]
  setupSteps:
    - "Ensure git is installed and repository is initialized"
    - "Configure MCP git server in ~/.claude.json"
    - "Add command file to .claude/commands/ directory"

# === Metadata ===
category: "development"                  # development, testing, debugging, etc.
tags: ["refactoring", "components", "architecture"]
author: "Your Organization"
lastUpdated: "2025-01-27"
compatibilityNotes: "Requires Claude Code 1.0.38+"
---

# Your Command Name

## Purpose

Clearly explain what this Claude Code command does and when to use it. Include:

- Primary use case and objectives
- Expected outcomes and benefits
- Prerequisites or setup requirements
- How it integrates with Claude Code's workflow

## Claude Code Integration

### Slash Command Usage

This command is accessed via the slash command:

```
/project:your-command [arguments]
```

**Scope**: Project-level command (shared with team via `.claude/commands/`)

### File Reference Support

The command supports Claude Code's `@` file reference syntax:

```
/project:your-command @src/components/Button.tsx
/project:your-command @docs/api-spec.md
```

Auto-included files:

- `@CLAUDE.md` - Project context and conventions
- `@package.json` - Project dependencies and scripts

### Bash Command Integration

The command can execute and include output from bash commands using `!` syntax:

```markdown
Current git status: !`git status`
Recent commits: !`git log --oneline -5`
```

### MCP Server Dependencies

**Required MCP Servers:**

- `git` - For repository operations and history analysis
- `postgres` - For database schema analysis

**Optional MCP Servers:**

- `github` -  PR and issue integration

Setup MCP servers:

```bash
claude mcp add git git-mcp-server
claude mcp add postgres postgres-mcp-server --env POSTGRES_URL="postgresql://..."
```

## Usage Examples

### Basic Usage

```
/project:your-command src/components
```

**Context**: Standard component refactoring workflow
**What it does**:

1. Analyzes component structure in `src/components/`
2. Applies project coding standards from `@CLAUDE.md`
3. Updates imports and exports for consistency
4. Runs validation checks

**Expected Outcome**:

- Components follow established patterns
- Consistent import/export structure
- Updated documentation if needed

### Advanced Usage with Arguments

```
/project:your-command api/users --verbose
```

**Context**: Debugging complex API issues
**What it does**:

1. Deep analysis of user API endpoints
2. Checks database integration via MCP
3. Validates error handling patterns
4. Provides detailed diagnostic output

**Expected Outcome**:

- Comprehensive API health report
- Identified bottlenecks or issues
- Suggested improvements with examples

### Integration with Git Workflow

```
/project:your-command feature/user-auth
```

**Context**: Preparing feature branch for review
**What it does**:

1. Analyzes changes in feature branch: !`git diff main...feature/user-auth`
2. Checks code quality and standards compliance
3. Suggests commit message improvements
4. Prepares PR description template

**Expected Outcome**:

- Clean, review-ready code
- Consistent with project standards
- Ready for team review

## Command Implementation

### File Structure

```
.claude/commands/your-command.md    # This command file
.claude/settings.json               # Project permissions
CLAUDE.md                          # Project context (auto-included)
```

### Permissions Required

```json
{
  "permissions": {
    "allow": [
      "Read(*)",
      "Write(src/**/*)",
      "Bash(git:*)",
      "Bash(npm:*)",
      "mcp__git__*",
      "mcp__postgres__*"
    ]
  }
}
```

### Hook Integration

The command integrates with Claude Code's hook system:

**Pre-execution hooks**:

- `validate-environment` - Ensures git repo and dependencies are ready

**Post-execution hooks**:

- `cleanup-temp-files` - Removes any temporary analysis files

## Step-by-Step Process

### Phase 1: Context Gathering

1. **Load project context** from `@CLAUDE.md`
2. **Analyze target files/directories** specified in arguments
3. **Gather git context**: !`git status` and recent changes
4. **Check MCP server connectivity** for required integrations

### Phase 2: Analysis

1. **Code structure analysis** using Claude Code's Read tool
2. **Pattern detection** against project standards
3. **Dependency analysis** via package.json and imports
4. **Database schema alignment** (if applicable) via MCP

### Phase 3: Implementation

1. **Apply transformations** using Claude Code's Write/Edit tools
2. **Update related files** (imports, exports, documentation)
3. **Validate changes** with available linters/tests
4. **Generate summary** of changes made

### Phase 4: Verification

1. **Run validation checks** via Bash tool if configured
2. **Check git status** for untracked files
3. **Provide commit suggestions** if appropriate
4. **Update project documentation** if needed

## Error Handling

### Common Issues

- **MCP server not available**: Command gracefully degrades without database features
- **Git repository not found**: Operates in single-file mode without version control features
- **Permission denied**: Requests approval for required tools
- **Invalid arguments**: Provides helpful usage examples

### Troubleshooting

```bash
# Verify MCP servers are running
claude /mcp

# Check permissions
claude /permissions

# Test command with minimal arguments
/project:your-command --help
```

## Integration with Claude Code Features

### Memory Management

- Automatically reads `CLAUDE.md` for project context
- Can update project documentation based on changes
- Respects `.claudeignore` patterns

### IDE Integration

- Works with VS Code, Cursor, Windsurf via Claude Code extension
- File changes appear in IDE diff viewer
- Supports IDE's diagnostic sharing

### Team Collaboration

- Command shared via `.claude/commands/` in source control
- Consistent behavior across team members
- Respects project-level permission settings

## Related Commands

- `/project:test` - Run comprehensive test suite after changes
- `/project:review` - Request code review for changes
- `/git:commit` - Create structured commit from changes
- `/mcp__git__create_pr` - Generate pull request from branch

## Version History

### 1.0.0 (2025-01-27)

- Initial implementation
- Basic file processing and validation
- MCP integration for git and database
- Hook system integration

---

**Note**: This command template follows Claude Code's architecture and integrates with its tool system, memory management, MCP servers, and permission framework. Ensure all dependencies are configured before use.
