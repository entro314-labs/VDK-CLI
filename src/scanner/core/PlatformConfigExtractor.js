import fsSync from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

export class PlatformConfigExtractor {
  constructor(projectPath) {
    this.projectPath = projectPath || process.cwd();
  }

  /**
   * Detect which IDE integrations are actively being used
   * @param {Object} integrationManager - Initialized IntegrationManager
   * @returns {Array} List of active integrations
   */
  async detectActiveIntegrations(integrationManager) {
    const candidateIntegrations = [];
    const allIntegrations = integrationManager.getAllIntegrations();

    // First pass: collect all integrations with medium/high confidence
    for (const integration of allIntegrations) {
      const detection = integration.detectUsage();

      // Consider integration active if confidence is medium or high
      if (detection.confidence === 'medium' || detection.confidence === 'high') {
        candidateIntegrations.push({
          name: integration.name,
          confidence: detection.confidence,
          integration,
        });
      }
    }

    // Second pass: apply priority filtering to avoid conflicts
    return this.filterIntegrationsByPriority(candidateIntegrations);
  }

  /**
   * Filter integrations to select PRIMARY IDE based on actual usage context
   * @param {Array} integrations - Candidate integrations
   * @returns {Array} Single primary IDE integration
   */
  filterIntegrationsByPriority(integrations) {
    if (integrations.length <= 1) {
      return integrations;
    }

    // Check if user explicitly specified an IDE in vdk.config.json
    const configPath = path.join(this.projectPath, 'vdk.config.json');
    let explicitIDE = null;
    try {
      if (fsSync.existsSync(configPath)) {
        const config = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
        explicitIDE = config.ide;
      }
    } catch {
      // Config file doesn't exist or is invalid, continue with detection
    }

    // If user explicitly set an IDE, use that (unless it's not detected)
    if (explicitIDE) {
      const explicitMatch = integrations.find(i => i.name === explicitIDE);
      if (explicitMatch) {
        console.log(chalk.cyan(`🎯 Using explicitly configured IDE: ${explicitIDE}`));
        return [explicitMatch];
      }
    }

    // Detect PRIMARY IDE based on actual usage indicators (not just installation)
    const primaryIDE = this.detectPrimaryIDE(integrations);
    if (primaryIDE) {
      console.log(
        chalk.cyan(
          `🎯 Detected primary IDE: ${primaryIDE.name} (${primaryIDE.confidence} confidence)`
        )
      );

      // Also mention other detected AI assistants
      const aiAssistants = integrations.filter(
        i =>
          i.name !== primaryIDE.name &&
          (i.name.includes('Copilot') || i.name.includes('AI') || i.name.includes('Claude'))
      );

      if (aiAssistants.length > 0) {
        const assistantNames = aiAssistants.map(a => a.name).join(', ');
        console.log(chalk.gray(`🤖 Additional AI assistants detected: ${assistantNames}`));
      }

      return [primaryIDE];
    }

    // Fallback: if no clear primary IDE, ask user to specify
    const ideNames = integrations.map(i => i.name).join(', ');
    console.log(chalk.yellow(`\n⚠️  Multiple IDEs detected: ${ideNames}`));
    console.log(chalk.yellow('💡 To avoid ambiguity, specify your primary IDE:'));
    console.log(chalk.gray('   • Run: vdk init --ide "Your IDE Name"'));
    console.log(chalk.gray('   • Or edit vdk.config.json: {"ide": "Your IDE Name"}'));

    // Default to highest confidence for now
    const highestConfidence = integrations.toSorted((a, b) => {
      const confidenceScore = { high: 3, medium: 2, low: 1 };
      return confidenceScore[b.confidence] - confidenceScore[a.confidence];
    })[0];

    console.log(chalk.yellow(`📝 Using ${highestConfidence.name} as fallback`));
    return [highestConfidence];
  }

