/**
 * Schema Validation Tests
 */
import { describe, expect, it } from 'vitest'

import { validBlueprint, validCommand } from './helpers/test-fixtures.js'

describe('Schema Validation', () => {
  describe('Command Validation', () => {
    it('should validate correct commands', async () => {
      const { validateCommand } = await import('../src/utils/schema-validator.js')

      const result = await validateCommand(validCommand)

      expect(result.valid).toBe(true)
      if (!result.valid) {
        console.log('Validation errors:', result.errors)
      }
    })

    it('should reject invalid commands', async () => {
      const { validateCommand } = await import('../src/utils/schema-validator.js')

      const invalidCommand = {
        id: 'invalid',
        target: 'invalid-platform',
      }

      const result = await validateCommand(invalidCommand)

      expect(result.valid).toBe(false)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Blueprint Validation', () => {
    it('should validate correct blueprints', async () => {
      const { validateBlueprint } = await import('../src/utils/schema-validator.js')

      const result = await validateBlueprint(validBlueprint)

      expect(result.valid).toBe(true)
      if (!result.valid) {
        console.log('Validation errors:', result.errors)
      }
    })

    it('should reject invalid blueprints', async () => {
      const { validateBlueprint } = await import('../src/utils/schema-validator.js')

      const invalidBlueprint = {
        id: 'invalid-blueprint',
      }

      const result = await validateBlueprint(invalidBlueprint)

      expect(result.valid).toBe(false)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Schema Availability', () => {
    it('should list available schemas', async () => {
      const { getAvailableSchemas } = await import('../src/utils/schema-validator.js')

      const schemas = await getAvailableSchemas()

      expect(Array.isArray(schemas)).toBe(true)
      expect(schemas.length).toBeGreaterThan(0)
    })
  })
})
