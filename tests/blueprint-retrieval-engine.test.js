import { describe, expect, it } from 'vitest';

import { BlueprintRetrievalEngine } from '../src/blueprints/retrieval/BlueprintRetrievalEngine.js';
import { canonicalKindClassifier } from '../src/blueprints/retrieval/CanonicalKindClassifier.js';
import { slugNormalizer } from '../src/blueprints/retrieval/SlugNormalizer.js';
import { specificityClassifier } from '../src/blueprints/retrieval/SpecificityClassifier.js';

describe('retrieval normalization and classification', () => {
  it('normalizes slug and separates provenance suffix', () => {
    const normalized = slugNormalizer.normalize('nextjs-supabase-auth-1a2b3c4d');

    expect(normalized.canonicalName).toBe('nextjs-supabase-auth');
    expect(normalized.provenance.variantSuffix).toBe('1a2b3c4d');
  });

  it('classifies canonical kind from explicit metadata.kind', () => {
    const blueprint = {
      metadata: {
        id: 'react-refactor-skill',
        kind: 'skill',
        tags: ['react'],
      },
    };

    const kind = canonicalKindClassifier.classify(blueprint);
    expect(kind.canonicalKind).toBe('skill');
  });

  it('rejects missing canonical kind', () => {
    const blueprint = {
      metadata: {
        id: 'missing-kind',
      },
    };

    expect(() => canonicalKindClassifier.classify(blueprint)).toThrow(
      'Blueprint missing canonical metadata.kind'
    );
  });

  it('classifies provenance variants as L4', () => {
    const blueprint = {
      metadata: {
        id: 'repo-internal-auth-guidelines-1a2b3c4d',
      },
    };

    const normalized = slugNormalizer.normalizeFromBlueprint(blueprint);
    const layer = specificityClassifier.classify(blueprint, normalized, 'conditional-rule');

    expect(layer.layer).toBe('L4');
  });
});

describe('blueprint retrieval engine', () => {
  const engine = new BlueprintRetrievalEngine();

  const sampleBlueprints = [
    {
      metadata: {
        id: 'security',
        kind: 'project-memory',
        title: 'Security Baseline',
        description: 'General secure coding baseline',
        category: 'core',
        maturity: 'stable',
      },
      valid: true,
      platforms: {
        'claude-code': { compatible: true },
      },
    },
    {
      metadata: {
        id: 'react-hooks',
        kind: 'skill',
        title: 'React Hooks Guide',
        description: 'Hooks and component patterns for React',
        category: 'technology',
        maturity: 'stable',
        tags: ['react'],
      },
      valid: true,
      platforms: {
        'claude-code': { compatible: true },
        cursor: { compatible: true },
      },
    },
    {
      metadata: {
        id: 'nextjs-supabase-auth',
        kind: 'workflow',
        title: 'Next.js + Supabase Auth',
        description: 'Stack-specific auth workflow',
        category: 'stack',
        maturity: 'beta',
        tags: ['nextjs', 'supabase', 'auth'],
      },
      valid: true,
      platforms: {
        'claude-code': { compatible: true },
        cursor: { compatible: true },
        windsurf: { compatible: true },
      },
    },
    {
      metadata: {
        id: 'nextjs-supabase-auth-1a2b3c4d',
        kind: 'workflow',
        title: 'Next.js + Supabase Auth (Variant)',
        description: 'Provenance variant copy',
        category: 'stack',
        maturity: 'beta',
      },
      valid: true,
      platforms: {
        'claude-code': { compatible: true },
      },
    },
  ];

  it('excludes L4 by default and dedupes canonical variants', () => {
    const { results } = engine.search(sampleBlueprints, { limit: 20 });

    const ids = results.map(result => result.metadata.id);
    expect(ids).not.toContain('nextjs-supabase-auth-1a2b3c4d');

    const canonicalEntries = results.filter(
      result => result.retrieval.canonicalName === 'nextjs-supabase-auth'
    );
    expect(canonicalEntries.length).toBe(1);
  });

  it('supports exact match retrieval by canonical id', () => {
    const { results } = engine.search(sampleBlueprints, {
      query: 'nextjs-supabase-auth',
      exactMatch: true,
      includeL4: true,
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].retrieval.canonicalName).toBe('nextjs-supabase-auth');
    expect(results[0].retrieval.exactMatch).toBe(true);
  });

  it('filters by canonical kind and specificity layer', () => {
    const { results } = engine.search(sampleBlueprints, {
      kind: 'project-memory',
      specificity: 'L0',
      limit: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0].metadata.id).toBe('security');
  });
});
