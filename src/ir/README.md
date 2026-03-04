# VDK Intermediate Representation (IR) System

## Overview

The VDK IR system provides a unified, platform-agnostic representation of AI context components that enables semantic preservation during cross-platform conversion.

```
Source Platform → IR (Universal) → Target Platform(s)
```

## Architecture

```
VDK-CLI/src/ir/
├── types.js                  # Core IR type definitions and validation
├── index.js                  # Platform parsers (Claude, Cursor, Copilot, Windsurf)
├── generators.js             # Platform generators
├── converters-extended.js    # Extended platform support (7 additional platforms)
├── file-resolver.js          # File reference resolution system
├── performance.js            # Performance optimizations (caching, large files)
└── README.md                 # This file
```

## Supported Platforms

### Base Platforms (index.js + generators.js)

- **Claude Code** - Full support (.claude/, CLAUDE.md, agents, rules, commands, skills)
- **Cursor** - MDC format in `.cursor/rules/*.mdc`, glob patterns, activation modes
- **GitHub Copilot** - 3000 char limit with smart truncation
- **Windsurf** - Rules and workflows

### Extended Platforms (converters-extended.js)

- **OpenAI AGENTS.md** - Natural language agent definitions
- **Continue.dev** - config.yaml with slash commands
- **Aider** - .aider.conf.yml configuration
- **Gemini CLI** - GEMINI.md format
- **Zed Editor** - settings.json
- **Tabnine** - Guidelines format
- **JetBrains** - .aiignore patterns

## Core Concepts

### IntermediateRepresentation (IR)

The universal representation of an AI context component:

```javascript
{
  id: 'ir_1234567890_abc123',        // Unique identifier
  type: 'agent',                     // agent|rule|command|skill|workflow|main|settings
  name: 'security-reviewer',         // Component name
  description: 'Security code review agent',

  content: {                         // Parsed content structure
    raw: '...',                      // Original content
    format: 'markdown',              // Content format
    sections: [...],                 // Hierarchical sections
    frontmatter: {...},              // YAML frontmatter
    hasFrontmatter: true
  },

  triggers: ['security', 'crypto'],  // Activation triggers
  tools: [{name: 'Read'}, ...],      // Required tools
  model: 'claude-3-5-sonnet',        // Preferred model

  conditionalRules: {                // Activation conditions
    globs: ['src/auth/**'],
    activation: 'path-based'
  },

  fileReferences: [                  // @path references
    {path: 'docs/security.md', type: 'include'}
  ],

  tags: ['security', 'audit'],       // Categorization
  category: 'security',              // Primary category
  complexity: 'intermediate',        // basic|intermediate|advanced

  platformSpecific: {                // Platform-specific preserved data
    'claude-code': {...},
    'cursor': {...}
  },

  conversionMetadata: {              // Conversion tracking
    sourcePlatform: 'claude-code',
    targetPlatform: 'cursor',
    sourceFile: '.claude/agents/security-reviewer.md',
    convertedAt: '2025-12-27T...',
    vdkVersion: '3.0.0',
    lossInfo: [],                    // What was lost in conversion
    semanticScore: 95                // 0-100 preservation score
  }
}
```

### IRBundle

Collection of related IR components (e.g., full project context):

```javascript
{
  id: 'bundle_1234567890_xyz',
  name: 'my-project',
  description: 'Project AI context',
  components: [ir1, ir2, ir3, ...],  // Array of IntermediateRepresentation
  projectContext: {                   // Project metadata
    framework: 'Next.js',
    language: 'TypeScript'
  },
  metadata: {...}                     // Bundle-level conversion metadata
}
```

## Usage Examples

### Basic Conversion

```javascript
import { claudeToIR, irToCursor } from './ir/index.js';
import { irToClaude } from './ir/generators.js';

// Read source file
const content = fs.readFileSync('.claude/agents/security-reviewer.md', 'utf8');

// Convert to IR
const ir = claudeToIR({
  content,
  filePath: '.claude/agents/security-reviewer.md',
});

// Generate for target platform
const { content: cursorContent, filePath, lossInfo } = irToCursor(ir);

// Write output
fs.writeFileSync(filePath, cursorContent);

// Check for conversion losses
if (lossInfo.length > 0) {
  console.log('Conversion losses:', lossInfo);
}
```

