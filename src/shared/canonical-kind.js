export const CANONICAL_KINDS = Object.freeze([
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

const CANONICAL_KIND_SET = new Set(CANONICAL_KINDS);

const KIND_ALIASES = {
  memory: 'project-memory',
  context: 'project-memory',
  main: 'project-memory',
  instructions: 'project-memory',
  'project-context': 'project-memory',
  'project memory': 'project-memory',
  'agents-md': 'project-memory',
  'gemini-md': 'project-memory',
  'copilot-instructions': 'project-memory',
  'copilot-repo': 'project-memory',
  rules: 'conditional-rule',
  rule: 'conditional-rule',
  'cursor-rule': 'conditional-rule',
  'claude-rule': 'conditional-rule',
  'windsurf-rule': 'conditional-rule',
  'copilot-rule': 'conditional-rule',
  skills: 'skill',
  commands: 'command',
  'slash-command': 'command',
  'custom-command': 'command',
  workflows: 'workflow',
  subagent: 'agent',
  subagents: 'agent',
  'sub-agent': 'agent',
  hooks: 'hook',
  mcp: 'mcp-integration',
  'mcp-server': 'mcp-integration',
  'mcp-servers': 'mcp-integration',
  plugins: 'plugin-distribution',
  plugin: 'plugin-distribution',
};

const COMPONENT_TYPE_TO_KIND = {
  main: 'project-memory',
  settings: 'project-memory',
  rule: 'conditional-rule',
  skill: 'skill',
  command: 'command',
  workflow: 'workflow',
  agent: 'agent',
};

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function normalizeCanonicalKind(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;

  if (CANONICAL_KIND_SET.has(normalized)) {
    return normalized;
  }

  return KIND_ALIASES[normalized] || null;
}

export function resolveCanonicalKind({ kind, componentType } = {}) {
  const fromKind = normalizeCanonicalKind(kind);
  if (fromKind) {
    const normalizedKind = normalizeToken(kind);
    const reason = normalizedKind === fromKind ? 'explicit-kind' : 'alias-kind';
    const confidence = reason === 'explicit-kind' ? 1.0 : 0.9;
    return { canonicalKind: fromKind, reason, confidence };
  }

  const normalizedComponentType = normalizeToken(componentType);
  const fromComponentType = COMPONENT_TYPE_TO_KIND[normalizedComponentType] || null;
  if (fromComponentType) {
    return {
      canonicalKind: fromComponentType,
      reason: 'component-type-fallback',
      confidence: 0.75,
    };
  }

  return null;
}
