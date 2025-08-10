#!/usr/bin/env node

/**
 * Project Insights Generator
 * Generates analytics and insights about projects using VDK
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bright: '\x1b[1m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Analyze project rules and generate insights
 * @param {string} projectPath - Path to project directory
 * @returns {Object} Project insights
 */
function generateProjectInsights(projectPath = process.cwd()) {
  const rulesPath = path.join(projectPath, '.ai', 'rules')

  if (!fs.existsSync(rulesPath)) {
    return {
      error: 'No VDK rules found. Run `vdk` to set up rules first.',
      hasRules: false,
    }
  }

  const insights = {
    hasRules: true,
    rulesCount: 0,
    ruleTypes: {},
    technologies: new Set(),
    frameworks: new Set(),
    languages: new Set(),
    lastUpdated: null,
    projectSize: 'unknown',
    recommendations: [],
  }

  try {
    // Analyze rule files
    const ruleFiles = fs.readdirSync(rulesPath).filter((f) => f.endsWith('.mdc'))
    insights.rulesCount = ruleFiles.length

    let latestTime = 0

    for (const file of ruleFiles) {
      const filePath = path.join(rulesPath, file)
      const stats = fs.statSync(filePath)

      if (stats.mtime.getTime() > latestTime) {
        latestTime = stats.mtime.getTime()
        insights.lastUpdated = stats.mtime.toISOString()
      }

      // Categorize rule types
      const content = fs.readFileSync(filePath, 'utf8')

      if (file.includes('project-context')) {
        insights.ruleTypes.context = true
      }
      if (
        file.includes('framework') ||
        content.includes('React') ||
        content.includes('Vue') ||
        content.includes('Angular')
      ) {
        insights.ruleTypes.framework = true

        // Extract framework info
        if (content.includes('React')) {
          insights.frameworks.add('React')
        }
        if (content.includes('Vue')) {
          insights.frameworks.add('Vue')
        }
        if (content.includes('Angular')) {
          insights.frameworks.add('Angular')
        }
        if (content.includes('Next.js')) {
          insights.frameworks.add('Next.js')
        }
        if (content.includes('Django')) {
          insights.frameworks.add('Django')
        }
        if (content.includes('Express')) {
          insights.frameworks.add('Express')
        }
      }

      if (
        file.includes('language') ||
        content.includes('TypeScript') ||
        content.includes('Python')
      ) {
        insights.ruleTypes.language = true

        // Extract language info
        if (content.includes('TypeScript')) {
          insights.languages.add('TypeScript')
        }
        if (content.includes('JavaScript')) {
          insights.languages.add('JavaScript')
        }
        if (content.includes('Python')) {
          insights.languages.add('Python')
        }
        if (content.includes('Java')) {
          insights.languages.add('Java')
        }
        if (content.includes('Go')) {
          insights.languages.add('Go')
        }
      }

      if (file.includes('common-errors')) {
        insights.ruleTypes.errorHandling = true
      }
      if (file.includes('mcp-configuration')) {
        insights.ruleTypes.mcpConfig = true
      }
    }

    // Convert sets to arrays for JSON serialization
    insights.technologies = Array.from(insights.technologies)
    insights.frameworks = Array.from(insights.frameworks)
    insights.languages = Array.from(insights.languages)

    // Generate recommendations
    if (insights.rulesCount < 3) {
      insights.recommendations.push(
        'Consider running the setup wizard again to generate more comprehensive rules'
      )
    }

    if (!insights.ruleTypes.errorHandling) {
      insights.recommendations.push('Add common error handling patterns to improve AI suggestions')
    }

    if (!insights.ruleTypes.mcpConfig && insights.frameworks.length > 0) {
      insights.recommendations.push('Configure MCP settings for better IDE integration')
    }

    // Estimate project size based on rule complexity
    if (insights.rulesCount >= 5 && insights.frameworks.length >= 2) {
      insights.projectSize = 'large'
    } else if (insights.rulesCount >= 3 && insights.frameworks.length > 0) {
      insights.projectSize = 'medium'
    } else {
      insights.projectSize = 'small'
    }
  } catch (error) {
    insights.error = `Failed to analyze rules: ${error.message}`
  }

  return insights
}

/**
 * Display insights in a formatted way
 * @param {Object} insights - Project insights object
 */
function displayInsights(insights) {
  if (!insights.hasRules) {
    log('❌ No VDK rules found', 'red')
    log(insights.error, 'yellow')
    return
  }

  log('📊 Project Insights', 'blue')
  log('==================', 'blue')
  log('')

  log(`Rules Count: ${insights.rulesCount}`, 'green')
  log(`Project Size: ${insights.projectSize}`, 'green')
  log(
    `Last Updated: ${insights.lastUpdated ? new Date(insights.lastUpdated).toLocaleDateString() : 'Unknown'}`,
    'green'
  )

  if (insights.languages.length > 0) {
    log(`Languages: ${insights.languages.join(', ')}`, 'green')
  }

  if (insights.frameworks.length > 0) {
    log(`Frameworks: ${insights.frameworks.join(', ')}`, 'green')
  }

  log('')
  log('Rule Types:', 'yellow')
  if (insights.ruleTypes.context) {
    log('  ✅ Project Context', 'green')
  }
  if (insights.ruleTypes.framework) {
    log('  ✅ Framework Rules', 'green')
  }
  if (insights.ruleTypes.language) {
    log('  ✅ Language Rules', 'green')
  }
  if (insights.ruleTypes.errorHandling) {
    log('  ✅ Error Handling', 'green')
  }
  if (insights.ruleTypes.mcpConfig) {
    log('  ✅ MCP Configuration', 'green')
  }

  if (insights.recommendations.length > 0) {
    log('')
    log('💡 Recommendations:', 'yellow')
    for (const rec of insights.recommendations) {
      log(`  • ${rec}`, 'yellow')
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectPath = process.argv[2] || process.cwd()
  const insights = generateProjectInsights(projectPath)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(insights, null, 2))
  } else {
    displayInsights(insights)
  }
}

export { displayInsights, generateProjectInsights }
