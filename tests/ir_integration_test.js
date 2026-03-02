import { RuleAdapter } from '../src/scanner/core/RuleAdapter.js';
import assert from 'node:assert';

async function testWindsurfAdaptation() {
  console.log('Testing RuleAdapter.adaptForWindsurf...');

  const adapter = new RuleAdapter();
  const rules = [
    {
      name: 'test-rule',
      content: '# Test Rule\n\nDo this thing.',
      frontmatter: {
        description: 'A test rule',
        category: 'testing',
        globs: ['*.js'],
      },
    },
  ];

  const projectContext = {};
  const platformConfig = { mode: 'workspace' };

  const result = await adapter.adaptForWindsurf(rules, projectContext, platformConfig);

  // Check if we got files
  assert.ok(result.files.length > 0, 'Should generate files');

  // Check individual rule content
  const ruleFile = result.files.find(f => f.path.includes('test-rule'));
  assert.ok(ruleFile, 'Should generate test-rule file');
  assert.ok(ruleFile.content.includes('Test Rule'), 'Content should be preserved');

  console.log('✅ Windsurf adaptation test passed');
}

testWindsurfAdaptation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
