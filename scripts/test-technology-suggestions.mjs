import { TechnologyAnalyzer } from './src/scanner/core/TechnologyAnalyzer.js';

// Mock ProjectScanner structure
const mockProjectStructure = {
  projectPath: '/tmp/test-project',
  files: [
    { path: '/tmp/test-project/package.json', name: 'package.json' },
    { path: '/tmp/test-project/src/App.tsx', name: 'App.tsx' },
  ],
  directories: [],
};

// Mock PackageAnalyzer to avoid file system dependency in this unit test
// We can override the analyzePackageFiles method or mock the PackageAnalyzer dependency.
// For simplicity, we'll subclass TechnologyAnalyzer and override analyzePackageFiles.

class MockTechnologyAnalyzer extends TechnologyAnalyzer {
  async analyzePackageFiles(_projectStructure) {
    // Mock finding React, Next.js, and Jest
    this.frameworks.push('React', 'Next.js');
    this.libraries.push('jest', 'docker');
  }
}

async function testSuggestions() {
  try {
    console.log('Testing TechnologyAnalyzer Suggestions...');
    const analyzer = new MockTechnologyAnalyzer({ verbose: true });

    const result = await analyzer.analyzeTechnologies(mockProjectStructure);

    console.log('Suggestions:', JSON.stringify(result.suggestedComponents, null, 2));

    const agents = result.suggestedComponents.agents;
    const commands = result.suggestedComponents.commands;

    const hasFrontendAgent = agents.some(a => a.name === 'frontend-specialist');
    const hasTestCommand = commands.some(c => c.name === 'test-unit');
    const hasDockerCommand = commands.some(c => c.name === 'docker-up');

    if (!hasFrontendAgent) throw new Error('Missing frontend-specialist agent');
    if (!hasTestCommand) throw new Error('Missing test-unit command');
    if (!hasDockerCommand) throw new Error('Missing docker-up command');

    console.log('SUCCESS: Suggestions validated.');
  } catch (e) {
    console.error('FAILURE:', e);
    process.exit(1);
  }
}

testSuggestions();
