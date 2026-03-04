import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCLI } from './helpers/cli-helper.js';

describe('Realistic IDE/AI Scenarios', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdk-realistic-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  async function runInit(projectPath) {
    const fakeHome = path.join(projectPath, '.home');
    await fs.mkdir(fakeHome, { recursive: true });

    return runCLI(['init', '--projectPath', projectPath, '--verbose'], {
      cwd: projectPath,
      timeout: 90000,
      env: {
        HOME: fakeHome,
        USERPROFILE: fakeHome,
      },
    });
  }

  async function createPackageJson(projectPath, packageJson) {
    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  it('regression: init succeeds when output path parent does not exist yet', async () => {
    await createPackageJson(tempDir, {
      name: 'regression-output-path-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
      },
    });

    const result = await runInit(tempDir);

    expect(result.code).toBe(0);

    const configPath = path.join(tempDir, 'vdk.config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(config.project.name).toBeTruthy();
    expect(config.rulesPath).toBe('./.vdk/blueprints/rules');
  });

  it('generates Claude project memory artifacts for a Claude-configured project', async () => {
    await createPackageJson(tempDir, {
      name: 'claude-next-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        typescript: '^5.0.0',
      },
    });

    await fs.mkdir(path.join(tempDir, '.claude'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, '.claude', 'settings.json'),
      JSON.stringify({ allowedTools: ['Read'] }, null, 2)
    );
    await fs.writeFile(
      path.join(tempDir, 'vdk.config.json'),
      JSON.stringify({ ide: 'Claude Code CLI' }, null, 2)
    );

    const result = await runInit(tempDir);
    expect(result.code).toBe(0);

    const claudeMemoryPath = path.join(tempDir, 'CLAUDE.md');
    const claudeMemory = await fs.readFile(claudeMemoryPath, 'utf-8');
    expect(claudeMemory).toContain('Project Overview');
    expect(claudeMemory).toContain(path.basename(tempDir));
  });
});
