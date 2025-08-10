#!/usr/bin/env node

/**
 * Rule Preview Tool
 *
 * This script generates a preview of how a rule will appear in the
 * VDK Web Application.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import chalk from 'chalk'
import express from 'express'
import matter from 'gray-matter'
import { marked } from 'marked'
import TerminalRenderer from 'marked-terminal'
import open from 'open'

// Set up Markdown renderer for terminal
marked.setOptions({
  renderer: new TerminalRenderer(),
})

// Get the rule file path from command line arguments
let rulePath

function initializeRulePath() {
  rulePath = process.argv[2]

  if (!rulePath) {
    console.error(chalk.red('Please provide a path to a rule file.'))
    console.log(chalk.yellow('Usage: npm run preview-rule <path-to-rule-file>'))
    process.exit(1)
  }
}

// Function to resolve absolute path (called after initialization)
function getAbsoluteRulePath() {
  return path.resolve(process.cwd(), rulePath)
}

async function previewRule() {
  try {
    // Initialize rule path
    initializeRulePath()
    const absoluteRulePath = getAbsoluteRulePath()

    // Check if file exists
    await fs.access(absoluteRulePath)

    // Read the file
    const fileContent = await fs.readFile(absoluteRulePath, 'utf-8')

    // Parse front matter
    const { data: frontMatter, content } = matter(fileContent)

    console.log(chalk.blue.bold('\n📄 Rule Preview\n'))

    // Display metadata
    console.log(chalk.cyan.bold('Metadata:\n'))

    console.log(chalk.cyan('Title: ') + chalk.white(frontMatter.title || 'Not specified'))
    console.log(
      chalk.cyan('Description: ') + chalk.white(frontMatter.description || 'Not specified')
    )
    console.log(chalk.cyan('Version: ') + chalk.white(frontMatter.version || 'Not specified'))
    console.log(chalk.cyan('Author: ') + chalk.white(frontMatter.author || 'Not specified'))
    console.log(
      chalk.cyan('Last Updated: ') + chalk.white(frontMatter.lastUpdated || 'Not specified')
    )

    if (frontMatter.tags && frontMatter.tags.length > 0) {
      console.log(chalk.cyan('Tags: ') + chalk.white(frontMatter.tags.join(', ')))
    }

    if (frontMatter.globs && frontMatter.globs.length > 0) {
      console.log(chalk.cyan('Globs: ') + chalk.white(frontMatter.globs.join(', ')))
    }

    console.log(chalk.cyan('Always Apply: ') + chalk.white(frontMatter.alwaysApply ? 'Yes' : 'No'))

    if (frontMatter.compatibleWith) {
      console.log(chalk.cyan('Compatible With:'))

      if (frontMatter.compatibleWith.ides && frontMatter.compatibleWith.ides.length > 0) {
        console.log(
          chalk.cyan('  IDEs: ') + chalk.white(frontMatter.compatibleWith.ides.join(', '))
        )
      }

      if (
        frontMatter.compatibleWith.aiAssistants &&
        frontMatter.compatibleWith.aiAssistants.length > 0
      ) {
        console.log(
          chalk.cyan('  AI Assistants: ') +
            chalk.white(frontMatter.compatibleWith.aiAssistants.join(', '))
        )
      }

      if (
        frontMatter.compatibleWith.frameworks &&
        frontMatter.compatibleWith.frameworks.length > 0
      ) {
        console.log(
          chalk.cyan('  Frameworks: ') +
            chalk.white(frontMatter.compatibleWith.frameworks.join(', '))
        )
      }
    }

    // Display content
    console.log(chalk.cyan.bold('\nContent:\n'))
    console.log(marked(content))

    // Ask if the user wants to see the HTML preview
    console.log(chalk.yellow('\nWould you like to see an HTML preview? (y/n)'))

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.once('data', async (data) => {
      if (data.toString().toLowerCase() === 'y') {
        await openHtmlPreview(frontMatter, content)
      } else {
        process.exit(0)
      }
    })
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`))
    process.exit(1)
  }
}

async function openHtmlPreview(frontMatter, content) {
  try {
    // Create a temporary Express server to serve the preview
    const app = express()
    const port = 3333

    // Convert Markdown to HTML
    const htmlContent = marked.parse(content)

    // Simple template for the HTML preview
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${frontMatter.title || 'Rule Preview'}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --background: #ffffff;
            --foreground: #11181c;
            --primary: #0070f3;
            --primary-foreground: #ffffff;
            --border: #e2e8f0;
            --ring: #0070f3;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --background: #1a1a1a;
              --foreground: #e1e1e1;
              --primary: #0070f3;
              --primary-foreground: #ffffff;
              --border: #333333;
              --ring: #0070f3;
            }
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            line-height: 1.6;
            color: var(--foreground);
            background-color: var(--background);
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }

          h1, h2, h3, h4, h5, h6 {
            margin-top: 2rem;
            margin-bottom: 1rem;
          }

          h1 {
            font-size: 2.25rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.5rem;
          }

          h2 {
            font-size: 1.75rem;
          }

          h3 {
            font-size: 1.5rem;
          }

          code {
            font-family: Menlo, Monaco, "Courier New", monospace;
            background-color: rgba(0, 0, 0, 0.05);
            padding: 0.2em 0.4em;
            border-radius: 3px;
          }

          pre {
            background-color: rgba(0, 0, 0, 0.05);
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
          }

          pre code {
            background-color: transparent;
            padding: 0;
          }

          a {
            color: var(--primary);
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }

          .metadata {
            background-color: rgba(0, 0, 0, 0.03);
            border-radius: 5px;
            padding: 1rem;
            margin-bottom: 2rem;
          }

          .metadata h2 {
            margin-top: 0;
          }

          .metadata-item {
            margin-bottom: 0.5rem;
          }

          .label {
            font-weight: bold;
          }

          .tag {
            display: inline-block;
            background-color: var(--primary);
            color: var(--primary-foreground);
            border-radius: 9999px;
            padding: 0.2em 0.6em;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
          }

          .compatibility {
            display: inline-block;
            background-color: rgba(0, 0, 0, 0.1);
            border-radius: 9999px;
            padding: 0.2em 0.6em;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
          }
        </style>
      </head>
      <body>
        <div class="metadata">
          <h2>${frontMatter.title || 'Untitled Rule'}</h2>
          <p><em>${frontMatter.description || 'No description provided.'}</em></p>

          <div class="metadata-item">
            <span class="label">Version:</span> ${frontMatter.version || 'Not specified'}
          </div>

          <div class="metadata-item">
            <span class="label">Author:</span> ${frontMatter.author || 'Not specified'}
          </div>

          <div class="metadata-item">
            <span class="label">Last Updated:</span> ${frontMatter.lastUpdated || 'Not specified'}
          </div>

          <div class="metadata-item">
            <span class="label">Always Apply:</span> ${frontMatter.alwaysApply ? 'Yes' : 'No'}
          </div>

          ${
            frontMatter.tags && frontMatter.tags.length > 0
              ? `
          <div class="metadata-item">
            <span class="label">Tags:</span><br />
            ${frontMatter.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
          </div>
          `
              : ''
          }

          ${
            frontMatter.globs && frontMatter.globs.length > 0
              ? `
          <div class="metadata-item">
            <span class="label">Globs:</span><br />
            ${frontMatter.globs.map((glob) => `<code>${glob}</code>`).join(', ')}
          </div>
          `
              : ''
          }

          ${
            frontMatter.compatibleWith
              ? `
          <div class="metadata-item">
            <span class="label">Compatible With:</span><br />
            ${
              frontMatter.compatibleWith.ides && frontMatter.compatibleWith.ides.length > 0
                ? `
              <div class="metadata-item">
                <span class="label">IDEs:</span>
                ${frontMatter.compatibleWith.ides.map((ide) => `<span class="compatibility">${ide}</span>`).join('')}
              </div>
            `
                : ''
            }

            ${
              frontMatter.compatibleWith.aiAssistants &&
              frontMatter.compatibleWith.aiAssistants.length > 0
                ? `
              <div class="metadata-item">
                <span class="label">AI Assistants:</span>
                ${frontMatter.compatibleWith.aiAssistants.map((assistant) => `<span class="compatibility">${assistant}</span>`).join('')}
              </div>
            `
                : ''
            }

            ${
              frontMatter.compatibleWith.frameworks &&
              frontMatter.compatibleWith.frameworks.length > 0
                ? `
              <div class="metadata-item">
                <span class="label">Frameworks:</span>
                ${frontMatter.compatibleWith.frameworks.map((framework) => `<span class="compatibility">${framework}</span>`).join('')}
              </div>
            `
                : ''
            }
          </div>
          `
              : ''
          }
        </div>

        <div class="content">
          ${htmlContent}
        </div>
      </body>
      </html>
    `

    app.get('/', (_req, res) => {
      res.send(htmlTemplate)
    })

    const server = app.listen(port, () => {
      console.log(chalk.green(`\nOpening HTML preview at http://localhost:${port}`))

      // Open the browser with the preview
      open(`http://localhost:${port}`)

      // Exit when the user presses any key
      console.log(chalk.yellow('\nPress any key to close the preview and exit.'))

      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.once('data', () => {
        server.close()
        process.exit(0)
      })
    })
  } catch (err) {
    console.error(chalk.red(`Error opening HTML preview: ${err.message}`))
    process.exit(1)
  }
}

// Run preview only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  previewRule()
}
