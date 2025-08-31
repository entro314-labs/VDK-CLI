/**
 * GitHub Copilot Integration Module
 * --------------------------------
 * Provides integration with GitHub Copilot Enterprise coding guidelines
 * and best practices for code completion and review features.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { BaseIntegration } from './base-integration.js'

/**
 * GitHub Copilot configuration and integration utilities
 */
export class GitHubCopilotIntegration extends BaseIntegration {
  constructor(projectPath = process.cwd()) {
    super('GitHub Copilot', projectPath)
    this.copilotConfigPath = path.join(projectPath, '.github')
    this.copilotGuidelinesPath = path.join(this.copilotConfigPath, 'copilot')
  }

  /**
   * Get GitHub Copilot configuration paths
   * @returns {Object} Configuration paths for GitHub Copilot
   */
  getConfigPaths() {
    return {
      // GitHub Copilot Enterprise guidelines (repository level)
      githubDirectory: this.copilotConfigPath,
      copilotDirectory: this.copilotGuidelinesPath,
      guidelinesConfig: path.join(this.copilotGuidelinesPath, 'guidelines.json'),

      // Documentation files
      guidelinesDocs: path.join(this.copilotGuidelinesPath, 'README.md'),

      // VDK-specific Copilot configuration
      vdkCopilotConfig: path.join(this.copilotGuidelinesPath, 'vdk-config.json'),

      // Global GitHub CLI config (for detection)
      globalGitHubConfig: path.join(os.homedir(), '.config', 'gh'),
    }
  }

  /**
   * Detect if GitHub Copilot is being used in the project
   * @returns {Object} Detection result with details
   */
  detectUsage() {
    const detection = {
      isUsed: false,
      confidence: 'none', // none, low, medium, high
      indicators: [],
      recommendations: [],
    }

    // 1. Check for .github directory and Copilot configuration
    if (this.directoryExists(this.copilotConfigPath)) {
      detection.indicators.push('Project has .github directory')

      // Check for Copilot-specific files
      const copilotFiles = ['copilot/', 'CODEOWNERS', 'pull_request_template.md']

      copilotFiles.forEach((file) => {
        const filePath = path.join(this.copilotConfigPath, file)
        if (this.directoryExists(filePath) || this.fileExists(filePath)) {
          detection.indicators.push(`Found .github/${file}`)
          if (file === 'copilot/') {
            detection.confidence = 'high'
            detection.isUsed = true
          } else if (detection.confidence === 'none') {
            detection.confidence = 'low'
          }
        }
      })
    }

    // 2. Check for GitHub CLI configuration
    const platformPaths = this.getPlatformPaths()
    const githubPaths = [path.join(platformPaths.home, '.config', 'gh'), path.join(platformPaths.home, '.gitconfig')]

    githubPaths.forEach((githubPath) => {
      if (this.directoryExists(githubPath) || this.fileExists(githubPath)) {
        detection.indicators.push(`GitHub configuration found at ${githubPath}`)
        if (detection.confidence === 'none') {
          detection.confidence = 'low'
        }
      }
    })

    // 3. Check for GitHub CLI command availability
    if (this.commandExists('gh')) {
      detection.indicators.push('GitHub CLI (gh) is available')
      if (detection.confidence === 'none') {
        detection.confidence = 'low'
      }

      const version = this.getCommandVersion('gh', '--version')
      if (version) {
        detection.indicators.push(`GitHub CLI version: ${version}`)
      }
    }

    // 4. Check for Git remote origins pointing to GitHub
    try {
      // execSync is already imported at the top
      const remoteOutput = execSync('git remote -v', {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: 'pipe',
      })

      if (remoteOutput.includes('github.com')) {
        detection.indicators.push('Repository has GitHub remote origin')
        detection.isUsed = true
        if (detection.confidence === 'none' || detection.confidence === 'low') {
          detection.confidence = 'medium'
        }
      }
    } catch {
      // Not a git repository or git not available
    }

    // 5. Check for existing Copilot guidelines
    if (this.directoryExists(this.copilotGuidelinesPath)) {
      detection.indicators.push('Found GitHub Copilot guidelines directory')
      detection.confidence = 'high'
      detection.isUsed = true
    }

    // 6. Check .gitignore for GitHub-specific patterns
    const gitignorePatterns = this.checkGitignore(['.github'])
    if (gitignorePatterns.length > 0) {
      detection.indicators.push(`GitHub patterns found in .gitignore: ${gitignorePatterns.join(', ')}`)
    }

    // 7. Generate recommendations based on detection
    if (detection.confidence === 'none') {
      detection.recommendations.push(
        'GitHub Copilot not detected. Requires GitHub repository and Copilot Enterprise subscription'
      )
      detection.recommendations.push('Install GitHub CLI: https://cli.github.com/')
    } else if (detection.confidence === 'low') {
      detection.recommendations.push('GitHub detected but Copilot guidelines not configured')
      detection.recommendations.push('Run: vdk init --ide-integration to set up Copilot integration')
    } else if (detection.confidence === 'medium') {
      detection.recommendations.push('GitHub repository detected')
      detection.recommendations.push('Configure Copilot Enterprise guidelines in repository settings')
    } else if (detection.confidence === 'high') {
      detection.recommendations.push('GitHub Copilot guidelines are configured')
      detection.recommendations.push('Consider reviewing and updating guidelines with VDK patterns')
    }

    return detection
  }

