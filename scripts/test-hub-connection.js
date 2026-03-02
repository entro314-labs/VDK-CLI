#!/usr/bin/env node

/**
 * Test script to verify VDK-Hub connectivity and API functionality
 */

import { VDKHubClient } from './src/hub/VDKHubClient.js';

async function testHubConnection() {
  console.log('🧪 Testing VDK-Hub connectivity...\n');

  // Test with local development hub
  const hubClient = new VDKHubClient({
    hubUrl: 'https://vdk.tools', // Assuming local dev server
  });

  try {
    console.log('1. Testing health endpoint...');
    const healthResult = await hubClient.ping();
    console.log('✅ Health check:', healthResult);
    console.log('');

    console.log('2. Testing blueprint sync...');
    const syncResult = await hubClient.syncBlueprints();
    console.log('✅ Blueprint sync:', syncResult.blueprints.length, 'blueprints');
    console.log('');

    console.log('3. Testing authentication flow...');
    // Skip auth for now since it requires user interaction
    console.log('⏭️  Skipping auth test (requires user interaction)');
    console.log('');

    console.log('4. Testing package generation...');
    const generateResult = await hubClient.generatePackage({
      stackChoices: { nextjs: true },
      languageChoices: { typescript: true },
      toolPreferences: { linting: true },
      aiAssistantChoices: { 'claude-code': true },
      environmentDetails: { targetIde: 'vscode' },
      outputFormat: 'zip',
    });
    console.log('✅ Package generation:', generateResult.package.id);
    console.log('');

    console.log('🎉 All tests passed! VDK-Hub integration is working.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Start the VDK-Hub development server first:');
      console.log('   cd /Users/dominikospritis/DevFolder/VDK-Hub');
      console.log('   pnpm dev');
    }
  }
}

testHubConnection();
