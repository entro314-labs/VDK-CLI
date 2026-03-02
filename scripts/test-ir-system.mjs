import IR from './src/ir/index-enhanced.js';
import fs from 'node:fs';

// Mock content for testing
const MOCK_CLAUDE_RULE = `---
description: "Test Rule"
triggers:
  - "test"
---

# Test Rule

This is a test rule.
`;

const MOCK_CURSOR_RULE = `---
description: "Test Cursor Rule"
globs: ["**/*.js"]
alwaysApply: true
---

# Test Cursor Rule

This is a test cursor rule.
`;

// Helper to log to file and console
function log(msg) {
  console.log(msg);
  fs.appendFileSync('verification-result.txt', `${msg}\n`);
}

async function runVerification() {
  // Clear previous result
  fs.writeFileSync('verification-result.txt', '');

  log('🧪 Verifying IR System...');

  try {
    // 1. Test Claude -> IR
    log('\n[1] Testing Claude -> IR Parsing...');
    const claudeIR = IR.parse.claude({
      content: MOCK_CLAUDE_RULE,
      filePath: 'test-rule.md',
    });

    if (claudeIR && claudeIR.type === 'rule' && claudeIR.platformSpecific['claude-code']) {
      log('✅ Claude Parsing Successful');
    } else {
      log(`❌ Claude Parsing Failed: ${JSON.stringify(claudeIR)}`);
    }

    // 2. Test Cursor -> IR
    log('\n[2] Testing Cursor -> IR Parsing...');
    const cursorIR = IR.parse.cursor({
      content: MOCK_CURSOR_RULE,
      filePath: '.cursor/rules/test.mdc',
    });

    if (cursorIR && cursorIR.type === 'rule' && cursorIR.platformSpecific.cursor) {
      log('✅ Cursor Parsing Successful');
    } else {
      log(`❌ Cursor Parsing Failed: ${JSON.stringify(cursorIR)}`);
    }

    // 3. Test IR -> Windsurf Generation
    log('\n[3] Testing IR -> Windsurf Generation...');
    const windsurfResult = IR.generate.windsurf(claudeIR);

    if (windsurfResult?.content.includes('# Test Rule')) {
      log('✅ Windsurf Generation Successful');
    } else {
      log(`❌ Windsurf Generation Failed: ${JSON.stringify(windsurfResult)}`);
    }

    // 4. Test Round Trip (Claude -> IR -> Claude)
    log('\n[4] Testing Round Trip (Claude)...');
    const roundTrip = await IR.convert.roundTrip('claude', MOCK_CLAUDE_RULE, 'test-rule.md');

    if (roundTrip.passed) {
      log(`✅ Round Trip Passed (Score: ${roundTrip.semanticScore})`);
    } else {
      log(`❌ Round Trip Failed (Score: ${roundTrip.semanticScore})`);
    }

    log('\n✨ Verification Complete');
  } catch (err) {
    log(`\n❌ FATAL ERROR: ${err.message}\n${err.stack}`);
  }
}

runVerification().catch(err => {
  fs.appendFileSync(
    'verification-result.txt',
    `\nUnhandled Rejection: ${err.message}\n${err.stack}`
  );
});
