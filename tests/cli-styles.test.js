/**
 * CLI Styles Test Suite
 * Tests for the new CLI styling utilities
 */

import stripAnsi from 'strip-ansi'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the CLI styles module
import {
  banner,
  boxes,
  colors,
  format,
  gradients,
  headers,
  progress,
  spinners,
  status,
  symbols,
  tables,
} from '../src/utils/cli-styles.js'

describe('CLI Styles Utilities', () => {
  let _consoleSpy

  beforeEach(() => {
    _consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Symbols', () => {
    it('should provide cross-platform symbols', () => {
      expect(symbols).toBeDefined()
      expect(typeof symbols.success).toBe('string')
      expect(typeof symbols.error).toBe('string')
      expect(typeof symbols.warning).toBe('string')
      expect(typeof symbols.info).toBe('string')
      expect(typeof symbols.arrow).toBe('string')
      expect(typeof symbols.bullet).toBe('string')
    })

    it('should have Unicode symbols for visual feedback', () => {
      expect(symbols.success.length).toBeGreaterThan(0)
      expect(symbols.error.length).toBeGreaterThan(0)
      expect(symbols.warning.length).toBeGreaterThan(0)
      expect(symbols.info.length).toBeGreaterThan(0)
    })

    it('should provide checkbox and radio symbols', () => {
      expect(symbols.checkboxOn).toBeDefined()
      expect(symbols.checkboxOff).toBeDefined()
      expect(symbols.radioOn).toBeDefined()
      expect(symbols.radioOff).toBeDefined()
    })
  })

  describe('Colors', () => {
    it('should provide color functions', () => {
      expect(typeof colors.primary).toBe('function')
      expect(typeof colors.secondary).toBe('function')
      expect(typeof colors.success).toBe('function')
      expect(typeof colors.warning).toBe('function')
      expect(typeof colors.error).toBe('function')
      expect(typeof colors.muted).toBe('function')
    })

    it('should apply colors to text', () => {
      const testText = 'test'
      expect(colors.primary(testText)).toContain(testText)
      expect(colors.success(testText)).toContain(testText)
      expect(colors.error(testText)).toContain(testText)
    })

    it('should produce consistent text when stripped of colors', () => {
      const testText = 'test'
      const primary = colors.primary(testText)
      const success = colors.success(testText)
      const error = colors.error(testText)

      // All color functions should produce the same text when stripped
      expect(stripAnsi(primary)).toBe(testText)
      expect(stripAnsi(success)).toBe(testText)
      expect(stripAnsi(error)).toBe(testText)

      // Functions should be callable and produce strings
      expect(typeof primary).toBe('string')
      expect(typeof success).toBe('string')
      expect(typeof error).toBe('string')
    })
  })

  describe('Gradients', () => {
    it('should provide gradient functions', () => {
      expect(typeof gradients.vdk).toBe('function')
      expect(typeof gradients.success).toBe('function')
      expect(typeof gradients.warning).toBe('function')
      expect(typeof gradients.error).toBe('function')
    })

    it('should apply gradients to text', () => {
      const testText = 'VDK CLI'
      const gradientText = gradients.vdk(testText)

      expect(gradientText).toContain(testText)
      expect(stripAnsi(gradientText)).toBe(testText)
    })

    it('should support multiline gradients', () => {
      const multilineText = 'Line 1\nLine 2'
      const gradientText = gradients.vdk.multiline(multilineText)

      expect(stripAnsi(gradientText)).toBe(multilineText)
    })
  })

  describe('Spinners', () => {
    it('should provide spinner configurations', () => {
      expect(spinners.scanning).toBeDefined()
      expect(spinners.processing).toBeDefined()
      expect(spinners.downloading).toBeDefined()
      expect(spinners.updating).toBeDefined()
    })

    it('should create ora spinner instances', () => {
      const spinner = spinners.scanning('Test scanning...')

      expect(spinner).toBeDefined()
      expect(typeof spinner.start).toBe('function')
      expect(typeof spinner.stop).toBe('function')
      expect(typeof spinner.succeed).toBe('function')
      expect(typeof spinner.fail).toBe('function')
    })

    it('should accept custom text', () => {
      const customText = 'Custom operation...'
      const spinner = spinners.processing(customText)

      expect(spinner.text).toBe(customText)
    })

    it('should have different spinner styles', () => {
      const scanning = spinners.scanning()
      const processing = spinners.processing()

      expect(scanning.spinner).not.toBe(processing.spinner)
    })
  })

  describe('Message Boxes', () => {
    it('should provide box functions for different message types', () => {
      expect(typeof boxes.info).toBe('function')
      expect(typeof boxes.success).toBe('function')
      expect(typeof boxes.warning).toBe('function')
      expect(typeof boxes.error).toBe('function')
    })

    it('should create boxed messages', () => {
      const message = 'Test message'
      const infoBox = boxes.info(message)

      expect(infoBox).toContain(message)
      expect(infoBox).toContain('Info') // Default title
      expect(infoBox.includes('╭') || infoBox.includes('┌')).toBe(true) // Box border
    })

    it('should support custom titles', () => {
      const message = 'Test message'
      const customTitle = 'Custom Title'
      const box = boxes.success(message, customTitle)

      expect(box).toContain(message)
      expect(box).toContain(customTitle)
    })

    it('should create different colored boxes', () => {
      const message = 'Test'
      const infoBox = boxes.info(message)
      const errorBox = boxes.error(message)

      expect(infoBox).not.toBe(errorBox)
    })
  })

  describe('Tables', () => {
    it('should provide table factory functions', () => {
      expect(typeof tables.basic).toBe('function')
      expect(typeof tables.status).toBe('function')
      expect(typeof tables.rules).toBe('function')
    })

    it('should create table instances', () => {
      const table = tables.basic()

      expect(table).toBeDefined()
      expect(typeof table.push).toBe('function')
      expect(typeof table.toString).toBe('function')
    })

    it('should create status table with predefined columns', () => {
      const statusTable = tables.status()

      expect(statusTable).toBeDefined()
      expect(statusTable.options.head).toBeDefined()
      expect(statusTable.options.head.length).toBe(3)
    })

    it('should create rules table with predefined columns', () => {
      const rulesTable = tables.rules()

      expect(rulesTable).toBeDefined()
      expect(rulesTable.options.head).toBeDefined()
      expect(rulesTable.options.head.length).toBe(3)
    })

    it('should render table with data', () => {
      const table = tables.basic()
      table.push(['Test Item', 'Test Status'])

      const output = table.toString()
      expect(output).toContain('Test Item')
      expect(output).toContain('Test Status')
    })
  })

  describe('Status Indicators', () => {
    it('should provide status functions', () => {
      expect(typeof status.success).toBe('function')
      expect(typeof status.error).toBe('function')
      expect(typeof status.warning).toBe('function')
      expect(typeof status.info).toBe('function')
      expect(typeof status.pending).toBe('function')
      expect(typeof status.progress).toBe('function')
    })

    it('should combine symbols with text', () => {
      const testText = 'Operation completed'
      const successStatus = status.success(testText)

      expect(successStatus).toContain(testText)
      expect(stripAnsi(successStatus)).toContain(symbols.success)
    })

    it('should create different status indicators', () => {
      const testText = 'Test'
      const successMsg = status.success(testText)
      const errorMsg = status.error(testText)

      expect(successMsg).not.toBe(errorMsg)
      expect(stripAnsi(successMsg)).toContain(symbols.success)
      expect(stripAnsi(errorMsg)).toContain(symbols.error)
    })
  })

  describe('Headers', () => {
    it('should provide header functions', () => {
      expect(typeof headers.main).toBe('function')
      expect(typeof headers.section).toBe('function')
      expect(typeof headers.subsection).toBe('function')
    })

    it('should format headers with symbols', () => {
      const title = 'Test Section'
      const sectionHeader = headers.section(title)

      expect(sectionHeader).toContain(title)
      expect(stripAnsi(sectionHeader)).toContain(symbols.hamburger)
    })

    it('should create different styled headers', () => {
      const title = 'Test Title'
      const mainHeader = headers.main(title)
      const sectionHeader = headers.section(title)

      expect(mainHeader).not.toBe(sectionHeader)
      expect(stripAnsi(mainHeader)).toBe(title)
    })
  })

  describe('Progress Indicators', () => {
    it('should provide progress functions', () => {
      expect(typeof progress.bar).toBe('function')
      expect(typeof progress.simple).toBe('function')
    })

    it('should create progress bars', () => {
      const progressBar = progress.bar(50, 100)

      expect(progressBar).toContain('50%')
      expect(progressBar).toContain('50/100')
      expect(progressBar.includes('█') || progressBar.includes('=')).toBe(true)
    })

    it('should calculate progress percentage correctly', () => {
      const progressBar25 = progress.bar(25, 100)
      const progressBar75 = progress.bar(75, 100)

      expect(progressBar25).toContain('25%')
      expect(progressBar75).toContain('75%')
    })

    it('should create simple progress indicators', () => {
      const simpleProgress = progress.simple(7, 10)

      expect(simpleProgress).toContain('70%')
      expect(simpleProgress).toContain('7/10')
      expect(stripAnsi(simpleProgress)).toContain(symbols.arrow)
    })

    it('should handle edge cases', () => {
      const zeroProgress = progress.bar(0, 100)
      const fullProgress = progress.bar(100, 100)

      expect(zeroProgress).toContain('0%')
      expect(fullProgress).toContain('100%')
    })
  })

  describe('Format Utilities', () => {
    it('should provide formatting functions', () => {
      expect(typeof format.path).toBe('function')
      expect(typeof format.count).toBe('function')
      expect(typeof format.time).toBe('function')
      expect(typeof format.brand).toBe('function')
      expect(typeof format.list).toBe('function')
      expect(typeof format.keyValue).toBe('function')
    })

    it('should format paths with dim styling', () => {
      const testPath = '/test/path/file.js'
      const formattedPath = format.path(testPath)

      expect(formattedPath).toContain(testPath)
      expect(stripAnsi(formattedPath)).toBe(testPath)
    })

    it('should highlight counts', () => {
      const count = 42
      const formattedCount = format.count(count)

      expect(formattedCount).toContain(count.toString())
      expect(stripAnsi(formattedCount)).toBe(count.toString())
    })

    it('should create lists with bullets', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const list = format.list(items)

      items.forEach((item) => {
        expect(list).toContain(item)
      })
      expect(stripAnsi(list)).toContain(symbols.bullet)
    })

    it('should support custom list symbols', () => {
      const items = ['Item 1']
      const customSymbol = '→'
      const list = format.list(items, customSymbol)

      expect(stripAnsi(list)).toContain(customSymbol)
    })

    it('should create key-value pairs', () => {
      const key = 'Project'
      const value = 'VDK CLI'
      const pair = format.keyValue(key, value)

      expect(pair).toContain(key)
      expect(pair).toContain(value)
      expect(stripAnsi(pair)).toContain(':')
    })

    it('should support custom separators', () => {
      const key = 'Name'
      const value = 'Test'
      const separator = ' = '
      const pair = format.keyValue(key, value, separator)

      expect(stripAnsi(pair)).toContain(separator)
    })

    it('should format time with muted styling', () => {
      const time = '2023-01-01'
      const formattedTime = format.time(time)

      expect(formattedTime).toContain(time)
      expect(stripAnsi(formattedTime)).toBe(time)
    })

    it('should apply brand styling', () => {
      const brandText = 'VDK'
      const formattedBrand = format.brand(brandText)

      expect(stripAnsi(formattedBrand)).toBe(brandText)
    })
  })

  describe('Banner', () => {
    it('should create a banner function', () => {
      expect(typeof banner).toBe('function')
    })

    it('should generate a banner with VDK ASCII art', () => {
      const bannerOutput = banner()

      // The banner contains VDK in ASCII art format, not plain text
      expect(bannerOutput).toMatch(/[╦╚╗╔╝║═]/) // Should contain ASCII art characters
      expect(bannerOutput).toContain('Vibe Development Kit')
      expect(bannerOutput.includes('╔') || bannerOutput.includes('┌')).toBe(true)
    })

    it('should include subtitle in banner', () => {
      const bannerOutput = banner()

      expect(bannerOutput).toContain("The world's first Vibe Development Kit")
    })

    it('should create a bordered banner', () => {
      const bannerOutput = banner()

      // Check for box border characters
      expect(
        bannerOutput.includes('╔') || bannerOutput.includes('┌') || bannerOutput.includes('╭')
      ).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should work together - status with table and symbols', () => {
      const table = tables.status()
      table.push([
        'Test Item',
        status.success('Working'),
        format.keyValue('Count', format.count(5)),
      ])

      const output = table.toString()
      expect(output).toContain('Test Item')
      expect(output).toContain('Working')
      expect(output).toContain('Count')
      expect(output).toContain('5')
    })

    it('should work together - box with formatted content', () => {
      const content = format.list(['Item 1', 'Item 2'])
      const box = boxes.info(content, 'Test Items')

      expect(box).toContain('Item 1')
      expect(box).toContain('Item 2')
      expect(box).toContain('Test Items')
    })

    it('should maintain consistent styling across components', () => {
      const successColor = colors.success('test')
      const successStatus = status.success('test')
      const successBox = boxes.success('test')

      // All should contain the original text
      expect(stripAnsi(successColor)).toBe('test')
      expect(stripAnsi(successStatus)).toContain('test')
      expect(stripAnsi(successBox)).toContain('test')
    })
  })

  describe('Error Handling', () => {
    it('should handle empty inputs gracefully', () => {
      expect(() => format.list([])).not.toThrow()
      expect(() => progress.bar(0, 0)).not.toThrow()
      expect(() => status.success('')).not.toThrow()
    })

    it('should handle null/undefined inputs', () => {
      expect(() => format.keyValue('key', null)).not.toThrow()
      expect(() => format.keyValue('key', undefined)).not.toThrow()
    })

    it('should handle malformed progress values', () => {
      // Progress bar should handle edge cases gracefully
      expect(() => progress.bar(0, 100)).not.toThrow()
      expect(() => progress.bar(100, 100)).not.toThrow()

      // For invalid values, we expect them to be handled internally
      // but the specific implementation might vary
      const negativeResult = progress.bar(-1, 100)
      const overflowResult = progress.bar(150, 100)

      expect(typeof negativeResult).toBe('string')
      expect(typeof overflowResult).toBe('string')
    })
  })

  describe('Performance', () => {
    it('should create components quickly', () => {
      const start = Date.now()

      for (let i = 0; i < 100; i++) {
        const _table = tables.basic()
        const _box = boxes.info('test')
        const _statusMsg = status.success('test')
      }

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})
