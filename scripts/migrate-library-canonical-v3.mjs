#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const CANONICAL_KINDS = new Set([
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

const SETTINGS_KINDS = new Set(['hook', 'mcp-integration', 'plugin-distribution']);

const PLATFORM_ALIASES = {
  claude: 'claude-code',
  codex: 'openai-codex',
  openai: 'openai-codex',
  gemini: 'gemini-cli',
  copilot: 'github-copilot',
};

const ALLOWED_CATEGORIES = new Set([
  'core',
  'language',
  'technology',
  'stack',
  'task',
  'assistant',
  'tool',
  'project',
  'agent-system',
  'command',
  'skill',
  'workflow',
  'rule',
  'plugin',
]);

const CATEGORY_ALIASES = {
  agents: 'assistant',
  assistants: 'assistant',
  agent: 'assistant',
  commands: 'command',
  command: 'command',
  workflows: 'workflow',
  workflow: 'workflow',
  skills: 'skill',
  skill: 'skill',
  rules: 'rule',
  rule: 'rule',
  technologies: 'technology',
  technology: 'technology',
  languages: 'language',
  language: 'language',
  stacks: 'stack',
  stack: 'stack',
  plugins: 'plugin',
  plugin: 'plugin',
  tools: 'tool',
  tool: 'tool',
  projects: 'project',
  project: 'project',
  'agent-systems': 'agent-system',
  'agent-system': 'agent-system',
  security: 'rule',
  quality: 'command',
  development: 'command',
  analysis: 'command',
};

