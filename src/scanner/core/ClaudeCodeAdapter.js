import os from 'node:os'
import path from 'node:path'

import chalk from 'chalk'
import fs from 'fs-extra'

import { validateCommand } from '../../utils/schema-validator.js'
import { RuleAdapter } from './RuleAdapter.js'

/**
 * Enhanced Claude Code Adapter
 *
 * Leverages Claude Code's advanced features including:
 * - Hierarchical memory management with import system
 * - Sophisticated slash command generation
 * - MCP server integration patterns
 * - Team memory synchronization
 * - Native Claude Code file structure
 */
export class ClaudeCodeAdapter extends RuleAdapter {
  constructor(options = {}) {
    super(options)
    this.claudeConfigPath = path.join(this.projectPath, '.claude')
    this.claudeUserPath = path.join(os.homedir(), '.claude')
    this.ruleGenerator = options.ruleGenerator // Reference to parent RuleGenerator for centralized fetching
  }

  /**
   * Enhanced Claude Code adaptation with memory hierarchy
   */
  async adaptForClaude(rules, projectContext, categoryFilter = null) {
    console.log('🧠 Generating enhanced Claude Code memory hierarchy...')

    const adapted = {
      files: [],
      directories: [this.claudeConfigPath],
      memoryHierarchy: await this.generateMemoryHierarchy(rules, projectContext, categoryFilter),
      slashCommands: await this.generateSlashCommands(rules, projectContext, categoryFilter),
      mcpIntegrations: await this.generateMcpIntegrations(rules, projectContext),
      settings: await this.generateClaudeSettings(rules, projectContext),
    }

    // Ensure .claude directory exists
    await fs.ensureDir(this.claudeConfigPath)
    await fs.ensureDir(path.join(this.claudeConfigPath, 'commands'))

    // Generate memory files
    for (const memory of adapted.memoryHierarchy) {
      await fs.writeFile(memory.path, memory.content)
      adapted.files.push(memory.path)
    }

    // Generate slash commands
    for (const command of adapted.slashCommands) {
      const commandPath = path.join(this.claudeConfigPath, 'commands', `${command.name}.md`)
      await fs.writeFile(commandPath, command.content)
      adapted.files.push(commandPath)
    }

    // Generate settings
    if (adapted.settings) {
      const settingsPath = path.join(this.claudeConfigPath, 'settings.json')
      await fs.writeFile(settingsPath, JSON.stringify(adapted.settings, null, 2))
      adapted.files.push(settingsPath)
    }

    console.log(`✅ Generated ${adapted.files.length} Claude Code files`)
    return adapted
  }

