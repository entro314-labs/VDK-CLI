import { validateBlueprint } from './src/utils/schema-validator.js';
import { IntegrationManager } from './src/integrations/integration-manager.js';

console.log('🧪 Testing Enhanced Schema Integration...\n');

// Test 1: Schema validation with new platforms
console.log('1. Testing schema validation with new platforms...');

const testBlueprint = {
  id: 'test-new-platforms',
  title: 'Test New Platforms Blueprint',
  description: 'Testing comprehensive platform support in the enhanced schema',
  version: '1.0.0',
  category: 'core',
  platforms: {
    'jetbrains': { compatible: true, ide: 'intellij', mcpIntegration: true },
    'zed': { compatible: true, mode: 'project', aiFeatures: true },
    'generic-ai': { compatible: true, configPath: '.ai/', priority: 5 },
    'vscode-insiders': { compatible: true, extension: 'ai-assistant' },
    'android-studio': { compatible: true, androidSdk: '33' }
  }
};

try {
  const result = await validateBlueprint(testBlueprint);
  if (result.valid) {
    console.log('✅ All new platforms validated successfully!');
  } else {
    console.log('❌ Validation failed:');
    console.log('Errors:', result.errors);
  }
} catch (error) {
  console.error('❌ Validation error:', error.message);
}

console.log('\n2. Testing Integration Manager discovery...');

// Test 2: Integration Manager discovery
try {
  const manager = new IntegrationManager();
  const results = await manager.discoverIntegrations({ verbose: false });
  
  console.log(`✅ Successfully loaded ${results.registered} integrations`);
  console.log('Loaded integrations:', results.loaded.map(r => r.name).join(', '));
  
  if (results.failed.length > 0) {
    console.log('❌ Failed to load:', results.failed.map(r => r.module).join(', '));
  }
} catch (error) {
  console.error('❌ Integration discovery error:', error.message);
}

console.log('\n3. Testing IDE detection...');

// Test 3: IDE detection functions
try {
  const { detectIDEs, detectSpecificJetBrainsIDEs, IDE_CONFIGURATIONS } = await import('./src/shared/ide-configuration.js');
  
  console.log(`✅ IDE Configurations loaded: ${IDE_CONFIGURATIONS.length} platforms`);
  
  // Test detection functions
  const detectedIDEs = detectIDEs(process.cwd());
  console.log(`✅ IDE detection function works, found ${detectedIDEs.length} IDE(s)`);
  
  const jetbrainsIDEs = detectSpecificJetBrainsIDEs(process.cwd());
  console.log(`✅ JetBrains detection function works, found ${jetbrainsIDEs.length} specific IDE(s)`);
  
} catch (error) {
  console.error('❌ IDE detection error:', error.message);
}

console.log('\n🎉 Enhanced schema integration testing complete!');