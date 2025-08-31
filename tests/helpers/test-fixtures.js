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
      command: true,
      memory: true,
      namespace: 'project',
    },
    jetbrains: {
      compatible: true,
      ide: 'intellij',
      mcpIntegration: true,
      fileTemplates: true,
    },
    zed: {
      compatible: true,
      mode: 'project',
      aiFeatures: true,
      performance: 'high',
    },
    'generic-ai': {
      compatible: true,
      configPath: '.vdk/',
      rulesPath: '.vdk/rules/',
      priority: 5,
    },
  },
}

// Additional test fixture for comprehensive platform testing
export const comprehensivePlatformBlueprint = {
  id: 'comprehensive-platform-test',
  title: 'Comprehensive Platform Test Blueprint',
  description: 'Blueprint for testing all supported platforms and their configurations',
  version: '2.0.0',
  category: 'tool',
  complexity: 'medium',
  scope: 'project',
  platforms: {
    'claude-code': { compatible: true, command: true, memory: true },
    'claude-desktop': { compatible: true, mcpIntegration: true, rules: true },
    cursor: { compatible: true, activation: 'auto-attached', priority: 'high' },
    windsurf: { compatible: true, mode: 'workspace', characterLimit: 4000 },
    'windsurf-next': { compatible: true, mode: 'workspace', priority: 8 },
    'github-copilot': { compatible: true, priority: 7, reviewType: 'code-quality' },
    zed: { compatible: true, mode: 'project', aiFeatures: true, performance: 'high' },
    vscode: { compatible: true, extension: 'vscode-ai-assistant', mcpIntegration: true },
    'vscode-insiders': { compatible: true, extension: 'vscode-ai-assistant', mcpIntegration: true },
    vscodium: { compatible: true, extension: 'vscodium-ai-assistant', configPath: '.vscode-oss/' },
    jetbrains: { compatible: true, ide: 'intellij', mcpIntegration: true, fileTemplates: true },
    intellij: { compatible: true, plugin: 'ai-assistant', fileTemplates: true },
    webstorm: { compatible: true, nodeIntegration: true, typescript: true },
    pycharm: { compatible: true, pythonInterpreter: '3.9', virtualEnv: true },
    phpstorm: { compatible: true, phpVersion: '8.1', composer: true },
    rubymine: { compatible: true, rubyVersion: '3.0', rails: true },
    clion: { compatible: true, cmake: true, debugger: true },
    datagrip: { compatible: true, databases: ['PostgreSQL', 'MySQL'], sqlDialect: 'PostgreSQL' },
    goland: { compatible: true, goVersion: '1.19', modules: true },
    rider: { compatible: true, dotnetVersion: '6.0', unity: false },
    'android-studio': { compatible: true, androidSdk: '33', gradleVersion: '7.4' },
    'generic-ai': { compatible: true, configPath: '.vdk/', priority: 5 },
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

export const dangerousFilePaths = ['/etc/passwd', '../../../etc/passwd', '/dev/null', 'nonexistent-directory-12345']