  /**
   * Generate hierarchical memory structure using CORRECT Claude Code format
   */
  async generateMemoryHierarchy(rules, projectContext, categoryFilter = null) {
    const memories = []
    const _projectName = projectContext.name || path.basename(this.projectPath)

    // Fetch technology-specific rules from remote repository
    let technologyRules = []
    if (this.ruleGenerator?.fetchFromRepository) {
      try {
        console.log('🔍 Fetching technology-specific rules for Claude Code...')
        // Use the full projectContext as analysisData since it contains technologyData
        technologyRules = await this.ruleGenerator.fetchFromRepository(
          projectContext,
          'rules',
          null, // No specific platform filter for rules
          categoryFilter
        )
        console.log(`📚 Fetched ${technologyRules.length} technology-specific rules`)
        if (technologyRules.length > 0) {
          console.log(`📋 Rule names: ${technologyRules.map((r) => r.name).join(', ')}`)
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch technology rules: ${error.message}`)
      }
    }

    // Main project memory with CORRECT Claude Code structure and technology rules
    const mainMemory = await this.generateCorrectClaudeMainMemory(
      rules,
      projectContext,
      technologyRules
    )
    memories.push({
      path: path.join(this.projectPath, 'CLAUDE.md'),
      content: mainMemory,
      type: 'project',
      priority: 'high',
    })

    return memories
  }

  /**
   * Generate CORRECT Claude Code memory structure as per report findings
   */
  async generateCorrectClaudeMainMemory(_rules, projectContext, technologyRules = []) {
    const projectName = projectContext.name || path.basename(this.projectPath)
    // Handle both techStack and technologyData structure
    const techData = projectContext.techStack || projectContext.technologyData || {}
    const frameworks = techData.frameworks || []
    const languages = techData.primaryLanguages || []
    const libraries = techData.libraries || []
    const packageManager = await this.detectPackageManager(projectContext)
    const buildTool = await this.detectBuildTool(projectContext)
    const testFramework = techData.testFramework || 'jest'

    // Extract technology-specific guidelines from remote rules
    const technologyGuidelines = await this.extractTechnologyGuidelines(
      technologyRules,
      projectContext
    )

    return `# ${projectName} - Claude Code Memory

## Project Overview

This is a **${this.determineProjectType(frameworks, languages)}** project.

### Key Information
- **Project Type**: ${this.determineProjectType(frameworks, languages)}
- **Primary Language**: ${languages.join(', ') || 'Not detected'}
- **Frameworks**: ${frameworks.join(', ') || 'Not detected'}
- **Libraries**: ${libraries.slice(0, 3).join(', ') || 'Standard libraries'}

## Coding Preferences

### Code Style
- Use ${this.detectIndentation(projectContext)} indentation
- Prefer ${languages.includes('TypeScript') ? 'TypeScript strict mode' : 'modern JavaScript'}
- ${this.generateStyleGuidelines(projectContext)}

### Project Structure
- Follow ${this.detectProjectStructure(projectContext)} structure
- ${this.generateStructureGuidelines(projectContext)}

### Testing
- Use ${testFramework} for testing
- ${this.generateTestingGuidelines(projectContext)}

## Development Environment

### Tools & Setup
- Package manager: ${packageManager}
- Build tool: ${buildTool}
- Primary IDE: ${await this.detectPrimaryIDE(projectContext)}
- AI Assistant: Claude Code

### Development Commands
- \`${await this.detectDevCommand(projectContext)}\` - Start development server
- \`${await this.detectTestCommand(projectContext)}\` - Run tests
- \`${await this.detectBuildCommand(projectContext)}\` - Build for production

## Technology-Specific Guidelines

${technologyGuidelines}

## Workflow Preferences

### Development Workflow
- Start with failing tests when appropriate
- Run tests before committing
- Use feature flags for incomplete features
- Plan for rollback strategies

### Communication
- Over-communicate in remote environments
- Document decisions and reasoning
- Share knowledge through code comments and docs
- Ask for clarification when requirements are unclear

---
*Generated by VDK CLI - Enhanced for Claude Code*
*Technology rules: ${technologyRules.length} rules integrated*`
  }

  /**
   * Determine project type based on frameworks and languages
   */
  determineProjectType(frameworks, languages) {
    // Prioritize Astro detection first since it's more specific
    if (frameworks.includes('Astro') && frameworks.includes('Starlight')) {
      return 'Astro Starlight Documentation Site'
    }
    if (frameworks.includes('Astro')) {
      return 'Astro Application'
    }
    if (frameworks.includes('Next.js') && frameworks.includes('Supabase')) {
      return 'Next.js + Supabase Full-Stack Application'
    }
    if (frameworks.includes('Next.js')) {
      return 'Next.js Application'
    }
    if (frameworks.includes('React')) {
      return 'React Application'
    }
    if (frameworks.includes('Vue.js')) {
      return 'Vue.js Application'
    }
    if (languages.includes('typescript')) {
      return 'TypeScript Application'
    }
    if (languages.includes('javascript')) {
      return 'JavaScript Application'
    }
    return 'Web Application'
  }

  /**
   * Extract technology-specific guidelines from remote rules
   */
  async extractTechnologyGuidelines(technologyRules, projectContext) {
    if (!technologyRules || technologyRules.length === 0) {
      return `### General Guidelines
- Follow established patterns in the codebase
- Maintain consistency with existing code
- Use project-specific conventions`
    }

    console.log(
      `🔍 Processing ${technologyRules.length} technology rules for guidelines extraction`
    )
    if (this.verbose) {
      technologyRules.forEach((rule) => {
        console.log(`   📄 Rule: ${rule.name}, Content length: ${rule.content?.length || 0}`)
      })
    }

    const guidelines = []
    // Handle both techStack and technologyData structure
    const techData = projectContext.techStack || projectContext.technologyData || {}
    const frameworks = techData.frameworks || []
    const languages = techData.primaryLanguages || []

    // Group rules by category for better organization
    const _rulesByCategory = this.groupRulesByCategory(technologyRules)

    // Extract framework-specific guidelines
    for (const framework of frameworks) {
      // Enhanced framework matching with aliases
      const frameworkLower = framework.toLowerCase()
      const frameworkAliases = {
        'tailwind css': ['tailwind', 'tailwindcss'],
        'next.js': ['nextjs'],
        supabase: ['supabase'],
        react: ['react'],
        typescript: ['typescript', 'ts'],
        'shadcn/ui': ['shadcn', 'shadcnui'],
      }

      const searchTerms = [frameworkLower]
      if (frameworkAliases[frameworkLower]) {
        searchTerms.push(...frameworkAliases[frameworkLower])
      }

      const frameworkRules = technologyRules.filter((rule) =>
        searchTerms.some(
          (term) =>
            rule.name.toLowerCase().includes(term) || rule.path?.toLowerCase().includes(term)
        )
      )

      if (frameworkRules.length > 0) {
        guidelines.push(`### ${framework} Guidelines`)
        for (const rule of frameworkRules.slice(0, 3)) {
          // Limit to 3 most relevant
          const extractedContent = this.extractRuleContent(rule.content, projectContext)
          if (extractedContent) {
            guidelines.push(extractedContent)
          }
        }
        guidelines.push('') // Add spacing
      }
    }

    // Extract language-specific guidelines
    for (const language of languages) {
      const languageRules = technologyRules.filter(
        (rule) =>
          rule.name.toLowerCase().includes(language.toLowerCase()) ||
          rule.path?.toLowerCase().includes(language.toLowerCase())
      )

      if (languageRules.length > 0) {
        guidelines.push(`### ${language} Guidelines`)
        for (const rule of languageRules.slice(0, 2)) {
          // Limit to 2 most relevant
          const extractedContent = this.extractRuleContent(rule.content, projectContext)
          if (extractedContent) {
            guidelines.push(extractedContent)
          }
        }
        guidelines.push('') // Add spacing
      }
    }

    // Extract library-specific guidelines (important for shadcn/ui, etc.)
    const libraries = techData.libraries || []
    for (const library of libraries) {
      const libraryLower = library.toLowerCase()
      const libraryAliases = {
        'shadcn/ui': ['shadcn', 'shadcnui'],
        'tailwind css': ['tailwind', 'tailwindcss'],
        'radix ui': ['radix'],
        'framer motion': ['framer'],
      }

      const searchTerms = [libraryLower]
      if (libraryAliases[libraryLower]) {
        searchTerms.push(...libraryAliases[libraryLower])
      }

      const libraryRules = technologyRules.filter((rule) =>
        searchTerms.some(
          (term) =>
            rule.name.toLowerCase().includes(term) || rule.path?.toLowerCase().includes(term)
        )
      )

      if (libraryRules.length > 0) {
        guidelines.push(`### ${library} Guidelines`)
        for (const rule of libraryRules.slice(0, 2)) {
          // Limit to 2 most relevant
          const extractedContent = this.extractRuleContent(rule.content, projectContext)
          if (extractedContent) {
            guidelines.push(extractedContent)
          }
        }
        guidelines.push('') // Add spacing
      }
    }

    // Add core/general rules
    const coreRules = technologyRules.filter(
      (rule) =>
        rule.path?.includes('core/') || rule.name.includes('core') || rule.name.includes('general')
    )

    if (coreRules.length > 0) {
      guidelines.push('### Core Development Practices')
      for (const rule of coreRules.slice(0, 2)) {
        const extractedContent = this.extractRuleContent(rule.content)
        if (extractedContent) {
          guidelines.push(extractedContent)
        }
      }
    }

    return guidelines.length > 0
      ? guidelines.join('\n')
      : `### Project-Specific Guidelines
- Follow patterns established in this ${frameworks.join('/')} codebase
- Maintain consistency with existing ${languages.join('/')} code
- Reference remote rules: ${technologyRules.length} rules available`
  }

  /**
   * Extract relevant content from a rule's markdown content
   */
  extractRuleContent(content, projectContext = null) {
    if (!content) {
      return null
    }

    try {
      // Remove frontmatter (YAML between ---)
      const withoutFrontmatter = this.stripFrontmatter(content)

      // Split into lines and process
      const lines = withoutFrontmatter.split('\n')
      const relevantLines = []
      let _currentSection = null
      let captureContent = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        if (!trimmed) {
          continue
        }

        // Check for section headers that indicate useful content
        if (
          trimmed.match(
            /^#+\s*(core principles|best practices|guidelines|rules|conventions|patterns|key concepts|important|essential|recommendations|development practices|coding standards)/i
          )
        ) {
          _currentSection = trimmed.replace(/^#+\s*/, '')
          captureContent = true
          continue
        }

        // Check for technology-specific sections
        if (
          trimmed.match(
            /^#+\s*(typescript|nextjs|supabase|react|development|code)\s+(guidelines|best practices|rules|patterns|conventions)/i
          )
        ) {
          _currentSection = trimmed.replace(/^#+\s*/, '')
          captureContent = true
          continue
        }

        // Stop capturing if we hit unrelated sections or tech stacks (which are just lists)
        if (
          trimmed.match(
            /^#+\s+(meta|compatibility|examples|implementation|setup|overview|tech stack|technology stack|recommended|stack)/i
          )
        ) {
          captureContent = false
          continue
        }

        // Capture content if we're in a relevant section
        if (captureContent) {
          // CRITICAL: Filter out mobile/native patterns for web projects
          const isMobilePattern = this.isMobilePattern(trimmed)
          const isWebProject = this.isWebProject(projectContext)

          if (isWebProject && isMobilePattern) {
            continue // Skip mobile patterns for web projects
          }

          // Skip technology lists that start with **Technology** (like **Next.js 15+**)
          if (trimmed.match(/^-\s*\*\*[A-Z][^*]+\*\*\s*(with|for|v?\d)/i)) {
            continue // Skip technology stack items
          }

          // Capture bullet points that are actual guidelines (contain action words)
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (this.isActionableGuideline(trimmed)) {
              relevantLines.push(trimmed)
            }
          }
          // Capture numbered lists that are guidelines
          else if (trimmed.match(/^\d+\.\s/)) {
            const content = trimmed.replace(/^\d+\.\s/, '')
            if (this.isActionableGuideline(content)) {
              relevantLines.push(`- ${content}`)
            }
          }
          // Capture important standalone statements
          else if (
            trimmed.length > 25 &&
            !trimmed.startsWith('#') &&
            (trimmed.includes('should') ||
              trimmed.includes('must') ||
              trimmed.includes('prefer') ||
              trimmed.includes('avoid') ||
              trimmed.includes('use') ||
              trimmed.includes('always') ||
              trimmed.includes('never') ||
              trimmed.includes('implement'))
          ) {
            relevantLines.push(`- ${trimmed}`)
          }
        }

        // Limit content extraction
        if (relevantLines.length >= 10) {
          break
        }
      }

      // If no structured content found, extract first few bullet points from anywhere
      if (relevantLines.length === 0) {
        const bullets = lines
          .filter((line) => {
            const trimmed = line.trim()
            return (trimmed.startsWith('- ') || trimmed.startsWith('* ')) && trimmed.length > 15
          })
          .slice(0, 5)

        return bullets.length > 0 ? bullets.join('\n') : null
      }

      return relevantLines.slice(0, 8).join('\n') // Limit to 8 most relevant points
    } catch (error) {
      console.warn(`Failed to extract content from rule: ${error.message}`)
      return null
    }
  }

  /**
   * Strip YAML frontmatter from content (reusing RuleAdapter pattern)
   */
  stripFrontmatter(content) {
    if (content.startsWith('---')) {
      const parts = content.split('---')
      return parts.slice(2).join('---').trim()
    }
    return content
  }

  /**
   * Check if a line contains mobile/native patterns that shouldn't be in web projects
   */
  isMobilePattern(line) {
    const mobilePatternsLower = line.toLowerCase()
    return (
      mobilePatternsLower.includes('expo-font') ||
      mobilePatternsLower.includes('react-native') ||
      (mobilePatternsLower.includes('usecolorscheme') &&
        mobilePatternsLower.includes('react-native')) ||
      mobilePatternsLower.includes('expo router') ||
      mobilePatternsLower.includes('@expo/') ||
      (mobilePatternsLower.includes('error boundaries') &&
        mobilePatternsLower.includes('navigation tree')) ||
      (mobilePatternsLower.includes('ios') && mobilePatternsLower.includes('android')) ||
      (mobilePatternsLower.includes('mobile') &&
        (mobilePatternsLower.includes('app') || mobilePatternsLower.includes('device'))) ||
      (mobilePatternsLower.includes('native') && !mobilePatternsLower.includes('native web')) ||
      mobilePatternsLower.includes('capacitor') ||
      mobilePatternsLower.includes('cordova') ||
      (mobilePatternsLower.includes('ionic') && !mobilePatternsLower.includes('ionic')) // Keep general ionic references
    )
  }

  /**
   * Check if the project is a web project (Next.js, React web, etc.)
   */
  isWebProject(projectContext) {
    const techData = projectContext.techStack || projectContext.technologyData || {}
    const frameworks = techData.frameworks || []

    return frameworks.some((framework) => {
      const fw = framework.toLowerCase()
      return (
        fw.includes('next.js') ||
        fw.includes('nextjs') ||
        (fw.includes('react') && !fw.includes('react native')) ||
        fw.includes('vue.js') ||
        fw.includes('angular') ||
        fw.includes('nuxt') ||
        fw.includes('remix') ||
        fw.includes('gatsby') ||
        (fw.includes('supabase') && !fw.includes('mobile'))
      )
    })
  }

  /**
   * Check if a line contains actionable guidelines rather than just technology lists
   */
  isActionableGuideline(line) {
    const lineLower = line.toLowerCase()

    // Skip technology stack items that just list versions/tools
    const techStackPatterns = [
      /\*\*[^*]+\*\*\s*(with|for|v?\d+)/i, // **Next.js 15+** with App Router
      /\*\*[^*]+\*\*\s*for\s+/i, // **Supabase** for backend services
      /\*\*[^*]+\d+\.\d+\*\*/i, // **TypeScript 5.4+**
      /^-?\s*\*\*[A-Z]/, // **React 19+**
    ]

    if (techStackPatterns.some((pattern) => pattern.test(line))) {
      return false
    }

    // Look for actionable language that indicates actual guidelines
    const actionableWords = [
      'use',
      'avoid',
      'prefer',
      'should',
      'must',
      'always',
      'never',
      'implement',
      'ensure',
      'configure',
      'setup',
      'create',
      'define',
      'follow',
      'apply',
      'enable',
      'disable',
      'keep',
      'make',
      'write',
      'structure',
      'organize',
      'split',
      'extract',
      'handle',
      'manage',
      'validate',
      'sanitize',
      'optimize',
      'test',
      'document',
      'review',
    ]

    return actionableWords.some((word) => lineLower.includes(word)) && line.length > 20
  }

  /**
   * Group rules by category for better organization
   */
  groupRulesByCategory(rules) {
    const categories = {
      frameworks: [],
      languages: [],
      stacks: [],
      technologies: [],
      core: [],
      other: [],
    }

    for (const rule of rules) {
      const path = rule.path?.toLowerCase() || ''
      const name = rule.name?.toLowerCase() || ''

      if (path.includes('frameworks/') || name.includes('framework')) {
        categories.frameworks.push(rule)
      } else if (path.includes('languages/') || name.includes('language')) {
        categories.languages.push(rule)
      } else if (path.includes('stacks/') || name.includes('stack')) {
        categories.stacks.push(rule)
      } else if (path.includes('technologies/') || name.includes('tech')) {
        categories.technologies.push(rule)
      } else if (path.includes('core/') || name.includes('core')) {
        categories.core.push(rule)
      } else {
        categories.other.push(rule)
      }
    }

    return categories
  }

  /**
   * Generate CORRECT Claude Code settings.json with permissions system
   */
  async generateClaudeSettings(_rules, projectContext) {
    const packageManager = projectContext.techStack?.packageManager || 'npm'
    const frameworks = projectContext.techStack?.frameworks || []

    const settings = {
      allowedTools: [
        'Read(src/**)',
        'Edit(src/**)',
        `Bash(${packageManager} run:*)`,
        'Bash(git status)',
        'Bash(git add:*)',
        'Bash(git commit:*)',
        'Bash(git diff:*)',
        'Bash(git log:*)',
        'Glob(**/*.js)',
        'Glob(**/*.ts)',
        'Glob(**/*.tsx)',
        'Grep(*)',
      ],
      deniedTools: [
        'Bash(rm -rf:*)',
        'Bash(sudo:*)',
        'Edit(.env*)',
        'Write(node_modules/**/*)',
        'Write(.git/**/*)',
      ],
      env: {
        BASH_DEFAULT_TIMEOUT_MS: this.getOptimalTimeout(projectContext),
        PROJECT_NAME: projectContext.name || path.basename(this.projectPath),
      },
    }

    // Add framework-specific permissions
    for (const framework of frameworks) {
      const frameworkPermissions = this.getFrameworkPermissions(framework)
      settings.allowedTools.push(...frameworkPermissions)
    }

    // Add project-specific environment variables
    if (projectContext.techStack?.buildTools?.includes('vite')) {
      settings.env.VITE_DEV_MODE = 'true'
    }

    if (projectContext.techStack?.testingFrameworks?.includes('jest')) {
      settings.allowedTools.push('Bash(npm run test:*)', 'Bash(jest:*)')
    }

    return settings
  }

  // Helper methods for Claude Code structure
  detectIndentation(projectContext) {
    if (projectContext.techStack?.languages?.includes('Python')) {
      return '4-space'
    }
    if (projectContext.techStack?.languages?.includes('Go')) {
      return '4-space'
    }
    return '2-space'
  }

  generateStyleGuidelines(projectContext) {
    const guidelines = []
    if (projectContext.techStack?.frameworks?.includes('React')) {
      guidelines.push('Use functional components with hooks')
    }
    if (projectContext.techStack?.languages?.includes('TypeScript')) {
      guidelines.push('Always use TypeScript strict mode')
    }
    return guidelines.join('\n- ') || 'Follow project conventions'
  }

  detectProjectStructure(projectContext) {
    if (projectContext.techStack?.frameworks?.includes('Next.js')) {
      return 'Next.js App Router'
    }
    if (projectContext.techStack?.frameworks?.includes('React')) {
      return 'React component-based'
    }
    return 'standard module'
  }

  generateStructureGuidelines(projectContext) {
    if (projectContext.techStack?.frameworks?.includes('React')) {
      return 'Keep components in src/components/, hooks in src/hooks/'
    }
    return 'Follow conventional directory structures'
  }

  generateTestingGuidelines(_projectContext) {
    return 'Write tests for all business logic, use descriptive test names'
  }

  async detectPrimaryIDE(projectContext) {
    try {
      const projectPath = projectContext.projectPath || this.projectPath

      // Check for IDE-specific files and folders with enhanced platform detection
      const ideIndicators = {
        'VS Code': ['.vscode/', '.vscode/settings.json', '.vscode/launch.json'],
        'VS Code Insiders': ['.vscode-insiders/', '.vscode-insiders/settings.json'],
        'VSCodium': ['.vscode-oss/', '.vscode-oss/settings.json'],
        'Cursor': ['.cursor/', 'cursor.json', '.cursorrules'],
        'Windsurf': ['.windsurf/', '.windsurfrules.md', '.codeium/'],
        'Windsurf Next': ['.windsurf-next/', '.windsurf-next/config.json'],
        'Claude Code': ['.claude/', '.claude/settings.json', '.claude/commands/'],
        'Claude Desktop': ['.claude-desktop/', '.claude-desktop/config.json'],
        'Zed': ['.zed/', 'zed.json', '.zed/settings.json'],
        'IntelliJ IDEA': ['.idea/', '.idea/modules.xml', 'src/main/java/'],
        'WebStorm': ['.idea/', '.idea/webServers.xml', 'package.json'],
        'PyCharm': ['.idea/', '.idea/misc.xml', 'requirements.txt'],
        'PHPStorm': ['.idea/', '.idea/php.xml', 'composer.json'],
        'RubyMine': ['.idea/', '.idea/runConfigurations.xml', 'Gemfile'],
        'CLion': ['.idea/', 'CMakeLists.txt', '.idea/cmake.xml'],
        'DataGrip': ['.idea/', '.idea/dataSources.xml'],
        'GoLand': ['.idea/', 'go.mod', '.idea/go.xml'],
        'Rider': ['.idea/', '*.sln', '.idea/.idea.*.dir/'],
        'Android Studio': ['.idea/', 'build.gradle', 'app/build.gradle'],
        'JetBrains (Generic)': ['.idea/', '*.iml'],
        'GitHub Copilot': ['.github/copilot/', '.github/copilot/config.json'],
        'Generic AI': ['.ai/', '.ai/config.json', '.ai/rules/']
      }

      for (const [ide, indicators] of Object.entries(ideIndicators)) {
        for (const indicator of indicators) {
          if (await this.fileExists(path.join(projectPath, indicator))) {
            return ide
          }
        }
      }

      // Additional detection methods for VS Code without .vscode folder:
      // 1. Check for VS Code specific extensions in package.json
      const packageJsonPath = path.join(projectPath, 'package.json')
      if (await this.fileExists(packageJsonPath)) {
        const packageContent = await fs.readFile(packageJsonPath, 'utf8')
        const packageData = JSON.parse(packageContent)

        // Check for VS Code extension development
        if (
          packageData.contributes ||
          packageData.engines?.vscode ||
          packageData.categories?.includes('Extension Packs') ||
          packageData.main?.includes('extension.js')
        ) {
          return 'VS Code'
        }

        // Check for common VS Code specific dev dependencies
        const vscodeDevDeps = ['@types/vscode', 'vscode-test', '@vscode/test-electron']
        const allDeps = { ...packageData.dependencies, ...packageData.devDependencies }
        if (vscodeDevDeps.some((dep) => allDeps[dep])) {
          return 'VS Code'
        }
      }

      // 2. Check for common workspace files that suggest VS Code
      const vscodeWorkspaceFiles = ['*.code-workspace', 'workspace.json']
      for (const pattern of vscodeWorkspaceFiles) {
        // This is a simplified check - in practice you'd use glob matching
        if (await this.fileExists(path.join(projectPath, pattern.replace('*', 'project')))) {
          return 'VS Code'
        }
      }

      return 'Not specified'
    } catch {
      return 'Not specified'
    }
  }

  /**
   * Detects package manager by checking lock files
   */
  async detectPackageManager(projectContext) {
    try {
      const projectPath = projectContext.projectPath || this.projectPath

      // Check for lock files in order of preference
      if (await this.fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
        return 'pnpm'
      }
      if (await this.fileExists(path.join(projectPath, 'yarn.lock'))) {
        return 'yarn'
      }
      if (await this.fileExists(path.join(projectPath, 'bun.lockb'))) {
        return 'bun'
      }
      if (await this.fileExists(path.join(projectPath, 'package-lock.json'))) {
        return 'npm'
      }

      // Default fallback
      return 'npm'
    } catch {
      return 'npm'
    }
  }

  /**
   * Helper to check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Extract actual scripts from package.json
   */
  async extractPackageScripts(projectContext) {
    try {
      const projectPath = projectContext.projectPath || this.projectPath
      const packageJsonPath = path.join(projectPath, 'package.json')

      if (await this.fileExists(packageJsonPath)) {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8')
        const packageData = JSON.parse(packageJsonContent)
        return packageData.scripts || {}
      }
    } catch {
      // Silently fail and return empty object
    }
    return {}
  }

  async detectDevCommand(projectContext) {
    const pm = await this.detectPackageManager(projectContext)
    const scripts = await this.extractPackageScripts(projectContext)

    // Check for common dev script variations
    if (scripts.dev) {
      return `${pm} run dev`
    }
    if (scripts.start) {
      return `${pm} run start`
    }
    if (scripts.serve) {
      return `${pm} run serve`
    }

    return `${pm} run dev`
  }

  async detectTestCommand(projectContext) {
    const pm = await this.detectPackageManager(projectContext)
    const scripts = await this.extractPackageScripts(projectContext)

    if (scripts.test) {
      return `${pm} run test`
    }
    if (scripts['test:unit']) {
      return `${pm} run test:unit`
    }

    return `${pm} run test`
  }

  async detectBuildCommand(projectContext) {
    const pm = await this.detectPackageManager(projectContext)
    const scripts = await this.extractPackageScripts(projectContext)

    if (scripts.build) {
      return `${pm} run build`
    }
    if (scripts['build:prod']) {
      return `${pm} run build:prod`
    }

    return `${pm} run build`
  }

  async detectBuildTool(projectContext) {
    const techData = projectContext.techStack || projectContext.technologyData || {}
    const frameworks = techData.frameworks || []

    // Check for turbopack in Next.js projects
    if (
      frameworks.some(
        (fw) => fw.toLowerCase().includes('next.js') || fw.toLowerCase().includes('nextjs')
      )
    ) {
      const scripts = await this.extractPackageScripts(projectContext)
      // Check if dev script uses --turbo flag
      if (scripts.dev?.includes('--turbo')) {
        return 'Turbopack (Next.js)'
      }
      return 'Next.js'
    }
    if (frameworks.some((fw) => fw.toLowerCase().includes('nuxt'))) {
      return 'Nuxt.js'
    }
    if (frameworks.some((fw) => fw.toLowerCase().includes('gatsby'))) {
      return 'Gatsby'
    }
    if (frameworks.some((fw) => fw.toLowerCase().includes('astro'))) {
      return 'Astro'
    }

    // Check for build tools in libraries/buildTools
    const buildTools = techData.buildTools || []
    if (buildTools.includes('Vite')) {
      return 'Vite'
    }
    if (buildTools.includes('Webpack')) {
      return 'Webpack'
    }
    if (buildTools.includes('esbuild')) {
      return 'esbuild'
    }
    if (buildTools.includes('Rollup')) {
      return 'Rollup'
    }
    if (buildTools.includes('Parcel')) {
      return 'Parcel'
    }

    // Default fallback
    return 'npm scripts'
  }

  generateWorkflowPreferences(_rules, projectContext) {
    return `### Development Workflow
- Start with failing tests when appropriate
- Run tests before committing
- Use feature flags for incomplete features
- Plan for rollback strategies

### Framework-Specific Guidelines
${this.generateFrameworkSpecificGuidelines(projectContext)}`
  }

  generateFrameworkSpecificGuidelines(projectContext) {
    const frameworks = projectContext.techStack?.frameworks || []
    const guidelines = []

    if (frameworks.includes('React')) {
      guidelines.push('- Use React hooks over class components')
      guidelines.push('- Implement proper state management patterns')
    }
    if (frameworks.includes('Next.js')) {
      guidelines.push('- Use App Router for new routes')
      guidelines.push('- Leverage server components when possible')
    }

    return guidelines.join('\n') || '- Follow established patterns in the codebase'
  }

  getOptimalTimeout(projectContext) {
    // Longer timeout for complex builds
    if (projectContext.techStack?.frameworks?.includes('Next.js')) {
      return '180000'
    }
    return '120000'
  }

  /**
   * Generate main CLAUDE.md with import-based structure
   */
  async generateMainMemory(rules, projectContext) {
    const projectName = path.basename(this.projectPath)
    const primaryLanguages = projectContext.techStack?.primaryLanguages || ['JavaScript']
    const frameworks = projectContext.techStack?.frameworks || []

    return `# ${projectName} - Claude Code Memory

## Project Overview
${projectContext.description || `${projectName} is a ${frameworks.join(', ') || primaryLanguages.join(', ')} project.`}

## Import Hierarchy
@CLAUDE-patterns.md
@CLAUDE-integrations.md

## Quick Commands
${await this.generateQuickCommandsSection(rules, projectContext)}

## Development Context
### Technology Stack
- **Languages**: ${primaryLanguages.join(', ')}
${frameworks.length > 0 ? `- **Frameworks**: ${frameworks.join(', ')}` : ''}
${projectContext.techStack?.libraries?.length > 0 ? `- **Libraries**: ${projectContext.techStack.libraries.slice(0, 5).join(', ')}` : ''}

### Project Structure
\`\`\`
${await this.generateProjectStructureSummary(projectContext)}
\`\`\`

## Development Commands
${await this.generateDevelopmentCommands(projectContext)}

## Coding Standards
${await this.generateCodingStandards(rules, projectContext)}

## Team Collaboration
- **Memory Management**: Use import-based structure for personal preferences
- **Slash Commands**: Available in \`.claude/commands/\` directory
- **Settings**: Configured in \`.claude/settings.json\`

## Personal Preferences Import
@~/.claude/my-project-preferences.md

---
*Generated by VDK CLI - Enhanced Claude Code Integration*
*Last updated: ${new Date().toISOString().split('T')[0]}*`
  }

  /**
   * Generate CLAUDE-patterns.md for code patterns and conventions
   */
  async generatePatternsMemory(rules, projectContext) {
    const patterns = projectContext.patterns || {}
    const namingConventions = patterns.namingConventions || {}

    return `# Code Patterns and Conventions

## Naming Conventions
${await this.generateNamingConventions(namingConventions)}

## Architectural Patterns
${await this.generateArchitecturalPatterns(patterns.architecturalPatterns || [])}

## Code Organization
${await this.generateCodeOrganization(projectContext)}

## Framework-Specific Patterns
${await this.generateFrameworkPatterns(rules, projectContext)}

## Testing Patterns
${await this.generateTestingPatterns(rules, projectContext)}

## Error Handling Patterns
${await this.generateErrorHandlingPatterns(rules, projectContext)}

## Performance Patterns
${await this.generatePerformancePatterns(rules, projectContext)}

---
*This file contains project-specific patterns discovered through codebase analysis*`
  }

  /**
   * Generate CLAUDE-integrations.md for MCP and tool integrations
   */
  async generateIntegrationsMemory(rules, projectContext) {
    return `# Claude Code Integrations

## MCP Server Configuration
${await this.generateMcpServerConfig(rules, projectContext)}

## Available Tools
${await this.generateAvailableTools(rules, projectContext)}

## Permission Configuration
${await this.generatePermissionConfig(rules, projectContext)}

## Hook System Integration
${await this.generateHookIntegration(rules, projectContext)}

## IDE Integration
- **Primary IDE**: ${this.detectPrimaryIDE(projectContext)}
- **Extensions**: Auto-detection enabled
- **Diff Viewer**: Configured for IDE integration

## External Services
${await this.generateExternalServices(rules, projectContext)}

---
*This file manages Claude Code's integration with external tools and services*`
  }

  /**
   * Generate sophisticated slash commands by fetching from remote repository
   */
  async generateSlashCommands(rules, projectContext, categoryFilter = null) {
    try {
      // Use the centralized repository fetch method from RuleGenerator
      if (this.ruleGenerator?.fetchFromRepository) {
        const remoteCommands = await this.ruleGenerator.fetchFromRepository(
          projectContext,
          'commands',
          'claude-code',
          categoryFilter
        )

        if (remoteCommands.length > 0) {
          console.log(`✅ Fetched ${remoteCommands.length} commands from repository`)
          // Transform the templates into command format
          return this.transformTemplatesIntoCommands(remoteCommands, projectContext)
        }
      }

      console.log('⚠️ No remote commands found, generating fallback commands')
      console.log(chalk.yellow('💡 To get more commands when available:'))
      console.log(chalk.gray('   • Check your GitHub token: VDK_GITHUB_TOKEN in .env.local'))
      console.log(chalk.gray('   • Get a token from: https://github.com/settings/tokens'))

      // Generate fallback commands based on detected technologies
      return this.generateFallbackCommands(rules, projectContext, categoryFilter)
    } catch (error) {
      console.log(`⚠️ Failed to fetch remote commands: ${error.message}`)
      if (error.message.includes('401')) {
        console.log(chalk.yellow('💡 GitHub authentication failed. To enable command fetching:'))
        console.log(chalk.gray('   • Add VDK_GITHUB_TOKEN=your_token to .env.local'))
        console.log(chalk.gray('   • Get a token from: https://github.com/settings/tokens'))
        console.log(chalk.gray('   • Token needs "public_repo" access for public repositories'))
      }

      // Generate fallback commands even when remote fetch fails
      return this.generateFallbackCommands(rules, projectContext, categoryFilter)
    }
  }

  /**
   * Generate fallback commands when remote fetch fails
   * @param {Array} rules - Available rules
   * @param {Object} projectContext - Project context
   * @param {Object} categoryFilter - Category filter
   * @returns {Array} Fallback commands
   */
  generateFallbackCommands(_rules, projectContext, categoryFilter = null) {
    const commands = []
    const frameworks = projectContext.techStack?.frameworks || []
    const languages = projectContext.techStack?.primaryLanguages || []
    const isAstroProject = frameworks.some((fw) => fw.toLowerCase().includes('astro'))
    const isNextJSProject = frameworks.some((fw) => fw.toLowerCase().includes('next'))
    const isContentProject = frameworks.some(
      (fw) => fw.toLowerCase().includes('starlight') || fw.toLowerCase().includes('content')
    )

    // Core development commands (always included)
    commands.push({
      name: 'review-code',
      description: 'Comprehensive code review and analysis',
      content: `Perform a thorough code review focusing on:
- Code quality and best practices
- Performance optimizations
- Security considerations
- Architecture and design patterns
- Testing coverage

Provide specific, actionable feedback with examples.`,
    })

    commands.push({
      name: 'debug-issue',
      description: 'Debug and troubleshoot issues',
      content: `Help debug the current issue by:
- Analyzing error messages and stack traces
- Identifying potential root causes
- Suggesting debugging strategies
- Providing step-by-step troubleshooting

Ask for relevant code, logs, or error details if needed.`,
    })

    commands.push({
      name: 'optimize-performance',
      description: 'Analyze and optimize performance',
      content: `Analyze performance bottlenecks and provide optimization recommendations:
- Code performance analysis
- Bundle size optimization
- Runtime performance improvements
- Best practices for ${frameworks[0] || 'the current stack'}

Focus on measurable improvements with implementation examples.`,
    })

    // Astro-specific commands
    if (isAstroProject) {
      commands.push({
        name: 'create-astro-component',
        description: 'Create new Astro component following project patterns',
        content: `Create a new Astro component with:
- Proper TypeScript typing
- Scoped CSS styling
- Props validation
- SEO optimization if needed
- Component documentation

Follow established project patterns for consistency.

## Arguments
- Component name (required): $ARGUMENTS
- Component type: page|layout|ui (default: ui)`,
      })

      if (isContentProject) {
        commands.push({
          name: 'create-content-page',
          description: 'Create new content page with proper frontmatter',
          content: `Create a new content page with:
- Proper frontmatter structure
- SEO metadata
- Navigation integration
- Content structure following site patterns

## Arguments
- Page title (required): $ARGUMENTS
- Content category: guide|reference|tutorial (default: guide)`,
        })

        commands.push({
          name: 'update-navigation',
          description: 'Update site navigation and content structure',
          content: `Update the site navigation to include new content:
- Add to sidebar configuration
- Update content collections
- Ensure proper ordering
- Maintain consistent navigation patterns

Review current navigation structure and suggest improvements.`,
        })
      }
    }

    // Next.js specific commands
    if (isNextJSProject) {
      commands.push({
        name: 'create-nextjs-page',
        description: 'Create new Next.js page with App Router',
        content: `Create a new Next.js page using App Router:
- Server Component by default
- Proper TypeScript typing
- SEO metadata
- Error boundaries
- Loading states

## Arguments
- Page path (required): $ARGUMENTS
- Page type: static|dynamic|api (default: static)`,
      })

      commands.push({
        name: 'create-api-route',
        description: 'Create new API route with validation',
        content: `Create a new API route with:
- Request/response typing
- Input validation
- Error handling
- Rate limiting considerations
- Proper HTTP status codes

## Arguments
- Route path (required): $ARGUMENTS
- HTTP method: GET|POST|PUT|DELETE (default: GET)`,
      })
    }

    // TypeScript specific commands
    if (languages.includes('typescript') || languages.includes('TypeScript')) {
      commands.push({
        name: 'improve-types',
        description: 'Improve TypeScript types and interfaces',
        content: `Analyze and improve TypeScript usage:
- Add missing type annotations
- Improve type safety
- Reduce any usage
- Create utility types where beneficial
- Improve interface design

Focus on making types more precise and maintainable.`,
      })
    }

    // Filter by categories if specified
    if (categoryFilter?.categories) {
      const allowedCategories = categoryFilter.categories
      return commands.filter((cmd) => {
        // Map commands to categories (simplified)
        const commandCategories = {
          'review-code': ['development', 'quality'],
          'debug-issue': ['development'],
          'optimize-performance': ['development', 'quality'],
          'create-astro-component': ['development'],
          'create-content-page': ['development', 'workflow'],
          'update-navigation': ['workflow'],
          'create-nextjs-page': ['development'],
          'create-api-route': ['development'],
          'improve-types': ['development', 'quality'],
        }

        const cmdCategories = commandCategories[cmd.name] || ['development']
        return cmdCategories.some((cat) => allowedCategories.includes(cat))
      })
    }

    return commands
  }

  /**
   * Transform repository templates into Claude Code command format
   * @param {Array} templates - Templates from repository
   * @param {Object} projectContext - Project context
   * @returns {Array} Commands in Claude Code format
   */
  transformTemplatesIntoCommands(templates, _projectContext) {
    const commands = []

    for (const template of templates) {
      try {
        // Parse the template content as a command
        const parsedCommand = this.parseClaudeCodeCommand(template.content)
        if (parsedCommand) {
          commands.push({
            name: template.name.replace('.md', ''),
            content: template.content,
            metadata: parsedCommand,
            category: this.getCategoryFromPath(template.path),
            source: 'repository',
            relevanceScore: template.relevanceScore || 0.5,
          })
        }
      } catch (error) {
        console.log(`Warning: Could not parse command ${template.name}: ${error.message}`)
      }
    }

    return commands.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  /**
   * Extract category from file path
   * @param {string} path - File path
   * @returns {string} Category name
   */
  getCategoryFromPath(path) {
    const pathParts = path.split('/')
    // Path structure: .ai/commands/claude-code/category/command.md
    if (pathParts.length >= 4) {
      return pathParts[3] // Get the category directory name
    }
    return 'general'
  }

  /**
   * Fetch commands from VDK-Blueprints repository
   */
  async fetchRemoteCommands(platform, projectContext) {
    const VDK_RULES_REPO_API_URL = 'https://api.github.com/repos/entro314-labs/VDK-Blueprints'
    const commands = []

    try {
      // Fetch command categories for the platform
      const response = await fetch(`${VDK_RULES_REPO_API_URL}/contents/.ai/commands/${platform}`)
      if (!response.ok) {
        return []
      }

      const categories = await response.json()

      // Fetch commands from each category
      for (const category of categories.filter((item) => item.type === 'dir')) {
        try {
          const categoryResponse = await fetch(category.url)
          if (categoryResponse.ok) {
            const commandFiles = await categoryResponse.json()

            for (const file of commandFiles.filter((f) => f.name.endsWith('.md'))) {
              const commandContent = await this.downloadFile(file.download_url)
              if (commandContent) {
                // Parse and validate command content
                const parsedCommand = this.parseClaudeCodeCommand(commandContent)
                if (parsedCommand && (await this.validateClaudeCodeCommand(parsedCommand))) {
                  commands.push({
                    name: file.name.replace('.md', ''),
                    content: commandContent,
                    metadata: parsedCommand,
                    category: category.name,
                    source: 'repository',
                    relevanceScore: this.calculateCommandRelevance(parsedCommand, projectContext),
                  })
                }
              }
            }
          }
        } catch (error) {
          console.log(`Could not fetch commands from ${category.name}: ${error.message}`)
        }
      }
    } catch (error) {
      console.log(`Failed to fetch command categories: ${error.message}`)
    }

    // Sort by relevance score
    return commands.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  /**
   * Parse Claude Code command frontmatter
   */
  parseClaudeCodeCommand(content) {
    try {
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
      if (!frontmatterMatch) {
        return null
      }

      // Simple YAML parsing for the schema fields
      const yamlContent = frontmatterMatch[1]
      const parsed = {}

      const lines = yamlContent.split('\n')
      let _currentKey = null
      let currentObject = null

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
          continue
        }

        if (line.match(/^[a-zA-Z]/)) {
          // Top-level key
          const [key, value] = trimmed.split(':').map((s) => s.trim())
          if (value && value !== '') {
            parsed[key] = value.replace(/['"]/g, '')
          } else {
            _currentKey = key
            currentObject = {}
            parsed[key] = currentObject
          }
        } else if (currentObject && line.match(/^\s+[a-zA-Z]/)) {
          // Nested key
          const [key, value] = trimmed.split(':').map((s) => s.trim())
          if (value && value !== '') {
            currentObject[key] = value.replace(/['"]/g, '')
          }
        }
      }

      return parsed
    } catch (error) {
      console.log(`Failed to parse command frontmatter: ${error.message}`)
      return null
    }
  }

  /**
   * Validate Claude Code command against the official schema
   */
  async validateClaudeCodeCommand(commandData) {
    if (!commandData) {
      return false
    }

    try {
      const validation = await validateCommand(commandData)

      if (!validation.valid) {
        if (this.verbose) {
          console.log('Command validation failed:')
          validation.errors.forEach((error) => console.log(`  - ${error}`))
        }
        return false
      }

      return true
    } catch (error) {
      console.log(`Schema validation error: ${error.message}`)
      return false
    }
  }

  /**
   * Calculate command relevance based on project context
   */
  calculateCommandRelevance(commandData, projectContext) {
    let score = 0.5 // Base score

    const frameworks = projectContext.techStack?.frameworks || []
    const languages = projectContext.techStack?.primaryLanguages || []
    const tags = commandData.tags || []
    const category = commandData.category || ''

    // Framework matching
    frameworks.forEach((framework) => {
      if (tags.some((tag) => tag.toLowerCase().includes(framework.toLowerCase()))) {
        score += 0.3
      }
    })

    // Language matching
    languages.forEach((language) => {
      if (tags.some((tag) => tag.toLowerCase().includes(language.toLowerCase()))) {
        score += 0.2
      }
    })

    // Category relevance
    if (category === 'development') {
      score += 0.2
    }
    if (category === 'testing') {
      score += 0.1
    }

    // Command type preference
    if (commandData.commandType === 'slash') {
      score += 0.1
    }

    return Math.min(score, 1.0)
  }

  /**
   * Download file content from URL
   */
  async downloadFile(url) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return await response.text()
      }
    } catch (error) {
      console.log(`Failed to download file: ${error.message}`)
    }
    return null
  }

  /**
   * Generate minimal fallback commands if remote fetch fails
   * Following Claude Code command schema format
   */
  generateDefaultCommands(projectContext) {
    const frameworks = projectContext.techStack?.frameworks || []
    const languages = projectContext.techStack?.primaryLanguages || ['JavaScript']

    return [
      {
        name: 'create-component',
        content: this.generateClaudeCodeCommand({
          id: 'create-component',
          name: 'Create Component',
          description: 'Create a new component following project patterns and conventions',
          target: 'claude-code',
          commandType: 'slash',
          version: '1.0.0',
          scope: 'project',
          claudeCode: {
            slashCommand: '/create-component',
            arguments: {
              supports: true,
              placeholder: '$ARGUMENTS',
              examples: ['Button', 'UserProfile', 'Modal'],
            },
            fileReferences: {
              supports: true,
              autoInclude: ['CLAUDE.md', 'package.json'],
            },
          },
          permissions: {
            allowedTools: ['Read', 'Write', 'Edit'],
            requiredApproval: false,
          },
          examples: [
            {
              usage: '/create-component Button',
              description: 'Create a Button component with proper TypeScript types',
              context: 'When building reusable UI components',
              expectedOutcome: 'Component file with tests and proper exports',
            },
          ],
          category: 'development',
          tags: ['component', 'react', 'typescript'],
          frameworks,
          languages,
        }),
        category: 'workflow',
        source: 'fallback',
      },
      {
        name: 'review-code',
        content: this.generateClaudeCodeCommand({
          id: 'review-code',
          name: 'Code Review',
          description: 'Perform comprehensive code review focusing on quality and best practices',
          target: 'claude-code',
          commandType: 'slash',
          version: '1.0.0',
          scope: 'project',
          claudeCode: {
            slashCommand: '/review-code',
            arguments: {
              supports: false,
            },
            fileReferences: {
              supports: true,
              autoInclude: ['CLAUDE.md'],
            },
          },
          permissions: {
            allowedTools: ['Read', 'Bash(git:*)'],
            requiredApproval: false,
          },
          examples: [
            {
              usage: '/review-code',
              description: 'Review current changes for code quality',
              context: 'Before committing changes',
              expectedOutcome: 'Detailed review with improvement suggestions',
            },
          ],
          category: 'analysis',
          tags: ['review', 'quality', 'best-practices'],
          frameworks,
          languages,
        }),
        category: 'quality',
        source: 'fallback',
      },
    ]
  }

  /**
   * Generate Claude Code command content from schema-compliant data
   */
  generateClaudeCodeCommand(commandData) {
    const { claudeCode, examples, permissions, frameworks, languages } = commandData

    return `---
id: "${commandData.id}"
name: "${commandData.name}"
description: "${commandData.description}"
target: "${commandData.target}"
commandType: "${commandData.commandType}"
version: "${commandData.version}"
scope: "${commandData.scope}"

claudeCode:
  slashCommand: "${claudeCode.slashCommand}"
  arguments:
    supports: ${claudeCode.arguments?.supports}${
      claudeCode.arguments?.placeholder
        ? `
    placeholder: "${claudeCode.arguments.placeholder}"`
        : ''
    }${
      claudeCode.arguments?.examples
        ? `
    examples: ${JSON.stringify(claudeCode.arguments.examples)}`
        : ''
    }
  fileReferences:
    supports: ${true}${
      claudeCode.fileReferences?.autoInclude
        ? `
    autoInclude: ${JSON.stringify(claudeCode.fileReferences.autoInclude)}`
        : ''
    }

permissions:
  allowedTools: ${JSON.stringify(permissions?.allowedTools || [])}
  requiredApproval: ${permissions?.requiredApproval}

examples:${
      examples
        ?.map(
          (ex) => `
  - usage: "${ex.usage}"
    description: "${ex.description}"
    context: "${ex.context}"
    expectedOutcome: "${ex.expectedOutcome}"`
        )
        .join('') || ''
    }

category: "${commandData.category}"
tags: ${JSON.stringify(commandData.tags || [])}
author: "VDK CLI"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
---

# ${commandData.name}

## Purpose

${commandData.description}

### Project Context
- **Frameworks**: ${frameworks.join(', ') || 'General'}
- **Languages**: ${languages.join(', ') || 'JavaScript'}
- **Command Type**: ${commandData.commandType}

## Usage

### Slash Command
\`\`\`
${claudeCode.slashCommand}${claudeCode.arguments?.supports ? ' [arguments]' : ''}
\`\`\`

${
  claudeCode.fileReferences?.supports
    ? `### File References
This command supports Claude Code's \`@\` file reference syntax:
\`\`\`
${claudeCode.slashCommand} @src/components/Example.tsx
\`\`\`
`
    : ''
}

## Implementation

This command will:
1. Analyze project structure and patterns
2. Apply established conventions from CLAUDE.md
3. Generate or modify files following project standards
4. Provide feedback on the changes made

## Examples

${
  examples
    ?.map(
      (ex) => `### ${ex.description}
\`\`\`
${ex.usage}
\`\`\`
**Context**: ${ex.context}
**Expected Outcome**: ${ex.expectedOutcome}
`
    )
    .join('\n') || ''
}

---
*Generated by VDK CLI - Claude Code Integration*`
  }

  /**
   * Generate core project commands
   */
  async generateCoreCommands(_rules, projectContext) {
    const projectName = path.basename(this.projectPath)
    const commands = []

    // Component creation command
    commands.push({
      name: 'create-component',
      content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create a new component following project patterns"
priority: "high"
---

# Create ${projectName} Component

Create a new component following established project patterns.

## Arguments
- Component name (required): $ARGUMENTS
- Component type (optional): functional|class (default: functional)

## Implementation Steps

1. **Analyze existing components**
   - Check component directory structure in \`${this.getComponentsDirectory(projectContext)}\`
   - Review naming patterns and conventions
   - Identify common imports and patterns

2. **Generate component files**
   - Create main component file with TypeScript
   - Add appropriate prop interfaces
   - Include proper exports following project conventions

3. **Add supporting files**
   - Create index.ts barrel export if pattern exists
   - Generate test file if testing framework detected
   - Add to component manifest if one exists

## Quality Checks
- Follow established naming conventions
- Include proper TypeScript types
- Add JSDoc comments for complex props
- Ensure accessibility attributes
- Follow project's styling approach

## Usage
\`/project:create-component ButtonComponent\`
\`/project:create-component Modal --type=functional\`
`,
    })

    // Code review command
    commands.push({
      name: 'review-code',
      content: `---
allowed-tools: ["Read", "Bash(git diff:*)", "Bash(git log:*)"]
description: "Comprehensive code review focusing on project standards"
priority: "high"
---

# ${projectName} Code Review

Perform comprehensive code review based on project-specific standards.

## Review Areas

1. **Code Quality**
   - Adherence to established patterns
   - Consistency with existing codebase
   - Performance implications

2. **Security**
   - Input validation
   - Authentication/authorization
   - Sensitive data handling

3. **Testing**
   - Test coverage adequacy
   - Test quality and effectiveness
   - Edge case coverage

4. **Documentation**
   - Code comments quality
   - API documentation completeness
   - README updates if needed

## Integration with Project Standards
- Reference CLAUDE-patterns.md for established conventions
- Check against detected architectural patterns
- Validate naming convention consistency

## Usage
\`/project:review-code\` - Review current changes
\`/project:review-code path/to/specific/file.js\` - Review specific file
`,
    })

    // Performance analysis command
    commands.push({
      name: 'analyze-performance',
      content: `---
allowed-tools: ["Read", "Bash(npm run:*)", "WebFetch"]
description: "Analyze performance bottlenecks and optimization opportunities"
priority: "medium"
---

# Performance Analysis for ${projectName}

Analyze performance characteristics and identify optimization opportunities.

## Analysis Areas

1. **Bundle Analysis** (if frontend)
   - Analyze bundle size and composition
   - Identify large dependencies
   - Check for code splitting opportunities

2. **Runtime Performance**
   - Memory usage patterns
   - CPU intensive operations
   - Network request efficiency

3. **Database Performance** (if backend)
   - Query optimization opportunities
   - N+1 query detection
   - Index usage analysis

## Recommendations Framework
- Prioritize optimizations by impact
- Consider maintenance overhead
- Align with project architecture

## Usage
\`/project:analyze-performance\` - Full performance analysis
\`/project:analyze-performance frontend\` - Focus on frontend performance
`,
    })

    return commands
  }

  /**
   * Generate framework-specific commands
   */
  async generateFrameworkCommands(_rules, projectContext) {
    const commands = []
    const frameworks = projectContext.techStack?.frameworks || []

    for (const framework of frameworks) {
      switch (framework.toLowerCase()) {
        case 'react':
          commands.push(...(await this.generateReactCommands(projectContext)))
          break
        case 'nextjs':
        case 'next.js':
          commands.push(...(await this.generateNextJSCommands(projectContext)))
          break
        case 'vue':
        case 'vue.js':
          commands.push(...(await this.generateVueCommands(projectContext)))
          break
        case 'angular':
          commands.push(...(await this.generateAngularCommands(projectContext)))
          break
        case 'express':
          commands.push(...(await this.generateExpressCommands(projectContext)))
          break
        case 'fastapi':
          commands.push(...(await this.generateFastAPICommands(projectContext)))
          break
      }
    }

    return commands
  }

  /**
   * Generate React-specific commands
   */
  async generateReactCommands(_projectContext) {
    return [
      {
        name: 'create-react-hook',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create custom React hook following project patterns"
priority: "medium"
---

# Create React Hook

Create a custom React hook following established patterns.

## Implementation Steps

1. **Analyze existing hooks**
   - Check hooks directory structure
   - Review naming conventions (use + descriptive name)
   - Identify common patterns and return types

2. **Generate hook file**
   - Create hook in appropriate location
   - Include proper TypeScript types
   - Add JSDoc comments explaining usage
   - Include error handling if appropriate

3. **Add tests**
   - Create test file using project's testing framework
   - Test hook behavior and edge cases
   - Include cleanup testing if needed

## Hook Best Practices
- Start with \`use\` prefix
- Return object for multiple values
- Handle cleanup in useEffect
- Memoize expensive calculations
- Follow project's TypeScript patterns

## Usage
\`/project:create-react-hook useLocalStorage\`
\`/project:create-react-hook useApi\`
`,
      },
    ]
  }

  /**
   * Generate task commands from rules
   */
  async generateTaskCommands(rules, projectContext) {
    const commands = []
    const taskRules = rules.filter(
      (rule) => rule.frontmatter?.category === 'task' || rule.frontmatter?.type?.includes('task')
    )

    for (const rule of taskRules) {
      const commandName = this.generateCommandName(rule.frontmatter.description || rule.name)
      const allowedTools = rule.frontmatter['allowed-tools'] ||
        rule.frontmatter.allowedTools || ['Read', 'Write', 'Edit']

      commands.push({
        name: commandName,
        content: `---
allowed-tools: ${JSON.stringify(allowedTools)}
description: "${rule.frontmatter.description || 'Project-specific task'}"
priority: "${rule.frontmatter.priority || 'medium'}"
---

# ${this.capitalizeWords(commandName.replace(/-/g, ' '))}

${rule.content || 'Perform project-specific task based on established patterns.'}

## Implementation Context
- Project: ${path.basename(this.projectPath)}
- Framework: ${projectContext.techStack?.frameworks?.[0] || 'General'}
- Standards: Reference CLAUDE-patterns.md for project conventions

## Usage
\`/project:${commandName} $ARGUMENTS\`
`,
      })
    }

    return commands
  }

  /**
   * Generate MCP server integrations
   */
  async generateMcpIntegrations(_rules, projectContext) {
    const integrations = {
      servers: {},
      tools: [],
      configuration: {},
    }

    // File system MCP for project access
    integrations.servers.filesystem = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', this.projectPath],
      env: {},
    }

    // Git MCP for version control
    integrations.servers.git = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
      env: {},
    }

