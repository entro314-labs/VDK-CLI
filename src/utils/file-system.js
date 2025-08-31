/**
 * Centralized File System Utilities
 *
 * Consolidates fs/promises operations with consistent error handling
 * and logging to reduce duplication across the codebase.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Enhanced file operations with error handling
 */
export const fileSystem = {
  /**
   * Read file with consistent error handling
   */
  async readFile(filePath, encoding = 'utf8') {
    try {
      return await fs.readFile(filePath, encoding)
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`)
    }
  },

  /**
   * Write file with automatic directory creation
   */
  async writeFile(filePath, data, options = {}) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath)
      await this.ensureDir(dir)

      return await fs.writeFile(filePath, data, options)
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`)
    }
  },

  /**
   * Append to file with automatic directory creation
   */
  async appendFile(filePath, data, options = {}) {
    try {
      const dir = path.dirname(filePath)
      await this.ensureDir(dir)

      return await fs.appendFile(filePath, data, options)
    } catch (error) {
      throw new Error(`Failed to append to file ${filePath}: ${error.message}`)
    }
  },

  /**
   * Check if file/directory exists
   */
  async exists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  },

  /**
   * Get file stats with error handling
   */
  async stat(filePath) {
    try {
      return await fs.stat(filePath)
    } catch (error) {
      throw new Error(`Failed to get stats for ${filePath}: ${error.message}`)
    }
  },

  /**
   * Check if path is a directory
   */
  async isDirectory(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.isDirectory()
    } catch {
      return false
    }
  },

  /**
   * Check if path is a file
   */
  async isFile(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.isFile()
    } catch {
      return false
    }
  },

  /**
   * Create directory recursively
   */
  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`)
    }
  },

  /**
   * Remove file
   */
  async removeFile(filePath) {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to remove file ${filePath}: ${error.message}`)
      }
    }
  },

  /**
   * Remove directory recursively
   */
  async removeDir(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true })
    } catch (error) {
      throw new Error(`Failed to remove directory ${dirPath}: ${error.message}`)
    }
  },

  /**
   * List directory contents
   */
  async readDir(dirPath) {
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      throw new Error(`Failed to read directory ${dirPath}: ${error.message}`)
    }
  },

  /**
   * Copy file
   */
  async copyFile(src, dest) {
    try {
      const destDir = path.dirname(dest)
      await this.ensureDir(destDir)

      await fs.copyFile(src, dest)
    } catch (error) {
      throw new Error(`Failed to copy ${src} to ${dest}: ${error.message}`)
    }
  },

  /**
   * Move/rename file
   */
  async moveFile(src, dest) {
    try {
      const destDir = path.dirname(dest)
      await this.ensureDir(destDir)

      await fs.rename(src, dest)
    } catch (error) {
      throw new Error(`Failed to move ${src} to ${dest}: ${error.message}`)
    }
  },

  /**
   * Read JSON file with parsing
   */
  async readJSON(filePath) {
    try {
      const content = await this.readFile(filePath)
      return JSON.parse(content)
    } catch (error) {
      throw new Error(`Failed to read JSON from ${filePath}: ${error.message}`)
    }
  },

  /**
   * Write JSON file with formatting
   */
  async writeJSON(filePath, data, indent = 2) {
    try {
      const content = JSON.stringify(data, null, indent)
      await this.writeFile(filePath, content)
    } catch (error) {
      throw new Error(`Failed to write JSON to ${filePath}: ${error.message}`)
    }
  },

  /**
   * Find files recursively with pattern matching
   */
  async findFiles(dirPath, pattern = null, options = {}) {
    const { maxDepth = Infinity, includeDirectories = false } = options
    const files = []

    async function traverse(currentPath, depth = 0) {
      if (depth > maxDepth) return

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name)

          if (entry.isDirectory()) {
            if (includeDirectories && (!pattern || pattern.test(entry.name))) {
              files.push(fullPath)
            }
            await traverse(fullPath, depth + 1)
          } else if (entry.isFile()) {
            if (!pattern || pattern.test(entry.name)) {
              files.push(fullPath)
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await traverse(dirPath)
    return files
  },

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.size
    } catch (error) {
      throw new Error(`Failed to get size of ${filePath}: ${error.message}`)
    }
  },

  /**
   * Get file modification time
   */
  async getModificationTime(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.mtime
    } catch (error) {
      throw new Error(`Failed to get modification time of ${filePath}: ${error.message}`)
    }
  },

  /**
   * Create temporary file
   */
  async createTempFile(prefix = 'vdk-', suffix = '.tmp') {
    const tmpDir = await fs.realpath('/tmp')
    const fileName = `${prefix}${Date.now()}-${Math.random().toString(36).substring(2)}${suffix}`
    return path.join(tmpDir, fileName)
  },
}

/**
 * Path utilities
 */
export const pathUtils = {
  /**
   * Get current file's directory (for ES modules)
   */
  getCurrentDir(importMetaUrl) {
    return path.dirname(fileURLToPath(importMetaUrl))
  },

  /**
   * Resolve path relative to project root
   */
  resolveFromRoot(...pathSegments) {
    // Assuming project root is 2 levels up from src/utils
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const projectRoot = path.resolve(currentDir, '..', '..')
    return path.resolve(projectRoot, ...pathSegments)
  },

  /**
   * Normalize path separators
   */
  normalize(filePath) {
    return path.normalize(filePath)
  },

  /**
   * Get relative path between two paths
   */
  relative(from, to) {
    return path.relative(from, to)
  },

  /**
   * Join path segments safely
   */
  join(...segments) {
    return path.join(...segments)
  },

  /**
   * Get file extension
   */
  getExtension(filePath) {
    return path.extname(filePath)
  },

  /**
   * Get filename without extension
   */
  getBasename(filePath, ext = null) {
    return path.basename(filePath, ext)
  },

  /**
   * Get directory name
   */
  getDirname(filePath) {
    return path.dirname(filePath)
  },
}

// Re-export fs and path for backward compatibility during migration
export { fs as fsPromises, path }
export default { fileSystem, pathUtils }
