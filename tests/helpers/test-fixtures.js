/**
 * Test Fixtures
 * Common test data and mock objects
 */

export const mockProjectStructure = {
  projectPath: '/test/project',
  projectName: 'test-project',
  files: [
    { path: 'src/index.js', name: 'index.js', type: 'javascript' },
    { path: 'src/utils.js', name: 'utils.js', type: 'javascript' },
    { path: 'package.json', name: 'package.json', type: 'json' },
  ],
  directories: ['src', 'tests'],
  fileTypes: { javascript: 2, json: 1 },
  fileExtensions: ['.js', '.json'],
  directoryStructure: {
    src: { files: ['index.js', 'utils.js'] },
    tests: { files: [] },
  },
}

export const mockPatterns = {
  namingConventions: {
    files: { camelCase: 0.8, kebabCase: 0.2 },
    directories: { camelCase: 0.9 },
  },
  architecturalPatterns: ['MVC', 'Module'],
  codePatterns: ['ES6 Modules', 'CommonJS'],
  consistencyMetrics: {
    namingConsistency: 0.85,
    structureConsistency: 0.9,
  },
}

export const mockDependencyAnalysis = {
  dependencyGraph: new Map(),
  inverseGraph: new Map(),
  moduleCount: 3,
  edgeCount: 2,
  centralModules: ['index.js'],
  layeredStructure: [['index.js'], ['utils.js']],
  cyclesDetected: false,
  architecturalHints: ['Clean Architecture'],
}

export const validCommand = {
  id: 'test-command',
  name: 'Test Command',
  description: 'Test command for validation',
  target: 'claude-code',
  commandType: 'slash',
  version: '1.0.0',
  scope: 'project',
}

export const validBlueprint = {
  id: 'test-blueprint',
  title: 'Test Blueprint',
  description: 'Test blueprint for validation purposes and comprehensive testing',
  version: '1.0.0',
  category: 'core',
  platforms: {
    'claude-code': {
      compatible: true,
    },
  },
}

export const malformedCodeSamples = [
  '}{invalid javascript syntax!@#$%',
  'while(true) { /* infinite loop */ }',
  'eval("dangerous code")',
  'require("fs").readFileSync("/etc/passwd")',
  ''.repeat(1000), // Long string
  '\x00\x01\x02\x03', // Binary data
]

export const dangerousFilePaths = [
  '/etc/passwd',
  '../../../etc/passwd',
  '/dev/null',
  'nonexistent-directory-12345',
]
