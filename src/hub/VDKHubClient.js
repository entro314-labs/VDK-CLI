/**
 * VDKHubClient - Complete VDK Hub API Integration
 *
 * Implements all Hub API endpoints as documented in CLI-HUB-API-GUIDE.md:
 * - Health checks and connectivity
 * - Blueprint synchronization with incremental updates
 * - Package generation and download
 * - Telemetry collection (usage, errors, integrations)
 * - Version compatibility checking
 * - Analytics and deployment
 *
 * Features:
 * - Anonymous and authenticated operations
 * - Retry logic with exponential backoff
 * - Rate limiting awareness
 * - Graceful error handling and fallbacks
 * - Comprehensive telemetry collection
 */

import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * VDK Hub API Client
 * Implements complete Hub integration as per API specification
 */
export class VDKHubClient {
  constructor(config = {}) {
    this.baseUrl = config.hubUrl || process.env.VDK_HUB_URL || 'https://vdk.tools';
    this.apiUrl = `${this.baseUrl}/api`;
    this.apiKey = config.apiKey || process.env.VDK_HUB_API_KEY;
    this.clientVersion = config.clientVersion || process.env.VDK_CLI_VERSION || '2.0.0';
    this.timeout = config.timeout || parseInt(process.env.VDK_HUB_TIMEOUT || '30000', 10);
    this.retryAttempts =
      config.retryAttempts || parseInt(process.env.VDK_HUB_RETRY_ATTEMPTS || '3', 10);
    this.telemetryEnabled =
      config.telemetryEnabled !== false && process.env.VDK_TELEMETRY_ENABLED !== 'false';

    // Authentication
    this.authTokenPath = path.join(__dirname, '..', '..', '.vdk-hub-auth');
    this.authToken = null;
  }

  // ============================================================================
  // HEALTH CHECK & CONNECTIVITY
  // ============================================================================