### Multi-Platform Generation

```javascript
import { irToMultiplePlatforms } from './ir/generators.js';

const results = irToMultiplePlatforms(ir, ['cursor', 'github-copilot', 'windsurf']);

for (const [platform, { content, filePath, lossInfo }] of Object.entries(results)) {
  console.log(`${platform}: ${filePath}`);
  fs.writeFileSync(filePath, content);
}
```

### File Reference Resolution

```javascript
import { resolveIRReferences, inlineIRReferences } from './ir/file-resolver.js';

// Validate file references
const validation = resolveIRReferences(ir, {
  baseDir: process.cwd(),
  inlineContent: false,
});

console.log(`Resolved: ${validation.resolved.length}`);
console.log(`Errors: ${validation.errors.length}`);

// Inline file references
const inlinedIR = inlineIRReferences(ir, {
  baseDir: process.cwd(),
  maxDepth: 3,
});
```

### Performance Optimization

```javascript
import { cachedParseFile, batchProcess } from './ir/performance.js';

// Use cached parsing
const ir = cachedParseFile('.claude/agents/security-reviewer.md', (content, filePath) => {
  return claudeToIR({ content, filePath });
});

// Batch process multiple files
const files = [
  /* array of file paths */
];
const results = await batchProcess(
  files,
  async filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    return claudeToIR({ content, filePath });
  },
  {
    concurrency: 5,
    onProgress: (current, total) => console.log(`${current}/${total}`),
  }
);
```

### Extended Platform Conversion

```javascript
import { agentsToIR, irToAgents } from './ir/converters-extended.js';

// Convert AGENTS.md to IR
const content = fs.readFileSync('AGENTS.md', 'utf8');
const agentIRs = agentsToIR({ content, filePath: 'AGENTS.md' });

console.log(`Found ${agentIRs.length} agents`);

// Convert IRs back to AGENTS.md
const { content: agentsContent } = irToAgents(agentIRs);
fs.writeFileSync('AGENTS-GENERATED.md', agentsContent);
```

## Semantic Preservation

The IR system tracks semantic preservation during conversion:

### Semantic Score (0-100)

Calculated based on:

- **Content preservation** (30 points) - How much content was preserved
- **Triggers preservation** (10 points) - Activation triggers maintained
- **Tools preservation** (10 points) - Required tools maintained
- **File references** (5 points) - @path references preserved
- **Conditional rules** (15 points) - Glob patterns and activation modes
- **Type preservation** (20 points) - Component type not changed

### Conversion Loss Tracking

Every conversion tracks what was lost and why:

```javascript
const { lossInfo } = irToCopilot(ir);

// Example loss info:
[
  {
    field: 'type',
    reason: 'GitHub Copilot does not support agents',
    originalValue: 'agent',
    suggestion: 'Converted to rule with agent-like behavior',
  },
  {
    field: 'content',
    reason: 'GitHub Copilot has 3000 character limit',
    originalValue: '5432 characters',
    suggestion: 'Content truncated with priority preservation',
  },
];
```

## Platform-Specific Features

### Claude Code

- ✅ Full component support (agents, rules, commands, skills, settings)
- ✅ File references with @path syntax
- ✅ YAML frontmatter
- ✅ Tool restrictions
- ✅ Model selection per component

### Cursor

- ✅ MDC (Markdown Component) format
- ✅ Glob patterns for auto-attachment
- ✅ Activation modes: always, auto-attached, agent-requested, manual
- ✅ `.cursor/rules/*.mdc`
- ❌ No agents
- ❌ No settings

### GitHub Copilot

- ✅ Single file: .github/copilot-instructions.md
- ✅ Smart truncation for 3000 char limit
- ✅ Priority-based section preservation
- ❌ No agents, commands, or skills
- ❌ No YAML frontmatter

### Windsurf

- ✅ Rules with frontmatter
- ✅ Workflow definitions
- ✅ Trigger patterns
- ❌ No skills

### OpenAI AGENTS.md

