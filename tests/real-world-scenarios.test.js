import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuleAdapter } from '../src/scanner/core/RuleAdapter.js';

describe('Real-world blueprint deployment scenarios', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdk-real-world-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function createBlueprintFor(platformId, manifestOverrides = {}) {
    return {
      schemaVersion: '3.0',
      title: 'Canonical Stack Blueprint',
      description: 'Blueprint used for cross-platform deployment tests',
      category: 'stack',
      metadata: {
        id: `canonical-${platformId}-blueprint`,
        title: 'Canonical Stack Blueprint',
        kind: 'conditional-rule',
      },
      platforms: {
        [platformId]: {
          compatible: true,
          components: {
            rules: {
              enabled: true,
              manifests: [
                {
                  name: `${platformId}-core-rule`,
                  file: `${platformId}-core-rule.md`,
                  content: '# Rule\nUse strict validation and explicit error handling.',
                  ...manifestOverrides,
                },
              ],
            },
          },
        },
      },
    };
  }

  it('adapts canonical blueprints to Claude Code project memory files', async () => {
    const adapter = new RuleAdapter({ projectPath: tempDir, verbose: false });
    const blueprint = createBlueprintFor('claude-code');

    const result = await adapter.adaptFromBlueprint(blueprint, 'claude-code');

    expect(result.files.length).toBeGreaterThan(0);

    const mainMemory = result.files.find(file => file.path === path.join(tempDir, 'CLAUDE.md'));
    expect(mainMemory).toBeTruthy();
    expect(mainMemory.content).toContain('Technology-Specific Guidelines');
    expect(mainMemory.content).toContain(path.basename(tempDir));
  });

  it('adapts canonical blueprints to Cursor rules in .cursor/rules', async () => {
    const adapter = new RuleAdapter({ projectPath: tempDir, verbose: false });
    const blueprint = createBlueprintFor('cursor', {
      alwaysApply: true,
      globs: ['**/*.ts', '**/*.tsx'],
      description: 'Apply for TypeScript source files',
    });

    const result = await adapter.adaptFromBlueprint(blueprint, 'cursor');

    expect(result.files.length).toBeGreaterThan(0);

    const cursorRule = result.files[0];
    expect(cursorRule.path).toContain(path.join('.cursor', 'rules'));
    expect(path.basename(cursorRule.path)).toMatch(/^always-/);
    expect(cursorRule.content).toContain('---');
  });

  it('adapts canonical blueprints to Windsurf rules and enforces per-file limits', async () => {
    const adapter = new RuleAdapter({ projectPath: tempDir, verbose: false });
    const longRule = `# Very Long Rule\n${'A'.repeat(7000)}`;

    const blueprint = createBlueprintFor('windsurf', {
      content: longRule,
    });

    const result = await adapter.adaptFromBlueprint(blueprint, 'windsurf');

    expect(result.files.length).toBeGreaterThan(0);

    const workspaceRule = result.files.find(file =>
      file.path.includes(path.join('.windsurf', 'rules'))
    );
    expect(workspaceRule).toBeTruthy();
    expect(workspaceRule.characterCount).toBeLessThanOrEqual(6000);
    expect(result.summary.totalCharacters).toBeLessThanOrEqual(12000);
  });

  it('adapts canonical blueprints to GitHub Copilot setup instructions', async () => {
    const adapter = new RuleAdapter({ projectPath: tempDir, verbose: false });
    const blueprint = createBlueprintFor('github-copilot');

    const result = await adapter.adaptFromBlueprint(blueprint, 'github-copilot');

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe(path.join(tempDir, 'GITHUB_COPILOT_SETUP.md'));
    expect(result.files[0].content).toContain('GitHub Copilot Setup Instructions');
    expect(result.summary.requiresManualSetup).toBe(true);
  });
});
