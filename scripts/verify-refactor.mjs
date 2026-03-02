import { RuleGenerator } from './src/scanner/core/RuleGenerator.js';

console.log('Starting verification...');
try {
  const rg = new RuleGenerator({ verbose: true });
  console.log('RuleGenerator instantiated successfully.');

  if (rg.mapper && rg.configExtractor && rg.blueprintLoader) {
    console.log('Sub-components initialized successfully.');
  } else {
    console.error('Sub-components missing!');
  }
} catch (e) {
  console.error('Verification failed:');
  console.error(e);
}
