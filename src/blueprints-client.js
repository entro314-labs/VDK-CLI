/**
 * VDK Blueprints Client
 * -----------------------
 * This module is responsible for all communication with the VDK-Blueprints repository,
 * which includes fetching rule lists, downloading rule files, and checking for updates.
 * 
 * Enhanced for AI Context Schema v2.1.0 support:
 * - Blueprint metadata parsing and validation
 * - Platform compatibility filtering
 * - Dependency relationship processing
 * - Enhanced search and discovery
 */

import chalk from 'chalk'
import ora from 'ora'
import matter from 'gray-matter'

import { validateBlueprint } from './utils/schema-validator.js'

const VDK_BLUEPRINTS_BASE_URL =
  'https://api.github.com/repos/entro314-labs/VDK-Blueprints/contents/.ai'

/**
 * Fetches the list of available blueprints from the VDK-Blueprints repository.
 * @returns {Promise<Array>} A promise that resolves to an array of blueprint file objects.
 */
async function fetchRuleList() {
  const spinner = ora('Connecting to VDK-Blueprints repository...').start()
  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
    }

    // Use GitHub token if available to avoid rate limiting
    if (process.env.VDK_GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`
    } else {
      spinner.warn('VDK_GITHUB_TOKEN not set. You may encounter rate limiting.')
    }

    const response = await fetch(`${VDK_BLUEPRINTS_BASE_URL}/rules?ref=main`, { headers })

    if (!response.ok) {
      spinner.fail('Failed to connect to VDK-Blueprints repository.')
      throw new Error(`Failed to fetch blueprint list. Status: ${response.status}`)
    }

    const data = await response.json()
    spinner.succeed('Successfully connected to VDK-Blueprints repository.')
    return data.filter((item) => item.type === 'file' && item.name.endsWith('.mdc'))
  } catch (error) {
    // Ora spinner might not be initialized if fetch fails, so check before using
    if (ora.isSpinning) {
      ora().stop()
    }
    console.error(chalk.red(`Error: ${error.message}`))
    return []
  }
}

/**
 * Downloads the content of a specific rule file.
 * @param {string} downloadUrl - The URL to download the file from.
 * @returns {Promise<string>} A promise that resolves to the content of the file.
 */
async function downloadRule(downloadUrl) {
  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download rule. Status: ${response.status}`)
    }
    return await response.text()
  } catch (error) {
    console.error(chalk.red(`Error downloading rule from ${downloadUrl}: ${error.message}`))
    return null
  }
}

/**
 * Enhanced blueprint fetching with schema v2.1.0 metadata parsing
 * @param {Object} options - Fetching options
 * @returns {Promise<Array>} Array of enhanced blueprint objects with metadata
 */
async function fetchBlueprintsWithMetadata(options = {}) {
  const spinner = ora('Fetching blueprints with metadata...').start()
  
  try {
    const rawBlueprints = await fetchRuleList()
    const blueprintsWithMetadata = []
    
    spinner.text = `Parsing ${rawBlueprints.length} blueprint files...`
    
    for (const blueprint of rawBlueprints) {
      try {
        const content = await downloadRule(blueprint.download_url)
        if (content) {
          const parsed = matter(content)
          const metadata = parsed.data
          
          // Validate against schema v2.1.0
          const validation = await validateBlueprint(metadata)
          
          blueprintsWithMetadata.push({
            ...blueprint,
            metadata,
            content: parsed.content,
            valid: validation.valid,
            validationErrors: validation.errors,
            // Enhanced v2.1.0 fields
            complexity: metadata.complexity,
            scope: metadata.scope,
            audience: metadata.audience,
            maturity: metadata.maturity,
            platforms: metadata.platforms || {},
            relationships: {
              requires: metadata.requires || [],
              suggests: metadata.suggests || [],
              conflicts: metadata.conflicts || [],
              supersedes: metadata.supersedes || []
            }
          })
        }
      } catch (error) {
        // Skip problematic blueprints but log the issue
        if (options.verbose) {
          console.warn(`Warning: Failed to parse ${blueprint.name}: ${error.message}`)
        }
      }
    }
    
    spinner.succeed(`Loaded ${blueprintsWithMetadata.length} blueprints with metadata`)
    return blueprintsWithMetadata
    
  } catch (error) {
    spinner.fail('Failed to fetch blueprints')
    throw error
  }
}

/**
 * Search blueprints by criteria using schema v2.1.0 metadata
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Array>} Filtered blueprint results
 */
async function searchBlueprints(criteria = {}) {
  const allBlueprints = await fetchBlueprintsWithMetadata()
  
  return allBlueprints.filter(blueprint => {
    // Platform compatibility filter
    if (criteria.platform && blueprint.platforms) {
      const platformConfig = blueprint.platforms[criteria.platform]
      if (!platformConfig || !platformConfig.compatible) {
        return false
      }
    }
    
    // Complexity filter
    if (criteria.complexity && blueprint.complexity !== criteria.complexity) {
      return false
    }
    
    // Scope filter
    if (criteria.scope && blueprint.scope !== criteria.scope) {
      return false
    }
    
    // Audience filter
    if (criteria.audience && blueprint.audience !== criteria.audience) {
      return false
    }
    
    // Maturity filter
    if (criteria.maturity && blueprint.maturity !== criteria.maturity) {
      return false
    }
    
    // Tag filter
    if (criteria.tags && Array.isArray(criteria.tags)) {
      const blueprintTags = blueprint.metadata.tags || []
      const hasMatchingTag = criteria.tags.some(tag => blueprintTags.includes(tag))
      if (!hasMatchingTag) {
        return false
      }
    }
    
    // Category filter
    if (criteria.category && blueprint.metadata.category !== criteria.category) {
      return false
    }
    
    // Text search (name, title, description)
    if (criteria.query) {
      const query = criteria.query.toLowerCase()
      const searchText = [
        blueprint.metadata.name,
        blueprint.metadata.title,
        blueprint.metadata.description
      ].join(' ').toLowerCase()
      
      if (!searchText.includes(query)) {
        return false
      }
    }
    
    return true
  })
}

