/**
 * CLI Styling Utilities
 * Provides consistent styling, symbols, and formatting across the VDK CLI
 */

import boxen from 'boxen'
import chalk from 'chalk'
import Table from 'cli-table3'
import figures from 'figures'
import gradient from 'gradient-string'
import ora from 'ora'

// Cross-platform Unicode symbols
export const symbols = {
  success: figures.tick,
  error: figures.cross,
  warning: figures.warning,
  info: figures.info,
  arrow: figures.arrowRight,
  bullet: figures.bullet,
  line: figures.line,
  pointer: figures.pointer,
  radioOn: figures.radioOn,
  radioOff: figures.radioOff,
  checkboxOn: figures.checkboxOn,
  checkboxOff: figures.checkboxOff,
  hamburger: figures.hamburger,
  star: figures.star,
  play: figures.play,
  square: figures.square,
  squareSmall: figures.squareSmall,
}

// Color themes
export const colors = {
  primary: chalk.cyan,
  secondary: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  highlight: chalk.bold,
  dim: chalk.dim,
}

// Gradient styles for branding
export const gradients = {
  vdk: gradient(['#00d4ff', '#0066ff']),
  success: gradient(['#00ff88', '#00cc66']),
  warning: gradient(['#ffaa00', '#ff6600']),
  error: gradient(['#ff4444', '#cc0000']),
}

// Pre-configured spinners
export const spinners = {
  scanning: (text = 'Scanning...') =>
    ora({
      text,
      spinner: 'dots',
    }),

  processing: (text = 'Processing...') =>
    ora({
      text,
      spinner: 'bouncingBar',
    }),

  downloading: (text = 'Downloading...') =>
    ora({
      text,
      spinner: 'arrow3',
    }),

  updating: (text = 'Updating...') =>
    ora({
      text,
      spinner: 'circleQuarters',
    }),
}

// Message boxes
export const boxes = {
  info: (message, title = 'Info') =>
    boxen(message, {
      title,
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    }),

  success: (message, title = 'Success') =>
    boxen(message, {
      title,
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
    }),

  warning: (message, title = 'Warning') =>
    boxen(message, {
      title,
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    }),

  error: (message, title = 'Error') =>
    boxen(message, {
      title,
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'red',
    }),
}

// Table configurations
export const tables = {
  basic: () =>
    new Table({
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
      style: {
        'padding-left': 1,
        'padding-right': 1,
        head: ['cyan', 'bold'],
        border: ['gray'],
      },
    }),

  status: () =>
    new Table({
      head: [colors.primary('Item'), colors.primary('Status'), colors.primary('Details')],
      colWidths: [25, 15, 40],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray'],
      },
    }),

  rules: () =>
    new Table({
      head: [colors.primary('Rule'), colors.primary('Type'), colors.primary('Status')],
      colWidths: [30, 15, 15],
      style: {
        head: ['cyan', 'bold'],
        border: ['gray'],
      },
    }),
}

// Status indicators
export const status = {
  success: (text) => `${colors.success(symbols.success)} ${text || ''}`,
  error: (text) => `${colors.error(symbols.error)} ${text || ''}`,
  warning: (text) => `${colors.warning(symbols.warning)} ${text || ''}`,
  info: (text) => `${colors.secondary(symbols.info)} ${text || ''}`,
  pending: (text) => `${colors.muted(symbols.squareSmall)} ${text || ''}`,
  progress: (text) => `${colors.primary(symbols.arrow)} ${text || ''}`,
}

// Branded headers
export const headers = {
  main: (text) => gradients.vdk.multiline(text),
  section: (text) => colors.primary.bold(`\n${symbols.hamburger} ${text}\n`),
  subsection: (text) => colors.secondary(`${symbols.bullet} ${text}`),
}

// Progress bars (using simple text-based approach)
export const progress = {
  bar: (current, total, width = 30) => {
    // Handle edge cases
    if (isNaN(current) || current === null || current === undefined) current = 0
    if (isNaN(total) || total === null || total === undefined || total === 0) total = 1
    if (isNaN(width) || width === null || width === undefined) width = 30

    if (current < 0) {
      current = 0
    }
    if (current > total) {
      current = total
    }

    const percentage = Math.round((current / total) * 100)
    const filled = Math.max(0, Math.min(width, Math.round((current / total) * width)))
    const empty = Math.max(0, width - filled)

    const bar = colors.success('█'.repeat(filled)) + colors.muted('░'.repeat(empty))
    return `${bar} ${colors.highlight(`${percentage}%`)} (${current}/${total})`
  },

  simple: (current, total) => {
    // Handle edge cases
    if (total === 0) {
      total = 1
    }
    if (current < 0) {
      current = 0
    }
    if (current > total) {
      current = total
    }

    const percentage = Math.round((current / total) * 100)
    return `${colors.primary(symbols.arrow)} Progress: ${colors.highlight(`${percentage}%`)} (${current}/${total})`
  },
}

// Utility functions
export const format = {
  path: (path) => colors.dim(path),
  count: (num) => colors.highlight(num.toString()),
  time: (time) => colors.muted(time),
  brand: (text) => gradients.vdk(text),

  list: (items, symbol = symbols.bullet) => {
    if (!(items && Array.isArray(items))) return ''
    return items.map((item) => `  ${colors.muted(symbol)} ${item || ''}`).join('\n')
  },

  keyValue: (key, value, separator = ':') => {
    if (key === null || key === undefined) return ''
    const safeValue = value === null || value === undefined ? '' : value
    return `${colors.primary(key)}${colors.muted(separator)} ${safeValue}`
  },
}

// Banner for CLI startup
export const banner = () => {
  const title = gradients.vdk.multiline(`
╦  ╦╔╦╗╦╔═  ╔═╗╦  ╦
╚╗╔╝ ║║╠╩╗  ║  ║  ║
 ╚╝ ═╩╝╩ ╩  ╚═╝╩═╝╩
  `)

  const subtitle = colors.dim("The world's first Vibe Development Kit")

  return boxen(`${title}\n\n${subtitle}`, {
    padding: { top: 1, bottom: 1, left: 3, right: 3 },
    margin: { top: 1, bottom: 1 },
    borderStyle: 'double',
    borderColor: 'cyan',
    backgroundColor: 'black',
  })
}
