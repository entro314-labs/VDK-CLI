/**
 * Styling Integration Tests
 * Tests for integration between styling utilities and real CLI usage
 */

import stripAnsi from 'strip-ansi'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Styling Integration', () => {
  let originalConsoleLog
  let capturedOutput

  beforeEach(() => {
    capturedOutput = []
    originalConsoleLog = console.log
    console.log = (...args) => {
      capturedOutput.push(args.join(' '))
    }
  })

  afterEach(() => {
    console.log = originalConsoleLog
    vi.restoreAllMocks()
  })

  describe('CLI Styles Module Loading', () => {
    it('should load all styling utilities without errors', async () => {
      expect(async () => {
        const styles = await import('../src/utils/cli-styles.js')

        // Verify all expected exports are available
        expect(styles.symbols).toBeDefined()
        expect(styles.colors).toBeDefined()
        expect(styles.gradients).toBeDefined()
        expect(styles.spinners).toBeDefined()
        expect(styles.boxes).toBeDefined()
        expect(styles.tables).toBeDefined()
        expect(styles.status).toBeDefined()
        expect(styles.headers).toBeDefined()
        expect(styles.progress).toBeDefined()
        expect(styles.format).toBeDefined()
        expect(styles.banner).toBeDefined()
      }).not.toThrow()
    })

    it('should handle styling utilities being imported multiple times', async () => {
      const styles1 = await import('../src/utils/cli-styles.js')
      const styles2 = await import('../src/utils/cli-styles.js')

      // Should be the same module instance
      expect(styles1.symbols).toBe(styles2.symbols)
      expect(styles1.colors).toBe(styles2.colors)
    })
  })

  describe('Real CLI Integration', () => {
    it('should integrate styling utilities in main CLI file', async () => {
      // Import and test that CLI file can load styling utilities
      expect(async () => {
        // This simulates what happens when cli-new.js imports the styles
        const styles = await import('../src/utils/cli-styles.js')

        // Test that we can create common UI components used in CLI
        const statusTable = styles.tables.status()
        statusTable.push(['Test', styles.status.success('OK'), 'Details'])

        const output = statusTable.toString()
        expect(output).toContain('Test')
        expect(output).toContain('OK')
      }).not.toThrow()
    })

    it('should handle ANSI codes in different environments', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Test with color support
      const coloredText = styles.colors.success('test')
      expect(coloredText).toContain('test')
      expect(coloredText.length).toBeGreaterThanOrEqual(4) // Should have ANSI codes or plain text

      // Test without color (stripped)
      const plainText = stripAnsi(coloredText)
      expect(plainText).toBe('test')
    })
  })

  describe('Component Interaction', () => {
    it('should combine multiple styling components seamlessly', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Create a complex UI component like what's used in status command
      const table = styles.tables.status()
      table.push(['Configuration', styles.status.success('Found'), styles.format.keyValue('Project', 'test-project')])

      const output = table.toString()

      expect(output).toContain('Configuration')
      expect(output).toContain('Found')
      expect(output).toContain('Project')
      expect(output).toContain('test-project')

      // Should maintain readability when ANSI codes are stripped
      const cleanOutput = stripAnsi(output)
      expect(cleanOutput).toContain('Configuration')
      expect(cleanOutput).toContain('test-project')
    })

    it('should handle nested styling without conflicts', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Test nested styling like boxes containing formatted text
      const formattedList = styles.format.list(['Item 1', 'Item 2'])
      const boxedList = styles.boxes.info(formattedList, 'Items')

      expect(boxedList).toContain('Item 1')
      expect(boxedList).toContain('Item 2')
      expect(boxedList).toContain('Items')

      // Should not break when stripped of ANSI codes
      const cleanOutput = stripAnsi(boxedList)
      expect(cleanOutput).toContain('Item 1')
      expect(cleanOutput).toContain('Item 2')
    })
  })

  describe('Memory and Performance', () => {
    it('should not leak memory when creating multiple styled components', () => {
      const initialMemory = process.memoryUsage().heapUsed

      return import('../src/utils/cli-styles.js').then((styles) => {
        // Create many styling components
        for (let i = 0; i < 1000; i++) {
          const _table = styles.tables.basic()
          const _box = styles.boxes.info(`Test ${i}`)
          const _status = styles.status.success(`Item ${i}`)
          const _progress = styles.progress.bar(i, 1000)
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        const finalMemory = process.memoryUsage().heapUsed
        const memoryIncrease = finalMemory - initialMemory

        // Memory increase should be reasonable (less than 10MB for 1000 components)
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
      })
    })

    it('should perform well with rapid styling operations', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      const start = Date.now()

      // Perform many styling operations rapidly
      for (let i = 0; i < 100; i++) {
        const _coloredText = styles.colors.primary(`Text ${i}`)
        const _statusMessage = styles.status.success(`Status ${i}`)
        const _formattedPath = styles.format.path(`/path/to/file${i}.js`)
        const _progress = styles.progress.simple(i, 100)
      }

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
  })

  describe('Error Resilience', () => {
    it('should handle malformed inputs gracefully', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      expect(() => {
        styles.format.keyValue(null, undefined)
        styles.format.list(null)
        styles.progress.bar(Number.NaN, 'invalid')
        styles.status.success(undefined)
      }).not.toThrow()
    })

    it('should degrade gracefully without required dependencies', async () => {
      // Test that styling utilities can handle missing dependencies
      expect(async () => {
        const styles = await import('../src/utils/cli-styles.js')

        // These should not throw even if underlying libraries fail
        const table = styles.tables.basic()
        const box = styles.boxes.info('test')
        const spinner = styles.spinners.scanning()

        expect(table).toBeDefined()
        expect(box).toBeDefined()
        expect(spinner).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('Cross-Platform Compatibility', () => {
    it('should use appropriate symbols for the platform', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // All symbols should be strings and not empty
      Object.values(styles.symbols).forEach((symbol) => {
        expect(typeof symbol).toBe('string')
        expect(symbol.length).toBeGreaterThan(0)
      })
    })

    it('should handle different terminal capabilities', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Test table rendering (should work in any terminal)
      const table = styles.tables.basic()
      table.push(['Col1', 'Col2'])

      const output = table.toString()
      expect(output).toContain('Col1')
      expect(output).toContain('Col2')

      // Should contain some form of table structure
      expect(output.match(/[│┃|]/)).toBeTruthy() // Vertical borders
      expect(output.match(/[─━-]/)).toBeTruthy() // Horizontal borders
    })
  })

  describe('State Management', () => {
    it('should maintain consistent styling state across calls', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      const text1 = styles.colors.primary('test')
      const text2 = styles.colors.primary('test')

      // Should produce identical output for identical input
      expect(text1).toBe(text2)
    })

    it('should handle concurrent styling operations', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      const promises = new Array(10).fill(0).map(async (_, i) => {
        const table = styles.tables.status()
        table.push([`Item ${i}`, styles.status.success('OK'), 'Details'])
        return table.toString()
      })

      const results = await Promise.all(promises)

      // All operations should complete successfully
      expect(results).toHaveLength(10)
      results.forEach((result, i) => {
        expect(result).toContain(`Item ${i}`)
        expect(result).toContain('OK')
      })
    })
  })

  describe('Styling Consistency', () => {
    it('should maintain consistent color usage across components', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Success styling should be consistent
      const successColor = styles.colors.success('test')
      const successStatus = styles.status.success('test')
      const successBox = styles.boxes.success('test')

      // While the exact output differs, they should all use the same underlying color
      // We can't easily test this without inspecting ANSI codes, but we can verify
      // they all contain the text and are not empty
      expect(stripAnsi(successColor)).toBe('test')
      expect(stripAnsi(successStatus)).toContain('test')
      expect(stripAnsi(successBox)).toContain('test')

      // All should be at least as long as the text (styled or not)
      expect(successColor.length).toBeGreaterThanOrEqual(4)
      expect(successStatus.length).toBeGreaterThanOrEqual(4)
      expect(successBox.length).toBeGreaterThanOrEqual(4)
    })

    it('should provide appropriate contrast and readability', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Test that different status types are visually distinct
      const success = styles.status.success('OK')
      const error = styles.status.error('FAIL')
      const warning = styles.status.warning('WARN')
      const info = styles.status.info('INFO')

      // Should all be different when rendered
      const outputs = [success, error, warning, info]
      const uniqueOutputs = new Set(outputs)
      expect(uniqueOutputs.size).toBe(4)

      // Should all contain readable symbols
      outputs.forEach((output) => {
        const cleanOutput = stripAnsi(output)
        expect(cleanOutput.match(/[✔✓✗✘⚠ℹ]/)).toBeTruthy()
      })
    })
  })

  describe('Real Usage Simulation', () => {
    it('should simulate status command styling integration', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Simulate what happens in the enhanced status command
      console.log(styles.headers.section('VDK Status Check'))

      const statusTable = styles.tables.status()
      statusTable.push([
        'VDK Configuration',
        styles.status.warning('Missing'),
        `Run ${styles.colors.primary('vdk init')} to get started`,
      ])
      statusTable.push([
        'Local Rules',
        styles.status.success('Found'),
        `${styles.format.count(0)} rules in ${styles.format.path('./.vdk/rules')}`,
      ])

      console.log(statusTable.toString())

      console.log(
        `\n${styles.boxes.info(
          `Get started by running:\n${styles.colors.primary('vdk init')}\n\nThis will scan your project and create project-aware AI rules.`,
          'Quick Start'
        )}`
      )

      // Verify output was captured
      expect(capturedOutput.length).toBeGreaterThan(0)

      const fullOutput = capturedOutput.join('\n')
      expect(fullOutput).toContain('VDK Status Check')
      expect(fullOutput).toContain('VDK Configuration')
      expect(fullOutput).toContain('Quick Start')
    })

    it('should simulate update command progress display', async () => {
      const styles = await import('../src/utils/cli-styles.js')

      // Simulate update command progress
      console.log(styles.headers.section('VDK Blueprint Update'))
      console.log(styles.status.progress('Checking for updates...'))
      console.log(styles.progress.simple(3, 10))
      console.log(styles.status.success('Update complete!'))
      console.log(styles.status.progress(`Added ${styles.format.count(2)} new rule(s)`))

      const fullOutput = capturedOutput.join('\n')
      expect(fullOutput).toContain('VDK Blueprint Update')
      expect(fullOutput).toContain('Checking for updates')
      expect(fullOutput).toContain('30%') // Progress percentage
      expect(fullOutput).toContain('Update complete')
      expect(fullOutput).toContain('Added')
      expect(fullOutput).toContain('2')
    })
  })
})
