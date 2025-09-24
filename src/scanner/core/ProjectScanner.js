/**
 * ProjectScanner.js
 *
 * Core component responsible for traversing the project directory structure
 * and gathering information about files, directories, and their relationships.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Worker } from 'node:worker_threads'

import chalk from 'chalk'
import { glob } from 'glob'

import { GitIgnoreParser } from '../utils/gitignore-parser.js'

export class ProjectScanner {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd()
    this.ignorePatterns = options.ignorePatterns || [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts',
    ]
    this.useGitIgnore = options.useGitIgnore !== false // Default to true
    this.deepScan = options.deepScan
    this.verbose = options.verbose
    this.concurrency = options.concurrency || Math.min(os.cpus().length, 8) // Max 8 workers

    // Initialize data structures for project information
    this.fileTypes = {}
    this.fileExtensions = new Set()
    this.directoryStructure = {}
    this.files = []
    this.directories = []
  }

  /**
   * Scan project directory and analyze structure
   * @param {string} projectPath - Path to project directory
   * @param {Object} options - Scanning options
   * @returns {Object} Project analysis results
   */
  async scanProject(projectPath, options = {}) {
    const startTime = Date.now()

    try {
      console.log(chalk.blue(`🔍 Scanning project at: ${projectPath}`))

      // Validate project directory exists
      try {
        await fs.access(projectPath)
      } catch {
        throw new Error(`Project directory does not exist: ${projectPath}`)
      }

      const stats = await fs.stat(projectPath)
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${projectPath}`)
      }

      // Update project path if provided
      if (projectPath) {
        this.projectPath = projectPath
      }

      // Update options if provided
      if (options.ignorePatterns) {
        this.ignorePatterns = options.ignorePatterns
      }

      if (options.useGitIgnore !== undefined) {
        this.useGitIgnore = options.useGitIgnore
      }

      if (options.deep !== undefined) {
        this.deepScan = options.deep
      }

      if (this.verbose) {
        console.log(chalk.gray(`Ignored patterns: ${this.ignorePatterns.join(', ')}`))
      }

      // Reset data structures for a clean scan
      this.fileTypes = {}
      this.fileExtensions = new Set()
      this.directoryStructure = {}
      this.files = []
      this.directories = []

      // If enabled, add gitignore patterns to our ignore list
      let effectiveIgnorePatterns = [...this.ignorePatterns]

      if (this.useGitIgnore) {
        try {
          const gitIgnorePatterns = await GitIgnoreParser.parseGitIgnore(this.projectPath)
          if (gitIgnorePatterns.length > 0) {
            effectiveIgnorePatterns = [...effectiveIgnorePatterns, ...gitIgnorePatterns]
            if (this.verbose) {
              console.log(chalk.gray(`Added ${gitIgnorePatterns.length} patterns from .gitignore`))
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Warning: Error parsing .gitignore: ${error.message}`))
          }
        }
      }

      // Get all files in the project, respecting ignore patterns
      const allFiles = await glob('**/*', {
        cwd: this.projectPath,
        ignore: effectiveIgnorePatterns,
        dot: true,
        nodir: false,
        absolute: true,
      })

      // Analyze files and directories concurrently for better performance
      const processedItems = await this.processFilesConcurrently(allFiles)

      // Aggregate results
      for (const item of processedItems) {
        if (item.type === 'file') {
          this.files.push(item.data)
          this.fileExtensions.add(item.data.extension)
          this.fileTypes[item.data.type] = (this.fileTypes[item.data.type] || 0) + 1
        } else if (item.type === 'directory') {
          this.directories.push(item.data)
        }
      }

      // If doing a deep scan, analyze relationships between files
      if (this.deepScan) {
        await this.analyzeRelationships()
      }

      // Build directory structure representation
      this.buildDirectoryStructure()

      const result = {
        projectPath,
        projectName: path.basename(projectPath),
        timestamp: new Date().toISOString(),
        scanDuration: Date.now() - startTime,
        files: this.files,
        directories: this.directories,
        fileTypes: this.fileTypes,
        fileExtensions: Array.from(this.fileExtensions),
        directoryStructure: this.directoryStructure,
      }

      console.log(chalk.green(`✅ Project scan completed in ${result.scanDuration}ms`))
      return result
    } catch (error) {
      console.log(chalk.red(`❌ Project scan failed: ${error.message}`))
      // Return a minimal structure instead of crashing
      return {
        projectPath,
        projectName: path.basename(projectPath),
        timestamp: new Date().toISOString(),
        scanDuration: Date.now() - startTime,
        error: error.message,
        files: [],
        directories: [],
        fileTypes: {},
        fileExtensions: [],
        directoryStructure: {},
      }
    }
  }

  /**
   * Analyzes relationships between files (imports, dependencies, etc.)
   * Only performed during deep scans
   */
  async analyzeRelationships() {
    if (this.verbose) {
      console.log(chalk.gray('Analyzing file relationships (deep scan)...'))
    }

    // Implementation would involve parsing files for import statements,
    // require() calls, etc., and creating a dependency graph

    for (const file of this.files) {
      file.imports = []
      file.importedBy = []
    }
  }

  /**
   * Builds a hierarchical representation of the directory structure
   */
  buildDirectoryStructure() {
    if (this.verbose) {
      console.log(chalk.gray('Building directory structure representation...'))
    }

    // Create the root node
    this.directoryStructure = {
      name: path.basename(this.projectPath),
      path: this.projectPath,
      type: 'directory',
      children: {},
    }

    // Group files by parent directory
    const filesByDir = {}
    for (const file of this.files) {
      const dirPath = path.dirname(file.relativePath)
      if (!filesByDir[dirPath]) {
        filesByDir[dirPath] = []
      }
      filesByDir[dirPath].push(file)
    }

    // Helper function to add a path to the structure
    const addPathToStructure = (relativePath, isDirectory = false, fileInfo = null) => {
      if (relativePath === '.') {
        return // Skip the root directory
      }

      const parts = relativePath.split(path.sep)
      let current = this.directoryStructure.children

      // Build the path in the structure
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) {
          continue // Skip empty parts
        }

        const isLastPart = i === parts.length - 1

        if (!current[part]) {
          if (isLastPart && !isDirectory) {
            // This is a file
            current[part] = {
              name: part,
              type: 'file',
              extension: fileInfo ? fileInfo.extension : '',
              fileType: fileInfo ? fileInfo.type : 'unknown',
              size: fileInfo ? fileInfo.size : 0,
            }
          } else {
            // This is a directory
            current[part] = {
              name: part,
              type: 'directory',
              children: {},
            }
          }
        }

        if (!isLastPart || isDirectory) {
          current = current[part].children
        }
      }
    }

    // Add directories to the structure
    for (const dir of this.directories) {
      addPathToStructure(dir.relativePath, true)
    }

    // Add files to the structure
    for (const file of this.files) {
      addPathToStructure(file.relativePath, false, file)
    }
  }

  /**
   * Determines the type of a file based on its extension or content
   * @param {string} filePath - Path to the file
   * @returns {string} Type of file
   */
  determineFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath).toLowerCase()

    // Configuration files
    if (
      [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'tsconfig.json',
        'jsconfig.json',
        '.prettierrc',
        '.eslintrc',
        '.babelrc',
        'webpack.config.js',
        'babel.config.js',
        'jest.config.js',
        'vite.config.js',
        'rollup.config.js',
      ].includes(fileName)
    ) {
      return 'config'
    }

    // Documentation files
    if (
      ['readme.md', 'license', 'license.md', 'license.txt', 'contributing.md', 'changelog.md'].includes(fileName) ||
      ext === '.md'
    ) {
      return 'documentation'
    }

    // Source code by language
    const codeExtensions = {
      '.js': 'javascript',
      '.jsx': 'javascript-react',
      '.ts': 'typescript',
      '.tsx': 'typescript-react',
      '.py': 'python',
      '.rb': 'ruby',
      '.java': 'java',
      '.go': 'go',
      '.cs': 'csharp',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.rs': 'rust',
      '.dart': 'dart',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c-header',
      '.hpp': 'cpp-header',
    }

    if (codeExtensions[ext]) {
      return codeExtensions[ext]
    }

    // Web assets
    if (['.html', '.htm'].includes(ext)) {
      return 'html'
    }
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      return 'stylesheet'
    }
    if (['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      return 'image'
    }
    if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) {
      return 'font'
    }
    if (['.json', '.jsonc'].includes(ext)) {
      return 'json'
    }
    if (['.xml', '.xsl'].includes(ext)) {
      return 'xml'
    }
    if (['.yml', '.yaml'].includes(ext)) {
      return 'yaml'
    }
    if (['.toml'].includes(ext)) {
      return 'toml'
    }
    if (['.csv', '.tsv'].includes(ext)) {
      return 'tabular-data'
    }

    // Fallback to 'unknown' type
    return 'unknown'
  }

  /**
   * Process files concurrently using worker threads for better performance
   * @param {Array<string>} filePaths - Array of file paths to process
   * @returns {Promise<Array>} Array of processed file/directory information
   */
  async processFilesConcurrently(filePaths) {
    if (filePaths.length === 0) {
      return []
    }

    // For small file counts, use synchronous processing to avoid overhead
    if (filePaths.length < 20) {
      return this.processFilesSync(filePaths)
    }

    if (this.verbose) {
      console.log(chalk.gray(`Processing ${filePaths.length} files with ${this.concurrency} workers...`))
    }

    // Split files into chunks for parallel processing
    const chunkSize = Math.ceil(filePaths.length / this.concurrency)
    const chunks = []

    for (let i = 0; i < filePaths.length; i += chunkSize) {
      chunks.push(filePaths.slice(i, i + chunkSize))
    }

    try {
      // Process chunks in parallel using Promise.all for concurrent execution
      const chunkResults = await Promise.all(chunks.map((chunk, index) => this.processFileChunk(chunk, index)))

      // Flatten results
      return chunkResults.flat()
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Concurrent processing failed, falling back to sync: ${error.message}`))
      return this.processFilesSync(filePaths)
    }
  }

  /**
   * Process a chunk of files synchronously
   * @param {Array<string>} filePaths - Array of file paths to process
   * @returns {Promise<Array>} Array of processed file information
   */
  async processFilesSync(filePaths) {
    const results = []

    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath)
        const relPath = path.relative(this.projectPath, filePath)

        if (stats.isDirectory()) {
          results.push({
            type: 'directory',
            data: {
              path: filePath,
              relativePath: relPath,
              name: path.basename(filePath),
              depth: relPath.split(path.sep).length,
              parentPath: path.dirname(filePath),
            },
          })
        } else {
          // File properties
          const ext = path.extname(filePath).substring(1) // Remove the dot
          results.push({
            type: 'file',
            data: {
              path: filePath,
              relativePath: relPath,
              name: path.basename(filePath),
              extension: ext,
              size: stats.size,
              type: this.determineFileType(filePath),
              modifiedTime: stats.mtime,
              parentPath: path.dirname(filePath),
            },
          })
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(chalk.yellow(`Warning: Error analyzing file ${filePath}: ${error.message}`))
        }
      }
    }

    return results
  }

  /**
   * Process a chunk of files using async concurrency
   * @param {Array<string>} chunk - Chunk of file paths to process
   * @param {number} chunkIndex - Index of the chunk for debugging
   * @returns {Promise<Array>} Array of processed file information
   */
  async processFileChunk(chunk, chunkIndex) {
    if (this.verbose && chunk.length > 50) {
      console.log(chalk.gray(`Processing chunk ${chunkIndex + 1} with ${chunk.length} files...`))
    }

    // Process files in this chunk with limited concurrency to avoid overwhelming filesystem
    const BATCH_SIZE = 10
    const results = []

    for (let i = 0; i < chunk.length; i += BATCH_SIZE) {
      const batch = chunk.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map(async (filePath) => {
        try {
          const stats = await fs.stat(filePath)
          const relPath = path.relative(this.projectPath, filePath)

          if (stats.isDirectory()) {
            return {
              type: 'directory',
              data: {
                path: filePath,
                relativePath: relPath,
                name: path.basename(filePath),
                depth: relPath.split(path.sep).length,
                parentPath: path.dirname(filePath),
              },
            }
          } else {
            // File properties
            const ext = path.extname(filePath).substring(1) // Remove the dot
            return {
              type: 'file',
              data: {
                path: filePath,
                relativePath: relPath,
                name: path.basename(filePath),
                extension: ext,
                size: stats.size,
                type: this.determineFileType(filePath),
                modifiedTime: stats.mtime,
                parentPath: path.dirname(filePath),
              },
            }
          }
        } catch (error) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Warning: Error analyzing file ${filePath}: ${error.message}`))
          }
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter((result) => result !== null))
    }

    return results
  }
}
