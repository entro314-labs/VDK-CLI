import { RuleAdapter } from './src/scanner/core/RuleAdapter.js';

async function testV3Support() {
  console.log('Testing RuleAdapter v3.0 support...');

  const adapter = new RuleAdapter({ verbose: true });

  // Mock v3.0 Blueprint
  const v3Blueprint = {
    name: 'test-blueprint',
    frontmatter: {
      schemaVersion: '3.0',
      category: 'testing',
      platforms: {
        cursor: {
          enabled: true,
          components: {
            rules: {
              manifests: [
                {
                  name: 'test-rule-1',
                  content: 'Rule 1 Content',
                  file: 'test1.mdc',
                  globs: ['*.ts'],
                },
                {
                  name: 'test-rule-2',
                  content: 'Rule 2 Content',
                  file: 'test2.mdc',
                },
              ],
            },
          },
        },
      },
    },
  };

  try {
    // Pass the v3 blueprint as if it were a list of rules (which is how the loader will return them)
    const result = await adapter.adaptRules([v3Blueprint], 'cursor');

    console.log('Result files:', result.files.length);
    result.files.forEach(f => console.log(` - ${f.path}`));

    // Expecting 2 files based on the manifest above
    if (result.files.length !== 2) {
      throw new Error(`Expected 2 files, got ${result.files.length}`);
    }

    // Check if content is preserved
    if (!result.files[0].content.includes('Rule 1 Content')) {
      throw new Error('Content parsing failed');
    }

    console.log('SUCCESS: v3.0 Blueprint correctly expanded and adapted.');
  } catch (e) {
    console.error('FAILURE:', e);
    process.exit(1);
  }
}

testV3Support();