  /**
   * Initialize GitHub Copilot configuration for VDK integration
   * @param {Object} options - Configuration options
   * @returns {boolean} Success status
   */
  async initialize(options = {}) {
    const _paths = this.getConfigPaths()

    try {
      // Create .github/copilot directory structure
      await this.ensureDirectory(this.copilotConfigPath)
      await this.ensureDirectory(this.copilotGuidelinesPath)

      // Create VDK-specific Copilot configuration
      await this.createCopilotVDKConfig(options)

      // Create documentation for Copilot guidelines
      await this.createCopilotGuidelines(options)

      // Generate example guidelines based on project analysis
      await this.generateProjectSpecificGuidelines(options)

      return true
    } catch (error) {
      console.error('Failed to initialize GitHub Copilot configuration:', error.message)
      return false
    }
  }

  /**
   * Create VDK-specific Copilot configuration
   * @param {Object} options - Configuration options
   */
  async createCopilotVDKConfig(options = {}) {
    const paths = this.getConfigPaths()

    if (this.fileExists(paths.vdkCopilotConfig)) {
      return // Don't overwrite existing config
    }

    const vdkConfig = {
      vdk: {
        enabled: true,
        version: '1.0.0',
        integration: 'github-copilot',
        projectName: options.projectName || path.basename(this.projectPath),
      },
      copilot: {
        enterprise: options.hasEnterprise,
        codeReview: true,
        codeCompletion: true,
        guidelinesVersion: '1.0',
      },
      guidelines: {
        maxGuidelines: 6,
        enforcementLevel: 'strict',
        languageSupport: options.languages || ['javascript', 'typescript', 'python'],
        autoUpdate: true,
      },
      generated: {
        timestamp: new Date().toISOString(),
        source: 'vdk-cli',
      },
    }

    await this.writeJsonFile(paths.vdkCopilotConfig, vdkConfig)
  }

  /**
   * Create documentation for Copilot guidelines setup
   * @param {Object} options - Configuration options
   */
  async createCopilotGuidelines(options = {}) {
    const paths = this.getConfigPaths()

    if (this.fileExists(paths.guidelinesDocs)) {
      return // Don't overwrite existing docs
    }

    const guidelinesContent = `# GitHub Copilot Guidelines for VDK Integration

## Overview

This directory contains GitHub Copilot Enterprise coding guidelines generated by VDK CLI. These guidelines help ensure consistent code quality and adherence to project standards.

## Setup Instructions

### Prerequisites
- GitHub Copilot Enterprise subscription
- Repository admin access
- VDK CLI configured for this project

### Configuration Steps

1. **Access Repository Settings**
   - Go to your repository on GitHub
   - Navigate to Settings → Code & automation → Copilot → Code review

2. **Add Guidelines**
   - Maximum 6 guidelines per repository
   - Each guideline: name + description (max 600 characters)
   - Optional file path patterns using fnmatch syntax

3. **Generated Guidelines**
   The VDK CLI has generated project-specific guidelines based on your codebase analysis:

${this.generateGuidelinesList(options)}

## File Path Patterns

Use these patterns to scope guidelines to specific files:

- \`**/*.js\` - All JavaScript files
- \`**/*.ts\` - All TypeScript files
- \`**/*.py\` - All Python files
- \`src/**/*\` - All files in src directory
- \`tests/**/*\` - All test files
- \`**/*.test.*\` - All test files by extension

## Best Practices

### Effective Guidelines
- Be specific about what Copilot should look for
- Use clear, concise language
- Focus on project-specific patterns
- Avoid rules that linters can handle

### Guidelines to Avoid
- Generic style rules (use ESLint/Prettier instead)
- Ambiguous wording with multiple interpretations
- Multiple different ideas in one guideline

## VDK Integration

- Guidelines updated automatically with \`vdk sync\`
- Project patterns detected and incorporated
- Technology stack considerations included
- Architecture patterns enforced

---
*Generated by VDK CLI - Update with \`vdk copilot --refresh\`*
`

    await fs.promises.writeFile(paths.guidelinesDocs, guidelinesContent, 'utf8')
  }