function parseArgs(argv) {
  const args = {
    apply: false,
    verbose: false,
    libraryPath: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--apply') args.apply = true;
    else if (value === '--verbose') args.verbose = true;
    else if (value === '--library-path') args.libraryPath = argv[i + 1];
  }

  return args;
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeVersion(input) {
  const raw = String(input || '').trim();
  if (!raw) return '1.0.0';

  const stripped = raw.replace(/^[<>~=^\s]+/, '').replace(/[^0-9A-Za-z.+-]/g, '');
  const m = stripped.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
  if (!m) return '1.0.0';
  return `${m[1]}.${m[2]}.${m[3]}`;
}

function normalizePlatformId(id) {
  const key = String(id || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return PLATFORM_ALIASES[key] || key;
}

function normalizeEnum(value, allowed) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : null;
}

function inferCategory(frontmatter, topDir, kind) {
  const explicit = String(frontmatter?.category || '')
    .trim()
    .toLowerCase();
  if (ALLOWED_CATEGORIES.has(explicit)) {
    return explicit;
  }

  if (CATEGORY_ALIASES[explicit]) {
    return CATEGORY_ALIASES[explicit];
  }

  const top = String(topDir || '').toLowerCase();
  if (CATEGORY_ALIASES[top]) {
    return CATEGORY_ALIASES[top];
  }

  if (kind === 'command') return 'command';
  if (kind === 'workflow') return 'workflow';
  if (kind === 'skill') return 'skill';
  if (kind === 'agent') return 'assistant';
  if (kind === 'plugin-distribution') return 'plugin';
  if (kind === 'hook' || kind === 'mcp-integration') return 'tool';
  if (kind === 'project-memory' || kind === 'conditional-rule') return 'rule';

  return 'core';
}

function inferKind(data, relativePath) {
  const explicitKind = String(data?.kind || '')
    .trim()
    .toLowerCase();
  if (CANONICAL_KINDS.has(explicitKind)) {
    return explicitKind;
  }

  const explicitType = String(data?.type || data?.commandType || '')
    .trim()
    .toLowerCase();
  if (explicitType === 'agent') return 'agent';
  if (explicitType === 'workflow') return 'workflow';
  if (explicitType === 'skill') return 'skill';
  if (explicitType.includes('command')) return 'command';

  const tags = Array.isArray(data?.tags) ? data.tags.map(t => String(t).toLowerCase()) : [];
  const idSignals = `${data?.id || ''} ${data?.title || ''} ${data?.name || ''}`.toLowerCase();

  if (tags.includes('plugin') || tags.includes('plugins') || idSignals.includes('plugin')) {
    return 'plugin-distribution';
  }
  if (tags.includes('hook') || tags.includes('hooks') || idSignals.includes('hook')) {
    return 'hook';
  }
  if (tags.includes('mcp') || idSignals.includes('mcp')) {
    return 'mcp-integration';
  }

  const [top] = relativePath.split(path.sep);
  if (top === 'agents') return 'agent';
  if (top === 'commands') return 'command';
  if (top === 'workflows') return 'workflow';
  if (top === 'skills') return 'skill';

  if (top === 'rules') {
    const category = String(data?.category || '').toLowerCase();
    const scope = String(data?.scope || '').toLowerCase();
    const always = data?.always_apply === true || data?.alwaysApply === true;

    if (category === 'core' || category === 'project' || scope === 'system' || always) {
      return 'project-memory';
    }

    return 'conditional-rule';
  }

  throw new Error(`Unable to infer canonical kind for ${relativePath}`);
}

function inferDefaultPlatforms(data, kind) {
  const target = normalizePlatformId(data?.target || data?.platform);
  if (target) {
    return [target];
  }

  if (data?.claudeCode || data?.commandType) {
    return ['claude-code'];
  }

  if (kind === 'agent') return ['claude-code', 'openai-codex'];
  if (kind === 'workflow') return ['windsurf', 'claude-code'];

  return ['claude-code', 'cursor', 'windsurf', 'github-copilot'];
}

function pickGlobs(data, platformConfig) {
  if (Array.isArray(platformConfig?.globs) && platformConfig.globs.length > 0) {
    return platformConfig.globs;
  }

  if (Array.isArray(data?.globs) && data.globs.length > 0) {
    return data.globs;
  }

  return ['**/*'];
}

function pickActivation(platformConfig) {
  const activation = String(platformConfig?.activation || '')
    .trim()
    .toLowerCase();
  if (['auto-attached', 'agent-requested', 'manual', 'always'].includes(activation)) {
    return activation;
  }
  return 'manual';
}

function pickWindsurfMode(platformConfig) {
  const mode = String(platformConfig?.mode || '')
    .trim()
    .toLowerCase();
  if (mode === 'glob' || mode === 'always') {
    return mode;
  }

  if (mode === 'manual') return 'glob';

  const activation = String(platformConfig?.activation || '')
    .trim()
    .toLowerCase();
  if (activation === 'always') return 'always';
  if (activation === 'auto-attached') return 'glob';
  return 'glob';
}

function buildPlatformComponents(platformId, kind, id, title, data, platformConfig) {
  const safeName = slugify(id || title || 'blueprint');
  const key = SETTINGS_KINDS.has(kind)
    ? 'settings'
    : kind === 'project-memory'
      ? 'main'
      : kind === 'command' || kind === 'workflow'
        ? 'commands'
        : kind === 'agent'
          ? 'agents'
          : kind === 'skill'
            ? 'skills'
            : 'rules';

  if (platformId === 'claude-code') {
    if (key === 'main') {
      return {
        main: {
          type: 'claude-main',
          enabled: true,
          location: 'CLAUDE.md',
        },
      };
    }

    if (key === 'agents') {
      return {
        agents: {
          type: 'claude-agent',
          enabled: true,
          location: '.claude/agents/',
          manifests: [{ name: safeName, file: `${safeName}.md` }],
        },
      };
    }

    if (key === 'skills') {
      return {
        skills: {
          type: 'claude-skill',
          enabled: true,
          location: '.claude/skills/',
          manifests: [{ name: safeName, file: `${safeName}.md` }],
        },
      };
    }

    if (key === 'commands') {
      return {
        commands: {
          type: 'claude-command',
          enabled: true,
          location: '.claude/commands/',
          manifests: [{ name: safeName, file: `${safeName}.md` }],
        },
      };
    }

    if (key === 'settings') {
      return {
        settings: {
          type: 'claude-settings',
          enabled: true,
          location: '.claude/settings.json',
        },
      };
    }

    return {
      rules: {
        type: 'claude-rule',
        enabled: true,
        location: '.claude/rules/',
        manifests: [
          { name: safeName, file: `${safeName}.md`, paths: pickGlobs(data, platformConfig) },
        ],
      },
    };
  }

  if (platformId === 'cursor') {
    if (kind === 'project-memory') {
      return {
        main: {
          type: 'cursor-main',
          enabled: true,
          location: '.cursor/rules/main.mdc',
        },
      };
    }

    return {
      rules: {
        type: 'cursor-rule',
        enabled: true,
        location: '.cursor/rules/',
        format: 'mdc',
        manifests: [
          {
            name: safeName,
            file: `${safeName}.mdc`,
            globs: pickGlobs(data, platformConfig),
            activation: pickActivation(platformConfig),
          },
        ],
      },
    };
  }

  if (platformId === 'windsurf') {
    if (kind === 'workflow') {
      return {
        workflows: {
          type: 'windsurf-workflow',
          enabled: true,
          location: '.windsurf/workflows/',
          manifests: [{ name: safeName, file: `${safeName}.yaml`, trigger: ['manual'] }],
        },
      };
    }

    return {
      rules: {
        type: 'windsurf-rule',
        enabled: true,
        location: '.windsurf/rules/',
        manifests: [
          {
            name: safeName,
            file: `${safeName}.md`,
            globs: pickGlobs(data, platformConfig),
            mode: pickWindsurfMode(platformConfig),
          },
        ],
      },
    };
  }

  if (platformId === 'github-copilot') {
    return {
      'repo-level': {
        type: 'copilot-repo',
        enabled: true,
        location: '.github/copilot-instructions.md',
      },
    };
  }

  if (platformId === 'continue') {
    return {
      config: {
        type: 'continue-config',
        enabled: true,
        location: '.continue/config.json',
      },
    };
  }

  if (platformId === 'aider') {
    return {
      config: {
        type: 'aider-config',
        enabled: true,
        location: '.aider.conf.yml',
      },
    };
  }

  if (platformId === 'openai-codex') {
    return {
      agents: {
        type: 'agents-md',
        enabled: true,
        location: 'AGENTS.md',
      },
    };
  }

  if (platformId === 'gemini-cli') {
    if (SETTINGS_KINDS.has(kind)) {
      return {
        settings: {
          type: 'gemini-settings',
          enabled: true,
          location: '.gemini/settings.json',
        },
      };
    }

    return {
      main: {
        type: 'gemini-main',
        enabled: true,
        location: 'GEMINI.md',
      },
    };
  }

  const genericKey = SETTINGS_KINDS.has(kind)
    ? 'settings'
    : kind === 'project-memory'
      ? 'main'
      : 'rules';
  return {
    [genericKey]: {
      enabled: true,
      location:
        genericKey === 'main'
          ? 'README.md'
          : genericKey === 'settings'
            ? '.vdk/settings.json'
            : '.vdk/blueprints/rules/',
      manifests:
        genericKey === 'rules'
          ? [{ name: safeName, file: `${safeName}.md`, globs: pickGlobs(data, platformConfig) }]
          : undefined,
    },
  };
}

function normalizePlatforms(data, kind, id, title) {
  const raw = data?.platforms;
  let candidateMap = {};

  if (Array.isArray(raw)) {
    candidateMap = Object.fromEntries(raw.map(item => [String(item), { compatible: true }]));
  } else if (raw && typeof raw === 'object') {
    candidateMap = raw;
  }

  if (Object.keys(candidateMap).length === 0) {
    candidateMap = Object.fromEntries(
      inferDefaultPlatforms(data, kind).map(platformId => [platformId, { compatible: true }])
    );
  }

  const normalized = {};

  for (const [rawPlatformId, rawPlatformConfig] of Object.entries(candidateMap)) {
    const platformId = normalizePlatformId(rawPlatformId);
    if (!platformId) continue;

    const cfg = rawPlatformConfig && typeof rawPlatformConfig === 'object' ? rawPlatformConfig : {};

    if (cfg.compatible === false || cfg.enabled === false) {
      continue;
    }

    const components = buildPlatformComponents(platformId, kind, id, title, data, cfg);

    normalized[platformId] = {
      compatible: true,
      enabled: true,
      components,
    };
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error(`No canonical platform configs generated for blueprint '${id}'`);
  }

  return normalized;
}

function pruneUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(item => pruneUndefinedDeep(item)).filter(item => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nested]) => [key, pruneUndefinedDeep(nested)])
      .filter(([, nested]) => nested !== undefined);

    return Object.fromEntries(entries);
  }

  return value;
}

