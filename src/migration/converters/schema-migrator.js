/**
 * Schema Migrator
 * ---------------
 * Converts existing blueprints to AI Context Schema v2.1.0 format
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import matter from 'gray-matter'

import { validateBlueprint } from '../../utils/schema-validator.js'

export class SchemaMigrator {
  constructor(options = {}) {
    this.verbose = options.verbose || false
  }

  /**
   * Migrate blueprint files to schema v2.1.0
   * @param {string} inputPath - Directory containing blueprint files
   * @param {string} outputPath - Directory for migrated blueprints
   * @param {Object} options - Migration options
   */
  async migrateBlueprints(inputPath, outputPath, options = {}) {
    const results = {
      processed: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      files: []
    }

    try {
      // Ensure output directory exists
      await fs.mkdir(outputPath, { recursive: true })

      // Find blueprint files
      const files = await this.findBlueprintFiles(inputPath)
      
      for (const filePath of files) {
        try {
          const result = await this.migrateSingleBlueprint(filePath, outputPath, options)
          results.processed++
          
          if (result.migrated) {
            results.migrated++
          } else {
            results.skipped++
          }
          
          results.files.push(result)
          
          if (this.verbose) {
            console.log(`${result.migrated ? '✓' : '→'} ${path.basename(filePath)}`)
          }
        } catch (error) {
          results.errors++
          results.files.push({
            file: path.basename(filePath),
            migrated: false,
            error: error.message
          })
          
          if (this.verbose) {
            console.error(`✗ ${path.basename(filePath)}: ${error.message}`)
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`)
    }

    return results
  }

  /**
   * Migrate a single blueprint file
   */
  async migrateSingleBlueprint(filePath, outputPath, options = {}) {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = matter(content)
    const originalData = { ...parsed.data }
    
    // Check if already in v2.1.0 format
    if (this.isAlreadyMigrated(originalData)) {
      if (!options.force) {
        return {
          file: path.basename(filePath),
          migrated: false,
          reason: 'Already in v2.1.0 format'
        }
      }
    }

    // Perform migration
    const migratedData = await this.migrateMetadata(originalData)
    
    // Validate migrated data
    const validation = await validateBlueprint(migratedData)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    // Create migrated file content
    const migratedContent = matter.stringify(parsed.content, migratedData)
    
    // Write migrated file
    const outputFile = path.join(outputPath, path.basename(filePath))
    await fs.writeFile(outputFile, migratedContent, 'utf8')
    
    return {
      file: path.basename(filePath),
      migrated: true,
      changes: this.getChanges(originalData, migratedData)
    }
  }

  /**
   * Check if blueprint is already in v2.1.0 format
   */
  isAlreadyMigrated(data) {
    const v2Fields = ['complexity', 'scope', 'audience', 'maturity']
    return v2Fields.some(field => field in data) && 
           data.platforms && 
           typeof data.platforms === 'object'
  }

  /**
   * Migrate metadata to v2.1.0 format
   */
  async migrateMetadata(originalData) {
    const migrated = { ...originalData }

    // Ensure required fields exist
    if (!migrated.id && migrated.name) {
      migrated.id = migrated.name
    }

    if (!migrated.title && migrated.name) {
      migrated.title = this.titleCase(migrated.name)
    }

    if (!migrated.version) {
      migrated.version = '1.0.0'
    }

    // Add v2.1.0 specific fields with defaults
    if (!migrated.complexity) {
      migrated.complexity = this.inferComplexity(originalData)
    }

    if (!migrated.scope) {
      migrated.scope = this.inferScope(originalData)
    }

    if (!migrated.audience) {
      migrated.audience = this.inferAudience(originalData)
    }

    if (!migrated.maturity) {
      migrated.maturity = this.inferMaturity(originalData)
    }

    // Ensure date format compliance (YYYY-MM-DD)
    if (migrated.created) {
      migrated.created = this.formatDate(migrated.created)
    } else {
      migrated.created = new Date().toISOString().split('T')[0]
    }

    if (migrated.lastUpdated) {
      migrated.lastUpdated = this.formatDate(migrated.lastUpdated)
    } else {
      migrated.lastUpdated = new Date().toISOString().split('T')[0]
    }

    // Migrate platform configuration
    migrated.platforms = this.migratePlatformConfig(originalData)

    // Clean up tags (ensure lowercase and kebab-case)
    if (migrated.tags && Array.isArray(migrated.tags)) {
      migrated.tags = migrated.tags.map(tag => 
        tag.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
      )
    }

    return migrated
  }

  /**
   * Migrate platform configuration to v2.1.0 format
   */
  migratePlatformConfig(originalData) {
    const platforms = {}

    // Check for existing platform configuration
    if (originalData.platforms && typeof originalData.platforms === 'object') {
      // Migrate existing platform config
      Object.keys(originalData.platforms).forEach(platform => {
        const config = originalData.platforms[platform]
        if (typeof config === 'boolean') {
          platforms[platform] = { compatible: config }
        } else {
          platforms[platform] = { compatible: true, ...config }
        }
      })
    } else {
      // Create default platform configuration
      const defaultPlatforms = ['claude', 'cursor', 'windsurf']
      defaultPlatforms.forEach(platform => {
        platforms[platform] = { compatible: true }
      })
    }

    // Infer platform-specific settings
    if (originalData.category === 'memory' || originalData.alwaysApply) {
      if (platforms.claude) {
        platforms.claude.memory = true
        platforms.claude.priority = 5
      }
    }

    if (originalData.fileTypes && Array.isArray(originalData.fileTypes)) {
      if (platforms.cursor) {
        platforms.cursor.globs = originalData.fileTypes.map(type => `**/*.${type}`)
        platforms.cursor.activation = 'auto-attached'
      }
    }

    return platforms
  }

  /**
   * Infer complexity from existing metadata
   */
  inferComplexity(data) {
    if (data.category === 'core') return 'simple'
    if (data.subcategory || data.framework) return 'medium'
    if (data.dependencies && data.dependencies.length > 3) return 'complex'
    return 'medium'
  }

  /**
   * Infer scope from existing metadata
   */
  inferScope(data) {
    if (data.category === 'language') return 'file'
    if (data.category === 'technology') return 'component'
    if (data.category === 'stack') return 'project'
    if (data.category === 'task') return 'feature'
    return 'project'
  }

  /**
   * Infer audience from existing metadata
   */
  inferAudience(data) {
    if (data.category === 'core') return 'any'
    if (data.complexity === 'complex') return 'senior'
    if (data.framework) return 'developer'
    return 'developer'
  }

  /**
   * Infer maturity from existing metadata
   */
  inferMaturity(data) {
    if (data.version && data.version.startsWith('0.')) return 'beta'
    if (data.version && data.version.startsWith('1.')) return 'stable'
    if (data.experimental) return 'experimental'
    if (data.deprecated) return 'deprecated'
    return 'beta'
  }

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  }

  /**
   * Convert string to title case
   */
  titleCase(str) {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Find blueprint files in directory
   */
  async findBlueprintFiles(dirPath) {
    const files = []
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          const subFiles = await this.findBlueprintFiles(fullPath)
          files.push(...subFiles)
        } else if (entry.name.endsWith('.mdc') || entry.name.endsWith('.md')) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(`Warning: Could not read directory ${dirPath}: ${error.message}`)
      }
    }
    
    return files
  }

  /**
   * Get list of changes made during migration
   */
  getChanges(original, migrated) {
    const changes = []
    
    const v2Fields = ['complexity', 'scope', 'audience', 'maturity']
    v2Fields.forEach(field => {
      if (!(field in original) && (field in migrated)) {
        changes.push(`Added ${field}: ${migrated[field]}`)
      }
    })
    
    if (!original.platforms && migrated.platforms) {
      changes.push('Added platform configuration')
    }
    
    if (original.created !== migrated.created) {
      changes.push('Formatted created date')
    }
    
    if (original.lastUpdated !== migrated.lastUpdated) {
      changes.push('Formatted lastUpdated date')
    }
    
    return changes
  }
}

/**
 * CLI helper function for schema migration
 */
export async function migrateToSchemaV2(inputPath, outputPath = null, options = {}) {
  const migrator = new SchemaMigrator(options)
  
  if (!outputPath) {
    outputPath = inputPath + '_v2'
  }
  
  const results = await migrator.migrateBlueprints(inputPath, outputPath, options)
  
  console.log(`Migration completed:`)
  console.log(`- Processed: ${results.processed}`)
  console.log(`- Migrated: ${results.migrated}`)
  console.log(`- Skipped: ${results.skipped}`)
  console.log(`- Errors: ${results.errors}`)
  
  if (results.errors > 0) {
    console.log('\\nErrors:')
    results.files
      .filter(f => f.error)
      .forEach(f => console.log(`- ${f.file}: ${f.error}`))
  }
  
  return results
}