  /**
   * Test Hub connectivity and get version info
   * Endpoint: GET /api/health
   */
  async ping() {
    const startTime = Date.now();

    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
        timeout: 5000, // Shorter timeout for ping
        returnResponse: true, // Get raw response to handle status ourselves
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          status: data.status,
          version: data.version,
          timestamp: data.timestamp,
          latency,
        };
      } else {
        return {
          success: false,
          status: 'unhealthy',
          latency,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        status: 'unreachable',
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // BLUEPRINT SYNCHRONIZATION
  // ============================================================================

  /**
   * Sync blueprints from Hub to CLI with incremental updates
   * Endpoint: GET /api/cli/sync/blueprints
   */
  async syncBlueprints(since = null, options = {}) {
    try {
      const params = new URLSearchParams();

      if (since) {
        params.set('since', since);
      }

      if (options.limit) {
        params.set('limit', Math.min(options.limit, 500).toString());
      } else {
        params.set('limit', '100');
      }

      if (options.category) {
        params.set('category', options.category);
      }

      if (options.kind) {
        params.set('kind', options.kind);
      }

      if (options.includeL4 === true || options.include_l4 === true) {
        params.set('includeL4', 'true');
      }

      const endpoint = `/cli/sync/blueprints?${params}`;
      const data = await this.makeRequest(endpoint, {
        method: 'GET',
        authenticated: false, // Optional auth
      });

      return {
        blueprints: data.blueprints || [],
        lastSyncTime: data.lastSyncTime,
        totalBlueprints: data.totalBlueprints || 0,
        changes: data.changes || { added: [], updated: [], removed: [] },
        metadata: data.metadata || {},
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }

      // Network error - return empty result to allow fallback to local blueprints
      console.warn(chalk.yellow(`Blueprint sync failed: ${error.message}`));
      return {
        blueprints: [],
        lastSyncTime: new Date().toISOString(),
        totalBlueprints: 0,
        changes: { added: [], updated: [], removed: [] },
        metadata: { syncType: 'failed', error: error.message },
      };
    }
  }

  // ============================================================================
  // PACKAGE GENERATION & DOWNLOAD
  // ============================================================================

  /**
   * Generate custom blueprint packages based on project analysis
   * Endpoint: POST /api/cli/generate
   */
  async generatePackage(packageRequest) {
    try {
      const data = await this.makeRequest('/cli/generate', {
        method: 'POST',
        body: JSON.stringify(packageRequest),
        authenticated: false, // Optional auth
      });

      const normalizedData = this.validateGeneratedPackageResponse(data);

      return {
        packageId: normalizedData.packageId,
        downloadUrl: normalizedData.downloadUrl,
        packageType: normalizedData.packageType,
        ruleCount: normalizedData.ruleCount, // Note: API uses 'ruleCount' not 'blueprintCount'
        fileSize: normalizedData.fileSize,
        expiresAt: normalizedData.expiresAt,
        createdAt: normalizedData.createdAt,
        metadata: normalizedData.metadata || {},
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }
      throw new VDKHubError(`Package generation error: ${error.message}`, 0, 'NETWORK_ERROR', true);
    }
  }

  /**
   * Download generated blueprint package
   * Endpoint: GET /api/cli/packages/{packageId}
   */
  async downloadPackage(packageId) {
    try {
      const response = await this.makeRequest(`/cli/packages/${packageId}`, {
        method: 'GET',
        authenticated: false, // Optional auth
        returnResponse: true, // Return the Response object for binary handling
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new VDKHubError('Package not found', 404, 'NOT_FOUND', false);
        }
        if (response.status === 410) {
          throw new VDKHubError('Package expired', 410, 'EXPIRED', false);
        }
        throw new VDKHubError(
          'Package download failed',
          response.status,
          'DOWNLOAD_FAILED',
          response.status >= 500
        );
      }

      const contentType = response.headers.get('content-type');
      const contentDisposition = response.headers.get('content-disposition');
      const packageType = response.headers.get('x-vdk-package-type');
      const ruleCount = response.headers.get('x-vdk-rule-count');

      let content;
      if (contentType?.includes('application/zip')) {
        content = await response.arrayBuffer();
      } else if (contentType?.includes('text/x-shellscript')) {
        content = await response.text();
      } else if (contentType?.includes('application/json')) {
        content = await response.json();
      } else {
        content = await response.text();
      }

      return {
        content,
        contentType,
        packageType,
        ruleCount: ruleCount ? parseInt(ruleCount, 10) : undefined,
        fileName: this.extractFileName(contentDisposition),
        headers: {
          contentType,
          contentDisposition,
          packageType,
          ruleCount,
        },
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }
      throw new VDKHubError(`Package download error: ${error.message}`, 0, 'NETWORK_ERROR', true);
    }
  }

  // ============================================================================
  // TELEMETRY COLLECTION
  // ============================================================================

  /**
   * Send CLI usage analytics
   * Endpoint: POST /api/cli/telemetry/usage
   */
  async sendUsageTelemetry(events) {
    if (!this.telemetryEnabled) {
      return { success: true, message: 'Telemetry disabled' };
    }

    try {
      // Ensure events is an array
      const eventArray = Array.isArray(events) ? events : [events];

      // Validate batch size
      if (eventArray.length > 50) {
        throw new Error('Usage telemetry batch size cannot exceed 50 events');
      }

      const response = await this.makeRequest('/cli/telemetry/usage', {
        method: 'POST',
        body: JSON.stringify(eventArray),
        authenticated: false, // Anonymous telemetry
        skipRetry: true, // Don't retry telemetry to avoid spamming
        returnResponse: true, // Get raw response to check status
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: data.message,
          processed: data.processed,
          successful: data.successful,
          failed: data.failed,
        };
      } else {
        // Don't throw for telemetry errors - log and continue
        console.warn(chalk.yellow(`Usage telemetry failed: HTTP ${response.status}`));
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      // Telemetry errors should not fail the main operation
      console.warn(chalk.yellow(`Usage telemetry error: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Report CLI errors for debugging
   * Endpoint: POST /api/cli/telemetry/errors
   */
  async sendErrorTelemetry(events) {
    if (!this.telemetryEnabled) {
      return { success: true, message: 'Telemetry disabled' };
    }

    try {
      const eventArray = Array.isArray(events) ? events : [events];

      if (eventArray.length > 20) {
        throw new Error('Error telemetry batch size cannot exceed 20 events');
      }

      const data = await this.makeRequest('/cli/telemetry/errors', {
        method: 'POST',
        body: JSON.stringify(eventArray),
        authenticated: false,
        skipRetry: true,
      });

      return { success: true, message: data.message };
    } catch (error) {
      console.warn(chalk.yellow(`Error telemetry error: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Track IDE/AI assistant integration events
   * Endpoint: POST /api/cli/telemetry/integrations
   */
  async sendIntegrationTelemetry(events) {
    if (!this.telemetryEnabled) {
      return { success: true, message: 'Telemetry disabled' };
    }

    try {
      const eventArray = Array.isArray(events) ? events : [events];

      if (eventArray.length > 30) {
        throw new Error('Integration telemetry batch size cannot exceed 30 events');
      }

      const data = await this.makeRequest('/cli/telemetry/integrations', {
        method: 'POST',
        body: JSON.stringify(eventArray),
        authenticated: false,
        skipRetry: true,
      });

      return { success: true, message: data.message };
    } catch (error) {
      console.warn(chalk.yellow(`Integration telemetry error: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // VERSION COMPATIBILITY
  // ============================================================================

  /**
   * Check version compatibility between CLI and Hub
   * Endpoint: POST /api/v1/version/check
   */
  async checkVersionCompatibility(versionInfo) {
    try {
      const data = await this.makeRequest('/v1/version/check', {
        method: 'POST',
        body: JSON.stringify(versionInfo),
        authenticated: false,
      });
      return {
        success: data.success,
        compatibility: data.compatibility,
        versions: data.versions,
        updates: data.updates,
        environment: data.environment,
        recommendations: data.recommendations,
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }

      // Return fallback compatibility info
      console.warn(chalk.yellow(`Version check failed: ${error.message}`));
      return {
        success: false,
        compatibility: {
          compatible: true, // Assume compatible on error
          upgradeRecommended: false,
        },
        error: error.message,
      };
    }
  }

  // ============================================================================
  // DEPLOYMENT & ANALYTICS
  // ============================================================================

  /**
   * Deploy blueprints from CLI to Hub
   * Endpoint: POST /api/deploy
   */
  async deployBlueprints(deploymentData) {
    try {
      const response = await this.makeRequest('/deploy', {
        method: 'POST',
        body: JSON.stringify(deploymentData),
        authenticated: false, // Optional auth
      });

      if (!response.ok) {
        throw new VDKHubError(
          'Blueprint deployment failed',
          response.status,
          'DEPLOYMENT_FAILED',
          response.status >= 500
        );
      }

      const data = await response.json();
      return {
        success: data.success,
        hubUrl: data.hubUrl,
        blueprintsCount: data.blueprintsCount,
        deploymentId: data.deploymentId,
        message: data.message,
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }
      throw new VDKHubError(`Deployment error: ${error.message}`, 0, 'NETWORK_ERROR', true);
    }
  }

  /**
   * Get CLI usage analytics
   * Endpoint: GET /api/cli/analytics
   */
  async getAnalytics(options = {}) {
    try {
      const params = new URLSearchParams();

      if (options.timeframe) {
        params.set('timeframe', options.timeframe);
      }
      if (options.command) {
        params.set('command', options.command);
      }
      if (options.platform) {
        params.set('platform', options.platform);
      }

      const endpoint = `/cli/analytics?${params}`;
      const response = await this.makeRequest(endpoint, {
        method: 'GET',
        authenticated: true, // Requires service role
      });

      if (!response.ok) {
        throw new VDKHubError(
          'Analytics fetch failed',
          response.status,
          'ANALYTICS_FAILED',
          response.status >= 500
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }
      throw new VDKHubError(`Analytics error: ${error.message}`, 0, 'NETWORK_ERROR', true);
    }
  }

  // ============================================================================
  // BLUEPRINT RECOMMENDATIONS (V1 API)
  // ============================================================================

  /**
   * Get blueprint recommendations based on project analysis
   * Endpoint: POST /api/v1/blueprints/recommend (replaces /api/v1/rules/recommend)
   */
  async getBlueprintRecommendations(projectAnalysis) {
    try {
      const response = await this.makeRequest('/v1/blueprints/recommend', {
        method: 'POST',
        body: JSON.stringify(projectAnalysis),
        authenticated: false, // Optional auth
      });

      if (!response.ok) {
        throw new VDKHubError(
          'Blueprint recommendations failed',
          response.status,
          'RECOMMENDATIONS_FAILED',
          response.status >= 500
        );
      }

      const data = await response.json();
      return {
        recommendations: data.recommendations || [],
        totalFound: data.totalFound || 0,
        projectSignature: data.projectSignature,
        recommendationId: data.recommendationId,
        generatedAt: data.generatedAt,
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }

      // Return empty recommendations on error
      console.warn(chalk.yellow(`Blueprint recommendations failed: ${error.message}`));
      return {
        recommendations: [],
        totalFound: 0,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // COMMUNITY BLUEPRINT OPERATIONS
  // ============================================================================

  /**
   * Fetch community blueprint by ID
   * Endpoint: GET /api/community/blueprints/{id}
   */
  async getCommunityBlueprint(blueprintId) {
    try {
      const endpoint = `/community/blueprints/${blueprintId}`;
      const fetchOnce = async () =>
        await this.makeRequest(endpoint, {
          method: 'GET',
          skipRetry: true,
        });

      let data;
      try {
        data = await fetchOnce();
      } catch (error) {
        if (
          error instanceof VDKHubError &&
          error.statusCode === 503 &&
          this.retryAttempts === 1
        ) {
          data = await fetchOnce();
        } else {
          throw error;
        }
      }

      return {
        id: data.id || data.blueprint_id,
        slug: data.slug,
        title: data.title || data.name,
        description: data.description,
        content: data.content || data.body,
        author: data.author,
        metadata: data.metadata || data.meta || {},
        stats: data.stats,
        created: data.created,
        updated: data.updated,
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        if (error.statusCode === 404 || error.errorCode === 'NOT_FOUND') {
          return null;
        }

        throw new VDKHubError(
          'Community blueprint fetch failed',
          error.statusCode,
          error.errorCode,
          error.retryable
        );
      }

      // Network error - return null to allow fallback
      console.warn(chalk.yellow(`Community blueprint fetch failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Search community blueprints (alias for compatibility)
   */
  async searchBlueprints(criteria = {}) {
    return this.searchCommunityBlueprints(criteria);
  }

  /**
   * Search community blueprints
   * Endpoint: GET /api/community/blueprints
   */
  async searchCommunityBlueprints(criteria = {}) {
    try {
      const params = new URLSearchParams();

      if (criteria.search) params.set('search', criteria.search);
      if (criteria.category) params.set('category', criteria.category);
      if (criteria.framework) params.set('framework', criteria.framework);
      if (criteria.platform) params.set('platform', criteria.platform);
      if (criteria.language) params.set('language', criteria.language);
      if (criteria.tags)
        params.set('tags', Array.isArray(criteria.tags) ? criteria.tags.join(',') : criteria.tags);
      if (criteria.author) params.set('author', criteria.author);
      if (criteria.sort) params.set('sort', criteria.sort);
      if (criteria.limit !== undefined) params.set('limit', criteria.limit.toString());
      if (criteria.offset !== undefined) params.set('offset', criteria.offset.toString());

      const query = params.toString().replace(/\+/g, '%20');
      const plusEncodedSearch = criteria.search
        ? encodeURIComponent(criteria.search).replace(/%20/g, '+')
        : null;
      const endpoint = `/community/blueprints?${query}${plusEncodedSearch ? `&search_plus=${plusEncodedSearch}` : ''}`;
      const data = await this.makeRequest(endpoint, {
        method: 'GET',
      });

      return {
        blueprints: data.blueprints || [],
        pagination: data.pagination || {},
        filters: data.filters || {},
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }

      // Network error - return empty results
      console.warn(chalk.yellow(`Community blueprint search failed: ${error.message}`));
      return {
        blueprints: [],
        pagination: { total: 0, limit: 20, offset: 0 },
        filters: {},
      };
    }
  }

  /**
   * Get trending community blueprints
   * Endpoint: GET /api/community/blueprints/trending
   */
  async getTrendingBlueprints(options = {}) {
    try {
      const params = new URLSearchParams();

      if (options.timeframe) params.set('timeframe', options.timeframe);
      if (options.category) params.set('category', options.category);
      if (options.limit) params.set('limit', options.limit.toString());

      const endpoint = `/community/blueprints/trending?${params.toString().replace(/\+/g, '%20')}`;
      const data = await this.makeRequest(endpoint, {
        method: 'GET',
      });

      return {
        blueprints: data.blueprints || [],
        timeframe: data.timeframe,
        generatedAt: data.generatedAt,
        meta: data.meta || {},
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }

      // Network error - return empty results
      console.warn(chalk.yellow(`Trending blueprints fetch failed: ${error.message}`));
      return {
        blueprints: [],
        timeframe: options.timeframe || '7d',
        generatedAt: new Date().toISOString(),
        meta: {},
      };
    }
  }

  /**
   * Track community blueprint usage
   * Endpoint: POST /api/community/blueprints/{id}/usage
   */
  async trackCommunityBlueprintUsage(blueprintId, usageData) {
    if (!this.telemetryEnabled && !this.apiKey) {
      return { success: true, message: 'Telemetry disabled' };
    }

    try {
      const data = await this.makeRequest(`/community/blueprints/${blueprintId}/usage`, {
        method: 'POST',
        body: JSON.stringify(usageData),
        skipRetry: true, // Don't retry telemetry to avoid spamming
      });

      return data;
    } catch (error) {
      // Tracking errors should not fail the main operation
      console.warn(chalk.yellow(`Usage tracking error: ${error.message}`));
      if (error instanceof VDKHubError && error.statusCode) {
        return { success: false, error: `HTTP ${error.statusCode}` };
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Get community blueprint categories
   * Endpoint: GET /api/community/categories
   */
  async getCommunityCategories() {
    try {
      const data = await this.makeRequest('/community/categories', {
        method: 'GET',
      });
      return {
        categories: data.categories || [],
        stats: data.stats || {},
        meta: data.meta || {},
      };
    } catch (error) {
      // Network error - return empty categories
      console.warn(chalk.yellow(`Categories fetch failed: ${error.message}`));
      return {
        categories: [],
        stats: {},
        meta: {},
      };
    }
  }

  // ============================================================================
  // HTTP CLIENT & ERROR HANDLING
  // ============================================================================

  /**
   * Make HTTP request to Hub API with retry logic and error handling
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VDK-Version': this.clientVersion,
        ...options.headers,
      },
      ...(typeof AbortSignal?.timeout === 'function'
        ? { signal: AbortSignal.timeout(options.timeout || this.timeout) }
        : {}),
    };

    // Add authentication if required and available
    if (options.authenticated !== false) {
      const authToken = this.apiKey || (await this.loadAuthToken());
      if (authToken) {
        requestOptions.headers.Authorization = `Bearer ${authToken}`;
      } else if (options.authenticated === true) {
        throw new VDKHubError('Authentication required', 401, 'AUTH_REQUIRED', false);
      }
    }

    // Add request body if provided
    if (options.body) {
      requestOptions.body = options.body;
    }

    // Retry logic with exponential backoff
    if (options.skipRetry) {
      const response = await fetch(url, requestOptions);
      return options.returnResponse ? response : await this.handleResponse(response);
    }

    return await this.retryWithBackoff(async () => {
      const response = await fetch(url, requestOptions);
      return options.returnResponse ? response : await this.handleResponse(response);
    }, this.retryAttempts);
  }

  /**
   * Handle HTTP response and convert to appropriate format
   */
  async handleResponse(response) {
    const canReadJson = typeof response?.json === 'function';
    const contentType = response?.headers?.get?.('content-type') || '';

    if (response.ok) {
      if (canReadJson && (contentType.includes('application/json') || contentType === '')) {
        try {
          return await response.json();
        } catch {
          return response;
        }
      }

      return response;
    }

    // Handle errors based on status code
    const errorData = canReadJson
      ? await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      : { error: `HTTP ${response.status}` };
    const message = errorData.error || errorData.message || `HTTP ${response.status}`;

    switch (response.status) {
      case 400:
        throw new VDKHubError(message, 400, 'BAD_REQUEST', false);
      case 401:
        throw new VDKHubError('Authentication failed', 401, 'UNAUTHORIZED', false);
      case 403:
        throw new VDKHubError('Access denied', 403, 'FORBIDDEN', false);
      case 404:
        throw new VDKHubError('Resource not found', 404, 'NOT_FOUND', false);
      case 409:
        throw new VDKHubError(message, 409, 'CONFLICT', true);
      case 410:
        throw new VDKHubError('Resource expired', 410, 'GONE', false);
      case 429:
        throw new VDKHubError('Rate limit exceeded', 429, 'RATE_LIMITED', true);
      case 500:
        throw new VDKHubError('Server error', 500, 'SERVER_ERROR', true);
      case 503:
        throw new VDKHubError('Service unavailable', 503, 'UNAVAILABLE', true);
      default:
        throw new VDKHubError(message, response.status, 'UNKNOWN', response.status >= 500);
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryWithBackoff(operation, maxAttempts = 3, baseDelay = 1000) {
    let attempt = 1;

    while (attempt <= maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts || !(error instanceof VDKHubError) || !error.retryable) {
          throw error;
        }

        const delay = baseDelay * 2 ** (attempt - 1);
        console.warn(
          chalk.yellow(
            `Request failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`
          )
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  // ============================================================================
  // AUTHENTICATION MANAGEMENT
  // ============================================================================

  /**
   * Check authentication status
   */
  async checkAuth() {
    try {
      // Try to load cached auth token
      this.authToken = await this.loadAuthToken();

      if (!this.authToken) {
        return { authenticated: false };
      }

      // Verify token with Hub API
      const data = await this.makeRequest('/auth/verify', {
        method: 'GET',
        authenticated: true,
      });

      return {
        authenticated: true,
        user: data.user,
        email: data.email,
      };
    } catch (error) {
      console.warn(chalk.yellow(`Auth check failed: ${error.message}`));
      // Token invalid, clear it
      await this.clearAuthToken();
      return { authenticated: false };
    }
  }

  /**
   * Initiate authentication flow
   */
  async promptForAuth() {
    console.log('');
    console.log(chalk.cyan('🔐 VDK Hub Authentication'));
    console.log(chalk.gray('VDK Hub provides instant sharing with temporary links and analytics'));
    console.log('');

    // Import readline for user input
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(chalk.yellow('Would you like to authenticate? (y/n): '), answer => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  /**
   * Perform OAuth authentication
   */
  async initiateAuth() {
    try {
      console.log(chalk.cyan('🔐 Starting Hub authentication...'));

      // For now, use a simplified token-based approach
      // TODO: Implement full OAuth flow with callback server
      console.log(chalk.yellow('📋 Please visit the VDK Hub to generate an API token:'));
      console.log(chalk.blue(`${this.baseUrl}/profile`));
      console.log('');

      // Import readline for token input
      const readline = await import('node:readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise((resolve, reject) => {
        rl.question(chalk.yellow('Enter your API token: '), async token => {
          rl.close();

          if (!token || token.trim().length === 0) {
            reject(new Error('No token provided'));
            return;
          }

          try {
            // Validate token by making a test API call
            const testResponse = await this.makeRequest('/auth/verify', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token.trim()}`,
              },
              authenticated: false,
            });

            if (testResponse) {
              await this.saveAuthToken(token.trim());
              this.authToken = token.trim();
              console.log(chalk.green('✅ Authentication successful!'));
              resolve(true);
            } else {
              reject(new Error('Invalid token'));
            }
          } catch (error) {
            reject(new Error(`Token validation failed: ${error.message}`));
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          rl.close();
          reject(new Error('Authentication timeout'));
        }, 300000);
      });
    } catch (error) {
      throw new VDKHubError(`Authentication failed: ${error.message}`, 0, 'AUTH_FAILED', false);
    }
  }

  /**
   * Validate and normalize generated package payload returned by Hub.
   */
  validateGeneratedPackageResponse(data) {
    if (!data || typeof data !== 'object') {
      throw new VDKHubError(
        'Invalid package generation response from Hub',
        502,
        'INVALID_RESPONSE',
        true
      );
    }

    const requiredStringFields = ['packageId', 'downloadUrl', 'packageType', 'expiresAt'];
    const missingFields = requiredStringFields.filter(field => {
      const value = data[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingFields.length > 0) {
      throw new VDKHubError(
        `Invalid package generation response from Hub: missing ${missingFields.join(', ')}`,
        502,
        'INVALID_RESPONSE',
        true
      );
    }

    const normalizedRuleCount = Number(data.ruleCount);
    if (!Number.isFinite(normalizedRuleCount) || normalizedRuleCount < 0) {
      throw new VDKHubError(
        'Invalid package generation response from Hub: ruleCount must be a valid number',
        502,
        'INVALID_RESPONSE',
        true
      );
    }

    const normalizedFileSize = Number(data.fileSize);
    if (!Number.isFinite(normalizedFileSize) || normalizedFileSize < 0) {
      throw new VDKHubError(
        'Invalid package generation response from Hub: fileSize must be a valid number',
        502,
        'INVALID_RESPONSE',
        true
      );
    }

    if (Number.isNaN(new Date(data.expiresAt).getTime())) {
      throw new VDKHubError(
        'Invalid package generation response from Hub: expiresAt is not a valid date',
        502,
        'INVALID_RESPONSE',
        true
      );
    }

    return {
      ...data,
      ruleCount: normalizedRuleCount,
      fileSize: normalizedFileSize,
    };
  }

  /**
   * Upload blueprint to VDK Hub for sharing
   */
  async uploadBlueprint({ blueprint, status, expires_at, metadata }) {
    try {
      if (!this.authToken) {
        throw new VDKHubError('Authentication required', 401, 'AUTH_REQUIRED', false);
      }

      const payload = {
        blueprint: blueprint,
        status: status || 'pending_confirmation',
        expires_at: expires_at,
        metadata: metadata,
      };

      const result = await this.makeRequest('/blueprints/upload', {
        method: 'POST',
        body: JSON.stringify(payload),
        authenticated: true,
      });

      return {
        blueprintId: result.blueprint_id,
        tempUrl: result.temp_url,
        expiresAt: result.expires_at,
        confirmationRequired: result.confirmation_required,
      };
    } catch (error) {
      if (error instanceof VDKHubError) {
        throw error;
      }

      if (error.message.includes('fetch')) {
        // Network error - provide proper error handling
        throw new VDKHubError(
          'VDK Hub is currently unreachable. Please check your internet connection and try again.',
          0,
          'NETWORK_ERROR',
          true
        );
      }
      throw new VDKHubError(`Upload error: ${error.message}`, 0, 'UPLOAD_ERROR', true);
    }
  }

  /**
   * Track blueprint usage for analytics
   */
  async trackBlueprintUsage(blueprintId, deploymentResult) {
    if (!this.telemetryEnabled) {
      return { success: true, message: 'Telemetry disabled' };
    }

    try {
      const payload = {
        blueprint_id: blueprintId,
        deployment_success: deploymentResult.success,
        platforms: deploymentResult.platforms,
        adaptation_score: deploymentResult.compatibilityScore || 0,
        project_context: {
          framework: deploymentResult.projectContext?.framework,
          language: deploymentResult.projectContext?.language,
        },
      };

      const response = await this.makeRequest(`/community/blueprints/${blueprintId}/usage`, {
        method: 'POST',
        body: JSON.stringify(payload),
        authenticated: false, // Anonymous usage tracking
        skipRetry: true,
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: data.message };
      } else {
        console.warn(chalk.yellow(`Usage tracking failed: HTTP ${response.status}`));
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.warn(chalk.yellow(`Usage tracking error: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async loadAuthToken() {
    try {
      const token = await fs.readFile(this.authTokenPath, 'utf8');
      return token.trim();
    } catch {
      return null;
    }
  }

  async saveAuthToken(token) {
    try {
      await fs.writeFile(this.authTokenPath, token, { mode: 0o600 });
    } catch (error) {
      console.warn(chalk.yellow(`Failed to save auth token: ${error.message}`));
    }
  }

  async clearAuthToken() {
    try {
      await fs.unlink(this.authTokenPath);
    } catch {
      // File doesn't exist, that's fine
    }
    this.authToken = null;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract filename from Content-Disposition header
   */
  extractFileName(contentDisposition) {
    if (!contentDisposition) return null;

    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      return match[1].replace(/['"]/g, '');
    }
    return null;
  }

  /**
   * Generate session ID for telemetry
   */
  generateSessionId() {
    return `cli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if telemetry is enabled
   */
  isTelemetryEnabled() {
    return this.telemetryEnabled;
  }

  /**
   * Create mock upload result for testing purposes
   */
  createMockUploadResult(blueprint, metadata = {}) {
    const mockId = `mock-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    return {
      blueprintId: mockId,
      tempUrl: `https://vdk.tools/temp/${mockId}`,
      expiresAt: expiresAt.toISOString(),
      confirmationRequired: true,
      metadata: {
        title: blueprint.title || 'Mock Blueprint',
        ...metadata,
      },
    };
  }

  /**
   * Share team configuration with VDK Hub
   */
  async shareTeamConfig(teamId, config) {
    try {
      const response = await this.makeRequest(`/teams/${teamId}/config`, {
        method: 'POST',
        body: JSON.stringify({
          main: config.main,
          rules: config.rules,
          settings: config.settings,
          teamName: config.teamName,
        }),
        authenticated: true,
      });

      return {
        shareUrl: response.shareUrl,
        expiresAt: response.expiresAt,
        lastUpdated: response.lastUpdated,
      };
    } catch (error) {
      throw new VDKHubError(
        `Failed to share team config: ${error.message}`,
        0,
        'TEAM_SHARE_ERROR',
        true
      );
    }
  }

  /**
   * Get team configuration from VDK Hub
   */
  async getTeamConfig(teamId) {
    try {
      const response = await this.makeRequest(`/teams/${teamId}/config`, {
        method: 'GET',
        authenticated: true,
      });

      return {
        teamId: response.teamId,
        name: response.name,
        lastUpdated: response.lastUpdated,
        main: response.main,
        rules: response.rules,
        settings: response.settings,
      };
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw new VDKHubError(
        `Failed to get team config: ${error.message}`,
        0,
        'TEAM_GET_ERROR',
        true
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      apiUrl: this.apiUrl,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      telemetryEnabled: this.telemetryEnabled,
      hasApiKey: !!this.apiKey,
    };
  }
}

/**
 * Custom error class for VDK Hub API errors
 */
export class VDKHubError extends Error {
  constructor(message, statusCode, errorCode, retryable = false) {
    super(message);
    this.name = 'VDKHubError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryable = retryable;
  }
}

/**
 * Factory function to create VDK Hub client
 */
export function createVDKHubClient(config = {}) {
  return new VDKHubClient(config);
}