function migrateFrontmatter(frontmatter, relativePath) {
  const [topDir] = relativePath.split(path.sep);

  const id = slugify(
    frontmatter.id || frontmatter.name || frontmatter.title || path.basename(relativePath)
  );
  const title = String(frontmatter.title || frontmatter.name || id)
    .trim()
    .replace(/\s+/g, ' ');

  const kind = inferKind(frontmatter, relativePath);
  const descriptionRaw = String(frontmatter.description || '').trim();
  const description =
    descriptionRaw.length >= 10 ? descriptionRaw : `${title} canonical ${kind} blueprint`;

  const migrated = {
    ...frontmatter,
    schemaVersion: '3.0',
    id,
    title,
    description,
    version: normalizeVersion(frontmatter.version),
    kind,
    category: inferCategory(frontmatter, topDir, kind),
    platforms: normalizePlatforms(frontmatter, kind, id, title),
    requires: Array.isArray(frontmatter.requires) ? frontmatter.requires : [],
    suggests: Array.isArray(frontmatter.suggests) ? frontmatter.suggests : [],
    conflicts: Array.isArray(frontmatter.conflicts) ? frontmatter.conflicts : [],
    supersedes: Array.isArray(frontmatter.supersedes) ? frontmatter.supersedes : [],
  };

  const complexity = normalizeEnum(frontmatter.complexity, ['simple', 'medium', 'complex']);
  if (complexity) migrated.complexity = complexity;
  else delete migrated.complexity;

  const scope = normalizeEnum(frontmatter.scope, [
    'file',
    'component',
    'feature',
    'project',
    'system',
  ]);
  if (scope) migrated.scope = scope;
  else delete migrated.scope;

  const audience = normalizeEnum(frontmatter.audience, [
    'developer',
    'architect',
    'team-lead',
    'junior',
    'senior',
    'any',
  ]);
  if (audience) migrated.audience = audience;
  else delete migrated.audience;

  const maturity = normalizeEnum(frontmatter.maturity, [
    'experimental',
    'beta',
    'stable',
    'deprecated',
  ]);
  if (maturity) migrated.maturity = maturity;
  else delete migrated.maturity;

  if (!Array.isArray(migrated.tags)) {
    migrated.tags = [];
  }

  return pruneUndefinedDeep(migrated);
}

