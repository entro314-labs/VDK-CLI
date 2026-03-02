import { ClaudeCodeAdapter } from '../src/scanner/core/ClaudeCodeAdapter.js';

// Mock context
const projectContext = {
  name: 'Test Project',
  techStack: {
    frameworks: ['React'],
    languages: ['TypeScript'],
  },
};

// Sample v3.0 Blueprint
const v3Blueprint = {
  schemaVersion: '3.0',
  title: 'Test Blueprint',
  description: 'A test blueprint',
  category: 'Test',
  platforms: {
    'claude-code': {
      components: {
        agents: {
          enabled: true,
          manifests: [
            {
              name: 'security-reviewer',
              file: 'security.md',
              description: 'Checks security',
              tools: ['Grep'],
            },
          ],
        },
        rules: {
          enabled: true,
          manifests: [
            {
              name: 'no-console',
              file: 'no-console.md',
              paths: ['**/*.ts'],
            },
          ],
        },
        skills: {
          enabled: true,
          manifests: [
            {
              name: 'refactor-utils',
              file: 'refactor.md',
              description: 'Refactoring skills',
            },
          ],
        },
      },
    },
  },
};

async function runTest() {
  console.log('🧪 Starting v3.0 Integration Test');

  try {
    const adapter = new ClaudeCodeAdapter({ projectPath: process.cwd() });

    // Test extraction logic via RuleAdapter base
    console.log('Testing adaptFromBlueprint...');
    const result = await adapter.adaptFromBlueprint(v3Blueprint, 'claude-code', {
      overwrite: true,
    });

    console.log(`✅ Success: ${result.success !== false}`);
    console.log(`📂 Generated files: ${result.files.length}`);

    // Checks
    const hasAgent = result.files.some(
      f =>
        f.path.includes('.claude/agents/security.md') && f.content.includes('# security-reviewer')
    );
    const hasRule = result.files.some(f => f.path.includes('.claude/rules/no-console.md'));
    const hasSkill = result.files.some(f => f.path.includes('.claude/skills/refactor.md'));

    console.log(`Agent file generated: ${hasAgent ? 'YES' : 'NO'}`);
    console.log(`Rule file generated: ${hasRule ? 'YES' : 'NO'}`);
    console.log(`Skill file generated: ${hasSkill ? 'YES' : 'NO'}`);

    if (hasAgent && hasRule && hasSkill) {
      console.log('🎉 PASSED: All v3.0 components processed correctly.');
    } else {
      console.error('❌ FAILED: Missing components');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

runTest();
