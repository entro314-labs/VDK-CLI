/**
 * AutoMigrator tests aligned with current migration conventions.
 *
 * Primary staging directory: .vdk/migrate
 * Legacy compatibility: .vdk/import
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutoMigrator } from '../src/migration/AutoMigrator.js';

describe('AutoMigrator (current behavior)', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdk-auto-migrator-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    vi.restoreAllMocks();
  });

  it('uses .vdk/migrate as primary import path', () => {
    const migrator = new AutoMigrator(tempDir);

    expect(migrator.projectPath).toBe(tempDir);
    expect(migrator.importPath).toBe(path.join(tempDir, '.vdk', 'migrate'));
    expect(migrator.legacyImportPath).toBe(path.join(tempDir, '.vdk', 'import'));
  });

  it('detects cursor rules from .vdk/migrate', async () => {
    const migrateDir = path.join(tempDir, '.vdk', 'migrate');
    await fs.mkdir(migrateDir, { recursive: true });
    await fs.writeFile(path.join(migrateDir, '.cursorrules'), 'Use TypeScript\nUse linting\n');
    await fs.writeFile(path.join(migrateDir, 'cursor-react.md'), '# React rules\nUse hooks\n');

    const migrator = new AutoMigrator(tempDir);
    const detected = await migrator.detectImportedRules();

    expect(detected.length).toBeGreaterThan(0);
    expect(detected.some(rule => rule.type === 'cursor')).toBe(true);
    expect(detected.some(rule => rule.originalFile === '.cursorrules')).toBe(true);
  });

  it('falls back to legacy .vdk/import when primary path is absent', async () => {
    const legacyDir = path.join(tempDir, '.vdk', 'import');
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, 'CLAUDE.md'), '# Claude\nProject guidance\n');

    const migrator = new AutoMigrator(tempDir);
    const detected = await migrator.detectImportedRules();

    expect(detected).toHaveLength(1);
    expect(detected[0].type).toBe('claude');
    expect(detected[0].filePath).toContain(path.join('.vdk', 'import'));
  });

  it('aggregates detections from both primary and legacy directories', async () => {
    const migrateDir = path.join(tempDir, '.vdk', 'migrate');
    const legacyDir = path.join(tempDir, '.vdk', 'import');
    await fs.mkdir(migrateDir, { recursive: true });
    await fs.mkdir(legacyDir, { recursive: true });

    await fs.writeFile(path.join(migrateDir, '.cursorrules'), 'Cursor content\n');
    await fs.writeFile(
      path.join(legacyDir, 'copilot-instructions.json'),
      JSON.stringify({ guidelines: ['Use tests'] })
    );

    const migrator = new AutoMigrator(tempDir);
    const detected = await migrator.detectImportedRules();

    expect(detected.some(rule => rule.type === 'cursor')).toBe(true);
    expect(detected.some(rule => rule.type === 'copilot')).toBe(true);
  });

  it('returns no_rules_found when staging directories are empty/missing', async () => {
    const migrator = new AutoMigrator(tempDir);
    const result = await migrator.migrate({ preview: false });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_rules_found');
  });

  it('cleans both .vdk/migrate and legacy .vdk/import directories', async () => {
    const migrateDir = path.join(tempDir, '.vdk', 'migrate');
    const legacyDir = path.join(tempDir, '.vdk', 'import');
    await fs.mkdir(migrateDir, { recursive: true });
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(migrateDir, 'rule.md'), '# rule\n');
    await fs.writeFile(path.join(legacyDir, 'legacy.md'), '# legacy\n');

    const migrator = new AutoMigrator(tempDir);
    await migrator.cleanImportDirectory();

    const migrateExists = await fs
      .access(migrateDir)
      .then(() => true)
      .catch(() => false);
    const legacyExists = await fs
      .access(legacyDir)
      .then(() => true)
      .catch(() => false);

    expect(migrateExists).toBe(false);
    expect(legacyExists).toBe(false);
  });

  it('shows migrate-first instructions and legacy compatibility note', () => {
    const migrator = new AutoMigrator(tempDir);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    migrator.showImportInstructions();

    const text = logSpy.mock.calls.map(([line]) => String(line)).join('\n');
    expect(text).toContain('mkdir -p .vdk/migrate');
    expect(text).toContain('Legacy path .vdk/import/ is still supported');
  });

  it('generates correct preview summary text', () => {
    const migrator = new AutoMigrator(tempDir);
    const summary = migrator.generatePreviewSummary({
      rules: [{}, {}],
      adaptations: ['a', 'b', 'c'],
      platforms: ['claude-code'],
    });

    expect(summary).toBe('Will migrate 2 rule files with 3 adaptations for 1 platform');
  });
});
