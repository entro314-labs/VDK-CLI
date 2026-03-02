import { RuleAdapter } from '../src/scanner/core/RuleAdapter.js';

const mockRules = [
  {
    name: 'test-rule',
    content: 'Always write tests.',
    frontmatter: {
      category: 'core',
      priority: 10,
      description: 'Core testing rule',
    },
  },
  {
    name: 'python-style',
    content: 'Use snake_case.',
    frontmatter: {
      category: 'language',
      description: 'Python style guide',
    },
  },
];

const mockContext = {
  description: 'A test project',
};

async function testAdapters() {
  const adapter = new RuleAdapter({ projectPath: process.cwd() });

  console.log('Testing Universal Adapters...');

  // Test Codex
  const codex = await adapter.adaptForCodex(mockRules, mockContext);
  console.log(`\n[Codex] Files: ${codex.files.length}`);
  console.log(`[Codex] Content Preview:\n${codex.files[0].content.substring(0, 100)}...`);

  // Test Gemini
  const gemini = await adapter.adaptForGemini(mockRules, mockContext);
  console.log(`\n[Gemini] Files: ${gemini.files.length}`);
  console.log(`[Gemini] Main Index:\n${gemini.files.find(f => f.type === 'index').content}`);

  // Test Continue
  const cont = await adapter.adaptForContinue(mockRules, mockContext);
  console.log(`\n[Continue] Files: ${cont.files.length}`);
  console.log(`[Continue] Config JSON:\n${cont.files[0].content}`);

  // Test Aider
  const aider = await adapter.adaptForAider(mockRules, mockContext);
  console.log(`\n[Aider] Files: ${aider.files.length}`);

  // Test JetBrains
  const jetbrains = await adapter.adaptForJetBrains(mockRules, mockContext);
  console.log(`\n[JetBrains] Files: ${jetbrains.files.length}`);
  console.log(`[JetBrains] Setup Guide:\n${jetbrains.files[0].content.substring(0, 100)}...`);

  // Test Tabnine
  const tabnine = await adapter.adaptForTabnine(mockRules, mockContext);
  console.log(`\n[Tabnine] Files: ${tabnine.files.length}`);
}

testAdapters().catch(console.error);
