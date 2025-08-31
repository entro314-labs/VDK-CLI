/**
 * HubStatusCommand
 * -----------------------
 * Check VDK Hub connection and status.
 * Provides comprehensive Hub connectivity and session information.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import { colors } from '../../utils/cli-styles.js'

export class HubStatusCommand extends BaseCommand {
  constructor() {
    super('hub-status', 'Check VDK Hub connection and status')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command.option('-v, --verbose', 'Show detailed status information', false)
  }

  /**
   * Execute the hub status command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    try {
      const { quickHubOperations } = await import('../../hub/index.js')
      const hubOps = await quickHubOperations()

      await this.displayHubStatus(hubOps, options.verbose)

      this.trackSuccess({
        hubConnected: hubOps ? true : false,
        verbose: options.verbose,
      })

      return { success: true, hubAvailable: hubOps ? true : false }
    } catch (error) {
      this.exitWithError(`Hub status check failed: ${error.message}`, error)
    }
  }

  /**
   * Display comprehensive Hub status
   */
  async displayHubStatus(hubOps, verbose) {
    const status = hubOps.getStatus()
    const session = hubOps.getSession()

    // Core status information
    console.log(
      `Hub Integration: ${status.initialized ? colors.success('✓ Initialized') : colors.error('✗ Not Initialized')}`
    )
    console.log(
      `Hub Connected: ${status.hubConnected ? colors.success('✓ Connected') : colors.error('✗ Disconnected')}`
    )
    console.log(`Telemetry: ${status.telemetryEnabled ? colors.success('✓ Enabled') : colors.warning('✗ Disabled')}`)
    console.log(`Session ID: ${session.sessionId}`)
    console.log(`Uptime: ${Math.round(session.uptime / 1000)}s`)

    // Test connectivity
    const spinner = this.createSpinner('Testing Hub connection...')
    spinner.start()

    try {
      const connectivity = await hubOps.testConnection()

      if (connectivity.success) {
        spinner.succeed('Connection test completed')
        console.log(`Connection: ${colors.success('✓ Connected')} (${connectivity.latency}ms)`)
        console.log(`Hub Version: ${connectivity.version}`)

        if (verbose) {
          this.displayVerboseStatus(connectivity, hubOps)
        }
      } else {
        spinner.fail('Connection test failed')
        console.log(`Connection: ${colors.error('✗ Failed')} (${connectivity.error})`)
        this.displayTroubleshootingTips()
      }
    } catch (error) {
      spinner.fail('Connection test failed')
      console.log(`Connection: ${colors.error('✗ Failed')} (${error.message})`)
      this.displayTroubleshootingTips()
    }
  }

  /**
   * Display verbose status information
   */
  displayVerboseStatus(connectivity, hubOps) {
    console.log('\n' + this.colorCyan('🔍 Detailed Status:'))

    if (connectivity.capabilities) {
      console.log(`\nHub Capabilities:`)
      Object.entries(connectivity.capabilities).forEach(([key, value]) => {
        const status = value ? colors.success('✓') : colors.error('✗')
        console.log(`  ${status} ${key}`)
      })
    }

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

  /**
   * Display troubleshooting tips for connection issues
   */
  displayTroubleshootingTips() {
    console.log('\n' + this.colorCyan('🔧 Troubleshooting Tips:'))
    console.log('• Check your internet connection')
    console.log('• Verify VDK_HUB_URL environment variable')
    console.log('• Try running: vdk init --force')
    console.log('• Check firewall and proxy settings')
    console.log('• Visit https://vdk.dev/docs/troubleshooting for more help')
  }
}