- ✅ Natural language agent definitions
- ✅ Role, Expertise, Responsibilities, Tools sections
- ✅ Bi-directional conversion (AGENTS.md ↔ IR ↔ Claude agents)

### Continue.dev

- ✅ config.yaml with slash commands
- ✅ MCP server configuration
- ✅ Context providers
- ✅ Bidirectional conversion

### Other Platforms

- **Aider**: YAML configuration
- **Gemini CLI**: GEMINI.md format with imports
- **Zed**: settings.json
- **Tabnine**: Guideline markdown
- **JetBrains**: .aiignore patterns

## File Reference Resolution

The IR system can resolve and inline file references:

### Syntax Support

- **Claude**: `@path/to/file.md`
- **MDC**: `{{ path/to/file.md }}`

### Features

- Relative and absolute path resolution
- Circular reference detection
- Recursion depth limits (default: 5)
- Missing file warnings
- Content inlining
- Nested reference tracking

### Resolution Options

```javascript
const options = {
  baseDir: process.cwd(), // Base directory for relative paths
  maxDepth: 5, // Maximum recursion depth
  followReferences: true, // Follow nested references
  inlineContent: false, // Inline file content vs. just validate
  visited: new Set(), // Internal cycle detection
};
```

## Performance Features

### LRU Caching

- Caches parsed content by file hash
- Caches file stats (hash, mtime, size)
- 100-item content cache, 500-item stats cache
- Cache hit/miss tracking

### Large File Handling

- Streaming for files >10MB
- Chunked parsing for files >512KB
- Memory usage monitoring
- Automatic large file detection

### Batch Processing

- Concurrent file processing (default: 5 concurrent)
- Progress tracking
- Error handling per file
- Memory-efficient processing

### Memory Management

- Heap usage tracking
- Memory limit checking
- Cache pruning
- Performance monitoring

## Validation

### IR Validation

```javascript
import { validateIR, validateIRBundle } from './ir/types.js';

const validation = validateIR(ir);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### File Reference Validation

```javascript
import { validateIRReferences, getReferencesReport } from './ir/file-resolver.js';

const report = getReferencesReport(ir, process.cwd());

console.log(`Total references: ${report.totalReferences}`);
console.log(`Resolved: ${report.resolved}`);
console.log(`Missing: ${report.missing}`);
console.log(`Circular: ${report.circular}`);
```

## Round-Trip Conversion

Test semantic preservation with round-trip conversion:

```javascript
// Claude → Cursor → Claude
const originalIR = claudeToIR({ content, filePath });
const { content: cursorContent } = irToCursor(originalIR);
const cursorIR = cursorToIR({ content: cursorContent, filePath: '.cursor/rules/test.mdc' });
const { content: backToClaude } = irToClaude(cursorIR);

// Compare semantic score
const score = calculateSemanticScore(originalIR, cursorIR);
console.log(`Round-trip semantic preservation: ${score}%`);
```

## Best Practices

1. **Always use caching** for repeated conversions
2. **Check file sizes** before processing large files
3. **Validate IR** after parsing
4. **Track conversion losses** and report to users
5. **Use batch processing** for multiple files
6. **Monitor memory usage** for large projects
7. **Resolve file references** before generating output
8. **Test round-trip conversions** for accuracy

## Performance Benchmarks

Target performance metrics:

- **Single file conversion**: <1s
- **Full project import**: <10s
- **Memory usage**: <100MB
- **Semantic preservation**: >95%
- **Cache hit rate**: >60% for repeated operations

## Error Handling

All conversion functions return structured results:

```javascript
{
  content: string,      // Generated content
  filePath: string,     // Suggested file path
  lossInfo: Array,      // What was lost
  truncated: boolean,   // Whether content was truncated (Copilot)
  warnings: Array,      // Non-critical issues
  errors: Array         // Critical issues
}
```

## Future Enhancements

- [ ] VS Code workspace settings integration
- [ ] JetBrains IDE settings XML parsing
- [ ] AI studio configuration formats
- [ ] Custom platform plugin system
- [ ] Visual diff tool for conversion comparison
- [ ] Automated round-trip testing suite

## License

Part of the VDK Ecosystem - MIT License
