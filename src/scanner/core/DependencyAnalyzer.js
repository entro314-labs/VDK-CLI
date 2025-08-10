/**
 * DependencyAnalyzer.js
 *
 * Analyzes import/require statements in code to build a dependency graph
 * and enhance architectural pattern detection with more sophisticated
 * insights beyond just directory naming conventions.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import chalk from 'chalk'

export class DependencyAnalyzer {
  constructor(options = {}) {
    this.verbose = options.verbose
    this.maxFilesToParse = options.maxFilesToParse || 200 // Limit files to parse for performance
    this.dependencyGraph = new Map() // Map of module -> Set(dependencies)
    this.inverseGraph = new Map() // Map of module -> Set(dependents)
    this.fileModuleMap = new Map() // Map of filePath -> logical module name
    this.moduleFileMap = new Map() // Map of logical module name -> filePath
    this.ignoredExtensions = new Set([
      '.json',
      '.md',
      '.txt',
      '.css',
      '.scss',
      '.png',
      '.jpg',
      '.gif',
      '.svg',
    ])
  }

  /**
   * Analyzes import/require statements in the project to build a dependency graph
   * @param {Object} projectStructure - Project structure from ProjectScanner
   * @param {Object} techData - Technology data from TechnologyAnalyzer
   * @returns {Object} Dependency graph analysis
   */
  async analyzeDependencies(projectStructure, techData) {
    if (this.verbose) {
      console.log(chalk.gray('Building dependency graph...'))
    }

    // Reset dependency graph
    this.dependencyGraph.clear()
    this.inverseGraph.clear()
    this.fileModuleMap.clear()
    this.moduleFileMap.clear()

    try {
      // Create a list of files to analyze, prioritizing key file types
      const filesToAnalyze = this.getFilesToAnalyze(projectStructure, techData)

      // Extract dependencies from each file
      await this.extractDependenciesFromFiles(filesToAnalyze, projectStructure.projectPath)

      // Analyze the graph
      const graphAnalysis = this.analyzeGraph()

      if (this.verbose) {
        console.log(
          chalk.gray(
            `Dependency graph built with ${this.dependencyGraph.size} modules and ${this.countEdges()} edges`
          )
        )
      }

      return {
        dependencyGraph: this.dependencyGraph,
        inverseGraph: this.inverseGraph,
        moduleCount: this.dependencyGraph.size,
        edgeCount: this.countEdges(),
        centralModules: graphAnalysis.centralModules,
        layeredStructure: graphAnalysis.layeredStructure,
        cyclesDetected: graphAnalysis.cyclesDetected,
        architecturalHints: graphAnalysis.architecturalHints,
      }
    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red(`Error in dependency analysis: ${error.message}`))
        console.error(chalk.gray(error.stack))
      }
      // Return an empty analysis instead of failing completely
      return {
        dependencyGraph: new Map(),
        inverseGraph: new Map(),
        moduleCount: 0,
        edgeCount: 0,
        centralModules: [],
        layeredStructure: [],
        cyclesDetected: false,
        architecturalHints: [],
      }
    }
  }

  /**
   * Get a prioritized list of files to analyze
   * @param {Object} projectStructure - Project structure from ProjectScanner
   * @param {Object} techData - Technology data from TechnologyAnalyzer
   * @returns {Array} Files to analyze
   */
  getFilesToAnalyze(projectStructure, _techData) {
    // Get all source files
    let files = projectStructure.files || []

    // Filter out irrelevant files
    files = files.filter((file) => {
      const ext = path.extname(file.path || file).toLowerCase()
      return !this.ignoredExtensions.has(ext)
    })

    // Sort files by their likely importance
    files.sort((a, b) => {
      const fileA = typeof a === 'object' ? a.path : a
      const fileB = typeof b === 'object' ? b.path : b

      // Put index files and main files first
      const nameA = path.basename(fileA).toLowerCase()
      const nameB = path.basename(fileB).toLowerCase()

      if (nameA.includes('index') && !nameB.includes('index')) {
        return -1
      }
      if (!nameA.includes('index') && nameB.includes('index')) {
        return 1
      }
      if (nameA.includes('main') && !nameB.includes('main')) {
        return -1
      }
      if (!nameA.includes('main') && nameB.includes('main')) {
        return 1
      }

      // Prioritize specific directories
      const isInSrcA = fileA.includes('/src/') || fileA.includes('\\src\\')
      const isInSrcB = fileB.includes('/src/') || fileB.includes('\\src\\')
      if (isInSrcA && !isInSrcB) {
        return -1
      }
      if (!isInSrcA && isInSrcB) {
        return 1
      }

      return 0
    })

    // Limit the number of files for performance
    return files.slice(0, this.maxFilesToParse)
  }

  /**
   * Extract dependencies from a list of files
   * @param {Array} files - List of files to analyze
   * @param {string} projectRoot - Root directory of the project
   */
  async extractDependenciesFromFiles(files, projectRoot) {
    for (const file of files) {
      const filePath = typeof file === 'object' ? file.path : file

      try {
        // Skip binary files and already processed files
        const ext = path.extname(filePath).toLowerCase()
        if (this.ignoredExtensions.has(ext) || this.fileModuleMap.has(filePath)) {
          continue
        }

        // Read the file
        const content = await fs.readFile(filePath, 'utf8')

        // Generate a logical module name
        const moduleName = this.getLogicalModuleName(filePath, projectRoot)
        this.fileModuleMap.set(filePath, moduleName)
        this.moduleFileMap.set(moduleName, filePath)

        // Initialize the module's dependency sets if they don't exist
        if (!this.dependencyGraph.has(moduleName)) {
          this.dependencyGraph.set(moduleName, new Set())
        }
        if (!this.inverseGraph.has(moduleName)) {
          this.inverseGraph.set(moduleName, new Set())
        }

        // Extract dependencies based on file type
        const dependencies = this.extractDependenciesFromContent(content, ext)

        // Resolve relative dependencies to logical module names
        const resolvedDependencies = this.resolveDependencies(dependencies, filePath, projectRoot)

        // Add dependencies to the graph
        for (const dep of resolvedDependencies) {
          this.dependencyGraph.get(moduleName).add(dep)

          // Add to inverse graph
          if (!this.inverseGraph.has(dep)) {
            this.inverseGraph.set(dep, new Set())
          }
          this.inverseGraph.get(dep).add(moduleName)
        }
      } catch (error) {
        // Skip files that can't be read
        if (this.verbose) {
          console.log(chalk.yellow(`Skipping file ${filePath}: ${error.message}`))
        }
      }
    }
  }

  /**
   * Extract dependencies from file content
   * @param {string} content - File content
   * @param {string} fileExtension - File extension
   * @returns {Array} List of dependencies
   */
  extractDependenciesFromContent(content, fileExtension) {
    const dependencies = new Set()

    // JavaScript/TypeScript import statements
    if (['.js', '.jsx', '.ts', '.tsx'].includes(fileExtension)) {
      // ES imports
      const esImportRegex =
        /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g
      let match
      while ((match = esImportRegex.exec(content)) !== null) {
        dependencies.add(match[1])
      }

      // CommonJS requires
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
      while ((match = requireRegex.exec(content)) !== null) {
        dependencies.add(match[1])
      }

      // Dynamic imports
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        dependencies.add(match[1])
      }
    }

    // Python imports
    else if (['.py'].includes(fileExtension)) {
      // Regular import statements
      const pyImportRegex = /^\s*import\s+([^\s.]+(?:\.[^\s,]+)*)/gm
      let match
      while ((match = pyImportRegex.exec(content)) !== null) {
        // Split multi-imports like "import os, sys"
        const imports = match[1].split(',').map((i) => i.trim())
        for (const imp of imports) {
          dependencies.add(imp)
        }
      }

      // From import statements
      const fromImportRegex = /^\s*from\s+([^\s]+)\s+import/gm
      while ((match = fromImportRegex.exec(content)) !== null) {
        dependencies.add(match[1])
      }
    }

    // Java/Kotlin imports
    else if (['.java', '.kt'].includes(fileExtension)) {
      const javaImportRegex = /^\s*import\s+([^;]+);/gm
      let match
      while ((match = javaImportRegex.exec(content)) !== null) {
        dependencies.add(match[1])
      }
    }

    // C# using statements
    else if (['.cs'].includes(fileExtension)) {
      const csharpUsingRegex = /^\s*using\s+([^;]+);/gm
      let match
      while ((match = csharpUsingRegex.exec(content)) !== null) {
        dependencies.add(match[1])
      }
    }

    return Array.from(dependencies)
  }

  /**
   * Resolve relative dependencies to logical module names
   * @param {Array} dependencies - List of dependencies
   * @param {string} currentFilePath - Path of the file containing the dependencies
   * @param {string} projectRoot - Root directory of the project
   * @returns {Array} List of resolved dependencies
   */
  resolveDependencies(dependencies, currentFilePath, projectRoot) {
    const resolvedDeps = new Set()

    // Validate inputs
    if (!(currentFilePath && projectRoot && Array.isArray(dependencies))) {
      // Only log warnings in verbose mode to reduce noise
      if (this.verbose) {
        console.log(
          chalk.yellow(
            `Invalid parameters for dependency resolution: currentFilePath=${currentFilePath}, projectRoot=${projectRoot}, dependencies=${dependencies}`
          )
        )
      }
      return []
    }

    const currentDir = path.dirname(currentFilePath)

    for (const dep of dependencies) {
      // Skip invalid dependencies
      if (!dep || typeof dep !== 'string') {
        continue
      }

      // Skip node_modules and external dependencies
      if (dep.startsWith('@') || !dep.startsWith('.')) {
        // For now, just skip external modules
        continue
      }

      try {
        // Resolve relative path
        const absolutePath = path.resolve(currentDir, dep)
        const relativePath = path.relative(projectRoot, absolutePath)

        // Generate logical module name
        const moduleName = this.getLogicalModuleName(relativePath, projectRoot)
        if (moduleName) {
          resolvedDeps.add(moduleName)
        }
      } catch (error) {
        // Skip dependencies that can't be resolved
        if (this.verbose) {
          console.log(chalk.yellow(`Could not resolve dependency ${dep}: ${error.message}`))
        }
      }
    }

    return Array.from(resolvedDeps)
  }

  /**
   * Generate a logical module name from a file path
   * @param {string} filePath - Path to the file
   * @param {string} projectRoot - Root directory of the project
   * @returns {string} Logical module name
   */
  getLogicalModuleName(filePath, projectRoot) {
    // Validate inputs
    if (
      !filePath ||
      typeof filePath !== 'string' ||
      !projectRoot ||
      typeof projectRoot !== 'string'
    ) {
      return null
    }

    // Remove file extension
    let modulePath = filePath.replace(/\.[^/.]+$/, '')

    // Make path relative to project root
    if (modulePath.startsWith(projectRoot)) {
      modulePath = path.relative(projectRoot, modulePath)
    }

    // Normalize separators
    modulePath = modulePath.replace(/\\/g, '/')

    // Remove index files
    modulePath = modulePath.replace(/\/index$/, '')

    return modulePath || null
  }

  /**
   * Analyze the dependency graph for architectural patterns
   * @returns {Object} Analysis results
   */
  analyzeGraph() {
    const analysis = {
      centralModules: this.findCentralModules(),
      layeredStructure: this.detectLayers(),
      cyclesDetected: this.detectCycles(),
      architecturalHints: [],
    }

    // Generate architectural hints based on analysis
    if (analysis.layeredStructure && analysis.layeredStructure.length > 0) {
      analysis.architecturalHints.push({
        pattern: 'Layered Architecture',
        confidence: 80,
        evidence: `Found ${analysis.layeredStructure.length} distinct layers in the codebase.`,
      })
    }

    if (analysis.centralModules.length > 0) {
      const centralityPattern = this.inferPatternFromCentralModules(analysis.centralModules)
      analysis.architecturalHints.push(centralityPattern)
    }

    if (analysis.cyclesDetected) {
      analysis.architecturalHints.push({
        pattern: 'Circular Dependencies',
        confidence: 70,
        evidence: 'Detected circular dependencies, which might indicate architectural issues.',
      })
    }

    return analysis
  }

  /**
   * Find central modules in the dependency graph based on incoming/outgoing connections
   * @returns {Array} List of central modules with metrics
   */
  findCentralModules() {
    const centralModules = []

    // Calculate centrality metrics for each module
    for (const [module, dependencies] of this.dependencyGraph.entries()) {
      const outDegree = dependencies.size // How many modules this depends on
      const inDegree = this.inverseGraph.has(module) ? this.inverseGraph.get(module).size : 0 // How many depend on this

      const centralityScore = inDegree * 2 + outDegree // Weight incoming more heavily

      if (centralityScore > 0) {
        centralModules.push({
          name: module,
          inDegree,
          outDegree,
          centralityScore,
        })
      }
    }

    // Sort by centrality score in descending order
    centralModules.sort((a, b) => b.centralityScore - a.centralityScore)

    // Return top 10 most central modules
    return centralModules.slice(0, 10)
  }

  /**
   * Detect layers in the dependency graph
   * @returns {Array} List of layers
   */
  detectLayers() {
    // Initialize layers
    const layers = []
    const visited = new Set()

    // Start with leaf nodes (those with no outgoing dependencies or only external ones)
    const currentLayer = Array.from(this.dependencyGraph.keys()).filter((module) => {
      const deps = this.dependencyGraph.get(module)
      return deps.size === 0 || Array.from(deps).every((dep) => !this.dependencyGraph.has(dep))
    })

    // Mark current layer as visited
    currentLayer.forEach((module) => visited.add(module))

    // Add layer if not empty
    if (currentLayer.length > 0) {
      layers.push({
        level: layers.length,
        modules: currentLayer,
        name: 'Infrastructure/Utility Layer',
      })
    }

    // Continue until all modules are visited
    while (visited.size < this.dependencyGraph.size) {
      // Find modules that depend only on already visited modules
      const nextLayer = Array.from(this.dependencyGraph.keys())
        .filter((module) => !visited.has(module)) // Not already visited
        .filter((module) => {
          const deps = this.dependencyGraph.get(module)
          return Array.from(deps).every((dep) => visited.has(dep) || !this.dependencyGraph.has(dep))
        })

      // If we can't find any more modules for the next layer, break
      if (nextLayer.length === 0) {
        break
      }

      // Add current layer and mark as visited
      nextLayer.forEach((module) => visited.add(module))

      // Assign a name based on layer position
      let layerName = 'Intermediate Layer'
      if (layers.length === 0) {
        layerName = 'Infrastructure/Utility Layer'
      } else if (
        nextLayer.every((m) => {
          const inDegree = this.inverseGraph.has(m) ? this.inverseGraph.get(m).size : 0
          return inDegree === 0
        })
      ) {
        layerName = 'Entry Points/UI Layer'
      }

      layers.push({
        level: layers.length,
        modules: nextLayer,
        name: layerName,
      })
    }

    return layers
  }

  /**
   * Detect cycles in the dependency graph
   * @returns {boolean} True if cycles are detected
   */
  detectCycles() {
    // Simple DFS to detect cycles
    const visited = new Set()
    const recursionStack = new Set()

    const hasCycle = (module) => {
      // Mark current node as visited and add to recursion stack
      visited.add(module)
      recursionStack.add(module)

      // Check all dependencies
      const dependencies = this.dependencyGraph.get(module) || new Set()
      for (const dep of dependencies) {
        // Skip external dependencies
        if (!this.dependencyGraph.has(dep)) {
          continue
        }

        // If not visited, check if there's a cycle in its dependencies
        if (!visited.has(dep)) {
          if (hasCycle(dep)) {
            return true
          }
        }
        // If the dependency is in recursion stack, we found a cycle
        else if (recursionStack.has(dep)) {
          return true
        }
      }

      // Remove from recursion stack
      recursionStack.delete(module)
      return false
    }

    // Check each module
    for (const module of this.dependencyGraph.keys()) {
      if (!visited.has(module) && hasCycle(module)) {
        return true
      }
    }

    return false
  }

  /**
   * Infer architectural pattern from central modules
   * @param {Array} centralModules - List of central modules
   * @returns {Object} Pattern description
   */
  inferPatternFromCentralModules(centralModules) {
    // Check module names for clues
    const moduleNames = centralModules.map((m) => m.name.toLowerCase())

    const hasController = moduleNames.some((name) => name.includes('controller'))
    const hasService = moduleNames.some((name) => name.includes('service'))
    const hasStore = moduleNames.some((name) => name.includes('store') || name.includes('redux'))
    const hasViewModel = moduleNames.some((name) => name.includes('viewmodel'))
    const hasRepository = moduleNames.some(
      (name) => name.includes('repository') || name.includes('dao')
    )
    const hasProvider = moduleNames.some((name) => name.includes('provider'))
    const hasComponent = moduleNames.some((name) => name.includes('component'))

    // Detecting patterns based on naming conventions in central modules
    if (hasController && hasService) {
      return {
        pattern: 'MVC/Service',
        confidence: 85,
        evidence: 'Detected controller and service modules as central components.',
      }
    }
    if (hasViewModel) {
      return {
        pattern: 'MVVM',
        confidence: 85,
        evidence: 'Detected viewmodel modules as central components.',
      }
    }
    if (hasStore) {
      return {
        pattern: 'Flux/Redux',
        confidence: 90,
        evidence: 'Detected store modules as central components.',
      }
    }
    if (hasRepository) {
      return {
        pattern: 'Repository Pattern',
        confidence: 80,
        evidence: 'Detected repository modules as central components.',
      }
    }
    if (hasProvider) {
      return {
        pattern: 'Provider Pattern',
        confidence: 75,
        evidence: 'Detected provider modules as central components.',
      }
    }
    if (hasComponent && centralModules.length > 5) {
      return {
        pattern: 'Component-Based',
        confidence: 80,
        evidence: 'Detected multiple component modules as central parts of the architecture.',
      }
    }
    // Default if we can't detect a specific pattern
    return {
      pattern: 'Modular Architecture',
      confidence: 65,
      evidence: `Detected ${centralModules.length} central modules with high interdependency.`,
    }
  }

  /**
   * Count the total number of edges in the dependency graph
   * @returns {number} Total number of edges
   */
  countEdges() {
    let count = 0
    for (const dependencies of this.dependencyGraph.values()) {
      count += dependencies.size
    }
    return count
  }
}
