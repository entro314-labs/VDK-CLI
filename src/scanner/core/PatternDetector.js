/**
 * PatternDetector.js
 *
 * Analyzes code to detect naming conventions, architectural patterns,
 * and common coding patterns used throughout the project.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import chalk from 'chalk'

// Helper functions for parsing specific file types
import { analyzeJavaScript } from '../analyzers/javascript.js'
import { analyzePython } from '../analyzers/python.js'
import { analyzeSwift } from '../analyzers/swift.js'
import { analyzeTypeScript } from '../analyzers/typescript.js'
import { DependencyAnalyzer } from './DependencyAnalyzer.js'

export class PatternDetector {
  constructor(options = {}) {
    this.verbose = options.verbose
    this.sampleSize = options.sampleSize || 50 // Max files to analyze per type

    // Initialize pattern storage
    this.namingConventions = {
      variables: {},
      functions: {},
      classes: {},
      components: {},
      files: {},
      directories: {},
    }

    this.architecturalPatterns = []
    this.codePatterns = []
    this.consistencyMetrics = {}

    // Initialize dependency analyzer
    this.dependencyAnalyzer = new DependencyAnalyzer({
      verbose: this.verbose,
      maxFilesToParse: options.maxFilesToParse || 200,
    })
  }

  /**
   * Detects patterns from project structure data
   * @param {Object} projectStructure - Project structure from ProjectScanner
   * @param {Object} techData - Technology data from TechnologyAnalyzer (optional)
   * @returns {Object} Detected patterns
   */
  async detectPatterns(projectStructure, techData = {}) {
    if (this.verbose) {
      console.log(chalk.gray('Starting pattern detection...'))
    }

    // Reset pattern storage for a clean analysis
    this.resetPatternStorage()

    try {
      // Analyze naming conventions for files and directories
      await this.analyzeFileAndDirectoryNaming(projectStructure)

      // Detect architectural patterns based on directory structure and dependencies
      await this.detectArchitecturalPatterns(projectStructure, techData)

      // Analyze code samples for naming conventions and patterns
      await this.analyzeCodeSamples(projectStructure)

      // Calculate consistency metrics
      this.calculateConsistencyMetrics()

      // Return combined pattern detection results
      return {
        namingConventions: this.namingConventions,
        architecturalPatterns: this.architecturalPatterns,
        codePatterns: this.codePatterns,
        consistencyMetrics: this.consistencyMetrics,
        dependencyInsights: {
          moduleCount: this.dependencyAnalyzer.dependencyGraph?.size || 0,
          edgeCount: this.dependencyAnalyzer.countEdges ? this.dependencyAnalyzer.countEdges() : 0,
        },
      }
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red(`Error in pattern detection: ${error.message}`))
        console.error(chalk.gray(error.stack))
      }
      throw new Error(`Pattern detection failed: ${error.message}`)
    }
  }

  /**
   * Resets pattern storage for a clean analysis
   */
  resetPatternStorage() {
    // Reset naming conventions
    this.namingConventions = {
      variables: { patterns: {}, total: 0, dominant: null },
      functions: { patterns: {}, total: 0, dominant: null },
      classes: { patterns: {}, total: 0, dominant: null },
      components: { patterns: {}, total: 0, dominant: null },
      files: { patterns: {}, total: 0, dominant: null },
      directories: { patterns: {}, total: 0, dominant: null },
    }

    // Reset other patterns
    this.architecturalPatterns = []
    this.codePatterns = []
    this.consistencyMetrics = {}
  }

  /**
   * Analyzes naming conventions for files and directories
   * @param {Object} projectStructure - Project structure data
   */
  async analyzeFileAndDirectoryNaming(projectStructure) {
    if (this.verbose) {
      console.log(chalk.gray('Analyzing file and directory naming conventions...'))
    }

    // Analyze file naming
    for (const file of projectStructure.files) {
      const name = path.basename(file.name, path.extname(file.name))
      this.analyzeNamingConvention(name, 'files')
    }

    // Analyze directory naming
    for (const dir of projectStructure.directories) {
      this.analyzeNamingConvention(dir.name, 'directories')
    }

    // Determine dominant conventions
    this.determineDominantConvention('files')
    this.determineDominantConvention('directories')

    if (this.verbose) {
      if (this.namingConventions.files.dominant) {
        console.log(chalk.gray(`File naming convention: ${this.namingConventions.files.dominant}`))
      }
      if (this.namingConventions.directories.dominant) {
        console.log(chalk.gray(`Directory naming convention: ${this.namingConventions.directories.dominant}`))
      }
    }
  }

  /**
   * Determines the naming convention used for a given name
   * @param {string} name - The name to analyze
   * @param {string} category - Category for storing results (files, directories, etc.)
   */
  analyzeNamingConvention(name, category) {
    // Skip empty names
    if (!name) {
      return
    }

    // Check for various naming conventions
    let convention = 'unknown'

    // camelCase: first character is lowercase, has mixed case
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
      convention = 'camelCase'
    }
    // PascalCase: first character is uppercase, has mixed case
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      convention = 'PascalCase'
    }
    // snake_case: contains underscores, all lowercase
    else if (/^[a-z0-9_]+$/.test(name) && name.includes('_')) {
      convention = 'snake_case'
    }
    // kebab-case: contains hyphens, all lowercase
    else if (/^[a-z0-9-]+$/.test(name) && name.includes('-')) {
      convention = 'kebab-case'
    }
    // lowercase: all lowercase, no separators
    else if (/^[a-z0-9]+$/.test(name)) {
      convention = 'lowercase'
    }
    // UPPERCASE: all uppercase, may contain underscores
    else if (/^[A-Z0-9_]+$/.test(name)) {
      convention = 'UPPERCASE'
    }

    // Update naming convention statistics
    const stats = this.namingConventions[category]
    stats.patterns[convention] = (stats.patterns[convention] || 0) + 1
    stats.total++
  }

  /**
   * Determines the dominant convention for a naming category
   * @param {string} category - Category to analyze (files, directories, etc.)
   */
  determineDominantConvention(category) {
    const stats = this.namingConventions[category]
    if (stats.total === 0) {
      return
    }

    let dominant = 'unknown'
    let highestCount = 0

    for (const [convention, count] of Object.entries(stats.patterns)) {
      if (count > highestCount) {
        highestCount = count
        dominant = convention
      }
    }

    // Calculate percentage of the dominant convention
    const percentage = Math.round((highestCount / stats.total) * 100)

    // If the dominant convention is less than 60% of the total,
    // consider it a mixed convention
    if (percentage < 60) {
      dominant = 'mixed'
    }

    stats.dominant = dominant
  }

  /**
   * Detects architectural patterns based on directory structure and code dependencies
   * @param {Object} projectStructure - Project structure data
   * @param {Object} techData - Technology data from TechnologyAnalyzer (optional)
   */
  async detectArchitecturalPatterns(projectStructure, techData = {}) {
    if (this.verbose) {
      console.log(chalk.gray('Detecting architectural patterns...'))
    }

    // Basic pattern detection based on directory structure
    this.detectDirectoryBasedPatterns(projectStructure)

    // Enhanced pattern detection with dependency analysis
    await this.detectDependencyBasedPatterns(projectStructure, techData)

    // Merge and reconcile pattern detections
    this.reconcilePatternDetections()

    // Sort patterns by confidence score
    this.architecturalPatterns.sort((a, b) => b.confidence - a.confidence)

    if (this.verbose && this.architecturalPatterns.length > 0) {
      console.log(
        chalk.gray(
          `Detected architectural pattern: ${this.architecturalPatterns[0].name} (${this.architecturalPatterns[0].confidence}% confidence)`
        )
      )
    }
  }

  /**
   * Detects architectural patterns based on directory structure
   * @param {Object} projectStructure - Project structure data
   */
  detectDirectoryBasedPatterns(projectStructure) {
    // MVC Pattern Detection
    const mvcScore = this.detectMVCPattern(projectStructure)
    if (mvcScore > 60) {
      this.architecturalPatterns.push({
        name: 'MVC',
        confidence: mvcScore,
        description: 'Model-View-Controller pattern separating data, UI, and application logic.',
        source: 'directory-structure',
      })
    }

    // MVVM Pattern Detection
    const mvvmScore = this.detectMVVMPattern(projectStructure)
    if (mvvmScore > 60) {
      this.architecturalPatterns.push({
        name: 'MVVM',
        confidence: mvvmScore,
        description: 'Model-View-ViewModel pattern with data binding between View and ViewModel.',
        source: 'directory-structure',
      })
    }

    // Clean Architecture / Layered Pattern Detection
    const layeredScore = this.detectLayeredPattern(projectStructure)
    if (layeredScore > 60) {
      this.architecturalPatterns.push({
        name: 'Layered Architecture',
        confidence: layeredScore,
        description: 'Layered architecture with clear separation of concerns between layers.',
        source: 'directory-structure',
      })
    }

    // Microservices Pattern Detection
    const microservicesScore = this.detectMicroservicesPattern(projectStructure)
    if (microservicesScore > 60) {
      this.architecturalPatterns.push({
        name: 'Microservices',
        confidence: microservicesScore,
        description: 'Microservices architecture with multiple independent services.',
        source: 'directory-structure',
      })
    }

    // Feature-based Pattern Detection
    const featureBasedScore = this.detectFeatureBasedPattern(projectStructure)
    if (featureBasedScore > 60) {
      this.architecturalPatterns.push({
        name: 'Feature-based',
        confidence: featureBasedScore,
        description: 'Feature-based organization with code grouped by feature rather than technical layer.',
        source: 'directory-structure',
      })
    }
  }

  /**
   * Detects MVC pattern indicators
   * @param {Object} projectStructure - Project structure data
   * @returns {number} Confidence score (0-100)
   */
  detectMVCPattern(projectStructure) {
    const dirNames = projectStructure.directories.map((d) => d.name.toLowerCase())

    let score = 0

    // Look for model/view/controller directories
    if (dirNames.includes('models') || dirNames.includes('model')) {
      score += 30
    }
    if (dirNames.includes('views') || dirNames.includes('view')) {
      score += 30
    }
    if (dirNames.includes('controllers') || dirNames.includes('controller')) {
      score += 30
    }

    // Look for files with these names
    const fileBasenames = projectStructure.files.map((f) => path.basename(f.name, path.extname(f.name)).toLowerCase())
    const modelFiles = fileBasenames.filter((name) => name.endsWith('model') || name.endsWith('models'))
    const viewFiles = fileBasenames.filter((name) => name.endsWith('view') || name.endsWith('views'))
    const controllerFiles = fileBasenames.filter((name) => name.endsWith('controller') || name.endsWith('controllers'))

    if (modelFiles.length > 0) {
      score += 15
    }
    if (viewFiles.length > 0) {
      score += 15
    }
    if (controllerFiles.length > 0) {
      score += 15
    }

    // Cap at 100%
    return Math.min(score, 100)
  }

  /**
   * Detects MVVM pattern indicators
   * @param {Object} projectStructure - Project structure data
   * @returns {number} Confidence score (0-100)
   */
  detectMVVMPattern(projectStructure) {
    const dirNames = projectStructure.directories.map((d) => d.name.toLowerCase())

    let score = 0

    // Look for model/view/viewmodel directories
    if (dirNames.includes('models') || dirNames.includes('model')) {
      score += 25
    }
    if (dirNames.includes('views') || dirNames.includes('view')) {
      score += 25
    }
    if (dirNames.includes('viewmodels') || dirNames.includes('viewmodel')) {
      score += 40
    }

    // Look for files with these names
    const fileBasenames = projectStructure.files.map((f) => path.basename(f.name, path.extname(f.name)).toLowerCase())
    const modelFiles = fileBasenames.filter((name) => name.endsWith('model') || name.endsWith('models'))
    const viewFiles = fileBasenames.filter((name) => name.endsWith('view') || name.endsWith('views'))
    const viewModelFiles = fileBasenames.filter(
      (name) =>
        name.endsWith('viewmodel') || name.endsWith('viewmodels') || name.includes('_vm') || name.includes('-vm')
    )

    if (modelFiles.length > 0) {
      score += 10
    }
    if (viewFiles.length > 0) {
      score += 10
    }
    if (viewModelFiles.length > 0) {
      score += 20
    }

    // Cap at 100%
    return Math.min(score, 100)
  }

  /**
   * Detects layered architecture pattern indicators
   * @param {Object} projectStructure - Project structure data
   * @returns {number} Confidence score (0-100)
   */
  detectLayeredPattern(projectStructure) {
    const dirNames = projectStructure.directories.map((d) => d.name.toLowerCase())

    let score = 0

    // Check for various layer names
    const layerNames = [
      'data',
      'domain',
      'presentation',
      'infrastructure',
      'application',
      'api',
      'core',
      'services',
      'repositories',
      'interfaces',
      'adapters',
      'persistence',
      'entities',
    ]

    for (const layer of layerNames) {
      if (dirNames.includes(layer)) {
        score += 15
      }
    }

    // Check for common patterns in filenames
    const fileBasenames = projectStructure.files.map((f) => path.basename(f.name, path.extname(f.name)).toLowerCase())
    const repositoryFiles = fileBasenames.filter((name) => name.endsWith('repository') || name.includes('repo'))
    const serviceFiles = fileBasenames.filter((name) => name.endsWith('service'))
    const entityFiles = fileBasenames.filter((name) => name.endsWith('entity'))
    const dtoFiles = fileBasenames.filter((name) => name.endsWith('dto'))

    if (repositoryFiles.length > 0) {
      score += 10
    }
    if (serviceFiles.length > 0) {
      score += 10
    }
    if (entityFiles.length > 0) {
      score += 10
    }
    if (dtoFiles.length > 0) {
      score += 10
    }

    // Cap at 100%
    return Math.min(score, 100)
  }

  /**
   * Detects microservices architecture pattern indicators
   * @param {Object} projectStructure - Project structure data
   * @returns {number} Confidence score (0-100)
   */
  detectMicroservicesPattern(projectStructure) {
    const dirNames = projectStructure.directories.map((d) => d.name.toLowerCase())

    let score = 0

    // Check for services, apis, or microservices directory
    if (dirNames.includes('services') || dirNames.includes('apis') || dirNames.includes('microservices')) {
      score += 40
    }

    // Check for multiple API/service directories
    const servicesDirs = projectStructure.directories.filter(
      (d) => d.name.toLowerCase().includes('service') || d.name.toLowerCase().includes('api')
    )

    if (servicesDirs.length >= 3) {
      score += 30 // Multiple services indicates microservices architecture
    }

    // Check for Docker/Kubernetes configuration
    const dockerFiles = projectStructure.files.filter(
      (f) => f.name.toLowerCase().includes('dockerfile') || f.name.toLowerCase().includes('docker-compose')
    )

    const k8sFiles = projectStructure.files.filter(
      (f) =>
        f.name.toLowerCase().includes('kubernetes') ||
        (f.extension === 'yaml' && f.name.toLowerCase().includes('deployment'))
    )

    if (dockerFiles.length > 0) {
      score += 15
    }
    if (k8sFiles.length > 0) {
      score += 15
    }

    // Cap at 100%
    return Math.min(score, 100)
  }

  /**
   * Detects feature-based architecture pattern indicators
   * @param {Object} projectStructure - Project structure data
   * @returns {number} Confidence score (0-100)
   */
  detectFeatureBasedPattern(projectStructure) {
    const dirNames = projectStructure.directories.map((d) => d.name.toLowerCase())

    let score = 0

    // Check for features or modules directory
    if (dirNames.includes('features') || dirNames.includes('modules')) {
      score += 50
    }

    // Check if feature directories contain multiple technical aspects
    // (e.g., a feature directory contains model, view, and controller files)
    const featureDirs = projectStructure.directories.filter((d) => {
      const path = d.path.toLowerCase()
      return path.includes('/features/') || path.includes('/modules/')
    })

    if (featureDirs.length >= 2) {
      score += 30 // Multiple feature directories is a strong indicator
    }

    // Check for feature-specific files
    const featureSpecificFiles = projectStructure.files.filter((f) => {
      const path = f.path.toLowerCase()
      return path.includes('/features/') || path.includes('/modules/')
    })

    if (featureSpecificFiles.length > 10) {
      score += 20 // Significant number of files in feature directories
    }

    // Cap at 100%
    return Math.min(score, 100)
  }

  /**
   * Detects architectural patterns using dependency graph analysis
   * @param {Object} projectStructure - Project structure data
   * @param {Object} techData - Technology data from TechnologyAnalyzer (optional)
   */
  async detectDependencyBasedPatterns(projectStructure, techData = {}) {
    if (this.verbose) {
      console.log(chalk.gray('Performing advanced architectural pattern detection with dependency analysis...'))
    }

    try {
      // Use the DependencyAnalyzer to build and analyze the dependency graph
      const dependencyAnalysis = await this.dependencyAnalyzer.analyzeDependencies(projectStructure, techData)

      // If we couldn't build a dependency graph, return early
      if (!dependencyAnalysis || dependencyAnalysis.moduleCount === 0) {
        if (this.verbose) {
          console.log(chalk.yellow('No dependencies found for analysis. Using directory-based detection only.'))
        }
        return
      }

      if (this.verbose) {
        console.log(
          chalk.gray(
            `Dependency graph built with ${dependencyAnalysis.moduleCount} modules and ${dependencyAnalysis.edgeCount} edges`
          )
        )
      }

      // Add architectural patterns from dependency analysis
      for (const hint of dependencyAnalysis.architecturalHints) {
        this.architecturalPatterns.push({
          name: hint.pattern,
          confidence: hint.confidence,
          description: hint.evidence,
          source: 'dependency-analysis',
        })
      }

      // Add layered architecture pattern if layers were detected
      if (dependencyAnalysis.layeredStructure && dependencyAnalysis.layeredStructure.length > 1) {
        const layerCount = dependencyAnalysis.layeredStructure.length

        this.architecturalPatterns.push({
          name: 'Layered Architecture',
          confidence: Math.min(60 + layerCount * 10, 90), // More layers increase confidence
          description: `Detected ${layerCount} distinct layers in code dependencies with clear separation.`,
          source: 'dependency-analysis',
          details: {
            layers: dependencyAnalysis.layeredStructure.map((l) => ({
              name: l.name,
              moduleCount: l.modules.length,
            })),
          },
        })
      }

      // Add information about circular dependencies if detected
      if (dependencyAnalysis.cyclesDetected) {
        this.codePatterns.push('circular-dependencies')
      }
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.yellow(`Error in dependency-based pattern detection: ${error.message}`))
      }
    }
  }

  /**
   * Reconciles patterns detected by different methods and merges duplicates
   */
  reconcilePatternDetections() {
    if (this.architecturalPatterns.length <= 1) {
      return
    }

    // Group patterns by name
    const patternsByName = {}
    for (const pattern of this.architecturalPatterns) {
      if (!patternsByName[pattern.name]) {
        patternsByName[pattern.name] = []
      }
      patternsByName[pattern.name].push(pattern)
    }

    // Merge duplicate patterns
    this.architecturalPatterns = Object.entries(patternsByName).map(([name, patterns]) => {
      if (patterns.length === 1) {
        return patterns[0]
      }

      // Merge duplicate patterns
      const mergedPattern = {
        name,
        // Take highest confidence level and boost it slightly for multiple detections
        confidence: Math.min(Math.max(...patterns.map((p) => p.confidence)) + (patterns.length > 1 ? 10 : 0), 100),
        description: patterns.map((p) => p.description).join(' '),
        source: patterns.map((p) => p.source).join('+'),
        detectionCount: patterns.length,
      }

      // Merge any additional details
      if (patterns.some((p) => p.details)) {
        mergedPattern.details = {}
        for (const pattern of patterns) {
          if (pattern.details) {
            Object.assign(mergedPattern.details, pattern.details)
          }
        }
      }

      return mergedPattern
    })
  }

  /**
   * Analyzes code samples for naming conventions and patterns
   * @param {Object} projectStructure - Project structure data
   */
  async analyzeCodeSamples(projectStructure) {
    if (this.verbose) {
      console.log(chalk.gray('Analyzing code samples for patterns...'))
    }

    // Group files by type for analysis
    const filesByType = {}

    // Instead of using projectStructure.fileTypes which is an object with counts,
    // we'll create filesByType from the actual files array
    for (const file of projectStructure.files) {
      const type = file.type || 'unknown'
      if (!filesByType[type]) {
        filesByType[type] = []
      }
      filesByType[type].push(file)
    }

    // Set up language-specific analyzers with correct mapping
    const analyzers = {
      // JavaScript family
      javascript: analyzeJavaScript,
      'javascript-react': analyzeJavaScript,
      jsx: analyzeJavaScript,
      js: analyzeJavaScript,

      // TypeScript family - use TypeScript analyzer
      typescript: analyzeTypeScript,
      'typescript-react': analyzeTypeScript,
      tsx: analyzeTypeScript,
      ts: analyzeTypeScript,

      // Other languages
      python: analyzePython,
      py: analyzePython,
      swift: analyzeSwift,
    }

    // Track files analyzed
    let totalFilesAnalyzed = 0
    let skippedFiles = 0

    // These are the file types we know how to analyze
    const knownCodeTypes = [
      'javascript',
      'javascript-react',
      'jsx',
      'js',
      'typescript',
      'typescript-react',
      'tsx',
      'ts',
      'python',
      'py',
      'swift',
    ]

    // Analyze samples of each supported language
    for (const [type, files] of Object.entries(filesByType)) {
      // Special handling for TypeScript files - always process with TypeScript analyzer
      const tsExtensions = ['.ts', '.tsx']
      const isTypeScript = files.some((file) => tsExtensions.some((ext) => file.path.endsWith(ext)))
      if (isTypeScript) {
        // For TypeScript files, always use TypeScript analyzer
        const analyzer = analyzeTypeScript
        await this.analyzeFilesWithAnalyzer(files, analyzer, totalFilesAnalyzed, skippedFiles)
        continue
      }

      // Skip non-source code files and unknown types
      const isKnownType = knownCodeTypes.some((knownType) => type.includes(knownType))
      if (!isKnownType) {
        skippedFiles += files.length
        continue
      }

      // Get the appropriate analyzer for this file type
      const analyzer = this.getAnalyzerForType(type, analyzers)
      if (!analyzer) {
        if (this.verbose) {
          console.warn(chalk.yellow(`No analyzer found for file type: ${type}`))
        }
        skippedFiles += files.length
        continue
      }

      // Sample files for analysis (to avoid analyzing too many files)
      const sampleSize = Math.min(this.sampleSize, files.length)
      const sampleFiles = files.slice(0, sampleSize)

      if (this.verbose) {
        console.log(chalk.gray(`Analyzing ${sampleFiles.length} ${type} files...`))
      }

      // Analyze each file in the sample
      for (const file of sampleFiles) {
        try {
          const content = await fs.readFile(file.path, 'utf8')

          // Determine the analyzer based on file extension first, then fallback to type
          const fileExt = path.extname(file.path).toLowerCase().substring(1)
          let fileAnalyzer = null

          // Map file extensions directly to analyzers
          const extensionMap = {
            ts: analyzeTypeScript,
            tsx: analyzeTypeScript,
            js: analyzeJavaScript,
            jsx: analyzeJavaScript,
            json: null, // Don't try to analyze JSON with JS parser
            py: analyzePython,
            swift: analyzeSwift,
          }

          // Use extension-based analyzer if available, otherwise fallback to type-based
          if (extensionMap[fileExt] !== undefined) {
            fileAnalyzer = extensionMap[fileExt]
          } else {
            fileAnalyzer = analyzer
          }

          // Skip analysis if no analyzer is available (e.g., for JSON files)
          if (!fileAnalyzer) {
            if (this.verbose) {
              console.log(chalk.gray(`Skipping analysis for ${fileExt} file: ${file.path}`))
            }
            continue
          }

          const analysis = await fileAnalyzer(content, file.path)
          totalFilesAnalyzed++

          // Update naming conventions with analysis results
          this.updateNamingConventions('variables', analysis.variables)
          this.updateNamingConventions('functions', analysis.functions)
          this.updateNamingConventions('classes', analysis.classes)

          // If analyzing React components, update component naming
          if (type.includes('react') || file.path.includes('.jsx') || file.path.includes('.tsx')) {
            this.updateNamingConventions('components', analysis.components || [])
          }

          // Track code patterns
          if (analysis.patterns && analysis.patterns.length > 0) {
            for (const pattern of analysis.patterns) {
              if (!this.codePatterns.includes(pattern)) {
                this.codePatterns.push(pattern)
              }
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Error analyzing file ${file.path}: ${error.message}`))
          }
        }
      }
    }

    if (this.verbose) {
      console.log(chalk.gray(`Analyzed ${totalFilesAnalyzed} files, skipped ${skippedFiles} non-code files`))
    }

    // Determine dominant conventions
    this.determineDominantConvention('variables')
    this.determineDominantConvention('functions')
    this.determineDominantConvention('classes')
    this.determineDominantConvention('components')

    if (this.verbose) {
      if (this.namingConventions.variables.dominant) {
        console.log(chalk.gray(`Variable naming convention: ${this.namingConventions.variables.dominant}`))
      }
      if (this.namingConventions.functions.dominant) {
        console.log(chalk.gray(`Function naming convention: ${this.namingConventions.functions.dominant}`))
      }
      if (this.namingConventions.classes.dominant) {
        console.log(chalk.gray(`Class naming convention: ${this.namingConventions.classes.dominant}`))
      }
    }
  }

  /**
   * Updates naming convention statistics for a given category
   * @param {string} category - The category (variables, functions, classes, etc.)
   * @param {Array} names - Array of names to analyze
   */
  updateNamingConventions(category, names) {
    if (!names || names.length === 0) {
      return
    }

    for (const name of names) {
      this.analyzeNamingConvention(name, category)
    }
  }

  /**
   * Gets the appropriate analyzer function for the given file type
   */
  getAnalyzerForType(fileType, analyzers) {
    const type = fileType.toLowerCase()

    // Direct match
    if (analyzers[type]) {
      return analyzers[type]
    }

    // Specific partial matches to avoid false positives like 'json' matching 'js'
    const partialMatches = [
      { pattern: 'javascript', key: 'javascript' },
      { pattern: 'typescript', key: 'typescript' },
      { pattern: 'python', key: 'python' },
      { pattern: 'swift', key: 'swift' },
    ]

    for (const match of partialMatches) {
      if (type.includes(match.pattern) && analyzers[match.key]) {
        return analyzers[match.key]
      }
    }

    // Legacy partial match for backward compatibility (more conservative)
    for (const [key, analyzer] of Object.entries(analyzers)) {
      if (key.length > 2 && type.includes(key)) {
        return analyzer
      }
    }

    return null
  }

  /**
   * Analyzes a set of files with the specified analyzer
   * @param {Array} files - Files to analyze
   * @param {Function} analyzer - Analyzer function to use
   * @param {number} totalFilesAnalyzed - Reference to track total files analyzed
   * @param {number} skippedFiles - Reference to track skipped files
   */
  async analyzeFilesWithAnalyzer(files, analyzer, totalFilesAnalyzed, skippedFiles) {
    // Sample files for analysis (to avoid analyzing too many files)
    const sampleSize = Math.min(this.sampleSize, files.length)
    const sampleFiles = files.slice(0, sampleSize)

    if (this.verbose) {
      console.log(chalk.gray(`Analyzing ${sampleFiles.length} files with specialized analyzer...`))
    }

    // Analyze each file in the sample
    for (const file of sampleFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8')

        // Skip analysis if no analyzer is available
        if (!analyzer) {
          if (this.verbose) {
            console.log(chalk.gray(`No analyzer available for file: ${file.path}`))
          }
          skippedFiles++
          continue
        }

        const analysis = await analyzer(content, file.path)
        totalFilesAnalyzed++

        // Update naming conventions with analysis results
        this.updateNamingConventions('variables', analysis.variables)
        this.updateNamingConventions('functions', analysis.functions)
        this.updateNamingConventions('classes', analysis.classes)

        // If analyzing React components, update component naming
        if (file.path.includes('.jsx') || file.path.includes('.tsx')) {
          this.updateNamingConventions('components', analysis.components || [])
        }

        // Track code patterns
        if (analysis.patterns && analysis.patterns.length > 0) {
          for (const pattern of analysis.patterns) {
            if (!this.codePatterns.includes(pattern)) {
              this.codePatterns.push(pattern)
            }
          }
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(chalk.yellow(`Error analyzing file ${file.path}: ${error.message}`))
        }
        skippedFiles++
      }
    }
  }

  /**
   * Calculates consistency metrics for the analyzed code
   */
  calculateConsistencyMetrics() {
    const metrics = {
      overallConsistency: 0,
      namingConsistency: 0,
      architecturalConsistency: 0,
      patternConsistency: 0,
    }

    // Calculate naming consistency
    const namingScores = []
    for (const [_category, data] of Object.entries(this.namingConventions)) {
      if (data.dominant && data.dominant !== 'mixed' && data.patterns && data.patterns[data.dominant]) {
        namingScores.push(data.patterns[data.dominant] / 100)
      }
    }

    metrics.namingConsistency =
      namingScores.length > 0
        ? Math.round((namingScores.reduce((sum, score) => sum + score, 0) / namingScores.length) * 100)
        : 0

    // Calculate architectural consistency
    metrics.architecturalConsistency =
      this.architecturalPatterns.length > 0 ? this.architecturalPatterns[0].confidence : 0

    // Calculate overall consistency
    const scores = [metrics.namingConsistency, metrics.architecturalConsistency].filter((score) => score > 0)

    metrics.overallConsistency =
      scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0

    this.consistencyMetrics = metrics
  }
}
