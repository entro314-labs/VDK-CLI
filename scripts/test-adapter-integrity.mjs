import { RuleAdapter } from './src/scanner/core/RuleAdapter.js';

try {
  const adapter = new RuleAdapter({ verbose: true });
  console.log('RuleAdapter initialized successfully.');

  if (!(adapter.constraints && adapter.validate)) {
    throw new Error('Validation methods missing on adapter.');
  }

  // Quick check of constraint logic
  const result = adapter.validate('content', 'cursor', 'main');
  console.log('Validation check:', result.valid ? 'PASS' : 'FAIL');
} catch (e) {
  console.error(e);
  process.exit(1);
}