  /**
   * Detect the PRIMARY IDE the user is actually using (not just installed)
   * @param {Array} integrations - Candidate integrations
   * @returns {Object|null} Primary IDE or null if ambiguous
   */
  detectPrimaryIDE(integrations) {
    // FIRST: Look for project-specific configuration files (highest priority)
    // These indicate the user's intentional choice for THIS project
    const projectIndicators = {
      Cursor: ['.cursor/', '.cursor/rules/', '.cursorignore'],
      'VS Code': ['.vscode/settings.json', '.vscode/launch.json'],
      Windsurf: ['.windsurf/', '.windsurf/rules/'],
      'JetBrains IDEs': ['.idea/', '*.iml'],
      'Zed Editor': ['.zed/'],
      'Claude Code CLI': ['CLAUDE.md', '.claude/'],
    };

    for (const [ideName, files] of Object.entries(projectIndicators)) {
      const integration = integrations.find(
        i => i.name === ideName || i.name.includes(ideName.split(' ')[0])
      );
      if (!integration) continue;

      const hasProjectConfig = files.some(file => {
        const fullPath = path.join(this.projectPath, file);
        return fsSync.existsSync(fullPath) || (file.endsWith('/') && fsSync.existsSync(fullPath));
      });

      if (hasProjectConfig) {
        return integration;
      }
    }

    // SECOND: Look for strong indicators of active usage (fallback only)
    for (const integration of integrations) {
      const detection = integration.integration.detectUsage();

      // Strong indicators that this IDE is actively being used
      const strongIndicators = [
        'Currently running in',
        'Active workspace',
        'Recent activity',
        'Open project',
        'Current session',
      ];

      const hasStrongIndicator = detection.indicators?.some(indicator =>
        strongIndicators.some(strong => indicator.includes(strong))
      );

      if (hasStrongIndicator && detection.confidence === 'high') {
        return integration;
      }
    }

    return null; // No clear primary IDE detected
  }

  /**
   * Extract platform-specific configuration for a given IDE/integration
   * @param {Array} rules - Array of rule objects with frontmatter
   * @param {string} ideId - IDE identifier (e.g., 'claude', 'cursor', 'windsurf')
   * @returns {Object} Aggregated platform configuration
   */
  getPlatformConfig(rules, ideId) {
    const platformConfig = {};

    for (const rule of rules) {
      const rulePlatforms = rule.frontmatter?.platforms || {};
      const rulePlatformConfig = rulePlatforms[ideId];

      if (rulePlatformConfig) {
        // Merge platform configurations, with later rules taking precedence
        Object.assign(platformConfig, rulePlatformConfig);
      }
    }

    return platformConfig;
  }

  /**
   * Map integration name to IDE identifier for RuleAdapter
   * @param {string} integrationName - Integration name
   * @returns {string} IDE identifier
   */
  mapIntegrationToIDE(integrationName) {
    const mapping = {
      Cursor: 'cursor',
      Windsurf: 'windsurf',
      'Claude Code CLI': 'claude',
      'GitHub Copilot': 'github-copilot',
    };

    return mapping[integrationName] || 'generic';
  }

  /**
   * Get the appropriate output directory for an IDE
   * @param {string} ideName - IDE name
   * @param {Object} configPaths - IDE config paths
   * @param {Object} analysisData - Analysis data
   * @returns {string} Output directory path
   */
  getIDEOutputDirectory(ideName, _configPaths, analysisData) {
    const projectRoot = analysisData.projectStructure?.root || this.projectPath;

    switch (ideName) {
      case 'Cursor':
        return path.join(projectRoot, '.cursor', 'rules');

      case 'Windsurf':
        return path.join(projectRoot, '.windsurf', 'rules');

      case 'Claude Code CLI':
        // Claude Code CLI uses project root for memory files
        return projectRoot;

      case 'GitHub Copilot':
        return path.join(projectRoot, '.github', 'copilot');

      default:
        return path.join(projectRoot, '.ai', 'rules');
    }
  }

  /**
   * Get the file format used by an IDE
   * @param {string} ideName - IDE name
   * @returns {string} File format (md, mdc, etc.)
   */
  getIDEFormat(ideName) {
    switch (ideName) {
      case 'Cursor':
        return 'mdc'; // MDC format with YAML frontmatter
      case 'Windsurf':
        return 'md'; // Markdown with XML tags
      case 'Claude Code CLI':
        return 'md'; // Pure markdown for memory
      case 'GitHub Copilot':
        return 'json'; // JSON configuration
      default:
        return 'md';
    }
  }
}
