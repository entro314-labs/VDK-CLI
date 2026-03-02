const WORKSPACE_SIGNALS = new Set([
  'workspace',
  'team',
  'org',
  'organization',
  'internal',
  'private',
  'company',
  'repo',
  'project',
  'custom',
]);

const TECH_MARKERS = new Set([
  'next',
  'nextjs',
  'react',
  'vue',
  'nuxt',
  'angular',
  'svelte',
  'typescript',
  'javascript',
  'node',
  'nodejs',
  'python',
  'django',
  'flask',
  'fastapi',
  'supabase',
  'postgres',
  'mysql',
  'mongodb',
  'docker',
  'kubernetes',
  'golang',
  'go',
  'rust',
]);

const DOMAIN_MARKERS = new Set([
  'auth',
  'payment',
  'ecommerce',
  'rag',
  'pipeline',
  'security',
  'observability',
  'analytics',
  'testing',
  'performance',
  'ci',
  'cd',
  'monitoring',
]);

function countMatches(tokens, markers) {
  return tokens.reduce((total, token) => total + (markers.has(token) ? 1 : 0), 0);
}

function normalizeLayer(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase();
  if (['L0', 'L1', 'L2', 'L3', 'L4'].includes(raw)) {
    return raw;
  }
  return null;
}

export class SpecificityClassifier {
  classify(blueprint, normalized, canonicalKind) {
    const tokens = normalized?.tokens || [];
    const metadata = blueprint?.metadata || {};

    const explicitLayer =
      normalizeLayer(metadata.specificityLayer) ||
      normalizeLayer(metadata.specificity) ||
      normalizeLayer(metadata.layer) ||
      normalizeLayer(blueprint?.specificityLayer) ||
      normalizeLayer(blueprint?.specificity) ||
      normalizeLayer(blueprint?.layer);

    if (explicitLayer) {
      return {
        layer: explicitLayer,
        confidence: 1.0,
        reason: 'explicit-specificity-metadata',
      };
    }

    if (normalized?.provenance?.variantSuffix || normalized?.provenance?.uuid) {
      return {
        layer: 'L4',
        confidence: 1.0,
        reason: 'provenance-variant-suffix',
      };
    }

    if (normalized?.provenance?.sourceTail) {
      return {
        layer: 'L4',
        confidence: 0.95,
        reason: 'provenance-source-tail',
      };
    }

    const workspaceHits = countMatches(tokens, WORKSPACE_SIGNALS);
    if (workspaceHits > 0 && canonicalKind !== 'project-memory') {
      return {
        layer: 'L3',
        confidence: 0.8,
        reason: 'workspace-token-signals',
      };
    }

    const techHits = countMatches(tokens, TECH_MARKERS);
    const domainHits = countMatches(tokens, DOMAIN_MARKERS);

    if (techHits >= 2 || (techHits >= 1 && domainHits >= 1)) {
      return {
        layer: 'L2',
        confidence: 0.85,
        reason: 'stack-domain-token-signals',
      };
    }

    if (techHits === 1 || metadata.framework || metadata.language || metadata.stack) {
      return {
        layer: 'L1',
        confidence: 0.8,
        reason: 'single-tech-signal',
      };
    }

    return {
      layer: 'L0',
      confidence: 0.75,
      reason: 'foundation-generic-default',
    };
  }
}

export const specificityClassifier = new SpecificityClassifier();