/**
 * Get blueprint dependencies and check for conflicts
 * @param {string} blueprintId - Blueprint ID to analyze
 * @returns {Promise<Object>} Dependency analysis result
 */
async function analyzeBlueprintDependencies(blueprintId) {
  const allBlueprints = await fetchBlueprintsWithMetadata()
  const blueprint = allBlueprints.find(b => b.metadata.id === blueprintId)
  
  if (!blueprint) {
    throw new Error(`Blueprint '${blueprintId}' not found`)
  }
  
  const analysis = {
    blueprint: blueprint.metadata,
    dependencies: {
      required: [],
      suggested: [],
      missing: [],
      available: []
    },
    conflicts: [],
    superseded: []
  }
  
  // Find required dependencies
  if (blueprint.relationships.requires) {
    for (const requiredId of blueprint.relationships.requires) {
      const dependency = allBlueprints.find(b => b.metadata.id === requiredId)
      if (dependency) {
        analysis.dependencies.required.push(dependency.metadata)
        analysis.dependencies.available.push(dependency.metadata)
      } else {
        analysis.dependencies.missing.push(requiredId)
      }
    }
  }
  
  // Find suggested dependencies
  if (blueprint.relationships.suggests) {
    for (const suggestedId of blueprint.relationships.suggests) {
      const suggestion = allBlueprints.find(b => b.metadata.id === suggestedId)
      if (suggestion) {
        analysis.dependencies.suggested.push(suggestion.metadata)
        analysis.dependencies.available.push(suggestion.metadata)
      }
    }
  }
  
  // Find conflicts
  if (blueprint.relationships.conflicts) {
    for (const conflictId of blueprint.relationships.conflicts) {
      const conflict = allBlueprints.find(b => b.metadata.id === conflictId)
      if (conflict) {
        analysis.conflicts.push(conflict.metadata)
      }
    }
  }
  
  // Find superseded blueprints
  if (blueprint.relationships.supersedes) {
    for (const supersededId of blueprint.relationships.supersedes) {
      const superseded = allBlueprints.find(b => b.metadata.id === supersededId)
      if (superseded) {
        analysis.superseded.push(superseded.metadata)
      }
    }
  }
  
  return analysis
}

/**
 * Get platform-specific blueprint configurations
 * @param {string} platform - Platform identifier (e.g., 'claude-code', 'cursor')
 * @returns {Promise<Array>} Blueprints compatible with the platform
 */
async function getBlueprintsForPlatform(platform) {
  const allBlueprints = await fetchBlueprintsWithMetadata()
  
  return allBlueprints
    .filter(blueprint => {
      const platformConfig = blueprint.platforms[platform]
      return platformConfig && platformConfig.compatible === true
    })
    .map(blueprint => ({
      ...blueprint.metadata,
      platformConfig: blueprint.platforms[platform]
    }))
}

/**
 * Get blueprint statistics for the repository
 * @returns {Promise<Object>} Statistics about the blueprint repository
 */
async function getBlueprintStatistics() {
  const allBlueprints = await fetchBlueprintsWithMetadata()
  
  const stats = {
    total: allBlueprints.length,
    valid: allBlueprints.filter(b => b.valid).length,
    invalid: allBlueprints.filter(b => !b.valid).length,
    byCategory: {},
    byComplexity: {},
    byMaturity: {},
    byAudience: {},
    platformSupport: {},
    relationships: {
      withDependencies: allBlueprints.filter(b => 
        b.relationships.requires.length > 0 || b.relationships.suggests.length > 0
      ).length,
      withConflicts: allBlueprints.filter(b => b.relationships.conflicts.length > 0).length
    }
  }
  
  // Count by categories
  allBlueprints.forEach(blueprint => {
    const category = blueprint.metadata.category || 'unknown'
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1
    
    const complexity = blueprint.complexity || 'unknown'
    stats.byComplexity[complexity] = (stats.byComplexity[complexity] || 0) + 1
    
    const maturity = blueprint.maturity || 'unknown'
    stats.byMaturity[maturity] = (stats.byMaturity[maturity] || 0) + 1
    
    const audience = blueprint.audience || 'unknown'
    stats.byAudience[audience] = (stats.byAudience[audience] || 0) + 1
    
    // Count platform support
    Object.keys(blueprint.platforms).forEach(platform => {
      if (blueprint.platforms[platform].compatible) {
        stats.platformSupport[platform] = (stats.platformSupport[platform] || 0) + 1
      }
    })
  })
  
  return stats
}

export { 
  downloadRule, 
  fetchRuleList,
  fetchBlueprintsWithMetadata,
  searchBlueprints,
  analyzeBlueprintDependencies,
  getBlueprintsForPlatform,
  getBlueprintStatistics
}
