/**
 * Platform resolution helpers
 * --------------------------
 * Normalizes platform ids and resolves compatible/fallback platform configs
 * from canonical blueprint platform maps.
 */

const PLATFORM_ALIASES = {
  // Claude family
  'claude-code-cli': 'claude-code',
  'claude-code-extension': 'claude-code',
  'claude-desktop-app': 'claude-desktop',

  // VS Code family
  'vs-code': 'vscode',
  'vs-code-insiders': 'vscode-insiders',
  'code-insiders': 'vscode-insiders',
  'vscode-insider': 'vscode-insiders',

  // Codex / AGENTS family
  codex: 'openai-codex',
  'openai-codex-cli': 'openai-codex',
  'openai-codex-app': 'openai-codex',

  // Windsurf family
  'windsurf-extension': 'windsurf-next',

  // Gemini family
  gemini: 'gemini-cli',
  'gemini-extension': 'gemini-cli',
  'gemini-ide': 'gemini-cli',
  'google-antigravity-ide': 'google-antigravity',

  // OpenCode family
  'opencode-desktop': 'opencode',
  'opencode-extension': 'opencode',

  // Cursor family
  'cursor-extension': 'cursor',
  'cursor-next': 'cursor',

  // Copilot aliases
  copilot: 'github-copilot',
  'github-copilot-chat': 'github-copilot',

  // ACP standard aliases
  'agent-client-protocol': 'acp',
  'zed-acp': 'acp',
  'acp-protocol': 'acp',
  'acp-standard': 'acp',
};

const PLATFORM_FAMILIES = {
  // Copilot ecosystem (VS Code variants)
  vscode: ['vscode', 'github-copilot'],
  'vscode-insiders': ['vscode-insiders', 'github-copilot', 'vscode'],
  vscodium: ['vscodium', 'github-copilot', 'vscode'],

  // Codex / AGENTS ecosystem
  'openai-codex': [
    'openai-codex',
    'opencode',
    'goose',
    'kimi-cli',
    'generic-ai',
    'claude-code',
    'cursor',
    'windsurf',
  ],

  // Claude ecosystem
  'claude-code': ['claude-code', 'claude-desktop', 'openai-codex'],
  'claude-desktop': ['claude-desktop', 'claude-code'],

  // Windsurf ecosystem
  windsurf: ['windsurf', 'windsurf-next'],
  'windsurf-next': ['windsurf-next', 'windsurf'],

  // Gemini ecosystem
  'gemini-cli': ['gemini-cli', 'google-antigravity', 'vscode', 'github-copilot', 'generic-ai'],
  'google-antigravity': ['google-antigravity', 'gemini-cli', 'vscode', 'github-copilot'],

  // OpenCode ecosystem
  opencode: ['opencode', 'openai-codex', 'generic-ai'],

  // AGENTS-compatible ecosystems
  goose: ['goose', 'openai-codex', 'generic-ai'],
  'kimi-cli': ['kimi-cli', 'openai-codex', 'generic-ai'],
  cline: ['cline', 'openai-codex', 'cursor', 'claude-code', 'generic-ai'],
  'roo-code': ['roo-code', 'openai-codex', 'cursor', 'generic-ai'],
  junie: ['junie', 'openai-codex', 'generic-ai'],
  trae: ['trae', 'openai-codex', 'generic-ai'],

  // ACP (agent protocol) bridging
  acp: ['acp', 'zed', 'openai-codex', 'generic-ai'],
  zed: ['zed', 'acp', 'openai-codex'],
};

/**
 * Normalize a platform id for matching.
 * @param {string} platformId
 * @returns {string}
 */
export function normalizePlatformId(platformId) {
  return String(platformId || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Resolve candidate platform ids for fallback lookup.
 * @param {string} requestedPlatform
 * @returns {string[]}
 */
export function resolvePlatformCandidates(requestedPlatform) {
  const normalizedRequested = normalizePlatformId(requestedPlatform);
  const canonicalPlatform = PLATFORM_ALIASES[normalizedRequested] || normalizedRequested;

  const family =
    PLATFORM_FAMILIES[canonicalPlatform] || PLATFORM_FAMILIES[normalizedRequested] || [];

  const candidates = [normalizedRequested, canonicalPlatform, ...family].map(normalizePlatformId);
  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Resolve a platform config from blueprint.platforms with alias/family fallback.
 * @param {object} blueprint
 * @param {string} requestedPlatform
 * @returns {{
 *   requestedPlatform: string,
 *   matchedPlatform: string | null,
 *   matchedPlatformKey: string | null,
 *   matchedViaAlias: boolean,
 *   candidates: string[],
 *   platformConfig: object | null,
 * }}
 */
export function resolveBlueprintPlatformConfig(blueprint, requestedPlatform) {
  const normalizedRequested = normalizePlatformId(requestedPlatform);
  const candidates = resolvePlatformCandidates(normalizedRequested);
  const platformEntries = Object.entries(blueprint?.platforms || {});

  const normalizedPlatformMap = new Map(
    platformEntries.map(([platformId, platformConfig]) => [
      normalizePlatformId(platformId),
      { platformId, platformConfig },
    ])
  );

  for (const candidate of candidates) {
    const match = normalizedPlatformMap.get(candidate);

    if (!match) {
      continue;
    }

    return {
      requestedPlatform: normalizedRequested,
      matchedPlatform: candidate,
      matchedPlatformKey: match.platformId,
      matchedViaAlias: candidate !== normalizedRequested,
      candidates,
      platformConfig: match.platformConfig,
    };
  }

  return {
    requestedPlatform: normalizedRequested,
    matchedPlatform: null,
    matchedPlatformKey: null,
    matchedViaAlias: false,
    candidates,
    platformConfig: null,
  };
}
