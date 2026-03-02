/**
 * CLI Schema Migrate Command Tests
 * Verifies canonical v3 schema migration behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('CLI schema-migrate command', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = path.join(__dirname, 'temp', `schema-migrate-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('shows migration preview in dry-run mode without writing files', async () => {
    await writeBlueprint('.vdk/rules/react-rules.md', {
      id: 'react-rules',
      title: 'React Rules',
      description: 'Rules for React projects',
      version: '2.1.0',
      category: 'technologies',
      platforms: {
        'claude-code': { compatible: true, memory: true },
      },
    });

    const result = await runCliCommand(['schema-migrate', '--input', '.vdk/rules', '--dry-run']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/DRY RUN/i);
    expect(result.stdout).toMatch(/Migration Preview:/);
    expect(result.stdout).toMatch(/Need migration:\s*1/);

    const outputDirExists = await pathExists(path.join(tempDir, '.vdk', 'rules_v3'));
    expect(outputDirExists).toBe(false);
  });

  it('migrates v2 blueprint frontmatter into v3 component architecture', async () => {
    await writeBlueprint('.vdk/rules/react-rules.md', {
      id: 'react-rules',
      title: 'React Rules',
      description: 'Rules for React projects',
      version: '2.1.0',
      category: 'technologies',
      platforms: {
        'claude-code': { compatible: true, memory: true, mcpIntegration: true },
        cursor: { compatible: true, activation: 'auto-attached', globs: ['**/*.tsx'] },
      },
    });

    const outputDir = '.vdk/rules-v3';
    const result = await runCliCommand([
      'schema-migrate',
      '--input',
      '.vdk/rules',
      '--output',
      outputDir,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Processed:\s*1/);
    expect(result.stdout).toMatch(/Migrated:\s*1/);

    const migratedPath = path.join(tempDir, outputDir, 'react-rules.md');
    const migratedContent = await fs.readFile(migratedPath, 'utf8');
    const parsed = matter(migratedContent);

    expect(parsed.data.schemaVersion).toBe('3.0');
    expect(parsed.data.source?.format).toBe('vdk-blueprint-v2');
    expect(parsed.data.platforms?.['claude-code']?.components?.main?.enabled).toBe(true);
    expect(parsed.data.platforms?.cursor?.components?.rules?.manifests?.[0]?.activation).toBe(
      'auto-attached'
    );
  });

  it('skips blueprints already in v3 format by default', async () => {
    await writeBlueprint('.vdk/rules/already-v3.md', {
      schemaVersion: '3.0',
      id: 'already-v3',
      title: 'Already V3',
      description: 'Already migrated',
      version: '1.0.0',
      category: 'core',
      platforms: {
        'claude-code': { compatible: true, memory: true },
      },
    });

    const result = await runCliCommand([
      'schema-migrate',
      '--input',
      '.vdk/rules',
      '--output',
      '.vdk/rules-v3',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Migrated:\s*0/);
    expect(result.stdout).toMatch(/Skipped:\s*1/);
    expect(result.stdout).toMatch(/No blueprints required migration/);
  });

  it('force-migrates blueprints in v3 format when --force is set', async () => {
    await writeBlueprint('.vdk/rules/already-v3.md', {
      schemaVersion: '3.0',
      id: 'already-v3',
      title: 'Already V3',
      description: 'Already migrated',
      version: '1.0.0',
      category: 'core',
      platforms: {
        'claude-code': { compatible: true, memory: true },
      },
    });

    const result = await runCliCommand([
      'schema-migrate',
      '--input',
      '.vdk/rules',
      '--output',
      '.vdk/rules-v3',
      '--force',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Migrated:\s*1/);

    const migratedPath = path.join(tempDir, '.vdk', 'rules-v3', 'already-v3.md');
    expect(await pathExists(migratedPath)).toBe(true);
  });

  it('finds both .md and .mdc files recursively during dry-run analysis', async () => {
    await writeBlueprint('.vdk/rules/root-rule.md', {
      id: 'root-rule',
      title: 'Root Rule',
      description: 'Root markdown rule',
      version: '2.1.0',
      category: 'core',
      platforms: { cursor: { compatible: true } },
    });

    await writeBlueprint('.vdk/rules/nested/cursor-rule.mdc', {
      id: 'cursor-rule',
      title: 'Cursor Rule',
      description: 'Nested cursor rule',
      version: '2.1.0',
      category: 'core',
      platforms: { cursor: { compatible: true, activation: 'manual' } },
    });

    await writeBlueprint('.vdk/rules/node_modules/ignored.md', {
      id: 'ignored',
      title: 'Ignored',
      description: 'Should not be discovered',
      version: '2.1.0',
      category: 'core',
      platforms: { cursor: { compatible: true } },
    });

    const result = await runCliCommand(['schema-migrate', '--input', '.vdk/rules', '--dry-run']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Files found:\s*2/);
    expect(result.stdout).toMatch(/Need migration:\s*2/);
  });

  it('exits with an error for a missing input directory', async () => {
    const result = await runCliCommand(['schema-migrate', '--input', './does-not-exist']);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/Schema migration failed/i);
  });
});

async function writeBlueprint(relativePath, frontmatter, markdown = '# Blueprint\n\nBody content') {
  const fullPath = path.join(process.cwd(), relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const fileContent = matter.stringify(markdown, frontmatter);
  await fs.writeFile(fullPath, fileContent, 'utf8');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCliCommand(args) {
  const cliPath = path.join(__dirname, '..', 'cli.js');

  return new Promise(resolve => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      resolve({
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}