async function walkBlueprintFiles(dirPath) {
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.name.endsWith('.md') || entry.name.endsWith('.mdc')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dirPath);
  return files;
}

async function main() {
  const args = parseArgs(process.argv);
  const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const defaultLibraryPath = path.join(workspaceRoot, 'VDK-Blueprints', 'library');
  const libraryPath = path.resolve(args.libraryPath || defaultLibraryPath);

  const files = await walkBlueprintFiles(libraryPath);
  const summary = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
  };

  for (const filePath of files) {
    const relativePath = path.relative(libraryPath, filePath);
    summary.processed += 1;

    try {
      const originalContent = await fs.readFile(filePath, 'utf8');
      const parsed = matter(originalContent);
      const migratedFrontmatter = migrateFrontmatter(parsed.data || {}, relativePath);
      const migratedContent = matter.stringify(parsed.content, migratedFrontmatter);

      if (migratedContent === originalContent) {
        summary.unchanged += 1;
        continue;
      }

      if (args.apply) {
        await fs.writeFile(filePath, migratedContent, 'utf8');
      }

      summary.updated += 1;

      if (args.verbose) {
        console.log(`${args.apply ? 'updated' : 'would-update'}: ${relativePath}`);
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({ file: relativePath, error: error.message });
      console.error(`failed: ${relativePath} -> ${error.message}`);
    }
  }

  console.log('\nCanonical v3 migration summary');
  console.log(`processed: ${summary.processed}`);
  console.log(`${args.apply ? 'updated' : 'would-update'}: ${summary.updated}`);
  console.log(`unchanged: ${summary.unchanged}`);
  console.log(`failed: ${summary.failed}`);

  if (!args.apply) {
    console.log('\nDry run only. Re-run with --apply to write changes.');
  }

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
