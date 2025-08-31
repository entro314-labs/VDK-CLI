/**
 * PublishManager Comprehensive Test Suite
 *
 * Covers all functionality in PublishManager.js with thorough testing of:
 * - Publishing workflows (Hub and GitHub pathways)
 * - Rule validation and quality scoring
 * - Security scanning and threat detection
 * - Format detection and conversion
 * - Project context extraction
 * - Preview functionality
 * - Error handling and edge cases
 * - Integration with external services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { PublishManager } from '../src/publishing/PublishManager.js'

// Mock dependencies
vi.mock('fs/promises')
vi.mock('matter')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    set text(value) {},
  })),
}))

// Mock chalk to avoid ANSI codes in tests
vi.mock('chalk', () => ({
  default: {
    yellow: (str) => str,
    green: (str) => str,
    red: (str) => str,
    cyan: (str) => str,
    gray: (str) => str,
  },
}))

// Mock project scanner
vi.mock('../src/scanner/core/ProjectScanner.js', () => ({
  ProjectScanner: vi.fn().mockImplementation(() => ({
    scanProject: vi.fn(),
  })),
}))

// Mock schema validator
vi.mock('../src/utils/schema-validator.js', () => ({
  validateBlueprint: vi.fn(),
}))

// Mock console methods to avoid noise in tests
const consoleSpy = {
  warn: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
}

vi.stubGlobal('console', consoleSpy)

describe('PublishManager', () => {
  let publishManager
  let mockProjectScanner
  let mockHubClient
  let mockGitHubClient
  let mockFormatConverter
  const testProjectPath = '/test/project'

  beforeEach(() => {
    publishManager = new PublishManager(testProjectPath)
    mockProjectScanner = publishManager.projectScanner

    // Mock external clients
    mockHubClient = {
      checkAuth: vi.fn(),
      promptForAuth: vi.fn(),
      uploadBlueprint: vi.fn(),
    }

    mockGitHubClient = {
      createCommunityBlueprintPR: vi.fn(),
    }

    mockFormatConverter = {
      convertToUniversal: vi.fn(),
      previewConversion: vi.fn(),
    }

    // Mock the lazy-loaded client getters
    publishManager.getHubClient = vi.fn().mockResolvedValue(mockHubClient)
    publishManager.getGitHubClient = vi.fn().mockResolvedValue(mockGitHubClient)
    publishManager.getFormatConverter = vi.fn().mockResolvedValue(mockFormatConverter)

    // Reset all mocks
    vi.clearAllMocks()
    consoleSpy.warn.mockClear()
    consoleSpy.log.mockClear()
    consoleSpy.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with project path', () => {
      expect(publishManager.projectPath).toBe(testProjectPath)
      expect(publishManager.projectScanner).toBeDefined()
      expect(publishManager.hubClient).toBeNull()
      expect(publishManager.githubClient).toBeNull()
      expect(publishManager.formatConverter).toBeNull()
    })
  })

  describe('Rule Validation', () => {
    const testRulePath = '/test/project/.cursorrules'
    const mockRuleContent = `# Test Rules
    
This is a test rule file with sufficient content to pass basic validation.
It includes examples and detailed explanations for comprehensive testing.

## Examples
- Example 1: Basic usage
- Example 2: Advanced patterns
- Example 3: Error handling

## Best Practices
Follow these guidelines for optimal results.`

    beforeEach(() => {
      fs.access.mockResolvedValue() // File exists
      fs.readFile.mockResolvedValue(mockRuleContent)
    })

    it('should validate rule successfully', async () => {
      const validation = await publishManager.validateRuleForPublishing(testRulePath)

      expect(validation.valid).toBe(true)
      expect(validation.content).toBe(mockRuleContent)
      expect(validation.detectedFormat).toBe('cursor-rules')
      expect(validation.qualityScore).toBeGreaterThan(0)
      expect(validation.errors).toEqual([])
    })

    it('should reject rules that are too short', async () => {
      fs.readFile.mockResolvedValue('Short rule')

      const validation = await publishManager.validateRuleForPublishing(testRulePath)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Rule content too short (minimum 100 characters)')
    })

    it('should warn about very large rules', async () => {
      const largeContent = 'x'.repeat(51000)
      fs.readFile.mockResolvedValue(largeContent)

      const validation = await publishManager.validateRuleForPublishing(testRulePath)

      expect(validation.warnings).toContain('Rule content very large (>50KB), consider splitting')
    })

    it('should validate VDK blueprint format', async () => {
      const blueprintContent = `---
title: Test Blueprint
description: Test blueprint for validation
version: 1.0.0
---

# Test Blueprint Content`

      fs.readFile.mockResolvedValue(blueprintContent)
      matter.mockReturnValue({
        data: {
          title: 'Test Blueprint',
          description: 'Test blueprint for validation',
          version: '1.0.0',
        },
      })

      const { validateBlueprint } = await import('../src/utils/schema-validator.js')
      validateBlueprint.mockResolvedValue({ valid: true, errors: [] })

      const validation = await publishManager.validateRuleForPublishing('/test/blueprint.mdc')

      expect(validation.detectedFormat).toBe('vdk-blueprint')
      expect(matter).toHaveBeenCalledWith(blueprintContent)
      expect(validateBlueprint).toHaveBeenCalled()
    })

    it('should handle JSON format validation', async () => {
      const jsonContent = JSON.stringify({
        guidelines: ['Use best practices', 'Follow conventions'],
        rules: ['Rule 1', 'Rule 2'],
      })

      fs.readFile.mockResolvedValue(jsonContent)

      const validation = await publishManager.validateRuleForPublishing('/test/copilot.json')

      expect(validation.detectedFormat).toBe('copilot-config')
      expect(validation.valid).toBe(true)
    })

    it('should detect invalid JSON format', async () => {
      fs.readFile.mockResolvedValue('{ invalid json }')

      const validation = await publishManager.validateRuleForPublishing('/test/invalid.json')

      expect(validation.errors).toContain('Invalid JSON format for Copilot configuration')
    })

    describe('Security Scanning', () => {
      it('should detect hardcoded API keys', async () => {
        const unsafeContent = `
API_KEY="sk-test-123456789"
secret_token = "dangerous_secret"
password: "unsafe_password"
`.repeat(10) // Make it long enough to pass length validation

        fs.readFile.mockResolvedValue(unsafeContent)

        const validation = await publishManager.validateRuleForPublishing(testRulePath)

        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('Potential API key detected')
        expect(validation.errors).toContain('Potential secret detected')
        expect(validation.errors).toContain('Potential password detected')
      })

      it('should detect dangerous code patterns', async () => {
        const dangerousContent = `
This rule contains dangerous patterns:
- eval(userInput)
- exec("rm -rf /")
- system("dangerous command")
- shell_exec("bad stuff")
- Template literal: \${\`dangerous\`}
`.repeat(10) // Make it long enough

        fs.readFile.mockResolvedValue(dangerousContent)

        const validation = await publishManager.validateRuleForPublishing(testRulePath)

        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('Use of eval() detected - potential security risk')
        expect(validation.errors).toContain('Use of exec() detected - potential security risk')
        expect(validation.errors).toContain('Use of system() detected - potential security risk')
      })

      it('should detect suspicious URLs', async () => {
        const suspiciousContent = `
Visit these links:
- https://suspicious.tk/malware
- https://bit.ly/shortlink
- https://tinyurl.com/redirect
`.repeat(10)

        fs.readFile.mockResolvedValue(suspiciousContent)

        const validation = await publishManager.validateRuleForPublishing(testRulePath)

        expect(validation.errors).toContain('Suspicious .tk domain detected')
        expect(validation.errors).toContain('Shortened URL detected - please use full URLs')
      })
    })

    describe('Quality Scoring', () => {
      it('should calculate quality score based on content metrics', async () => {
        const highQualityContent = `
# High Quality Rule

This is a comprehensive rule with:

## Structure
- Clear headings
- Organized sections
- Proper formatting

## Examples
\`\`\`javascript
function example1() {
  return "code example";
}
\`\`\`

\`\`\`typescript
const example2: string = "another example";
\`\`\`

More \`inline code\` examples and detailed explanations.

## Guidelines
1. Follow best practices
2. Use proper patterns
3. Maintain consistency

This content has good readability and structure.`.repeat(2)

        fs.readFile.mockResolvedValue(highQualityContent)

        const validation = await publishManager.validateRuleForPublishing('/test/blueprint.mdc')

        expect(validation.qualityScore).toBeGreaterThanOrEqual(7)
      })

      it('should give lower scores for poor quality content', async () => {
        const lowQualityContent =
          'basic rule with no structure examples or formatting and very poor readability with run on sentences'

        fs.readFile.mockResolvedValue(lowQualityContent)

        const validation = await publishManager.validateRuleForPublishing(testRulePath)

        expect(validation.qualityScore).toBeLessThan(5)
      })
    })
  })

  describe('Format Detection', () => {
    const testCases = [
      {
        filename: '.cursorrules',
        content: 'cursor rules content',
        expected: 'cursor-rules',
      },
      {
        filename: 'CLAUDE.md',
        content: '# Claude memory content',
        expected: 'claude-memory',
      },
      {
        filename: 'copilot-config.json',
        content: '{"guidelines": []}',
        expected: 'copilot-config',
      },
      {
        filename: 'windsurf-rules.xml',
        content: '<windsurf>rules</windsurf>',
        expected: 'windsurf-rules',
      },
      {
        filename: 'blueprint.mdc',
        content: '---\ntitle: Test\n---\n# Content',
        expected: 'vdk-blueprint',
      },
      {
        filename: 'rules.md',
        content: '# Generic markdown content',
        expected: 'markdown',
      },
      {
        filename: 'rules.txt',
        content: 'plain text content',
        expected: 'text',
      },
    ]

    testCases.forEach(({ filename, content, expected }) => {
      it(`should detect ${expected} format for ${filename}`, () => {
        const result = publishManager.detectRuleFormat(`/test/${filename}`, content)
        expect(result).toBe(expected)
      })
    })

    it('should detect VDK blueprint format by YAML frontmatter', () => {
      const content = `---
title: Test Blueprint
description: Test
---

# Blueprint content`

      const result = publishManager.detectRuleFormat('/test/rule.md', content)
      expect(result).toBe('vdk-blueprint')
    })
  })

  describe('Project Context Extraction', () => {
    it('should extract comprehensive project context', async () => {
      const mockProjectData = {
        files: [
          { name: 'package.json', path: '/test/package.json' },
          { name: 'src/index.ts', path: '/test/src/index.ts' },
          { name: 'src/utils.js', path: '/test/src/utils.js' },
          { name: '__tests__/test.spec.js', path: '/test/__tests__/test.spec.js' },
        ],
        directories: ['src', '__tests__'],
      }

      mockProjectScanner.scanProject.mockResolvedValue(mockProjectData)

      const context = await publishManager.extractProjectContext()

      expect(context.name).toBe('project')
      expect(context.language).toBe('typescript')
      expect(context.technologies).toContain('nodejs')
      expect(context.hasPackageJson).toBe(true)
      expect(context.structure.hasTests).toBe(true)
    })

    it('should handle project scanning failures gracefully', async () => {
      mockProjectScanner.scanProject.mockRejectedValue(new Error('Scan failed'))

      const context = await publishManager.extractProjectContext()

      expect(context.name).toBe('project')
      expect(context.framework).toBe('generic')
      expect(context.language).toBe('javascript')
      expect(context.hasPackageJson).toBe(false)
    })

    it('should detect primary language from file extensions', () => {
      const projectData = {
        files: [{ name: 'main.py' }, { name: 'utils.py' }, { name: 'config.js' }],
      }

      const result = publishManager.detectPrimaryLanguage(projectData)
      expect(result).toBe('python')
    })

    it('should extract technologies from file patterns', () => {
      const projectData = {
        files: [
          { name: 'package.json' },
          { name: 'tailwind.config.js' },
          { name: 'Dockerfile' },
          { name: 'jest.config.js' },
        ],
      }

      const result = publishManager.extractTechnologies(projectData)
      expect(result).toContain('nodejs')
      expect(result).toContain('docker')
    })
  })

  describe('Publishing Workflows', () => {
    const mockRulePath = '/test/project/.cursorrules'
    const mockValidation = {
      valid: true,
      content: 'test rule content',
      detectedFormat: 'cursor-rules',
      qualityScore: 8,
      errors: [],
      warnings: [],
    }

    beforeEach(() => {
      fs.access.mockResolvedValue()
      publishManager.validateRuleForPublishing = vi.fn().mockResolvedValue(mockValidation)
      publishManager.extractProjectContext = vi.fn().mockResolvedValue({
        name: 'test-project',
        framework: 'react',
        language: 'typescript',
      })
    })

    describe('Hub Publishing', () => {
      it('should publish to Hub successfully with authentication', async () => {
        mockHubClient.checkAuth.mockResolvedValue({ authenticated: true })
        mockFormatConverter.convertToUniversal.mockResolvedValue({
          title: 'Converted Rule',
          content: 'converted content',
        })
        mockHubClient.uploadBlueprint.mockResolvedValue({
          blueprintId: 'bp-123',
          tempUrl: 'https://vdk.tools/temp/bp-123',
          expiresAt: '2024-01-02T00:00:00Z',
        })

        const result = await publishManager.publishViaHub(mockRulePath, mockValidation)

        expect(result.success).toBe(true)
        expect(result.platform).toBe('hub')
        expect(result.blueprintId).toBe('bp-123')
        expect(result.shareUrl).toBe('https://vdk.tools/temp/bp-123')
        expect(result.qualityScore).toBe(8)

        expect(mockHubClient.checkAuth).toHaveBeenCalled()
        expect(mockFormatConverter.convertToUniversal).toHaveBeenCalled()
        expect(mockHubClient.uploadBlueprint).toHaveBeenCalledWith(
          expect.objectContaining({
            blueprint: { title: 'Converted Rule', content: 'converted content' },
            status: 'pending_confirmation',
          })
        )
      })

      it('should handle authentication requirement', async () => {
        mockHubClient.checkAuth.mockResolvedValue({ authenticated: false })
        mockHubClient.promptForAuth.mockResolvedValue(false)

        await expect(publishManager.publishViaHub(mockRulePath, mockValidation)).rejects.toThrow(
          'Hub authentication required for Hub publishing'
        )
      })

      it('should publish as private when requested', async () => {
        mockHubClient.checkAuth.mockResolvedValue({ authenticated: true })
        mockFormatConverter.convertToUniversal.mockResolvedValue({ content: 'converted' })
        mockHubClient.uploadBlueprint.mockResolvedValue({
          blueprintId: 'bp-private',
          tempUrl: 'https://vdk.tools/temp/bp-private',
          expiresAt: '2024-01-02T00:00:00Z',
        })

        const result = await publishManager.publishViaHub(mockRulePath, mockValidation, {
          private: true,
        })

        expect(result.success).toBe(true)
        expect(mockHubClient.uploadBlueprint).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'private',
          })
        )
      })
    })

    describe('GitHub Publishing', () => {
      it('should publish via GitHub PR successfully', async () => {
        mockFormatConverter.convertToUniversal.mockResolvedValue({
          title: 'Converted Rule',
          content: 'converted content',
        })
        mockGitHubClient.createCommunityBlueprintPR.mockResolvedValue({
          prUrl: 'https://github.com/org/repo/pull/123',
          blueprintId: 'github-bp-123',
        })

        const result = await publishManager.publishViaGitHub(mockRulePath, mockValidation, {
          name: 'Custom Rule Name',
        })

        expect(result.success).toBe(true)
        expect(result.platform).toBe('github')
        expect(result.prUrl).toBe('https://github.com/org/repo/pull/123')
        expect(result.blueprintId).toBe('github-bp-123')
        expect(result.qualityScore).toBe(8)

        expect(mockGitHubClient.createCommunityBlueprintPR).toHaveBeenCalledWith(
          expect.objectContaining({
            blueprint: { title: 'Converted Rule', content: 'converted content' },
            customName: 'Custom Rule Name',
          })
        )
      })

      it('should handle GitHub PR creation failures', async () => {
        mockFormatConverter.convertToUniversal.mockResolvedValue({ content: 'converted' })
        mockGitHubClient.createCommunityBlueprintPR.mockRejectedValue(new Error('PR creation failed'))

        await expect(publishManager.publishViaGitHub(mockRulePath, mockValidation)).rejects.toThrow(
          'PR creation failed'
        )
      })
    })

    describe('Main Publish Method', () => {
      it('should choose Hub publishing by default', async () => {
        publishManager.publishViaHub = vi.fn().mockResolvedValue({
          success: true,
          platform: 'hub',
        })

        const result = await publishManager.publish(mockRulePath)

        expect(result.success).toBe(true)
        expect(result.platform).toBe('hub')
        expect(publishManager.publishViaHub).toHaveBeenCalled()
      })

      it('should choose GitHub publishing when specified', async () => {
        publishManager.publishViaGitHub = vi.fn().mockResolvedValue({
          success: true,
          platform: 'github',
        })

        const result = await publishManager.publish(mockRulePath, { github: true })

        expect(result.success).toBe(true)
        expect(result.platform).toBe('github')
        expect(publishManager.publishViaGitHub).toHaveBeenCalled()
      })

      it('should handle validation failures', async () => {
        publishManager.validateRuleForPublishing = vi.fn().mockResolvedValue({
          valid: false,
          errors: ['Validation error 1', 'Validation error 2'],
          warnings: ['Warning 1'],
        })

        await expect(publishManager.publish(mockRulePath)).rejects.toThrow('Rule validation failed')
      })

      it('should handle missing file', async () => {
        fs.access.mockRejectedValue(new Error('File not found'))

        await expect(publishManager.publish('/nonexistent/file')).rejects.toThrow('File not found')
      })
    })
  })

  describe('Preview Functionality', () => {
    beforeEach(() => {
      publishManager.validateRuleForPublishing = vi.fn().mockResolvedValue({
        valid: true,
        content: 'test content',
        detectedFormat: 'cursor-rules',
        qualityScore: 7,
        errors: [],
        warnings: [],
      })

      publishManager.extractProjectContext = vi.fn().mockResolvedValue({
        name: 'test-project',
        framework: 'react',
        language: 'typescript',
      })

      mockFormatConverter.previewConversion.mockResolvedValue({
        title: 'Preview Rule',
        content: 'preview content',
      })
    })

    it('should generate publication preview', async () => {
      const preview = await publishManager.previewPublication('/test/rule.md')

      expect(preview.summary).toContain('cursor-rules')
      expect(preview.summary).toContain('Quality: 7/10')
      expect(preview.summary).toContain('react project')
      expect(preview.validation.valid).toBe(true)
      expect(preview.universalFormat.title).toBe('Preview Rule')
      expect(preview.projectContext.name).toBe('test-project')
      expect(preview.recommendations).toBeDefined()
    })

    it('should handle preview generation errors', async () => {
      publishManager.validateRuleForPublishing.mockRejectedValue(new Error('Validation failed'))

      await expect(publishManager.previewPublication('/test/rule.md')).rejects.toThrow(
        'Preview generation failed: Validation failed'
      )
    })
  })

  describe('Content Analysis Methods', () => {
    it('should analyze content structure correctly', () => {
      const content = `# Main Heading

## Sub Heading

- List item 1
- List item 2

1. Numbered item
2. Another item

\`\`\`javascript
console.log('code block');
\`\`\`

| Column 1 | Column 2 |
|----------|----------|
| Data     | More     |`

      const result = publishManager.analyzeStructure(content)

      expect(result.hasHeadings).toBe(true)
      expect(result.hasLists).toBe(true)
      expect(result.hasCodeBlocks).toBe(true)
      expect(result.hasTables).toBe(true)
      expect(result.lineCount).toBeGreaterThan(10)
    })

    it('should count code examples accurately', () => {
      const content = `
\`\`\`javascript
function example1() {}
\`\`\`

Some text with \`inline code\` and more \`code\` and \`another\`.

\`\`\`python
def example2():
    pass
\`\`\`

More \`inline\` code examples.`

      const result = publishManager.countExamples(content)
      expect(result).toBe(3) // 2 code blocks + 1 from inline (5/3 = 1.67, floored to 1)
    })

    it('should assess content clarity', () => {
      const clearContent = `
This is clear content. Each sentence is short. The writing flows well.
Ideas are expressed simply. The structure is logical.`

      const unclearContent = `
This is an extremely long and convoluted sentence that goes on and on without making a clear point and uses many unnecessary words that make it difficult to understand what the author is trying to communicate to the reader who may become confused or lost in the verbose and meandering explanation.`

      const clearResult = publishManager.assessClarity(clearContent)
      const unclearResult = publishManager.assessClarity(unclearContent)

      expect(clearResult.readabilityScore).toBeGreaterThan(unclearResult.readabilityScore)
      expect(clearResult.avgWordsPerSentence).toBeLessThan(unclearResult.avgWordsPerSentence)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty rule files', async () => {
      fs.readFile.mockResolvedValue('')

      const validation = await publishManager.validateRuleForPublishing('/test/empty.md')

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Rule content too short (minimum 100 characters)')
    })

    it('should handle malformed JSON gracefully', async () => {
      const invalidJson = '{ "incomplete": json'
      fs.readFile.mockResolvedValue(invalidJson)

      const validation = await publishManager.validateRuleForPublishing('/test/invalid.json')

      expect(validation.errors).toContain('Invalid JSON format for Copilot configuration')
    })

    it('should handle VDK blueprint parsing errors', async () => {
      const malformedBlueprint = `---
invalid: yaml: structure
---
# Content`

      fs.readFile.mockResolvedValue(malformedBlueprint)
      matter.mockImplementation(() => {
        throw new Error('YAML parsing failed')
      })

      const validation = await publishManager.validateRuleForPublishing('/test/bad.mdc')

      expect(validation.errors).toContain('VDK Blueprint parsing failed: YAML parsing failed')
    })

    it('should handle security scanning failures gracefully', async () => {
      const content = 'x'.repeat(200) // Valid length
      fs.readFile.mockResolvedValue(content)

      // Mock scanForSecurity to throw an error
      const originalScanForSecurity = publishManager.scanForSecurity
      publishManager.scanForSecurity = vi.fn().mockRejectedValue(new Error('Scan failed'))

      const validation = await publishManager.validateRuleForPublishing('/test/rule.md')

      expect(validation.warnings).toContain('Security scan failed: Scan failed')

      // Restore original method
      publishManager.scanForSecurity = originalScanForSecurity
    })
  })

  describe('Lazy Loading of External Dependencies', () => {
    it('should lazy load Hub client', async () => {
      // Reset the mocked method to test actual lazy loading behavior
      delete publishManager.hubClient
      publishManager.getHubClient = PublishManager.prototype.getHubClient

      // Mock the dynamic import
      vi.doMock('./clients/VDKHubClient.js', () => ({
        VDKHubClient: vi.fn().mockImplementation(() => ({ test: 'hubClient' })),
      }))

      const hubClient = await publishManager.getHubClient()
      const sameClient = await publishManager.getHubClient()

      expect(hubClient).toBe(sameClient) // Should return same instance
    })

    it('should lazy load GitHub client', async () => {
      delete publishManager.githubClient
      publishManager.getGitHubClient = PublishManager.prototype.getGitHubClient

      vi.doMock('./clients/GitHubPRClient.js', () => ({
        GitHubPRClient: vi.fn().mockImplementation(() => ({ test: 'githubClient' })),
      }))

      const githubClient = await publishManager.getGitHubClient()
      const sameClient = await publishManager.getGitHubClient()

      expect(githubClient).toBe(sameClient)
    })

    it('should lazy load format converter', async () => {
      delete publishManager.formatConverter
      publishManager.getFormatConverter = PublishManager.prototype.getFormatConverter

      vi.doMock('./UniversalFormatConverter.js', () => ({
        UniversalFormatConverter: vi.fn().mockImplementation(() => ({ test: 'formatConverter' })),
      }))

      const formatConverter = await publishManager.getFormatConverter()
      const sameConverter = await publishManager.getFormatConverter()

      expect(formatConverter).toBe(sameConverter)
    })
  })

  describe('UI Helper Methods', () => {
    it('should generate preview summary correctly', () => {
      const validation = {
        detectedFormat: 'cursor-rules',
        content: 'x'.repeat(500),
        qualityScore: 8,
      }

      const context = {
        framework: 'nextjs',
      }

      const summary = publishManager.generatePublishPreviewSummary(validation, context)

      expect(summary).toContain('cursor-rules')
      expect(summary).toContain('500 chars')
      expect(summary).toContain('Quality: 8/10')
      expect(summary).toContain('nextjs project')
    })

    it('should generate publishing recommendations', () => {
      const lowQualityValidation = {
        qualityScore: 4,
        content: 'short',
      }

      const genericContext = {
        framework: 'generic',
      }

      const recommendations = publishManager.generatePublishingRecommendations(lowQualityValidation, genericContext)

      expect(recommendations).toContain('Consider adding more examples and documentation')
      expect(recommendations).toContain('Rule content is quite brief - consider adding more detail')
      expect(recommendations).toContain('Consider adding technology-specific context for better adaptation')
    })
  })
})
