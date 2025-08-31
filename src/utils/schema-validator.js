/**
 * Schema Validator Utility
 * -----------------------
 * Centralized validation for VDK schemas including commands and blueprints
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMAS_DIR = path.join(__dirname, '../schemas')

// Cache for loaded schemas
const schemaCache = new Map()

/**
 * Load schema from file with caching
 */
async function loadSchema(schemaName) {
  if (schemaCache.has(schemaName)) {
    return schemaCache.get(schemaName)
  }

  try {
    const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.json`)
    const schemaContent = await fs.readFile(schemaPath, 'utf8')
    const schema = JSON.parse(schemaContent)

    schemaCache.set(schemaName, schema)
    return schema
  } catch (error) {
    throw new Error(`Failed to load schema '${schemaName}': ${error.message}`)
  }
}

/**
 * Validate platforms object with $ref definitions
 */
async function validatePlatformsObject(platformsData, schema, errors) {
  if (!schema.definitions) return

  const schemaProperties = schema.properties.platforms.properties || {}

  for (const [platformName, platformConfig] of Object.entries(platformsData)) {
    if (typeof platformConfig !== 'object') {
      errors.push(`Platform '${platformName}' configuration must be an object`)
      continue
    }

    // Find the appropriate definition
    let definition = null
    if (schemaProperties[platformName]?.['$ref']) {
      const refPath = schemaProperties[platformName]['$ref']
      const defName = refPath.replace('#/definitions/', '')
      definition = schema.definitions[defName]
    } else {
      // Use genericPlatform for unknown platforms
      definition = schema.definitions.genericPlatform
    }

    if (!definition) continue

    // Validate required fields
    if (definition.required) {
      for (const requiredField of definition.required) {
        if (!(requiredField in platformConfig)) {
          errors.push(`Platform '${platformName}' missing required field: ${requiredField}`)
        }
      }
    }

    // Validate platform-specific properties
    if (definition.properties) {
      for (const [fieldName, fieldValue] of Object.entries(platformConfig)) {
        const fieldDef = definition.properties[fieldName]
        if (!fieldDef) {
          errors.push(`Platform '${platformName}' has unknown field: ${fieldName}`)
          continue
        }

        // Type validation
        if (fieldDef.type) {
          const expectedType = fieldDef.type
          const actualType = Array.isArray(fieldValue) ? 'array' : typeof fieldValue
          if (actualType !== expectedType) {
            errors.push(`Platform '${platformName}.${fieldName}' should be ${expectedType}, got ${actualType}`)
            continue
          }
        }

        // Enum validation
        if (fieldDef.enum && !fieldDef.enum.includes(fieldValue)) {
          errors.push(`Platform '${platformName}.${fieldName}' must be one of: ${fieldDef.enum.join(', ')}`)
        }

        // Number range validation
        if (fieldDef.type === 'number') {
          if (fieldDef.minimum !== undefined && fieldValue < fieldDef.minimum) {
            errors.push(`Platform '${platformName}.${fieldName}' must be at least ${fieldDef.minimum}`)
          }
          if (fieldDef.maximum !== undefined && fieldValue > fieldDef.maximum) {
            errors.push(`Platform '${platformName}.${fieldName}' must not exceed ${fieldDef.maximum}`)
          }
        }
      }
    }
  }
}

/**
 * Validate relationship fields (requires, suggests, conflicts, supersedes)
 */
function validateRelationships(data, errors) {
  const relationshipFields = ['requires', 'suggests', 'conflicts', 'supersedes']

  for (const field of relationshipFields) {
    if (data[field] && Array.isArray(data[field])) {
      // Check for self-references
      if (data.id && data[field].includes(data.id)) {
        errors.push(`Blueprint cannot reference itself in ${field}`)
      }

      // Check for duplicates within each array
      const uniqueItems = new Set(data[field])
      if (uniqueItems.size !== data[field].length) {
        errors.push(`${field} array must have unique items`)
      }
    }
  }

  // Check for conflicts between relationship fields
  if (data.requires && data.conflicts) {
    const conflicts = data.requires.filter((id) => data.conflicts.includes(id))
    if (conflicts.length > 0) {
      errors.push(`Cannot both require and conflict with: ${conflicts.join(', ')}`)
    }
  }
}

/**
 * Validate data against a schema
 */
export async function validateSchema(data, schemaName) {
  const schema = await loadSchema(schemaName)
  const errors = []

  // Validate required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`)
      }
    }
  }

  // Validate properties
  if (schema.properties) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      const value = data[field]

      if (value === undefined || value === null) {
        continue // Skip validation for missing optional fields
      }

      // Type validation
      const expectedType = fieldSchema.type
      const actualType = Array.isArray(value) ? 'array' : typeof value

      if (expectedType && actualType !== expectedType) {
        errors.push(`Field '${field}' should be of type ${expectedType}, got ${actualType}`)
        continue
      }

      // String validations
      if (expectedType === 'string' && typeof value === 'string') {
        // Pattern validation
        if (fieldSchema.pattern) {
          const pattern = new RegExp(fieldSchema.pattern)
          if (!pattern.test(value)) {
            errors.push(`Field '${field}' does not match required pattern`)
          }
        }

        // Length validation
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          errors.push(`Field '${field}' must be at least ${fieldSchema.minLength} characters`)
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          errors.push(`Field '${field}' must not exceed ${fieldSchema.maxLength} characters`)
        }

        // Enum validation
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${fieldSchema.enum.join(', ')}`)
        }
      }

      // Array validation
      if (expectedType === 'array' && Array.isArray(value)) {
        // Check array constraints
        if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
          errors.push(`Array '${field}' must have at least ${fieldSchema.minItems} items`)
        }
        if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
          errors.push(`Array '${field}' must not have more than ${fieldSchema.maxItems} items`)
        }
        if (fieldSchema.uniqueItems && new Set(value).size !== value.length) {
          errors.push(`Array '${field}' must have unique items`)
        }

        // Validate array items
        if (fieldSchema.items) {
          for (const [index, item] of value.entries()) {
            if (fieldSchema.items.type) {
              const itemType = typeof item
              if (itemType !== fieldSchema.items.type) {
                errors.push(
                  `Array '${field}' item at index ${index} should be ${fieldSchema.items.type}, got ${itemType}`
                )
              }
            }
            // Validate item patterns
            if (fieldSchema.items.pattern && typeof item === 'string') {
              const pattern = new RegExp(fieldSchema.items.pattern)
              if (!pattern.test(item)) {
                errors.push(`Array '${field}' item at index ${index} does not match required pattern`)
              }
            }
            // Validate item length
            if (fieldSchema.items.maxLength && typeof item === 'string' && item.length > fieldSchema.items.maxLength) {
              errors.push(`Array '${field}' item at index ${index} exceeds maximum length`)
            }
          }
        }
      }

      // Number validation
      if (expectedType === 'number' && typeof value === 'number') {
        if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
          errors.push(`Field '${field}' must be at least ${fieldSchema.minimum}`)
        }
        if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
          errors.push(`Field '${field}' must not exceed ${fieldSchema.maximum}`)
        }
      }

      // Object validation with $ref support
      if (expectedType === 'object' && typeof value === 'object') {
        if (field === 'platforms') {
          // Special handling for platforms object with $ref definitions
          await validatePlatformsObject(value, schema, errors)
        } else if (fieldSchema.properties) {
          for (const [subField, subSchema] of Object.entries(fieldSchema.properties)) {
            const subValue = value[subField]
            if (subValue !== undefined && subSchema.type) {
              const subType = Array.isArray(subValue) ? 'array' : typeof subValue
              if (subType !== subSchema.type) {
                errors.push(`Object '${field}.${subField}' should be ${subSchema.type}, got ${subType}`)
              }
            }
          }
        }
      }
    }
  }

  // Additional validation for blueprints
  if (schemaName === 'blueprint-schema') {
    validateRelationships(data, errors)

    // Validate platforms has at least one compatible platform
    if (data.platforms) {
      const hasCompatiblePlatform = Object.values(data.platforms).some(
        (platform) => platform && platform.compatible === true
      )
      if (!hasCompatiblePlatform) {
        errors.push('Blueprint must have at least one compatible platform')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Claude Code command
 */
export async function validateCommand(commandData) {
  return await validateSchema(commandData, 'command-schema')
}

/**
 * Validate VDK Blueprint
 */
export async function validateBlueprint(blueprintData) {
  return await validateSchema(blueprintData, 'blueprint-schema')
}

/**
 * Get all available schemas
 */
export async function getAvailableSchemas() {
  try {
    const files = await fs.readdir(SCHEMAS_DIR)
    return files.filter((file) => file.endsWith('.json')).map((file) => file.replace('.json', ''))
  } catch (error) {
    console.warn(`Could not read schemas directory: ${error.message}`)
    return []
  }
}

/**
 * Clear schema cache (useful for testing)
 */
export function clearSchemaCache() {
  schemaCache.clear()
}

export default {
  validateSchema,
  validateCommand,
  validateBlueprint,
  getAvailableSchemas,
  clearSchemaCache,
}
