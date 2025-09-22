/**
 * Hub Status Utilities
 * ------------------
 * Shared utilities for checking and displaying Hub status across commands
 */

import { colors } from '../utils/cli-styles.js'

/**
 * Get detailed Hub status information
 * @param {Object} hubOps - Hub operations instance
 * @returns {Promise<Object>} Hub status details
 */
export async function getHubStatus(hubOps) {
  if (!hubOps) {
    return {
      available: false,
      connected: false,
      error: 'Hub operations not available'
    }
  }

  try {
    const status = hubOps.getStatus()
    const connectivity = await hubOps.testConnection()

    return {
      available: true,
      connected: connectivity.success,
      status,
      connectivity,
      session: hubOps.getSession()
    }
  } catch (error) {
    return {
      available: true,
      connected: false,
      error: error.message
    }
  }
}

/**
 * Format Hub status for table display
 * @param {Object} hubStatus - Hub status from getHubStatus
 * @returns {Array} Table row data [name, status, details]
 */
export function formatHubStatusForTable(hubStatus) {
  if (!hubStatus.available) {
    return ['VDK Hub Integration', 'error', 'Cannot connect to VDK Hub']
  }

  if (hubStatus.connected) {
    return [
      'VDK Hub Integration',
      'success',
      `Connected (${hubStatus.connectivity.latency}ms)\nVersion: ${hubStatus.connectivity.version}`
    ]
  }

  if (hubStatus.error) {
    return ['VDK Hub Integration', 'error', hubStatus.error]
  }

  return ['VDK Hub Integration', 'warning', 'Hub available but connection failed']
}

/**
 * Display detailed Hub status (for hub-status command)
 * @param {Object} hubStatus - Hub status from getHubStatus
 * @param {boolean} verbose - Show verbose details
 */
export function displayDetailedHubStatus(hubStatus, verbose = false) {
  if (!hubStatus.available) {
    console.log(`Hub Integration: ${colors.error('✗ Not Available')}`)
    console.log(`Error: ${hubStatus.error}`)
    return
  }

  const { status: hubStatusData, connectivity, session } = hubStatus

  // Core status information
  console.log(
    `Hub Integration: ${hubStatusData.initialized ? colors.success('✓ Initialized') : colors.error('✗ Not Initialized')}`
  )
  console.log(
    `Hub Connected: ${hubStatusData.hubConnected ? colors.success('✓ Connected') : colors.error('✗ Disconnected')}`
  )
  console.log(`Telemetry: ${hubStatusData.telemetryEnabled ? colors.success('✓ Enabled') : colors.warning('✗ Disabled')}`)

  if (session) {
    console.log(`Session ID: ${session.sessionId}`)
    console.log(`Uptime: ${Math.round(session.uptime / 1000)}s`)
  }

  // Connection details
  if (connectivity.success) {
    console.log(`Connection: ${colors.success('✓ Connected')} (${connectivity.latency}ms)`)
    console.log(`Hub Version: ${connectivity.version}`)

    if (verbose && connectivity.capabilities) {
      console.log(`\n${colors.cyan('🔍 Detailed Status:')}`)

      console.log(`\nHub Capabilities:`)
      Object.entries(connectivity.capabilities).forEach(([key, value]) => {
        const status = value ? colors.success('✓') : colors.error('✗')
        console.log(`  ${status} ${key}`)
      })

      if (connectivity.limits) {
        console.log(`\nRate Limits:`)
        console.log(`  Daily Requests: ${connectivity.limits.dailyRequests || 'Unlimited'}`)
        console.log(`  Concurrent: ${connectivity.limits.concurrent || 'Unlimited'}`)
      }

      if (connectivity.features) {
        console.log(`\nEnabled Features:`)
        connectivity.features.forEach((feature) => {
          console.log(`  • ${feature}`)
        })
      }
    }
  } else {
    console.log(`Connection: ${colors.error('✗ Failed')} (${connectivity.error || hubStatus.error})`)
  }
}

/**
 * Display troubleshooting tips for connection issues
 */
export function displayTroubleshootingTips() {
  console.log(`\n${colors.cyan('🔧 Troubleshooting Tips:')}`)
  console.log('• Check your internet connection')
  console.log('• Verify VDK_HUB_URL environment variable')
  console.log('• Try running: vdk init --force')
  console.log('• Check firewall and proxy settings')
  console.log('• Visit https://vdk.dev/docs/troubleshooting for more help')
}