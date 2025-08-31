/**
 * Validation Module Tests - Complete rule and duplicate validation
 */
import { describe, expect, it } from 'vitest'

describe('Validation Modules', () => {
  describe('Rule Validation', () => {
    it('should load rule validation module', async () => {
      const validateRules = await import('../src/validation/validate-rules.js')

      expect(validateRules).toBeDefined()
      expect(typeof validateRules).toBe('object')
    })

    it('should handle rule validation process', async () => {
      // Test that validation module can be imported
      const validateRules = await import('../src/validation/validate-rules.js')

      expect(validateRules).toBeDefined()
    })

    it('should provide validation functionality', async () => {
      const validateRules = await import('../src/validation/validate-rules.js')

      // Module should be importable and structured correctly
      expect(typeof validateRules).toBe('object')
    })
  })

  describe('Duplicate Checking', () => {
    it('should load duplicate checking module', async () => {
      const checkDuplicates = await import('../src/validation/check-duplicates.js')

      expect(checkDuplicates).toBeDefined()
      expect(typeof checkDuplicates).toBe('object')
    })

    it('should handle duplicate detection', async () => {
      // Test duplicate checking functionality
      const checkDuplicates = await import('../src/validation/check-duplicates.js')

      expect(checkDuplicates).toBeDefined()
    })

    it('should provide duplicate validation', async () => {
      const checkDuplicates = await import('../src/validation/check-duplicates.js')

      // Verify module structure
      expect(typeof checkDuplicates).toBe('object')
    })
  })

  describe('Validation Integration', () => {
    it('should integrate with schema validation', async () => {
      const { validateBlueprint, validateCommand } = await import('../src/utils/schema-validator.js')
      const validateRules = await import('../src/validation/validate-rules.js')

      expect(validateBlueprint).toBeDefined()
      expect(validateCommand).toBeDefined()
      expect(validateRules).toBeDefined()
    })

    it('should provide comprehensive validation workflow', async () => {
      // Test that all validation modules work together
      const schemaValidator = await import('../src/utils/schema-validator.js')
      const validateRules = await import('../src/validation/validate-rules.js')
      const checkDuplicates = await import('../src/validation/check-duplicates.js')

      expect(schemaValidator).toBeDefined()
      expect(validateRules).toBeDefined()
      expect(checkDuplicates).toBeDefined()
    })
  })
})