  /**
   * Generate project-specific guidelines based on VDK analysis
   * @param {Object} options - Project analysis results
   */
  async generateProjectSpecificGuidelines(options = {}) {
    const guidelines = []

    // Generate guidelines based on detected technology stack
    if (options.techStack) {
      if (options.techStack.frameworks?.includes('React')) {
        guidelines.push({
          title: 'React Component Standards',
          description:
            'Use functional components with hooks. Include proper prop typing with TypeScript. Add error boundaries for complex components.',
          paths: ['**/*.tsx', '**/*.jsx'],
        })
      }

      if (options.techStack.frameworks?.includes('Node.js') || options.techStack.frameworks?.includes('Express')) {
        guidelines.push({
          title: 'API Validation Requirements',
          description:
            'Validate all input parameters. Use proper HTTP status codes. Implement error handling middleware. Add rate limiting where appropriate.',
          paths: ['src/api/**/*', 'src/routes/**/*', '**/*route*'],
        })
      }

      if (options.techStack.primaryLanguages?.includes('TypeScript')) {
        guidelines.push({
          title: 'TypeScript Best Practices',
          description:
            "Use strict type checking. Avoid 'any' types. Define proper interfaces for data structures. Use generic types for reusable components.",
          paths: ['**/*.ts', '**/*.tsx'],
        })
      }

      if (options.techStack.primaryLanguages?.includes('Python')) {
        guidelines.push({
          title: 'Python Code Standards',
          description:
            'Follow PEP 8 guidelines. Use type hints for function parameters and returns. Include docstrings for classes and functions.',
          paths: ['**/*.py'],
        })
      }
    }

    // Add general VDK guidelines
    guidelines.push({
      title: 'VDK Integration Standards',
      description:
        'Follow VDK CLI naming conventions. Use unified rule formats. Include proper error handling and logging patterns. Update documentation when adding features.',
      paths: [],
    })

    guidelines.push({
      title: 'Security Best Practices',
      description:
        'Never commit secrets or API keys. Validate all user inputs. Use environment variables for configuration. Implement proper authentication patterns.',
      paths: [],
    })

    // Save guidelines configuration
    const paths = this.getConfigPaths()
    const guidelinesConfig = {
      guidelines: guidelines.slice(0, 6), // GitHub Copilot max 6 guidelines
      generated: {
        timestamp: new Date().toISOString(),
        source: 'vdk-cli',
        projectAnalysis: {
          techStack: options.techStack,
          patterns: options.patterns,
        },
      },
    }

    await this.writeJsonFile(paths.guidelinesConfig, guidelinesConfig)
  }

  /**
   * Generate guidelines list for documentation
   * @param {Object} options - Configuration options
   * @returns {string} Formatted guidelines list
   */
  generateGuidelinesList(_options = {}) {
    const commonGuidelines = [
      '**VDK Integration Standards** - Follow VDK CLI conventions and patterns',
      '**Security Best Practices** - Never commit secrets, validate inputs',
      '**Error Handling** - Implement proper error boundaries and logging',
      '**Documentation** - Update docs when adding features',
      '**Testing** - Include tests for new functionality',
      '**Performance** - Consider performance implications of changes',
    ]

    return commonGuidelines.map((guideline) => `   - ${guideline}`).join('\n')
  }

  /**
   * Check if GitHub Copilot Enterprise features are available
   * @returns {Promise<Object>} Feature availability status
   */
  async getCopilotFeatures() {
    const features = {
      enterpriseAccess: false,
      codeReview: false,
      codeCompletion: false,
      customGuidelines: false,
      repositoryConfigured: false,
    }

    try {
      // Check if we're in a GitHub repository
      // execSync is already imported at the top
      const remoteOutput = execSync('git remote -v', {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: 'pipe',
      })

      if (remoteOutput.includes('github.com')) {
        features.repositoryConfigured = true

        // Basic features assume GitHub repository
        features.codeCompletion = true

        // Enterprise features require subscription (can't detect programmatically)
        // User would need to configure manually
      }
    } catch {
      // Not a git repository or no GitHub remote
    }

    // Check for Copilot configuration
    const paths = this.getConfigPaths()
    if (this.fileExists(paths.vdkCopilotConfig)) {
      const config = await this.readJsonFile(paths.vdkCopilotConfig)
      features.enterpriseAccess = config?.copilot?.enterprise
      features.customGuidelines = config?.copilot?.enterprise
      features.codeReview = config?.copilot?.codeReview
    }

    return features
  }

  /**
   * Get GitHub Copilot status summary
   * @returns {Promise<Object>} Status summary object
   */
  async getStatusSummary() {
    const detection = this.getCachedDetection()
    const features = await this.getCopilotFeatures()
    const paths = this.getConfigPaths()

    return {
      isConfigured: detection.isUsed,
      confidence: detection.confidence,
      features,
      configPaths: paths,
      recommendations: detection.recommendations,
      enterpriseRequired: true,
      setupInstructions: 'Configure guidelines in GitHub repository settings',
    }
  }
}
