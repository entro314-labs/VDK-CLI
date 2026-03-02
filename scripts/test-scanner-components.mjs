import fs from 'fs-extra';
import path from 'node:path';
import { ProjectScanner } from './src/scanner/core/ProjectScanner.js';

async function testComponentScanning() {
  const testDir = path.resolve('test-components');

  try {
    // Setup test environment
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, '.claude/agents'));
    await fs.ensureDir(path.join(testDir, '.cursor/rules'));

    // Create dummy components
    await fs.writeFile(path.join(testDir, '.claude/agents/reviewer.md'), 'Agent content');
    await fs.writeFile(path.join(testDir, '.cursor/rules/typescript.mdc'), 'Rule content');

    console.log('Created test environment with dummy components.');

    // Run scanner
    const scanner = new ProjectScanner({
      projectPath: testDir,
      verbose: true,
    });

    const result = await scanner.scanProject(testDir);

    // Verify results
    console.log('Detected Components:', JSON.stringify(result.components, null, 2));

    const agentCount = result.components?.agents?.length || 0;
    const ruleCount = result.components?.rules?.length || 0;

    if (agentCount !== 1) throw new Error(`Expected 1 agent, found ${agentCount}`);
    if (ruleCount !== 1) throw new Error(`Expected 1 rule, found ${ruleCount}`);

    console.log('SUCCESS: Components correctly detected.');
  } catch (e) {
    console.error('FAILURE:', e);
  } finally {
    // Cleanup
    await fs.remove(testDir);
  }
}

testComponentScanning();
