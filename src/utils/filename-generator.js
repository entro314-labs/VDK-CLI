/**
 * Centralized Filename Generation Utility
 * =====================================
 *
 * Eliminates duplicate filename generation logic across the codebase
 * and provides consistent, safe filename generation for all VDK components.
 *
 * Used by:
 * - RuleAdapter.js (getCursorFileName)
 * - RuleGenerator.js (generateIDESpecificRules)
 * - UniversalFormatConverter.js (generateId)
 * - GitHubPRClient.js (generateBranchName)
 * - Migration converters
 */

/**
 * Generate safe, consistent filename from string input
 * @param {string} input - Raw input string
 * @param {Object} options - Generation options
 * @returns {string} Safe filename
 */
export function generateSafeFilename(input, options = {}) {
  const {
    maxLength = 50,
    extension = '',
    preserveCase = false,
    separator = '-',
    allowedChars = /[a-z0-9-_]/,
    fallbackName = 'untitled',
  } = options

  if (!input || typeof input !== 'string') {
    return fallbackName + extension
  }

  // 1. Convert to lowercase (unless preserveCase is true)
  let filename = preserveCase ? input.trim() : input.toLowerCase().trim()

  // 2. Replace spaces and special chars with separator
  filename = filename
    .replace(/\s+/g, separator) // Multiple spaces to separator
    .replace(/[^a-z0-9-_]/g, separator) // Non-alphanumeric to separator
    .replace(new RegExp(`\\${separator}+`, 'g'), separator) // Multiple separators to single
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '') // Remove leading/trailing separators

  // 3. Ensure we have a valid filename
  if (!filename || filename.length === 0) {
    filename = fallbackName
  }

  // 4. Truncate if necessary (preserve extension)
  if (filename.length > maxLength) {
    filename = filename.substring(0, maxLength)
    // Remove any trailing separator after truncation
    filename = filename.replace(new RegExp(`\\${separator}+$`), '')
  }

  return filename + extension
}

/**
 * Generate unique filename for Cursor IDE rules
 * Handles the specific requirements for Cursor .cursorrules format
 * @param {Object} rule - Rule object with frontmatter
 * @returns {string} Unique filename
 */
export function generateCursorFilename(rule) {
  const category = rule.frontmatter?.category || 'general'
  const framework = rule.frontmatter?.framework || ''
  const description = rule.frontmatter?.description || ''
  const id = rule.frontmatter?.id || ''
  const title = rule.frontmatter?.title || ''

  // Build unique identifier using most specific available data
  const identifiers = [category]

  // Add framework if different from category
  if (framework && framework !== category) {
    identifiers.push(framework)
  }

  // Add ID if available and different from existing identifiers
  if (id && !identifiers.includes(id)) {
    identifiers.push(id)
  }

  // Add title/description fragment if ID is not available
  if (!id && (title || description)) {
    const titleFragment = (title || description).split(' ').slice(0, 2).join('-')
    if (titleFragment && !identifiers.includes(titleFragment)) {
      identifiers.push(titleFragment)
    }
  }

  const baseName = identifiers.join('-')

  return generateSafeFilename(baseName, {
    maxLength: 40,
    extension: '.md',
    separator: '-',
  })
}

/**
 * Generate branch name for GitHub operations
 * @param {string} blueprintName - Blueprint name
 * @param {string} username - GitHub username
 * @returns {string} Safe branch name
 */
export function generateGitHubBranchName(blueprintName, username) {
  const safeBlueprintName = generateSafeFilename(blueprintName, {
    maxLength: 30,
    separator: '-',
  })

  const safeUsername = generateSafeFilename(username, {
    maxLength: 10,
    separator: '',
  })

  return `community/${safeBlueprintName}-${safeUsername}`
}

/**
 * Generate blueprint ID from title/name
 * @param {string} title - Blueprint title
 * @returns {string} Blueprint ID in kebab-case
 */
export function generateBlueprintId(title) {
  return generateSafeFilename(title, {
    maxLength: 50,
    separator: '-',
  })
}

/**
 * Generate command name from template name
 * @param {string} templateName - Template file name
 * @returns {string} Command name
 */
export function generateCommandName(templateName) {
  // Remove file extensions
  let name = templateName.replace(/\.(md|mdc)$/, '')

  return generateSafeFilename(name, {
    maxLength: 30,
    separator: '-',
  })
}

/**
 * Generate memory file name for IDE memory systems
 * @param {string} category - Memory category
 * @param {string} technology - Technology name (optional)
 * @returns {string} Memory filename
 */
export function generateMemoryFilename(category, technology = '') {
  const parts = [category]
  if (technology) {
    parts.push(technology)
  }

  return generateSafeFilename(parts.join('-'), {
    maxLength: 30,
    extension: '.md',
    separator: '-',
  })
}
