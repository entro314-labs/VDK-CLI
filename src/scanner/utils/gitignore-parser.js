/**
 * GitIgnore Parser
 * Reads .gitignore files and converts patterns to glob patterns for use with our scanner
 */

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Parses .gitignore files and converts them to glob patterns
 */
export class GitIgnoreParser {
  /**
   * Read and parse a .gitignore file, converting patterns to glob patterns
   *
   * @param {string} projectPath - The path to the project
   * @returns {Promise<string[]>} - Array of glob patterns
   */
  static async parseGitIgnore(projectPath) {
    try {
      const gitIgnorePath = path.join(projectPath, '.gitignore')

      // Check if .gitignore exists
      try {
        await fs.access(gitIgnorePath)
      } catch {
        // .gitignore doesn't exist, return empty array
        return []
      }

      // Read the .gitignore file
      const content = await fs.readFile(gitIgnorePath, 'utf8')

      // Parse the file and convert to glob patterns
      return GitIgnoreParser.convertToGlobPatterns(content, projectPath)
    } catch (error) {
      console.warn(`Warning: Error parsing .gitignore: ${error.message}`)
      return []
    }
  }

  /**
   * Convert gitignore patterns to glob patterns
   *
   * @param {string} content - The content of the .gitignore file
   * @param {string} projectPath - The path to the project
   * @returns {string[]} - Array of glob patterns
   */
  static convertToGlobPatterns(content, _projectPath) {
    const lines = content.split('\n')
    const globPatterns = []

    for (let line of lines) {
      // Remove comments and trim whitespace
      line = line.replace(/#.*$/, '').trim()

      // Skip empty lines
      if (!line) {
        continue
      }

      // Handle negation (we don't support this in our ignore patterns, so skip)
      if (line.startsWith('!')) {
        continue
      }

      // Convert pattern to glob
      let globPattern = line

      // Handle directory-specific patterns (ends with /)
      if (globPattern.endsWith('/')) {
        globPattern = `${globPattern}**`
      }

      // Handle leading slash (matches patterns from project root)
      if (globPattern.startsWith('/')) {
        globPattern = globPattern.substring(1)
      } else {
        // If no leading slash, pattern matches anywhere
        globPattern = `**/${globPattern}`
      }

      // Handle no trailing slash or * (match files and directories)
      if (!(globPattern.endsWith('**') || globPattern.endsWith('*'))) {
        // Add both the exact match and any children for directories
        globPatterns.push(globPattern)
        globPatterns.push(`${globPattern}/**`)
      } else {
        globPatterns.push(globPattern)
      }
    }

    return globPatterns
  }
}
