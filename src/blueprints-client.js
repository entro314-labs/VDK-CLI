/**
 * VDK Blueprints Client
 * -----------------------
 * This module is responsible for all communication with the VDK-Blueprints repository,
 * which includes fetching rule lists, downloading rule files, and checking for updates.
 */

import chalk from 'chalk'
import ora from 'ora'

const VDK_BLUEPRINTS_BASE_URL =
  'https://api.github.com/repos/entro314-labs/VDK-Blueprints/contents/.ai'

/**
 * Fetches the list of available blueprints from the VDK-Blueprints repository.
 * @returns {Promise<Array>} A promise that resolves to an array of blueprint file objects.
 */
async function fetchRuleList() {
  const spinner = ora('Connecting to VDK-Blueprints repository...').start()
  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
    }

    // Use GitHub token if available to avoid rate limiting
    if (process.env.VDK_GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`
    } else {
      spinner.warn('VDK_GITHUB_TOKEN not set. You may encounter rate limiting.')
    }

    const response = await fetch(`${VDK_BLUEPRINTS_BASE_URL}/rules?ref=main`, { headers })

    if (!response.ok) {
      spinner.fail('Failed to connect to VDK-Blueprints repository.')
      throw new Error(`Failed to fetch blueprint list. Status: ${response.status}`)
    }

    const data = await response.json()
    spinner.succeed('Successfully connected to VDK-Blueprints repository.')
    return data.filter((item) => item.type === 'file' && item.name.endsWith('.mdc'))
  } catch (error) {
    // Ora spinner might not be initialized if fetch fails, so check before using
    if (ora.isSpinning) {
      ora().stop()
    }
    console.error(chalk.red(`Error: ${error.message}`))
    return []
  }
}

/**
 * Downloads the content of a specific rule file.
 * @param {string} downloadUrl - The URL to download the file from.
 * @returns {Promise<string>} A promise that resolves to the content of the file.
 */
async function downloadRule(downloadUrl) {
  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download rule. Status: ${response.status}`)
    }
    return await response.text()
  } catch (error) {
    console.error(chalk.red(`Error downloading rule from ${downloadUrl}: ${error.message}`))
    return null
  }
}

export { downloadRule, fetchRuleList }
