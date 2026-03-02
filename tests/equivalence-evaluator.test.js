import { describe, expect, it } from 'vitest';

import { EquivalenceEvaluator } from '../src/blueprints/equivalence/EquivalenceEvaluator.js';

describe('EquivalenceEvaluator', () => {
  const evaluator = new EquivalenceEvaluator();

  it('returns lossless when all enabled components are supported and no loss tracked', () => {
    const blueprint = {
      platforms: {
        cursor: {
          components: {
            rules: {
              enabled: true,
              manifests: [{ name: 'typescript-rule', file: 'typescript-rule.mdc' }],
            },
          },
        },
      },
      source: {
        content: 'Use TypeScript strict mode',
      },
    };

    const result = evaluator.evaluateBlueprintForPlatform(blueprint, 'cursor');

    expect(result.outcome).toBe('lossless');
    expect(result.supportedComponents.length).toBe(1);
    expect(result.unsupportedComponents.length).toBe(0);
    expect(result.lossItems.length).toBe(0);
  });

  it('returns lossy when supported deployment still has conversion loss', () => {
    const blueprint = {
      metadata: {
        tools: ['Read'],
      },
      source: {
        content: 'x'.repeat(3500),
      },
      platforms: {
        'github-copilot': {
          components: {
            'repo-level': {
              enabled: true,
              location: '.github/copilot-instructions.md',
            },
          },
        },
      },
    };

    const result = evaluator.evaluateBlueprintForPlatform(blueprint, 'github-copilot');

    expect(result.outcome).toBe('lossy');
    expect(result.lossItems.length).toBeGreaterThan(0);
  });

  it('returns unsupported when no deployable components are supported by target platform', () => {
    const blueprint = {
      platforms: {
        cursor: {
          components: {
            agents: {
              enabled: true,
              manifests: [{ name: 'security-agent', file: 'security-agent.md' }],
            },
          },
        },
      },
      source: {
        content: 'Agent guidance',
      },
    };

    const result = evaluator.evaluateBlueprintForPlatform(blueprint, 'cursor');

    expect(result.outcome).toBe('unsupported');
    expect(result.supportedComponents.length).toBe(0);
    expect(result.unsupportedComponents.length).toBe(1);
  });
});
