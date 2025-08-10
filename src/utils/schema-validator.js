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
      if (expectedType === 'array' && Array.isArray(value) && fieldSchema.items?.type) {
        for (const [index, item] of value.entries()) {
          const itemType = typeof item
          if (itemType !== fieldSchema.items.type) {
            errors.push(
              `Array '${field}' item at index ${index} should be ${fieldSchema.items.type}, got ${itemType}`
            )
          }
        }
      }

      // Object validation (simplified)
      if (expectedType === 'object' && typeof value === 'object' && fieldSchema.properties) {
        for (const [subField, subSchema] of Object.entries(fieldSchema.properties)) {
          const subValue = value[subField]
          if (subValue !== undefined && subSchema.type) {
            const subType = Array.isArray(subValue) ? 'array' : typeof subValue
            if (subType !== subSchema.type) {
              errors.push(
                `Object '${field}.${subField}' should be ${subSchema.type}, got ${subType}`
              )
            }
          }
        }
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
