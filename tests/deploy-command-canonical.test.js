import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/integrations/index.js', () => ({
  createIntegrationManager: vi.fn(),
}));

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

  it('resolves deterministic match by metadata.id/canonicalName', () => {
    const command = new DeployCommand();
    const options = [
      {
        metadata: { id: 'nextjs-supabase-auth', title: 'Nextjs Supabase Auth' },
        retrieval: { canonicalName: 'nextjs-supabase-auth' },
      },
      {
        metadata: { id: 'nextjs-supabase', title: 'Nextjs Supabase' },
        retrieval: { canonicalName: 'nextjs-supabase' },
      },
    ];

    const selected = command.resolveDeterministicRepositoryMatch(options, 'nextjs-supabase-auth');
    expect(selected?.metadata?.id).toBe('nextjs-supabase-auth');
  });

  it('rejects ambiguous matches when deterministic id resolution is impossible', () => {
    const command = new DeployCommand();
    const options = [
      {
        metadata: { id: 'one', title: 'Shared Title' },
        retrieval: { canonicalName: 'canonical-one' },
      },
      {
        metadata: { id: 'two', title: 'Shared Title' },
        retrieval: { canonicalName: 'canonical-two' },
      },
    ];

    expect(() => command.resolveDeterministicRepositoryMatch(options, 'shared title')).toThrow(
      'Unable to deterministically resolve'
    );
  });

  it('scans integrations before resolving active deployment targets', async () => {
    const command = new DeployCommand();
    const mockIntegrationManager = {
      discoverIntegrations: vi.fn().mockResolvedValue(undefined),
      scanAll: vi.fn().mockResolvedValue(undefined),
      getActiveIntegrations: vi.fn().mockReturnValue([]),
    };

    const { createIntegrationManager } = await import('../src/integrations/index.js');
    createIntegrationManager.mockReturnValue(mockIntegrationManager);

    const result = await command.executeV3Deployment(validBlueprint, {
      projectPath: '/tmp/vdk-canonical-test',
      verbose: false,
    });

    expect(mockIntegrationManager.discoverIntegrations).toHaveBeenCalledTimes(1);
    expect(mockIntegrationManager.scanAll).toHaveBeenCalledTimes(1);
    expect(mockIntegrationManager.getActiveIntegrations).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: false, platforms: [] });
  });
});