    // Database MCP if database detected
    if (this.detectsDatabase(projectContext)) {
      integrations.servers.database = await this.generateDatabaseMCP(projectContext)
    }

    // Framework-specific MCP servers
    const frameworks = projectContext.techStack?.frameworks || []
    for (const framework of frameworks) {
      const frameworkMCP = await this.generateFrameworkMCP(framework, projectContext)
      if (frameworkMCP) {
        integrations.servers[framework.toLowerCase()] = frameworkMCP
      }
    }

    return integrations
  }

  detectsDatabase(projectContext) {
    const dbIndicators = ['prisma', 'sequelize', 'mongoose', 'postgresql', 'mysql', 'sqlite']
    const libraries = projectContext.techStack?.libraries || []
    return libraries.some((lib) =>
      dbIndicators.some((indicator) => lib.toLowerCase().includes(indicator))
    )
  }

  getFrameworkPermissions(framework) {
    const permissions = {
      react: ['Bash(npm run start)', 'Bash(npm run build)'],
      nextjs: ['Bash(npm run dev)', 'Bash(npm run build)', 'Bash(npm run start)'],
      vue: ['Bash(npm run serve)', 'Bash(npm run build)'],
      angular: ['Bash(ng serve)', 'Bash(ng build)', 'Bash(ng test)'],
      express: ['Bash(npm run dev)', 'Bash(npm run start)'],
    }

    return permissions[framework.toLowerCase()] || []
  }

  // Additional helper methods for generating memory content sections

  async generateQuickCommandsSection(_rules, projectContext) {
    const commands = []

    // Add common project commands
    commands.push('- `/project:create-component` - Create new component following project patterns')
    commands.push('- `/project:review-code` - Comprehensive code review')
    commands.push('- `/project:analyze-performance` - Performance analysis and optimization')

    // Add framework-specific commands
    const frameworks = projectContext.techStack?.frameworks || []
    if (frameworks.includes('React')) {
      commands.push('- `/project:create-react-hook` - Create custom React hook')
    }

    return commands.join('\n')
  }

  async generateProjectStructureSummary(projectContext) {
    if (!projectContext.projectStructure) {
      return 'Project structure analysis pending...'
    }

    const structure = projectContext.projectStructure
    const summary = []

    // Add main directories
    const mainDirs = structure.directories?.slice(0, 8) || []
    mainDirs.forEach((dir) => {
      const depth = '  '.repeat(dir.depth || 0)
      summary.push(`${depth}${dir.name}/`)
    })

    if (structure.directories?.length > 8) {
      summary.push('  ...')
    }

    return summary.join('\n')
  }

  async generateDevelopmentCommands(projectContext) {
    const commands = []
    const packageCommands = this.extractPackageCommands(projectContext)

    if (packageCommands.dev) {
      commands.push(`- \`${packageCommands.dev}\` - Start development server`)
    }
    if (packageCommands.build) {
      commands.push(`- \`${packageCommands.build}\` - Build for production`)
    }
    if (packageCommands.test) {
      commands.push(`- \`${packageCommands.test}\` - Run test suite`)
    }
    if (packageCommands.lint) {
      commands.push(`- \`${packageCommands.lint}\` - Run code linting`)
    }

    return commands.join('\n')
  }

  extractPackageCommands(_projectContext) {
    // Extract commands from package.json analysis if available
    return {
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm run test',
      lint: 'npm run lint',
    }
  }

  async generateCodingStandards(_rules, projectContext) {
    const standards = []

    // Extract standards from rules and project analysis
    const namingConventions = projectContext.patterns?.namingConventions
    if (namingConventions) {
      if (namingConventions.variables?.dominant) {
        standards.push(`- **Variables**: Use ${namingConventions.variables.dominant} naming`)
      }
      if (namingConventions.functions?.dominant) {
        standards.push(`- **Functions**: Use ${namingConventions.functions.dominant} naming`)
      }
    }

    // Add framework-specific standards
    const frameworks = projectContext.techStack?.frameworks || []
    for (const framework of frameworks) {
      const frameworkStandards = this.getFrameworkStandards(framework)
      standards.push(...frameworkStandards)
    }

    return standards.length > 0
      ? standards.join('\n')
      : '- Follow established project patterns\n- Maintain consistency with existing code'
  }

  getFrameworkStandards(framework) {
    const standards = {
      React: [
        '- Use functional components with hooks',
        '- Implement proper prop interfaces with TypeScript',
        '- Follow component composition patterns',
      ],
      'Next.js': [
        '- Use App Router for new pages',
        '- Implement proper SEO metadata',
        '- Optimize for Core Web Vitals',
      ],
      Vue: [
        '- Use Composition API for new components',
        '- Implement proper reactive patterns',
        '- Follow Vue 3 best practices',
      ],
    }

    return standards[framework] || []
  }

  // Additional memory generation methods for patterns, naming conventions, etc.

  async generateNamingConventions(namingConventions) {
    if (!namingConventions || Object.keys(namingConventions).length === 0) {
      return '- Follow consistent naming patterns discovered in codebase analysis'
    }

    const sections = []

    if (namingConventions.variables) {
      sections.push(
        `### Variables\n- **Preferred**: ${namingConventions.variables.dominant}\n- **Confidence**: ${namingConventions.variables.confidence}%`
      )
    }

    if (namingConventions.functions) {
      sections.push(
        `### Functions\n- **Preferred**: ${namingConventions.functions.dominant}\n- **Confidence**: ${namingConventions.functions.confidence}%`
      )
    }

    if (namingConventions.files) {
      sections.push(
        `### Files\n- **Preferred**: ${namingConventions.files.dominant}\n- **Confidence**: ${namingConventions.files.confidence}%`
      )
    }

    return sections.join('\n\n')
  }

  async generateArchitecturalPatterns(patterns) {
    if (!patterns || patterns.length === 0) {
      return '- Follow established architectural patterns discovered in codebase'
    }

    return patterns
      .map(
        (pattern) =>
          `- **${pattern.name}**: ${pattern.confidence}% confidence${pattern.description ? ` - ${pattern.description}` : ''}`
      )
      .join('\n')
  }

  async generateCodeOrganization(projectContext) {
    const structure = projectContext.projectStructure
    if (!structure) {
      return '- Maintain existing project structure patterns'
    }

    const organization = []

    // Analyze directory patterns
    const srcDirs =
      structure.directories?.filter(
        (dir) => dir.name.includes('src') || dir.name.includes('app') || dir.name.includes('lib')
      ) || []

    if (srcDirs.length > 0) {
      organization.push('### Source Organization')
      srcDirs.forEach((dir) => {
        organization.push(`- **${dir.name}**: ${dir.path}`)
      })
    }

    return organization.length > 0
      ? organization.join('\n')
      : '- Follow established directory structure'
  }

  async generateFrameworkPatterns(rules, projectContext) {
    const frameworks = projectContext.techStack?.frameworks || []
    const patterns = []

    for (const framework of frameworks) {
      const frameworkRules = rules.filter(
        (rule) =>
          rule.frontmatter?.framework?.toLowerCase() === framework.toLowerCase() ||
          rule.frontmatter?.tags?.includes(framework.toLowerCase())
      )

      if (frameworkRules.length > 0) {
        patterns.push(`### ${framework} Patterns`)
        frameworkRules.forEach((rule) => {
          patterns.push(`- ${rule.frontmatter?.description || rule.name}`)
        })
        patterns.push('')
      }
    }

    return patterns.join('\n')
  }

  async generateTestingPatterns(_rules, projectContext) {
    const testingFrameworks = projectContext.techStack?.testingFrameworks || []
    if (testingFrameworks.length === 0) {
      return '- Implement comprehensive testing following project standards'
    }

    const patterns = [`### Testing Framework: ${testingFrameworks.join(', ')}`]

    // Add testing-specific patterns based on detected frameworks
    if (testingFrameworks.includes('jest')) {
      patterns.push('- Use Jest for unit testing')
      patterns.push('- Follow describe/it pattern for test organization')
    }

    if (testingFrameworks.includes('cypress')) {
      patterns.push('- Use Cypress for end-to-end testing')
      patterns.push('- Follow page object pattern for E2E tests')
    }

    return patterns.join('\n')
  }

  async generateErrorHandlingPatterns(_rules, projectContext) {
    const languages = projectContext.techStack?.primaryLanguages || []
    const patterns = []

    if (languages.includes('JavaScript') || languages.includes('TypeScript')) {
      patterns.push('- Use try-catch blocks for async operations')
      patterns.push('- Implement proper error boundaries for React applications')
      patterns.push('- Return error objects rather than throwing for expected errors')
    }

    if (languages.includes('Python')) {
      patterns.push('- Use specific exception types')
      patterns.push('- Implement proper logging for error tracking')
    }

    return patterns.length > 0
      ? patterns.join('\n')
      : '- Follow language-specific error handling best practices'
  }

  async generatePerformancePatterns(_rules, projectContext) {
    const frameworks = projectContext.techStack?.frameworks || []
    const patterns = []

    if (frameworks.includes('React')) {
      patterns.push('- Use React.memo for expensive components')
      patterns.push('- Implement proper key props for lists')
      patterns.push('- Use useMemo and useCallback for expensive calculations')
    }

    if (frameworks.includes('Next.js')) {
      patterns.push('- Optimize images with next/image')
      patterns.push('- Use dynamic imports for code splitting')
      patterns.push('- Implement proper caching strategies')
    }

    return patterns.length > 0
      ? patterns.join('\n')
      : '- Optimize for performance following framework best practices'
  }

  // Additional methods for MCP and configuration generation...

  async generateMcpServerConfig(_rules, _projectContext) {
    return `### File System Access
- **Server**: \`@modelcontextprotocol/server-filesystem\`
- **Scope**: Project directory only
- **Permissions**: Read/write access to source files

### Version Control
- **Server**: \`@modelcontextprotocol/server-git\`
- **Capabilities**: Git operations, commit history, diff analysis

### External APIs
- Additional MCP servers configured based on project requirements`
  }

  async generateAvailableTools(_rules, _projectContext) {
    return `### Core Tools
- **Read**: View file contents
- **Write**: Create and modify files
- **Edit**: Targeted file changes
- **Bash**: Execute development commands
- **Glob**: File pattern matching
- **Grep**: Content search

### Project-Specific Tools
- Configured based on detected technologies and frameworks
- MCP-enabled tools for external service integration`
  }

  async generatePermissionConfig(_rules, _projectContext) {
    return `### Allowed Operations
- Read all project files
- Write to source directories
- Execute npm/pnpm/yarn scripts
- Git operations (status, add, commit, diff)

### Restricted Operations
- System-level commands (sudo, rm -rf)
- Environment file modifications
- Node modules modifications

### Framework-Specific Permissions
- Additional permissions based on detected frameworks`
  }

  async generateHookIntegration(_rules, _projectContext) {
    return `### Pre-Tool Use Hooks
- Validation hooks for file operations
- Security checks for bash commands

### Post-Tool Use Hooks
- Automatic formatting (if configured)
- Test execution triggers
- Documentation updates

### Custom Hooks
- Project-specific automation based on development workflow`
  }

  async generateExternalServices(_rules, projectContext) {
    const services = []

    // Detect common external services
    if (this.detectsDatabase(projectContext)) {
      services.push('- **Database**: MCP integration for schema and query operations')
    }

    if (projectContext.techStack?.libraries?.some((lib) => lib.includes('api'))) {
      services.push('- **APIs**: External API integration capabilities')
    }

    if (services.length === 0) {
      services.push('- External services configured based on project requirements')
    }

    return services.join('\n')
  }

  async generateTechnologyMemories(rules, projectContext) {
    const memories = []
    const frameworks = projectContext.techStack?.frameworks || []

    // Generate memory files for complex technology stacks
    for (const framework of frameworks) {
      if (this.requiresDetailedMemory(framework)) {
        const memoryContent = await this.generateFrameworkMemory(framework, rules, projectContext)
        memories.push({
          path: path.join(this.projectPath, `CLAUDE-${framework.toLowerCase()}.md`),
          content: memoryContent,
          type: 'technology',
          priority: 'medium',
        })
      }
    }

    return memories
  }

  requiresDetailedMemory(framework) {
    // Complex frameworks that benefit from dedicated memory files
    const complexFrameworks = ['Next.js', 'Angular', 'Django', 'FastAPI']
    return complexFrameworks.includes(framework)
  }

  async generateFrameworkMemory(framework, rules, projectContext) {
    return `# ${framework} Framework Memory

## Framework-Specific Patterns
${await this.getFrameworkSpecificPatterns(framework, rules)}

## Best Practices
${this.getFrameworkBestPractices(framework).join('\n')}

## Common Patterns
${await this.getFrameworkCommonPatterns(framework, projectContext)}

## Performance Considerations
${this.getFrameworkPerformancePatterns(framework).join('\n')}

---
*Generated for ${framework} framework integration*`
  }

  async getFrameworkSpecificPatterns(framework, rules) {
    const frameworkRules = rules.filter(
      (rule) => rule.frontmatter?.framework?.toLowerCase() === framework.toLowerCase()
    )

    if (frameworkRules.length === 0) {
      return `- Follow ${framework} best practices and conventions`
    }

    return frameworkRules
      .map((rule) => `- ${rule.frontmatter?.description || rule.name}`)
      .join('\n')
  }

  getFrameworkBestPractices(framework) {
    const practices = {
      'Next.js': [
        '- Use App Router for new applications',
        '- Implement proper SEO with metadata API',
        '- Optimize images with next/image component',
        '- Use server components when possible',
      ],
      React: [
        '- Use functional components with hooks',
        '- Implement proper key props for lists',
        '- Use React.memo for performance optimization',
        '- Follow component composition patterns',
      ],
      Angular: [
        '- Use Angular CLI for code generation',
        '- Implement proper dependency injection',
        '- Use reactive forms for complex forms',
        '- Follow Angular style guide',
      ],
    }

    return practices[framework] || [`- Follow ${framework} recommended practices`]
  }

  async getFrameworkCommonPatterns(framework, _projectContext) {
    // Analyze existing code patterns specific to the framework
    return `- Patterns detected through codebase analysis
- Follow established component/module organization
- Maintain consistency with existing ${framework} implementations`
  }

  getFrameworkPerformancePatterns(framework) {
    const patterns = {
      'Next.js': [
        '- Use dynamic imports for code splitting',
        '- Implement proper caching strategies',
        '- Optimize Core Web Vitals',
        '- Use streaming for better perceived performance',
      ],
      React: [
        '- Use React.memo and useMemo appropriately',
        '- Implement virtualization for large lists',
        '- Optimize re-renders with proper dependency arrays',
        '- Use React.lazy for component lazy loading',
      ],
    }

    return patterns[framework] || [`- Optimize ${framework} applications following best practices`]
  }

  async generateDatabaseMCP(projectContext) {
    const libraries = projectContext.techStack?.libraries || []

    if (libraries.some((lib) => lib.includes('prisma'))) {
      return {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-prisma'],
        env: {
          DATABASE_URL: '${DATABASE_URL}',
        },
      }
    }

    // Default database MCP
    return {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-database'],
      env: {},
    }
  }

  async generateFrameworkMCP(framework, _projectContext) {
    // Framework-specific MCP servers
    const mcpServers = {
      react: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-react-devtools'],
        env: {},
      },
    }

    return mcpServers[framework.toLowerCase()] || null
  }

  async generateNextJSCommands(_projectContext) {
    return [
      {
        name: 'create-nextjs-page',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create Next.js page following App Router patterns"
priority: "medium"
---

# Create Next.js Page

Create a new page following Next.js App Router conventions.

## Implementation Steps

1. **Analyze routing structure**
   - Check if using App Router or Pages Router
   - Review existing page patterns
   - Identify layout and metadata patterns

2. **Generate page file**
   - Create page.tsx in appropriate app directory
   - Include proper metadata export
   - Follow established layout patterns
   - Implement proper TypeScript interfaces

3. **Add supporting files**
   - Create loading.tsx if needed
   - Add error.tsx for error boundaries
   - Include not-found.tsx if appropriate

## Next.js Best Practices
- Use Server Components by default
- Implement proper SEO metadata
- Follow App Router conventions
- Optimize for Core Web Vitals

## Usage
\`/project:create-nextjs-page about\`
\`/project:create-nextjs-page blog/[slug]\`
`,
      },
    ]
  }

  async generateVueCommands(_projectContext) {
    return [
      {
        name: 'create-vue-component',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create Vue component using Composition API"
priority: "medium"
---

# Create Vue Component

Create a new Vue component following Composition API patterns.

## Implementation Steps

1. **Analyze existing components**
   - Check component directory structure
   - Review composition patterns
   - Identify common composables usage

2. **Generate component file**
   - Create .vue file with setup script
   - Include proper TypeScript support
   - Follow established prop patterns
   - Add scoped styling if needed

3. **Add tests and documentation**
   - Create test file using project's testing framework
   - Add JSDoc comments for complex props
   - Include usage examples

## Vue 3 Best Practices
- Use Composition API for new components
- Implement proper reactive patterns
- Follow Vue 3 style guide
- Use TypeScript for better development experience

## Usage
\`/project:create-vue-component BaseButton\`
\`/project:create-vue-component UserProfile\`
`,
      },
    ]
  }

  async generateAngularCommands(_projectContext) {
    return [
      {
        name: 'create-angular-component',
        content: `---
allowed-tools: ["Read", "Write", "Bash(ng generate:*)"]
description: "Create Angular component using Angular CLI"
priority: "medium"
---

# Create Angular Component

Create a new Angular component following Angular best practices.

## Implementation Steps

1. **Use Angular CLI**
   - Generate component using ng generate
   - Follow Angular naming conventions
   - Include proper module declarations

2. **Implement component logic**
   - Use proper TypeScript types
   - Implement lifecycle hooks as needed
   - Follow Angular style guide

3. **Add tests and documentation**
   - Use Angular testing utilities
   - Include component documentation
   - Add examples of usage

## Angular Best Practices
- Use Angular CLI for code generation
- Follow Angular style guide
- Implement proper dependency injection
- Use OnPush change detection when appropriate

## Usage
\`/project:create-angular-component user-profile\`
\`/project:create-angular-component shared/button\`
`,
      },
    ]
  }

  async generateExpressCommands(_projectContext) {
    return [
      {
        name: 'create-express-route',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create Express route with middleware and validation"
priority: "medium"
---

# Create Express Route

Create a new Express route following established patterns.

## Implementation Steps

1. **Analyze existing routes**
   - Check routing structure and patterns
   - Review middleware usage
   - Identify validation patterns

2. **Generate route file**
   - Create route handler with proper structure
   - Include input validation
   - Add error handling middleware
   - Implement proper HTTP status codes

3. **Add tests and documentation**
   - Create integration tests
   - Add API documentation
   - Include request/response examples

## Express Best Practices
- Use proper HTTP status codes
- Implement input validation
- Add comprehensive error handling
- Include request logging

## Usage
\`/project:create-express-route users\`
\`/project:create-express-route api/auth\`
`,
      },
    ]
  }

  async generateFastAPICommands(_projectContext) {
    return [
      {
        name: 'create-fastapi-endpoint',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create FastAPI endpoint with Pydantic models"
priority: "medium"
---

# Create FastAPI Endpoint

Create a new FastAPI endpoint following best practices.

## Implementation Steps

1. **Analyze existing endpoints**
   - Check API structure and patterns
   - Review Pydantic model usage
   - Identify authentication patterns

2. **Generate endpoint**
   - Create route with proper type hints
   - Include Pydantic models for validation
   - Add proper error handling
   - Implement authentication if needed

3. **Add tests and documentation**
   - Create pytest tests
   - Add OpenAPI documentation
   - Include request/response examples

## FastAPI Best Practices
- Use Pydantic for data validation
- Implement proper type hints
- Add comprehensive error handling
- Include OpenAPI documentation

## Usage
\`/project:create-fastapi-endpoint users\`
\`/project:create-fastapi-endpoint auth/login\`
`,
      },
    ]
  }

  async generateArchitectureCommands(_rules, projectContext) {
    const commands = []
    const architecturalPatterns = projectContext.patterns?.architecturalPatterns || []

    // Generate commands based on detected architectural patterns
    for (const pattern of architecturalPatterns) {
      if (pattern.confidence > 70) {
        // Only for high-confidence patterns
        const command = await this.generatePatternCommand(pattern, projectContext)
        if (command) {
          commands.push(command)
        }
      }
    }

    return commands
  }

  async generatePatternCommand(pattern, _projectContext) {
    const patternName = pattern.name.toLowerCase().replace(/\s+/g, '-')

    return {
      name: `analyze-${patternName}`,
      content: `---
allowed-tools: ["Read", "Grep"]
description: "Analyze ${pattern.name} architecture pattern implementation"
priority: "low"
---

# Analyze ${pattern.name} Pattern

Analyze the implementation of ${pattern.name} architectural pattern in the codebase.

## Analysis Areas

1. **Pattern Adherence**
   - Verify proper ${pattern.name} implementation
   - Identify deviations from pattern principles
   - Assess consistency across modules

2. **Architecture Quality**
   - Evaluate separation of concerns
   - Check dependency flow
   - Assess testability

3. **Improvement Opportunities**
   - Identify pattern violations
   - Suggest architectural improvements
   - Recommend refactoring opportunities

## Pattern Context
- **Confidence**: ${pattern.confidence}%
- **Description**: ${pattern.description || 'Architectural pattern detected in codebase'}

## Usage
\`/project:analyze-${patternName}\`
`,
    }
  }

  /**
   * Generate technology-specific commands
   */
  async generateTechnologyCommands(_rules, projectContext) {
    const commands = []
    const technologies = projectContext.techStack?.libraries || []

    // TypeScript commands
    if (technologies.some((tech) => tech.includes('typescript'))) {
      commands.push({
        name: 'fix-typescript-errors',
        content: `---
allowed-tools: ["Read", "Edit", "Bash(npx tsc:*)", "Bash(npm run type-check:*)"]
description: "Fix TypeScript compilation errors and type issues"
priority: "high"
---

# Fix TypeScript Errors

Systematically identify and fix TypeScript compilation errors.

## Process

1. **Identify Errors**
   - Run TypeScript compiler to get error list
   - Categorize errors by type and severity
   - Prioritize fixes by impact

2. **Fix Strategy**
   - Start with simple type annotations
   - Fix import/export issues
   - Address strict mode violations
   - Update type usage as needed

3. **Verification**
   - Run type checker after each fix
   - Ensure no new errors introduced
   - Validate runtime behavior unchanged

## Usage
\`/project:fix-typescript-errors\`
\`/project:fix-typescript-errors src/components\`
`,
      })

      commands.push({
        name: 'generate-types',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Generate TypeScript type definitions from usage patterns"
priority: "medium"
---

# Generate TypeScript Types

Create comprehensive TypeScript type definitions based on code analysis.

## Generation Process

1. **Analyze Usage**
   - Scan function signatures and return types
   - Identify object shapes and interfaces
   - Detect union and intersection types

2. **Create Definitions**
   - Generate interface definitions
   - Create utility types for common patterns
   - Add generic type constraints

3. **Integrate Types**
   - Import types in relevant files
   - Update function signatures
   - Add type exports to index files

## Usage
\`/project:generate-types ComponentProps\`
\`/project:generate-types APIResponse\`
`,
      })
    }

    // TailwindCSS commands
    if (technologies.some((tech) => tech.includes('tailwind'))) {
      commands.push({
        name: 'optimize-tailwind',
        content: `---
allowed-tools: ["Read", "Edit", "Bash(npx tailwindcss:*)"]
description: "Optimize TailwindCSS usage and remove unused classes"
priority: "medium"
---

# Optimize TailwindCSS

Analyze and optimize TailwindCSS usage across the project.

## Optimization Areas

1. **Class Usage Analysis**
   - Identify unused Tailwind classes
   - Find duplicate utility combinations
   - Detect custom CSS that could use Tailwind

2. **Component Optimization**
   - Extract common class patterns to components
   - Create utility classes for repeated patterns
   - Optimize responsive design patterns

3. **Bundle Optimization**
   - Configure PurgeCSS for production
   - Remove unused utility classes
   - Optimize build size

## Usage
\`/project:optimize-tailwind\`
\`/project:optimize-tailwind components\`
`,
      })
    }

    // State management commands
    if (technologies.some((tech) => tech.includes('zustand') || tech.includes('redux'))) {
      commands.push({
        name: 'create-store',
        content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create state management store following project patterns"
priority: "medium"
---

# Create State Store

Create a new state management store following established patterns.

## Implementation Steps

1. **Analyze Existing Stores**
   - Review current store structure
   - Identify common patterns and conventions
   - Check action and selector patterns

2. **Design Store Interface**
   - Define state shape and types
   - Plan actions and mutations
   - Design selectors for data access

3. **Generate Store Code**
   - Create store with proper TypeScript types
   - Implement actions and reducers
   - Add middleware if needed
   - Include testing utilities

## Usage
\`/project:create-store UserStore\`
\`/project:create-store CartStore\`
`,
      })
    }

    return commands
  }

  /**
   * Generate testing and quality commands
   */
  async generateTestingCommands(_rules, projectContext) {
    const commands = []
    const testingFrameworks = projectContext.techStack?.testingFrameworks || []

    commands.push({
      name: 'generate-tests',
      content: `---
allowed-tools: ["Read", "Write", "Edit", "Bash(npm run test:*)"]
description: "Generate comprehensive test suite for components or functions"
priority: "high"
---

# Generate Test Suite

Create comprehensive tests following project testing patterns.

## Test Generation Process

1. **Analyze Target Code**
   - Understand function/component behavior
   - Identify edge cases and error conditions
   - Review existing test patterns

2. **Create Test Structure**
   - Set up test file with proper imports
   - Create describe blocks for logical grouping
   - Generate test cases for all scenarios

3. **Test Implementation**
   - Unit tests for individual functions
   - Integration tests for components
   - Mock external dependencies
   - Add accessibility tests if applicable

## Test Types Generated
${testingFrameworks.map((fw) => `- ${fw} tests`).join('\n') || '- Framework-agnostic tests'}

## Usage
\`/project:generate-tests UserComponent\`
\`/project:generate-tests utils/helpers.js\`
`,
    })

    commands.push({
      name: 'fix-failing-tests',
      content: `---
allowed-tools: ["Read", "Edit", "Bash(npm run test:*)"]
description: "Analyze and fix failing tests in the project"
priority: "high"
---

# Fix Failing Tests

Systematically identify and fix failing tests.

## Fix Process

1. **Identify Failures**
   - Run test suite to get failure list
   - Categorize failures by type and cause
   - Prioritize fixes by impact

2. **Analyze Root Causes**
   - Review test expectations vs actual behavior
   - Check for breaking changes in dependencies
   - Identify flaky or timing-dependent tests

3. **Implement Fixes**
   - Update test expectations if behavior changed correctly
   - Fix implementation bugs if tests are correct
   - Improve test reliability and maintainability

## Usage
\`/project:fix-failing-tests\`
\`/project:fix-failing-tests integration\`
`,
    })

    commands.push({
      name: 'improve-coverage',
      content: `---
allowed-tools: ["Read", "Write", "Edit", "Bash(npm run coverage:*)"]
description: "Analyze test coverage and add tests for uncovered code"
priority: "medium"
---

# Improve Test Coverage

Analyze test coverage and systematically improve it.

## Coverage Analysis

1. **Generate Coverage Report**
   - Run coverage analysis tools
   - Identify uncovered lines and branches
   - Prioritize by code criticality

2. **Add Missing Tests**
   - Create tests for uncovered functions
   - Add edge case testing
   - Include error path testing

3. **Quality Assessment**
   - Ensure tests are meaningful, not just coverage
   - Add integration tests for complex flows
   - Include performance and accessibility tests

## Usage
\`/project:improve-coverage\`
\`/project:improve-coverage src/utils\`
`,
    })

    return commands
  }

  /**
   * Generate DevOps and deployment commands
   */
  async generateDevOpsCommands(_rules, projectContext) {
    const commands = []
    const technologies = projectContext.techStack?.libraries || []

    // Docker commands
    if (technologies.some((tech) => tech.includes('docker'))) {
      commands.push({
        name: 'optimize-docker',
        content: `---
allowed-tools: ["Read", "Write", "Edit", "Bash(docker:*)"]
description: "Optimize Docker configuration and build process"
priority: "medium"
---

# Optimize Docker Setup

Analyze and optimize Docker configuration for better performance and security.

## Optimization Areas

1. **Dockerfile Optimization**
   - Use multi-stage builds for smaller images
   - Optimize layer caching
   - Minimize image size
   - Improve security with non-root users

2. **Docker Compose Optimization**
   - Configure proper networking
   - Set up volume management
   - Optimize service dependencies
   - Add health checks

3. **Build Process**
   - Optimize build context
   - Use .dockerignore effectively
   - Cache dependencies properly
   - Implement security scanning

## Usage
\`/project:optimize-docker\`
\`/project:optimize-docker frontend\`
`,
      })
    }

    // CI/CD commands
    commands.push({
      name: 'setup-cicd',
      content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Set up or improve CI/CD pipeline configuration"
priority: "medium"
---

# Setup CI/CD Pipeline

Create or improve continuous integration and deployment pipeline.

## Pipeline Components

1. **Build Pipeline**
   - Set up dependency installation
   - Configure build process
   - Add code quality checks
   - Implement test execution

2. **Quality Gates**
   - Add linting and formatting checks
   - Configure test coverage requirements
   - Set up security scanning
   - Add performance testing

3. **Deployment Strategy**
   - Configure staging deployment
   - Set up production deployment
   - Add rollback mechanisms
   - Include monitoring and alerts

## Usage
\`/project:setup-cicd github-actions\`
\`/project:setup-cicd gitlab-ci\`
`,
    })

    commands.push({
      name: 'security-audit',
      content: `---
allowed-tools: ["Read", "Bash(npm audit:*)", "Bash(yarn audit:*)", "WebFetch"]
description: "Perform comprehensive security audit of the project"
priority: "high"
---

# Security Audit

Perform comprehensive security analysis of the project.

## Audit Areas

1. **Dependency Security**
   - Run npm/yarn security audit
   - Check for known vulnerabilities
   - Update vulnerable packages
   - Review dependency licenses

2. **Code Security**
   - Scan for security anti-patterns
   - Check input validation
   - Review authentication/authorization
   - Identify sensitive data exposure

3. **Configuration Security**
   - Review environment variables
   - Check server configuration
   - Validate SSL/TLS setup
   - Assess deployment security

## Usage
\`/project:security-audit\`
\`/project:security-audit dependencies\`
`,
    })

    return commands
  }

  /**
   * Generate database and data layer commands
   */
  async generateDataCommands(_rules, projectContext) {
    const commands = []
    const technologies = projectContext.techStack?.libraries || []

    // Prisma commands
    if (technologies.some((tech) => tech.includes('prisma'))) {
      commands.push({
        name: 'generate-prisma-schema',
        content: `---
allowed-tools: ["Read", "Write", "Edit", "Bash(npx prisma:*)"]
description: "Generate or update Prisma schema based on requirements"
priority: "medium"
---

# Generate Prisma Schema

Create or update Prisma database schema following best practices.

## Schema Generation Process

1. **Analyze Requirements**
   - Review data model requirements
   - Identify entity relationships
   - Plan indexes and constraints

2. **Design Schema**
   - Create model definitions
   - Set up relationships and constraints
   - Add indexes for performance
   - Configure database-specific features

3. **Generate and Migrate**
   - Generate Prisma client
   - Create database migrations
   - Validate schema against database
   - Update TypeScript types

## Usage
\`/project:generate-prisma-schema User\`
\`/project:generate-prisma-schema BlogPost\`
`,
      })

      commands.push({
        name: 'optimize-queries',
        content: `---
allowed-tools: ["Read", "Edit", "Bash(npx prisma:*)"]
description: "Analyze and optimize database queries for performance"
priority: "medium"
---

# Optimize Database Queries

Analyze and optimize database queries for better performance.

## Optimization Process

1. **Query Analysis**
   - Identify slow queries
   - Analyze query execution plans
   - Find N+1 query problems
   - Review index usage

2. **Optimization Strategies**
   - Add appropriate database indexes
   - Optimize Prisma query patterns
   - Implement query batching
   - Add caching where appropriate

3. **Performance Testing**
   - Benchmark query performance
   - Test with realistic data volumes
   - Monitor query execution times
   - Validate optimization effectiveness

## Usage
\`/project:optimize-queries\`
\`/project:optimize-queries user-queries\`
`,
      })
    }

    // General data commands
    commands.push({
      name: 'create-data-model',
      content: `---
allowed-tools: ["Read", "Write", "Edit"]
description: "Create data model with validation and types"
priority: "medium"
---

# Create Data Model

Create comprehensive data model with validation and type safety.

## Model Creation Process

1. **Define Data Structure**
   - Identify required fields and types
   - Set up validation rules
   - Define relationships with other models
   - Plan data access patterns

2. **Implement Model**
   - Create TypeScript interfaces/types
   - Add validation schemas
   - Implement data access methods
   - Add error handling

3. **Integration**
   - Connect to database layer
   - Add API endpoints if needed
   - Create test fixtures
   - Update documentation

## Usage
\`/project:create-data-model UserProfile\`
\`/project:create-data-model ProductCatalog\`
`,
    })

    return commands
  }
}
