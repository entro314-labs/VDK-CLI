/**
 * VDK Hub Integration Module
 *
 * Complete implementation of VDK Hub API integration according to
 * CLI-HUB-API-GUIDE.md and v1-endpoints.md specifications.
 *
 * Exports:
 * - HubIntegration: Main integration manager
 * - VDKHubClient: Low-level API client
 * - TelemetryManager: Telemetry collection and batching
 * - ConfigManager: Configuration management
 * - Utility functions and factories
 */

// Main integration components
export {
  HubIntegration,
  getGlobalHubIntegration,
  initializeHubIntegration,
  createHubIntegration,
} from './HubIntegration.js'

export {
  VDKHubClient,
  VDKHubError,
  createVDKHubClient,
} from './VDKHubClient.js'

export {
  TelemetryManager,
  createTelemetryManager,
  getGlobalTelemetryManager,
  setGlobalTelemetryManager,
  initializeTelemetry,
} from './TelemetryManager.js'

export {
  ConfigManager,
  getGlobalConfigManager,
  initializeConfig,
  getConfig,
  updateConfig,
  getConfigValue,
} from './ConfigManager.js'

/**
 * Initialize complete Hub integration system
 * This is the main entry point for CLI commands
 */
export async function initializeHub(config = {}) {
  const integration = await initializeHubIntegration(config)
  return integration
}

/**
 * Quick access to common Hub operations
 */
export async function quickHubOperations() {
  const { getGlobalHubIntegration } = await import('./HubIntegration.js')
  const hub = getGlobalHubIntegration()
  await hub.initialize()

  return {
    // Blueprint operations
    syncBlueprints: (options) => hub.syncBlueprints(options),
    generatePackage: (analysis, options) => hub.generatePackage(analysis, options),
    downloadPackage: (packageId, outputPath) => hub.downloadPackage(packageId, outputPath),
    deployBlueprints: (project, blueprints, options) => hub.deployBlueprints(project, blueprints, options),

    // Community blueprint operations
    getCommunityBlueprint: (id) => hub.hubClient?.getCommunityBlueprint(id),
    searchCommunityBlueprints: (criteria) => hub.hubClient?.searchCommunityBlueprints(criteria),
    getTrendingBlueprints: (options) => hub.hubClient?.getTrendingBlueprints(options),
    trackCommunityBlueprintUsage: (id, usage) => hub.hubClient?.trackCommunityBlueprintUsage(id, usage),
    getCommunityCategories: () => hub.hubClient?.getCommunityCategories(),

    // Recommendations and compatibility
    getRecommendations: (analysis) => hub.getBlueprintRecommendations(analysis),
    checkCompatibility: () => hub.checkVersionCompatibility(),

    // Telemetry and tracking
    trackCommand: (command, options) => hub.trackCommand(command, options),
    trackError: (command, error, context) => hub.trackError(command, error, context),
    trackIntegrations: (integrations) => hub.trackIntegrationDetection(integrations),

    // Status and configuration
    getStatus: () => hub.getStatus(),
    getSession: () => hub.getSessionInfo(),
    testConnection: () => hub.testConnectivity(false),

    // Lifecycle
    shutdown: () => hub.shutdown(),
  }
}

/**
 * Create a minimal Hub client for specific operations
 */
export function createMinimalHubClient(hubUrl = null, apiKey = null) {
  return createVDKHubClient({
    hubUrl: hubUrl || process.env.VDK_HUB_URL || 'https://vdk.tools',
    apiKey: apiKey || process.env.VDK_HUB_API_KEY,
    timeout: 30000,
    retryAttempts: 3,
    telemetryEnabled: true,
  })
}

/**
 * Utility function to check if Hub integration is available
 */
export async function isHubAvailable() {
  try {
    const client = createMinimalHubClient()
    const result = await client.ping()
    return result.success
  } catch {
    return false
  }
}

/**
 * Constants and configuration
 */
export const HUB_CONSTANTS = {
  DEFAULT_HUB_URL: 'https://vdk.tools',
  API_VERSION: '2.0.0',
  SUPPORTED_OUTPUT_FORMATS: ['bash', 'zip', 'config'],
  TELEMETRY_BATCH_LIMITS: {
    usage: 50,
    errors: 20,
    integrations: 30,
  },
  RATE_LIMITS: {
    sync: 10, // requests per minute
    generate: 5, // requests per minute
    download: 20, // requests per minute
    telemetry: 100, // requests per minute
  },
}

/**
 * Helper function to create telemetry events
 */
export function createUsageEvent(command, options = {}) {
  return {
    cli_version: options.cliVersion || '2.0.0',
    command: command,
    platform: process.platform,
    node_version: process.version,
    execution_time_ms: options.executionTime || 0,
    success: options.success !== false,
    project_type: options.projectType,
    blueprints_generated: options.blueprintsGenerated || 0,
    integrations_detected: options.integrations || [],
    session_id: options.sessionId || `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    metadata: options.metadata || {},
  }
}

export function createErrorEvent(command, error, options = {}) {
  return {
    cli_version: options.cliVersion || '2.0.0',
    command: command,
    error_type: error.constructor.name,
    error_message: error.message,
    stack_trace: error.stack,
    platform: process.platform,
    node_version: process.version,
    session_id: options.sessionId || `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    context: options.context || {},
  }
}

export function createIntegrationEvent(integrationType, action = 'detected', options = {}) {
  return {
    cli_version: options.cliVersion || '2.0.0',
    integration_type: integrationType,
    action: action,
    success: options.success !== false,
    integration_version: options.integrationVersion,
    configuration_details: options.configurationDetails || {},
    session_id: options.sessionId || `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Version information
 */
export const VERSION_INFO = {
  hubApiVersion: '2.1.0',
  cliApiVersion: '1.0.0',
  schemaVersion: '2.1.0',
  compatibleCliVersions: ['1.0.0', '1.1.0', '1.2.0', '2.0.0'],
}
