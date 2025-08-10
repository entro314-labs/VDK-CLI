/**
 * TechnologyAnalyzer.js
 *
 * Identifies the technology stack, frameworks, and libraries used in the project
 * by analyzing package files, imports, and project structure.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import chalk from 'chalk'

import { PackageAnalyzer } from '../utils/package-analyzer.js'

export class TechnologyAnalyzer {
  constructor(options = {}) {
    this.verbose = options.verbose

    // Initialize tech stack storage
    this.primaryLanguages = []
    this.frameworks = []
    this.libraries = []
    this.buildTools = []
    this.linters = []
    this.testingFrameworks = []
    this.foundPackages = []
    this.stacks = []
  }

  /**
   * Analyzes the project to identify technologies used
   * @param {Object} projectStructure - Project structure from ProjectScanner
   * @returns {Object} Technology stack information
   */
  async analyzeTechnologies(projectStructure) {
    if (this.verbose) {
      console.log(chalk.gray('Starting technology stack analysis...'))
    }

    // Reset tech stack storage for a clean analysis
    this.resetTechnologyStack()

    try {
      // Identify primary languages based on file extensions
      this.identifyPrimaryLanguages(projectStructure)

      // Analyze package files (package.json, requirements.txt, etc.)
      await this.analyzePackageFiles(projectStructure)

      // Analyze specific framework files and indicators
      await this.analyzeFrameworkIndicators(projectStructure)

      // Detect technology stacks and integrations
      this.detectTechnologyStacks()

      // Return combined technology stack results
      return {
        primaryLanguages: this.primaryLanguages,
        frameworks: this.frameworks,
        libraries: this.libraries,
        buildTools: this.buildTools,
        linters: this.linters,
        testingFrameworks: this.testingFrameworks,
        stacks: this.stacks || [],
      }
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red(`Error in technology analysis: ${error.message}`))
        console.error(chalk.gray(error.stack))
      }
      throw new Error(`Technology analysis failed: ${error.message}`)
    }
  }

  /**
   * Resets technology stack storage for a clean analysis
   */
  resetTechnologyStack() {
    this.primaryLanguages = []
    this.frameworks = []
    this.libraries = []
    this.buildTools = []
    this.linters = []
    this.testingFrameworks = []
  }

  /**
   * Identifies primary languages based on file extensions
   * @param {Object} projectStructure - Project structure data
   */
  identifyPrimaryLanguages(projectStructure) {
    if (this.verbose) {
      console.log(chalk.gray('Identifying primary languages...'))
    }

    // Count files by extension
    const extensionCount = new Map()
    let totalFiles = 0

    // Create a mapping of extensions to languages
    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      rb: 'ruby',
      php: 'php',
      java: 'java',
      go: 'go',
      rs: 'rust',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      clj: 'clojure',
      ex: 'elixir',
      exs: 'elixir',
      html: 'html',
      css: 'css',
      scss: 'sass',
      sass: 'sass',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
    }

    // Count files by extension
    for (const file of projectStructure.files) {
      // Skip files that are in the project's node_modules, build, or dist directories
      if (
        file.path.includes('/node_modules/') ||
        file.path.includes('/dist/') ||
        file.path.includes('/build/')
      ) {
        continue
      }

      // Get file extension without the dot
      const ext = path.extname(file.path).slice(1).toLowerCase()
      if (!ext) {
        continue
      }

      extensionCount.set(ext, (extensionCount.get(ext) || 0) + 1)
      totalFiles++
    }

    if (totalFiles === 0) {
      return
    }

    // Calculate language percentages
    const languagePercentage = new Map()

    for (const [ext, count] of extensionCount.entries()) {
      if (languageMap[ext]) {
        const language = languageMap[ext]
        languagePercentage.set(
          language,
          (languagePercentage.get(language) || 0) + (count / totalFiles) * 100
        )
      }
    }

    // Filter for primary languages (more than 5%)
    for (const [language, percentage] of languagePercentage.entries()) {
      if (percentage > 5) {
        this.primaryLanguages.push(language)
      }
    }

    // Sort languages by percentage
    this.primaryLanguages.sort((a, b) => {
      return languagePercentage.get(b) - languagePercentage.get(a)
    })

    if (this.verbose) {
      console.log(chalk.gray(`Primary languages detected: ${this.primaryLanguages.join(', ')}`))
    }
  }

  /**
   * Analyzes package files for dependencies
   * @param {Object} projectStructure - Project structure data
   */
  async analyzePackageFiles(projectStructure) {
    if (this.verbose) {
      console.log(chalk.gray('Analyzing package files for dependencies...'))
    }

    // Get project root
    const projectRoot = projectStructure.projectPath

    // Use our enhanced package analyzer
    if (this.verbose) {
      console.log(chalk.gray('Using enhanced package analyzer...'))
    }

    try {
      // Analyze package.json files
      const packageAnalysis = await PackageAnalyzer.analyzeDependencies(projectRoot)

      // Update tech stacks from the analysis
      if (packageAnalysis?.technologies) {
        // Add libraries from different categories
        if (packageAnalysis.technologies.ui && packageAnalysis.technologies.ui.length > 0) {
          this.libraries.push(...packageAnalysis.technologies.ui)
        }
        if (
          packageAnalysis.technologies.backend_services &&
          packageAnalysis.technologies.backend_services.length > 0
        ) {
          this.libraries.push(...packageAnalysis.technologies.backend_services)
        }
        if (
          packageAnalysis.technologies.databases &&
          packageAnalysis.technologies.databases.length > 0
        ) {
          this.libraries.push(...packageAnalysis.technologies.databases)
        }
        if (
          packageAnalysis.technologies.stateManagement &&
          packageAnalysis.technologies.stateManagement.length > 0
        ) {
          this.libraries.push(...packageAnalysis.technologies.stateManagement)
        }
        if (
          packageAnalysis.technologies.dataFetching &&
          packageAnalysis.technologies.dataFetching.length > 0
        ) {
          this.libraries.push(...packageAnalysis.technologies.dataFetching)
        }
        if (packageAnalysis.technologies.forms && packageAnalysis.technologies.forms.length > 0) {
          this.libraries.push(...packageAnalysis.technologies.forms)
        }
        if (
          packageAnalysis.technologies.styling &&
          packageAnalysis.technologies.styling.length > 0
        ) {
          this.libraries.push(...packageAnalysis.technologies.styling)
        }
        if (packageAnalysis.technologies.api && packageAnalysis.technologies.api.length > 0) {
          this.libraries.push(...packageAnalysis.technologies.api)
        }

        // Add frameworks
        if (
          packageAnalysis.technologies.frontend &&
          packageAnalysis.technologies.frontend.length > 0
        ) {
          this.frameworks.push(...packageAnalysis.technologies.frontend)
        }
        if (
          packageAnalysis.technologies.backend &&
          packageAnalysis.technologies.backend.length > 0
        ) {
          this.frameworks.push(...packageAnalysis.technologies.backend)
        }
        if (
          packageAnalysis.technologies.serverless &&
          packageAnalysis.technologies.serverless.length > 0
        ) {
          this.frameworks.push(...packageAnalysis.technologies.serverless)
        }
        if (packageAnalysis.technologies.mobile && packageAnalysis.technologies.mobile.length > 0) {
          this.frameworks.push(...packageAnalysis.technologies.mobile)
        }

        // Add build tools
        if (
          packageAnalysis.technologies.buildTools &&
          packageAnalysis.technologies.buildTools.length > 0
        ) {
          this.buildTools.push(...packageAnalysis.technologies.buildTools)
        }

        // Add testing frameworks
        if (
          packageAnalysis.technologies.testing &&
          packageAnalysis.technologies.testing.length > 0
        ) {
          this.testingFrameworks.push(...packageAnalysis.technologies.testing)
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Warning: Error analyzing package.json: ${error.message}`))
      }
    }

    // Check for Python projects (requirements.txt, setup.py)
    if (this.primaryLanguages.includes('python')) {
      const requirementsFiles = projectStructure.files
        .filter((file) => file.name === 'requirements.txt')
        .map((file) => file.path)

      const _setupFiles = projectStructure.files
        .filter((file) => file.name === 'setup.py')
        .map((file) => file.path)

      // Analyze requirements.txt files
      for (const requirementsPath of requirementsFiles) {
        try {
          const content = await fs.readFile(requirementsPath, 'utf8')
          const lines = content.split('\n').map((line) => line.trim())

          for (const line of lines) {
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
              continue
            }

            // Extract package name (ignoring version)
            const packageName = line.split('==')[0].split('>=')[0].split('<=')[0].trim()

            // Check for common frameworks and libraries
            if (packageName === 'django') {
              this.frameworks.push('Django')
            }
            if (packageName === 'flask') {
              this.frameworks.push('Flask')
            }
            if (packageName === 'fastapi') {
              this.frameworks.push('FastAPI')
            }
            if (packageName === 'tornado') {
              this.frameworks.push('Tornado')
            }
            if (packageName === 'pyramid') {
              this.frameworks.push('Pyramid')
            }

            // Testing libraries
            if (packageName === 'pytest') {
              this.testingFrameworks.push('pytest')
            }
            if (packageName === 'unittest') {
              this.testingFrameworks.push('unittest')
            }

            // Common data science libraries
            if (
              ['numpy', 'pandas', 'matplotlib', 'seaborn', 'scipy'].includes(packageName) &&
              !this.libraries.includes('Data Science')
            ) {
              this.libraries.push('Data Science')
            }

            // ML/AI libraries
            if (
              ['tensorflow', 'keras', 'pytorch', 'scikit-learn', 'xgboost'].includes(packageName) &&
              !this.libraries.includes('Machine Learning')
            ) {
              this.libraries.push('Machine Learning')
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(
              chalk.yellow(`Warning: Error analyzing requirements.txt: ${error.message}`)
            )
          }
        }
      }
    }

    // Check for Ruby projects (Gemfile)
    if (this.primaryLanguages.includes('ruby')) {
      const gemFiles = projectStructure.files
        .filter((file) => file.name === 'Gemfile')
        .map((file) => file.path)

      for (const gemfilePath of gemFiles) {
        try {
          const content = await fs.readFile(gemfilePath, 'utf8')
          const lines = content.split('\n').map((line) => line.trim())

          for (const line of lines) {
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
              continue
            }

            // Check for common frameworks and libraries
            if (line.includes("'rails'") || line.includes('"rails"')) {
              this.frameworks.push('Ruby on Rails')
            }

            if (line.includes("'sinatra'") || line.includes('"sinatra"')) {
              this.frameworks.push('Sinatra')
            }

            if (line.includes("'rspec'") || line.includes('"rspec"')) {
              this.testingFrameworks.push('RSpec')
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Warning: Error analyzing Gemfile: ${error.message}`))
          }
        }
      }
    }
  }

  /**
   * Analyze specific framework indicators in the project structure
   * @param {Object} projectStructure - Project structure from ProjectScanner
   */
  async analyzeFrameworkIndicators(projectStructure) {
    if (this.verbose) {
      console.log(chalk.gray('Analyzing framework indicators...'))
    }

    // Check for React
    const reactFiles = projectStructure.files
      .filter((file) => file.name.endsWith('.jsx') || file.name.endsWith('.tsx'))
      .map((file) => file.path)

    if (reactFiles.length > 0 && !this.frameworks.includes('React')) {
      this.frameworks.push('React')
    }

    // Enhanced Next.js detection
    // Check for Next.js config files
    const nextjsConfigFiles = projectStructure.files
      .filter(
        (file) =>
          file.name === 'next.config.js' ||
          file.name === 'next.config.mjs' ||
          file.name === 'next.config.ts'
      )
      .map((file) => file.path)

    // Check for Next.js app directory structure (Next.js 13+)
    const hasAppDir = projectStructure.directories.some(
      (dir) => dir.name === 'app' && (dir.path.includes('/src/app') || dir.path.endsWith('/app'))
    )

    // Check for Next.js pages directory structure (traditional Next.js)
    const hasPagesDir = projectStructure.directories.some(
      (dir) =>
        dir.name === 'pages' && (dir.path.includes('/src/pages') || dir.path.endsWith('/pages'))
    )

    // Look for Next.js special files like page.js, layout.js in app directory
    const nextSpecialFileNames = ['page', 'layout', 'loading', 'error', 'not-found', 'route']
    const hasNextAppPageFiles = projectStructure.files.some((file) => {
      const fileName = path.basename(file.name, path.extname(file.name))
      return file.path.includes('/app/') && nextSpecialFileNames.includes(fileName)
    })

    // Check package.json for Next.js dependency
    const hasNextDependency = this.libraries.includes('next')

    // If any Next.js indicators are found, mark as Next.js project
    // Note: hasPagesDir alone is not sufficient since Astro also uses pages directories
    if (
      nextjsConfigFiles.length > 0 ||
      hasNextDependency ||
      (hasAppDir && hasNextAppPageFiles) ||
      (hasPagesDir && (hasNextDependency || nextjsConfigFiles.length > 0))
    ) {
      if (!this.frameworks.includes('Next.js')) {
        this.frameworks.push('Next.js')

        // Log detailed detection reason if in verbose mode
        if (this.verbose) {
          if (nextjsConfigFiles.length > 0) {
            console.log(chalk.gray('  - Next.js detected: Found next.config.js'))
          }
          if (hasNextDependency) {
            console.log(chalk.gray('  - Next.js detected: Found next dependency'))
          }
          if (hasAppDir && hasNextAppPageFiles) {
            console.log(
              chalk.gray('  - Next.js detected: Found app directory with Next.js page files')
            )
          }
          if (hasPagesDir) {
            console.log(chalk.gray('  - Next.js detected: Found pages directory'))
          }
        }
      }

      // If app directory is detected, add Next.js App Router as framework variant
      if (hasAppDir && hasNextAppPageFiles && !this.frameworks.includes('Next.js App Router')) {
        this.frameworks.push('Next.js App Router')
        if (this.verbose) {
          console.log(chalk.gray('  - Next.js App Router detected'))
        }
      }

      // Try to detect Next.js version from package.json
      try {
        const packageJsonFiles = projectStructure.files
          .filter((file) => file.name === 'package.json')
          .map((file) => file.path)

        if (packageJsonFiles.length > 0) {
          const packageJsonContent = await fs.readFile(packageJsonFiles[0], 'utf8')
          const packageData = JSON.parse(packageJsonContent)

          // Check for Next.js version
          const nextVersion = packageData.dependencies?.next || packageData.devDependencies?.next
          if (nextVersion) {
            // Extract major version
            const versionMatch = nextVersion.match(/[0-9]+/)
            if (versionMatch) {
              const majorVersion = Number.parseInt(versionMatch[0], 10)
              if (majorVersion >= 14) {
                if (!this.frameworks.includes('Next.js 14+')) {
                  this.frameworks.push('Next.js 14+')
                  if (this.verbose) {
                    console.log(chalk.gray(`  - Next.js 14+ detected (version: ${nextVersion})`))
                  }
                }
              } else if (majorVersion >= 13 && !this.frameworks.includes('Next.js 13+')) {
                this.frameworks.push('Next.js 13+')
                if (this.verbose) {
                  console.log(chalk.gray(`  - Next.js 13+ detected (version: ${nextVersion})`))
                }
              }
            }
          }
        }
      } catch (err) {
        // Silently handle any errors in version detection
        if (this.verbose) {
          console.log(chalk.yellow(`Error detecting Next.js version: ${err.message}`))
        }
      }
    }

    // Check for Vue.js
    const vueFiles = projectStructure.files
      .filter((file) => file.name.endsWith('.vue'))
      .map((file) => file.path)

    if (vueFiles.length > 0 && !this.frameworks.includes('Vue.js')) {
      this.frameworks.push('Vue.js')
    }

    // Check for Angular
    const angularFiles = projectStructure.files
      .filter((file) => file.name === 'angular.json')
      .map((file) => file.path)

    if (angularFiles.length > 0 && !this.frameworks.includes('Angular')) {
      this.frameworks.push('Angular')
    }

    // Check for Django
    const djangoFiles = projectStructure.files
      .filter((file) => file.name === 'manage.py' || file.name === 'settings.py')
      .map((file) => file.path)

    if (djangoFiles.length > 0 && !this.frameworks.includes('Django')) {
      this.frameworks.push('Django')
    }

    // Check for shadcn/ui
    const hasShadcnUIComponents = projectStructure.directories.some(
      (dir) => dir.name === 'components' && dir.path.includes('/ui/')
    )

    const hasShadcnUIIndicators = projectStructure.files.some(
      (file) =>
        file.name === 'components.json' ||
        (file.path.includes('/ui/') &&
          (file.path.includes('/button/') || file.path.includes('/dialog/')))
    )

    const hasShadcnDependencies = [
      'class-variance-authority',
      'clsx',
      'cmdk',
      'lucide-react',
      'tailwind-merge',
      'tailwindcss-animate',
    ].some((dep) => this.libraries.includes(dep))

    if (
      ((hasShadcnUIComponents && hasShadcnUIIndicators) || hasShadcnDependencies) &&
      !this.frameworks.includes('shadcn/ui')
    ) {
      this.frameworks.push('shadcn/ui')
      if (this.verbose) {
        console.log(chalk.gray('  - shadcn/ui detected'))
      }
    }

    // Check for Supabase
    const hasSupabaseDependencies = [
      '@supabase/supabase-js',
      '@supabase/auth-helpers-nextjs',
      '@supabase/auth-helpers-react',
      '@supabase/auth-ui-react',
    ].some((dep) => this.libraries.includes(dep))

    const hasSupabaseConfig = projectStructure.files.some(
      (file) =>
        file.name === 'supabase.ts' ||
        file.name === 'supabase.js' ||
        file.path.includes('/supabase/') ||
        file.path.includes('/lib/supabase')
    )

    if (hasSupabaseDependencies || hasSupabaseConfig) {
      if (!this.frameworks.includes('Supabase')) {
        this.frameworks.push('Supabase')
        if (this.verbose) {
          console.log(chalk.gray('  - Supabase detected'))
        }
      }

      // If using both Next.js and Supabase, add the stack
      if (
        this.frameworks.includes('Next.js') &&
        !this.frameworks.includes('Supabase-Next.js Stack')
      ) {
        this.frameworks.push('Supabase-Next.js Stack')
        if (this.verbose) {
          console.log(chalk.gray('  - Supabase-Next.js Stack detected'))
        }
      }
    }

    // Check for Flask
    const flaskFiles = projectStructure.files
      .filter((file) => {
        // Check for app.py or similar with imports for Flask
        if (file.name === 'app.py' || file.name === 'wsgi.py' || file.name === 'main.py') {
          return true
        }
        return false
      })
      .map((file) => file.path)

    if (flaskFiles.length > 0) {
      // Sample a few files to check for Flask imports
      const sampleSize = Math.min(flaskFiles.length, 3)
      let hasFlask = false

      for (let i = 0; i < sampleSize; i++) {
        try {
          const content = await fs.readFile(flaskFiles[i], 'utf8')
          if (content.includes('from flask import')) {
            hasFlask = true
            break
          }
        } catch {
          // Ignore errors reading files
        }
      }

      if (hasFlask && !this.frameworks.includes('Flask')) {
        this.frameworks.push('Flask')
      }
    }

    // Check for Express.js
    if (
      (this.libraries.includes('express') || this.libraries.includes('express.js')) &&
      !this.frameworks.includes('Express.js')
    ) {
      this.frameworks.push('Express.js')
    }

    // Check for iOS/Swift projects
    const xcodeProjectFiles = projectStructure.files
      .filter((file) => file.name.endsWith('.xcodeproj') || file.name.endsWith('.xcworkspace'))
      .map((file) => file.path)

    if (xcodeProjectFiles.length > 0) {
      this.frameworks.push('Xcode')

      // Check for Swift UI
      const swiftFiles = projectStructure.files
        .filter((file) => file.extension === 'swift')
        .map((file) => file.path)

      if (swiftFiles.length > 0) {
        // Sample a few Swift files to check for SwiftUI imports
        const sampleSize = Math.min(swiftFiles.length, 5)
        let hasSwiftUI = false

        for (let i = 0; i < sampleSize; i++) {
          try {
            const content = await fs.readFile(swiftFiles[i], 'utf8')
            if (content.includes('import SwiftUI')) {
              hasSwiftUI = true
              break
            }
          } catch {
            // Ignore errors reading files
          }
        }

        if (hasSwiftUI) {
          this.frameworks.push('SwiftUI')
        }
      }
    }

    // Detect Android projects
    const androidManifestFiles = projectStructure.files
      .filter((file) => file.name === 'AndroidManifest.xml')
      .map((file) => file.path)

    if (androidManifestFiles.length > 0) {
      this.frameworks.push('Android')
    }

    // Detect Flutter
    const pubspecFiles = projectStructure.files
      .filter((file) => file.name === 'pubspec.yaml')
      .map((file) => file.path)

    if (pubspecFiles.length > 0) {
      for (const pubspecPath of pubspecFiles) {
        try {
          const content = await fs.readFile(pubspecPath, 'utf8')
          if (content.includes('flutter:')) {
            this.frameworks.push('Flutter')
            break
          }
        } catch {
          // Ignore errors reading files
        }
      }
    }

    // Check for Tailwind CSS
    const hasTailwindDependencies = [
      'tailwindcss',
      '@tailwindcss/forms',
      '@tailwindcss/typography',
      '@tailwindcss/aspect-ratio',
      '@tailwindcss/container-queries',
      'tailwind-merge',
      'tailwindcss-animate',
    ].some((dep) => this.libraries.includes(dep))

    const hasTailwindConfig = projectStructure.files.some(
      (file) =>
        file.name === 'tailwind.config.js' ||
        file.name === 'tailwind.config.ts' ||
        file.name === 'tailwind.config.cjs' ||
        file.name === 'tailwind.config.mjs'
    )

    if (
      (hasTailwindDependencies || hasTailwindConfig) &&
      !this.frameworks.includes('Tailwind CSS')
    ) {
      this.frameworks.push('Tailwind CSS')
      if (this.verbose) {
        console.log(chalk.gray('  - Tailwind CSS detected'))
      }
    }

    // Ensure we don't have duplicates
    this.primaryLanguages = [...new Set(this.primaryLanguages)]
    this.frameworks = [...new Set(this.frameworks)]
    this.libraries = [...new Set(this.libraries)]
    this.buildTools = [...new Set(this.buildTools)]
    this.linters = [...new Set(this.linters)]
    this.testingFrameworks = [...new Set(this.testingFrameworks)]
  }

  /**
   * Detects common technology stacks based on identified frameworks and libraries
   * This method analyzes the combination of detected technologies to identify
   * well-known technology stacks and patterns
   */
  detectTechnologyStacks() {
    if (this.verbose) {
      console.log(chalk.gray('Detecting technology stacks...'))
    }

    this.stacks = []

    // MERN Stack (MongoDB, Express, React, Node.js)
    if (
      this.frameworks.includes('React') &&
      this.frameworks.includes('Express.js') &&
      this.libraries.includes('mongodb')
    ) {
      this.stacks.push('MERN Stack')
    }

    // MEAN Stack (MongoDB, Express, Angular, Node.js)
    if (
      this.frameworks.includes('Angular') &&
      this.frameworks.includes('Express.js') &&
      this.libraries.includes('mongodb')
    ) {
      this.stacks.push('MEAN Stack')
    }

    // Next.js Enterprise Stack
    if (
      this.frameworks.includes('Next.js') &&
      (this.libraries.includes('typescript') || this.primaryLanguages.includes('typescript'))
    ) {
      this.stacks.push('NextJS Enterprise Stack')
    }

    // Supabase + Next.js Stack (already detected in framework indicators)
    if (this.frameworks.includes('Supabase-Next.js Stack')) {
      this.stacks.push('Supabase + Next.js')
    }

    // tRPC Full-Stack
    if (
      this.libraries.includes('@trpc/server') ||
      this.libraries.includes('@trpc/client') ||
      this.libraries.includes('@trpc/react-query')
    ) {
      this.stacks.push('tRPC Full-Stack')
    }

    // Laravel + Vue Stack
    if (this.frameworks.includes('Laravel') && this.frameworks.includes('Vue.js')) {
      this.stacks.push('Laravel + Vue')
    }

    // Django REST + React Stack
    if (
      this.frameworks.includes('Django') &&
      this.frameworks.includes('React') &&
      this.libraries.includes('djangorestframework')
    ) {
      this.stacks.push('Django REST + React')
    }

    // Spring Boot + React Stack
    if (this.frameworks.includes('Spring Boot') && this.frameworks.includes('React')) {
      this.stacks.push('Spring Boot + React')
    }

    // Astro Content Stack
    if (this.frameworks.includes('Astro')) {
      this.stacks.push('Astro Content Stack')
    }

    // React Native Mobile Stack
    if (this.frameworks.includes('React Native')) {
      this.stacks.push('React Native Mobile')
    }

    // E-commerce Stack indicators
    const ecommerceIndicators = [
      'stripe',
      'shopify',
      'woocommerce',
      'magento',
      'commerce.js',
      '@stripe/stripe-js',
      'paypal',
    ]
    if (ecommerceIndicators.some((indicator) => this.libraries.includes(indicator))) {
      this.stacks.push('Ecommerce Stack')
    }

    // JAMstack (JavaScript, APIs, Markup)
    const jamstackFrameworks = ['Gatsby', 'Next.js', 'Nuxt.js', 'Astro', 'Eleventy']
    if (jamstackFrameworks.some((framework) => this.frameworks.includes(framework))) {
      this.stacks.push('JAMstack')
    }

    // Serverless Stack
    const serverlessIndicators = [
      'aws-lambda',
      'vercel',
      'netlify-functions',
      '@vercel/node',
      'serverless',
      'aws-cdk',
    ]
    if (serverlessIndicators.some((indicator) => this.libraries.includes(indicator))) {
      this.stacks.push('Serverless Stack')
    }

    // Full-Stack TypeScript
    if (this.primaryLanguages.includes('typescript') && this.frameworks.length > 1) {
      this.stacks.push('Full-Stack TypeScript')
    }

    // Remove duplicates
    this.stacks = [...new Set(this.stacks)]

    if (this.verbose && this.stacks.length > 0) {
      console.log(chalk.gray(`Technology stacks detected: ${this.stacks.join(', ')}`))
    }
  }
}
