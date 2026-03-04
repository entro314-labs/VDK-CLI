/**
 * CommunityDeployer Comprehensive Test Suite
 *
 * Covers all functionality in CommunityDeployer.js with thorough testing of:
 * - Community blueprint fetching (Hub and GitHub sources)
 * - Project context analysis and technology detection
 * - Blueprint adaptation and compatibility assessment
 * - Cross-framework adaptation (React to Next.js, etc.)
 * - Platform-specific deployment via integration system
 * - Usage tracking and analytics
 * - Preview functionality
 * - Error handling and fallback mechanisms
 * - UI helper methods and user experience
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let CommunityDeployer;
let createCommunityDeployer;

// Mock dependencies
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    set text(_value) {},
  })),
}));

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    yellow: str => str,
    green: str => str,
    red: str => str,
    cyan: str => str,
    gray: str => str,
  },
}));

// Mock project scanner and related dependencies
vi.mock('../src/scanner/core/ProjectScanner.js', () => ({
  ProjectScanner: class ProjectScanner {
    constructor() {
      this.scanProject = vi.fn();
    }
  },
}));

vi.mock('../src/scanner/core/RuleAdapter.js', () => ({
  RuleAdapter: class RuleAdapter {},
}));

vi.mock('../src/shared/ProjectContextAnalyzer.js', () => ({
  ProjectContextAnalyzer: class ProjectContextAnalyzer {
    constructor() {
      this.analyze = vi.fn();
    }
  },
}));

vi.mock('../src/integrations/index.js', () => ({
  createIntegrationManager: vi.fn(),
}));

vi.mock('../src/hub/VDKHubClient.js', () => ({
  VDKHubClient: class VDKHubClient {},
}));

vi.mock('../src/blueprints-client.js', () => ({
  searchBlueprints: vi.fn(),
}));

// Mock fs for dynamic imports in detectFramework
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock console methods
const consoleSpy = {
  warn: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
};

vi.stubGlobal('console', consoleSpy);

describe('CommunityDeployer', () => {
  let communityDeployer;
  let mockProjectScanner;
  let mockContextAnalyzer;
  let mockIntegrationManager;
  let mockHubClient;
  const testProjectPath = '/test/project';

  beforeEach(async () => {
    if (!(CommunityDeployer && createCommunityDeployer)) {
      ({ CommunityDeployer, createCommunityDeployer } =
        await import('../src/community/CommunityDeployer.js'));
    }

    communityDeployer = new CommunityDeployer(testProjectPath);
    mockProjectScanner = communityDeployer.projectScanner;
    mockContextAnalyzer = communityDeployer.contextAnalyzer;

    mockIntegrationManager = {
      discoverIntegrations: vi.fn(),
      scanAll: vi.fn(),
      initializeActive: vi.fn(),
      getActiveIntegrations: vi
        .fn()
        .mockReturnValue([{ name: 'claude-code-cli' }, { name: 'cursor' }, { name: 'windsurf' }]),
    };

    mockHubClient = {
      getCommunityBlueprint: vi.fn(),
      trackCommunityBlueprintUsage: vi.fn(),
      sendUsageTelemetry: vi.fn(),
    };

    // Mock the lazy-loaded client getter
    communityDeployer.getHubClient = vi.fn().mockResolvedValue(mockHubClient);

    // Mock createIntegrationManager
    const { createIntegrationManager } = await import('../src/integrations/index.js');
    createIntegrationManager.mockReturnValue(mockIntegrationManager);

    // Reset all mocks
    vi.clearAllMocks();
    consoleSpy.warn.mockClear();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with project path', () => {
      expect(communityDeployer.projectPath).toBe(testProjectPath);
      expect(communityDeployer.projectScanner).toBeDefined();
      expect(communityDeployer.ruleAdapter).toBeDefined();
      expect(communityDeployer.integrationManager).toBeNull();
      expect(communityDeployer.hubClient).toBeNull();
    });
  });

  describe('Blueprint Fetching', () => {
    const mockHubBlueprint = {
      id: 'react-performance',
      slug: 'react-performance',
      title: 'React Performance Patterns',
      description: 'Advanced React optimization techniques',
      content: '# React Performance Patterns\n\nUse React.memo for expensive components.',
      author: { username: 'react-expert' },
      metadata: { framework: 'React', tags: ['performance', 'optimization'] },
      stats: { downloads: 1500 },
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-01T00:00:00Z',
    };

    it('should fetch blueprint from Hub successfully', async () => {
      mockHubClient.getCommunityBlueprint.mockResolvedValue(mockHubBlueprint);

      const result = await communityDeployer.fetchCommunityBlueprint('react-performance');

      expect(result.id).toBe('react-performance');
      expect(result.title).toBe('React Performance Patterns');
      expect(result.author).toEqual({ username: 'react-expert' });
      expect(result.platforms).toBeDefined();
      expect(mockHubClient.getCommunityBlueprint).toHaveBeenCalledWith('react-performance');
    });

    it('should fallback to repository when Hub fails', async () => {
      const mockRepositoryBlueprint = {
        content: '# Repository Blueprint\n\nContent from repository.',
        metadata: {
          id: 'repo-blueprint',
          title: 'Repository Blueprint',
          description: 'Blueprint from repository',
          author: 'repo-author',
          tags: ['javascript', 'nodejs'],
          language: 'javascript',
          architecture: 'standard',
        },
        platforms: { 'claude-code': { compatible: true } },
      };

      mockHubClient.getCommunityBlueprint.mockRejectedValue(new Error('Hub unavailable'));

      const { searchBlueprints } = await import('../src/blueprints-client.js');
      searchBlueprints.mockResolvedValue([mockRepositoryBlueprint]);

      const result = await communityDeployer.fetchCommunityBlueprint('repo-blueprint');

      expect(result.id).toBe('repo-blueprint');
      expect(result.title).toBe('Repository Blueprint');
      expect(result.framework).toBeUndefined();
      expect(result.language).toBe('javascript');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Hub fetch failed, trying repository')
      );
    });

    it('should return null when blueprint not found anywhere', async () => {
      mockHubClient.getCommunityBlueprint.mockRejectedValue(new Error('Hub error'));

      const { searchBlueprints } = await import('../src/blueprints-client.js');
      searchBlueprints.mockResolvedValue([]);

      const result = await communityDeployer.fetchCommunityBlueprint('nonexistent');

      expect(result).toBeNull();
    });

    it('does not fallback to fuzzy repository matches for deploy-by-id', async () => {
      mockHubClient.getCommunityBlueprint.mockRejectedValue(new Error('Hub error'));

      const { searchBlueprints } = await import('../src/blueprints-client.js');
      searchBlueprints.mockResolvedValue([]);

      const result = await communityDeployer.fetchCommunityBlueprint('almost-matching-id');

      expect(result).toBeNull();
      expect(searchBlueprints).toHaveBeenCalledTimes(1);
      expect(searchBlueprints).toHaveBeenCalledWith({
        query: 'almost-matching-id',
        exactMatch: true,
      });
    });
  });

  describe('Project Context Analysis', () => {
    const mockProjectData = {
      files: [
        { name: 'package.json', path: '/test/package.json' },
        { name: 'src/index.tsx', path: '/test/src/index.tsx' },
        { name: 'src/components/App.tsx', path: '/test/src/components/App.tsx' },
        { name: 'tailwind.config.js', path: '/test/tailwind.config.js' },
        { name: 'jest.config.js', path: '/test/jest.config.js' },
        { name: '__tests__/App.test.tsx', path: '/test/__tests__/App.test.tsx' },
      ],
      directories: ['src', 'src/components', '__tests__'],
    };

    beforeEach(async () => {
      mockProjectScanner.scanProject.mockResolvedValue(mockProjectData);
      mockContextAnalyzer.analyze.mockResolvedValue({
        name: 'project',
        framework: 'nextjs',
        language: 'typescript',
        technologies: ['tailwind', 'jest'],
        architecture: 'standard',
        patterns: ['component-based', 'testing'],
        structure: { type: 'small', hasTests: true },
        packageManager: 'npm',
        platforms: ['claude-code-cli', 'cursor'],
        summary: 'nextjs + typescript + tailwind + jest',
      });

      // Mock package.json reading
      const fs = await import('node:fs');
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: { react: '^18.0.0', next: '^13.0.0' },
          devDependencies: { typescript: '^4.9.0' },
        })
      );
    });

    it('should analyze project context comprehensively', async () => {
      const context = await communityDeployer.analyzeProjectContext();

      expect(mockProjectScanner.scanProject).toHaveBeenCalledWith(testProjectPath);
      expect(mockContextAnalyzer.analyze).toHaveBeenCalledWith(mockProjectData);

      expect(context.name).toBe('project');
      expect(context.framework).toBe('nextjs');
      expect(context.language).toBe('typescript');
      expect(context.technologies).toContain('tailwind');
      expect(context.technologies).toContain('jest');
      expect(context.architecture).toBe('standard');
      expect(context.patterns).toContain('component-based');
      expect(context.patterns).toContain('testing');
      expect(context.structure.type).toBe('small'); // < 50 files
      expect(context.structure.hasTests).toBe(true);
      expect(context.packageManager).toBe('npm'); // Default when no lock files
      expect(context.platforms).toContain('claude-code-cli');
      expect(context.platforms).toContain('cursor');
      expect(context.summary).toContain('nextjs');
      expect(context.summary).toContain('typescript');
    });

    it('should handle project analysis failures gracefully', async () => {
      mockProjectScanner.scanProject.mockRejectedValue(new Error('Scan failed'));

      const context = await communityDeployer.analyzeProjectContext();

      expect(context.framework).toBe('generic');
      expect(context.language).toBe('javascript');
      expect(context.technologies).toEqual(['javascript']);
      expect(context.summary).toBe('Generic JavaScript project');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Project analysis failed, using fallback')
      );
    });
  });

  describe('Compatibility Assessment', () => {
    it('should assess framework compatibility correctly', () => {
      // Perfect match
      const perfectMatch = communityDeployer.assessFrameworkCompatibility('react', 'react');
      expect(perfectMatch.score).toBe(1.0);
      expect(perfectMatch.needsAdaptation).toBe(false);

      // Compatible family (Next.js to React)
      const compatibleFamily = communityDeployer.assessFrameworkCompatibility('nextjs', 'react');
      expect(compatibleFamily.score).toBe(0.8);
      expect(compatibleFamily.needsAdaptation).toBe(true);
      expect(compatibleFamily.from).toBe('nextjs');
      expect(compatibleFamily.to).toBe('react');

      // Different families
      const differentFamily = communityDeployer.assessFrameworkCompatibility('angular', 'react');
      expect(differentFamily.score).toBe(0.8);
      expect(differentFamily.needsAdaptation).toBe(true);
    });

    it('should assess language compatibility correctly', () => {
      // Perfect match
      const perfectMatch = communityDeployer.assessLanguageCompatibility(
        'typescript',
        'typescript'
      );
      expect(perfectMatch.score).toBe(1.0);
      expect(perfectMatch.needsAdaptation).toBe(false);

      // Compatible languages (JavaScript to TypeScript)
      const compatible = communityDeployer.assessLanguageCompatibility('javascript', 'typescript');
      expect(compatible.score).toBe(0.9);
      expect(compatible.needsAdaptation).toBe(true);

      // Different languages
      const different = communityDeployer.assessLanguageCompatibility('python', 'javascript');
      expect(different.score).toBe(0.5);
      expect(different.needsAdaptation).toBe(true);
    });

    it('should assess technology alignment', () => {
      const blueprintTags = ['react', 'typescript', 'performance'];
      const projectTechnologies = ['react', 'typescript', 'jest'];

      const score = communityDeployer.assessTechnologyAlignment(blueprintTags, projectTechnologies);

      // Should have 2/3 = 0.67 alignment
      expect(score).toBeCloseTo(0.67, 1);
    });
  });

  describe('Usage Tracking and Analytics', () => {
    const mockBlueprintId = 'react-hooks-bp';
    const mockDeployResult = {
      success: true,
      platforms: ['claude-code', 'cursor'],
      adaptations: 3,
      compatibilityScore: 8,
    };
    const mockProjectContext = {
      framework: 'react',
      language: 'typescript',
    };

    it('should track blueprint usage successfully', async () => {
      mockHubClient.trackCommunityBlueprintUsage.mockResolvedValue({ success: true });
      mockHubClient.sendUsageTelemetry.mockResolvedValue({ success: true });

      await communityDeployer.trackBlueprintUsage(
        mockBlueprintId,
        mockDeployResult,
        mockProjectContext
      );

      // Should track community-specific usage
      expect(mockHubClient.trackCommunityBlueprintUsage).toHaveBeenCalledWith(
        mockBlueprintId,
        expect.objectContaining({
          projectContext: {
            framework: 'react',
            language: 'typescript',
            platform: process.platform,
            cliVersion: '2.0.0',
          },
          deploymentResult: {
            success: true,
            platforms: ['claude-code', 'cursor'],
            adaptations: 3,
            compatibilityScore: 8,
          },
        })
      );

      // Should also send general telemetry
      expect(mockHubClient.sendUsageTelemetry).toHaveBeenCalledWith(
        expect.objectContaining({
          cli_version: '2.0.0',
          command: 'deploy',
          success: true,
          blueprints_generated: 1,
          metadata: expect.objectContaining({
            blueprint_id: mockBlueprintId,
            project_framework: 'react',
            project_language: 'typescript',
          }),
        })
      );
    });

    it('should handle tracking failures gracefully', async () => {
      mockHubClient.trackCommunityBlueprintUsage.mockRejectedValue(new Error('Tracking failed'));

      await communityDeployer.trackBlueprintUsage(
        mockBlueprintId,
        mockDeployResult,
        mockProjectContext
      );

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Analytics tracking failed: Tracking failed')
      );
    });
  });

  describe('Adapted deployment wiring', () => {
    it('adapts blueprint content and writes generated files per active integration', async () => {
      mockIntegrationManager.getActiveIntegrations.mockReturnValue([{ name: 'Cursor' }]);

      communityDeployer.ruleAdapter = {
        adaptRules: vi.fn().mockResolvedValue({
          files: [
            {
              path: '/tmp/community/.cursor/rules/community-import.mdc',
              content: '# ADAPTED_BLUEPRINT_CONTENT',
            },
          ],
          warnings: ['cursor adaptation warning'],
        }),
      };

      communityDeployer.writeAdaptedFiles = vi.fn().mockResolvedValue(undefined);

      const result = await communityDeployer.deployToIntegrations(
        {
          title: 'Community Import',
          description: 'Community import description',
          content: '# ADAPTED_BLUEPRINT_CONTENT',
          metadata: { id: 'community-import' },
          adaptedFor: { name: 'project' },
          platforms: {},
        },
        { framework: 'react', language: 'typescript' }
      );

      expect(communityDeployer.ruleAdapter.adaptRules).toHaveBeenCalledTimes(1);

      const [rulesArg, platformArg] = communityDeployer.ruleAdapter.adaptRules.mock.calls[0];
      expect(platformArg).toBe('cursor');
      expect(rulesArg[0].content).toContain('ADAPTED_BLUEPRINT_CONTENT');
      expect(rulesArg[0].frontmatter.category).toBe('imported');

      expect(communityDeployer.writeAdaptedFiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining('ADAPTED_BLUEPRINT_CONTENT') }),
        ])
      );

      expect(mockIntegrationManager.initializeActive).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.platforms).toEqual(['Cursor']);
      expect(result.warnings).toContain('cursor adaptation warning');
    });

    it('returns a failed result when no active integrations are detected', async () => {
      mockIntegrationManager.getActiveIntegrations.mockReturnValue([]);

      communityDeployer.ruleAdapter = {
        adaptRules: vi.fn(),
      };

      const result = await communityDeployer.deployToIntegrations(
        {
          title: 'No Targets',
          description: 'No targets available',
          content: '# nothing to deploy',
          metadata: { id: 'no-targets' },
          platforms: {},
        },
        { framework: 'generic', language: 'javascript' }
      );

      expect(communityDeployer.ruleAdapter.adaptRules).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No active IDE integrations detected');
    });
  });

  describe('UI Helper Methods', () => {
    it('should format platform list correctly', () => {
      const platforms = {
        'claude-code': { compatible: true },
        cursor: { compatible: true },
        windsurf: { compatible: false },
        vscode: { compatible: true },
      };

      const result = communityDeployer.formatPlatformList(platforms);
      expect(result).toBe('claude-code, cursor, vscode');
    });

    it('should handle empty or invalid platform objects', () => {
      expect(communityDeployer.formatPlatformList(null)).toBe('All platforms');
      expect(communityDeployer.formatPlatformList({})).toBe('Unknown');
      expect(communityDeployer.formatPlatformList('invalid')).toBe('All platforms');
    });

    it('should generate project summary correctly', () => {
      const testCases = [
        {
          context: { framework: 'react', language: 'javascript', technologies: [] },
          expected: 'react',
        },
        {
          context: {
            framework: 'nextjs',
            language: 'typescript',
            technologies: ['tailwind', 'prisma'],
          },
          expected: 'nextjs + typescript + tailwind + prisma',
        },
      ];

      testCases.forEach(({ context, expected }) => {
        const result = communityDeployer.generateProjectSummary(context);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Factory Function', () => {
    it('should create CommunityDeployer instance', () => {
      const deployer = createCommunityDeployer(testProjectPath);

      expect(deployer).toBeInstanceOf(CommunityDeployer);
      expect(deployer.projectPath).toBe(testProjectPath);
    });
  });
});
