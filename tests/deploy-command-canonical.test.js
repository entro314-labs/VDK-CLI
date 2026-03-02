import { describe, expect, it } from 'vitest';

import { DeployCommand } from '../src/commands/blueprints/DeployCommand.js';

const validBlueprint = {
  schemaVersion: '3.0',
  metadata: {
    id: 'strict-canonical-blueprint',
    title: 'Strict Canonical Blueprint',
    kind: 'conditional-rule',
  },
  platforms: {
    'claude-code': {
      compatible: true,
      components: {
        rules: {
          enabled: true,
          manifests: [{ name: 'strict-canonical-blueprint', file: 'rule.md', content: '# Rule' }],
        },
      },
    },
  },
};

describe('DeployCommand canonical repository enforcement', () => {
  it('accepts canonical v3 blueprint payloads', () => {
    const command = new DeployCommand();
    const result = command.assertCanonicalRepositoryBlueprint(validBlueprint);
    expect(result).toEqual(validBlueprint);
  });

  it('rejects non-v3 payloads', () => {
    const command = new DeployCommand();
    expect(() =>
      command.assertCanonicalRepositoryBlueprint({
        ...validBlueprint,
        schemaVersion: '2.1',
      })
    ).toThrow('Canonical deployment requires schemaVersion 3.0');
  });

  it('rejects payloads without canonical metadata.kind', () => {
    const command = new DeployCommand();
    expect(() =>
      command.assertCanonicalRepositoryBlueprint({
        ...validBlueprint,
        metadata: {
          ...validBlueprint.metadata,
          kind: 'legacy-rule',
        },
      })
    ).toThrow('Canonical deployment requires metadata.kind');
  });

  it('rejects platform entries without components', () => {
    const command = new DeployCommand();
    expect(() =>
      command.assertCanonicalRepositoryBlueprint({
        ...validBlueprint,
        platforms: {
          'claude-code': {
            compatible: true,
          },
        },
      })
    ).toThrow("Canonical deployment requires platform 'claude-code' to define a components object");
  });
});
