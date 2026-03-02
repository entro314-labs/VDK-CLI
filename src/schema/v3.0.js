import { z } from 'zod';

const CanonicalKindSchema = z.enum([
  'project-memory',
  'conditional-rule',
  'skill',
  'command',
  'workflow',
  'agent',
  'hook',
  'mcp-integration',
  'plugin-distribution',
]);

// Metadata Schema
const MetadataSchema = z
  .object({
    triggers: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    severity: z.array(z.enum(['Critical', 'High', 'Medium', 'Low'])).optional(),
    audience: z.string().optional(),
    framework: z.string().optional(),
    language: z.string().optional(),
  })
  .passthrough();

// Component Constraints Schema
const ConstraintsSchema = z
  .object({
    maxChars: z.number().optional(),
    fileNaming: z.string().optional(),
    allowedTools: z.array(z.string()).optional(),
  })
  .optional();

// Base Component Schema
const BaseComponentSchema = z.object({
  enabled: z.boolean().default(true),
  location: z.string(),
  constraints: ConstraintsSchema,
});

// Specific Component Schemas
const SingleFileComponentSchema = BaseComponentSchema.extend({
  type: z.enum([
    'claude-main',
    'cursor-main',
    'gemini-main',
    'copilot-repo',
    'copilot-directory',
    'continue-config',
    'aider-config',
    'agents-md',
    'gemini-settings',
  ]),
});

const ManifestItemSchema = z.object({
  name: z.string(),
  file: z.string(),
  paths: z.array(z.string()).optional(), // For Claude
  globs: z.array(z.string()).optional(), // For Cursor/Windsurf
  description: z.string().optional(),
  category: z.string().optional(),
});

const MultiFileComponentSchema = BaseComponentSchema.extend({
  type: z.enum([
    'claude-agent',
    'claude-rule',
    'claude-command',
    'claude-skill',
    'cursor-rule',
    'windsurf-rule',
    'windsurf-workflow',
    'agent-file', // For OpenAI individual agents
  ]),
  manifests: z.array(ManifestItemSchema).optional(),
  format: z.enum(['markdown', 'mdc', 'yaml', 'json']).optional(),
});

// Platform Configurations
const ClaudeConfigSchema = z.object({
  components: z
    .object({
      main: SingleFileComponentSchema.optional(),
      agents: MultiFileComponentSchema.optional(),
      rules: MultiFileComponentSchema.optional(),
      commands: MultiFileComponentSchema.optional(),
      skills: MultiFileComponentSchema.optional(),
    })
    .partial(),
});

const CursorConfigSchema = z.object({
  components: z
    .object({
      main: SingleFileComponentSchema.optional(),
      rules: MultiFileComponentSchema.optional(),
    })
    .partial(),
});

const WindsurfConfigSchema = z.object({
  components: z
    .object({
      rules: MultiFileComponentSchema.optional(),
      workflows: MultiFileComponentSchema.optional(),
    })
    .partial(),
});

const CopilotConfigSchema = z.object({
  components: z
    .object({
      'repo-level': SingleFileComponentSchema.optional(),
      'directory-level': SingleFileComponentSchema.optional(),
    })
    .partial(),
});

const ContinueConfigSchema = z.object({
  components: z
    .object({
      config: SingleFileComponentSchema.optional(),
    })
    .partial(),
});

const AiderConfigSchema = z.object({
  components: z
    .object({
      config: SingleFileComponentSchema.optional(),
    })
    .partial(),
});

const OpenAICodexConfigSchema = z.object({
  components: z
    .object({
      agents: MultiFileComponentSchema.optional(), // AGENTS.md
    })
    .partial(),
});

const GeminiConfigSchema = z.object({
  components: z
    .object({
      main: SingleFileComponentSchema.optional(),
      settings: SingleFileComponentSchema.optional(),
    })
    .partial(),
});

// Main Blueprint Schema v3.0
export const BlueprintSchemaV3 = z.object({
  schemaVersion: z.literal('3.0'),
  kind: CanonicalKindSchema,
  category: z.string().optional(),
  title: z.string(),
  description: z.string(),
  platforms: z
    .object({
      'claude-code': ClaudeConfigSchema.optional(),
      cursor: CursorConfigSchema.optional(),
      windsurf: WindsurfConfigSchema.optional(),
      'github-copilot': CopilotConfigSchema.optional(),
      continue: ContinueConfigSchema.optional(),
      aider: AiderConfigSchema.optional(),
      'openai-codex': OpenAICodexConfigSchema.optional(),
      'gemini-cli': GeminiConfigSchema.optional(),
    })
    .partial(),
  source: z.object({
    content: z.string(),
    format: z.enum(['markdown', 'json', 'yaml', 'toml']),
    hasYAMLFrontmatter: z.boolean().optional(),
  }),
  metadata: MetadataSchema.optional(),
});
