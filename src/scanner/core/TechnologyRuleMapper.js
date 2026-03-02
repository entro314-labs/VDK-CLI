import path from 'node:path';

export class TechnologyRuleMapper {
  /**
   * Build components from analysis data
   * @param {Object} analysisData - Analysis data
   * @param {Object} integration - Platform integration
   * @param {Object} options - Build options
   * @returns {Object} Components structure
   */
  buildComponentsFromAnalysis(analysisData, integration, options = {}) {
    const constraints = integration.getPlatformConstraints();
    const components = {};

    // Build main component if supported
    if (analysisData.projectStructure) {
      components.main = {
        name: analysisData.projectStructure.name || 'project',
        content: this.buildMainContent(analysisData),
      };
    }

    // Build rules from analysis
    if (constraints.supportsRules && analysisData.technologies) {
      components.rules = this.buildRulesFromTechnologies(analysisData.technologies);
    }

    // Build agents if supported
    if (constraints.supportsAgents && options.generateAgents) {
      components.agents = this.buildAgentsFromAnalysis(analysisData);
    }

    return components;
  }

  /**
   * Build main content from analysis
   * @param {Object} analysisData - Analysis data
   * @returns {string} Main content
   */
  buildMainContent(analysisData) {
    const { projectStructure, technologies } = analysisData;

    let content = `# ${projectStructure.name || 'Project'}\n\n`;

    if (projectStructure.description) {
      content += `${projectStructure.description}\n\n`;
    }

    if (technologies?.primary) {
      content += `## Technology Stack\n`;
      content += `- ${technologies.primary.join('\n- ')}\n\n`;
    }

    content += `## Development Guidelines\n`;
    content += `- Follow best practices\n`;
    content += `- Write comprehensive tests\n`;
    content += `- Document complex logic\n`;

    return content;
  }

  /**
   * Build rules from detected technologies
   * @param {Object} technologies - Detected technologies
   * @returns {Array} Rules array
   */
  buildRulesFromTechnologies(technologies) {
    const rules = [];

    if (technologies.frameworks) {
      technologies.frameworks.forEach(framework => {
        rules.push({
          name: `${framework.toLowerCase()}-standards`,
          description: `${framework} development standards`,
          content: `# ${framework} Standards\n\nFollow ${framework} best practices.`,
          globs: this.getGlobsForFramework(framework),
        });
      });
    }

    return rules;
  }

  /**
   * Build agents from analysis
   * @param {Object} analysisData - Analysis data
   * @returns {Array} Agents array
   */
  buildAgentsFromAnalysis(_analysisData) {
    const agents = [];

    // Generate code review agent
    agents.push({
      name: 'code-reviewer',
      description: 'Automated code review agent',
      content: `# Code Reviewer\n\nReview code for quality and best practices.`,
      tools: ['Read', 'Grep', 'Glob'],
    });

    return agents;
  }

  /**
   * Get glob patterns for framework
   * @param {string} framework - Framework name
   * @returns {Array} Glob patterns
   */
  getGlobsForFramework(framework) {
    const patterns = {
      React: ['src/**/*.jsx', 'src/**/*.tsx'],
      Vue: ['src/**/*.vue'],
      Angular: ['src/**/*.ts', 'src/**/*.component.ts'],
      Next: ['app/**/*.tsx', 'pages/**/*.tsx'],
    };

    return patterns[framework] || ['src/**/*'];
  }

  /**
   * Infer actual framework from file path and content
   * @param {string} filePath - Path to the rule file
   * @param {string} content - File content
   * @returns {string} Inferred framework
   */
  inferFrameworkFromFile(filePath, content) {
    const fileName = path.basename(filePath, '.mdc').toLowerCase();

    // Check filename for framework indicators
    if (fileName.includes('nextjs') || fileName.includes('next')) {
      return 'nextjs';
    }
    if (fileName.includes('react')) {
      return 'react';
    }
    if (fileName.includes('vue')) {
      return 'vue';
    }
    if (fileName.includes('angular')) {
      return 'angular';
    }
    if (fileName.includes('django')) {
      return 'django';
    }
    if (fileName.includes('node') || fileName.includes('express')) {
      return 'nodejs';
    }
    if (fileName.includes('typescript')) {
      return 'typescript';
    }
    if (fileName.includes('python')) {
      return 'python';
    }
    if (fileName.includes('swift')) {
      return 'swift';
    }
    if (fileName.includes('kotlin')) {
      return 'kotlin';
    }

    // Check content for framework indicators
    const contentLower = content.toLowerCase();
    if (contentLower.includes('next.js') || contentLower.includes('nextjs')) {
      return 'nextjs';
    }
    if (contentLower.includes('react')) {
      return 'react';
    }
    if (contentLower.includes('vue.js') || contentLower.includes('vue 3')) {
      return 'vue';
    }
    if (contentLower.includes('angular')) {
      return 'angular';
    }
    if (contentLower.includes('django')) {
      return 'django';
    }
    if (contentLower.includes('express') || contentLower.includes('node.js')) {
      return 'nodejs';
    }

    return 'general';
  }

  /**
   * Generate project signature for template matching
   */
  generateProjectSignature(analysisData, ecosystemVersion) {
    // Handle both techStack and technologyData structure for backward compatibility
    const techData = analysisData.techStack || analysisData.technologyData || {};

    const signature = {
      languages: techData.primaryLanguages || [],
      frameworks: techData.frameworks || [],
      libraries: techData.libraries?.slice(0, 10) || [],
      testingFrameworks: techData.testingFrameworks || [],
      buildTools: techData.buildTools || [],
      patterns: Object.keys(analysisData.patterns?.architecturalPatterns || {}),
      projectSize: this.categorizeProjectSize(analysisData.projectStructure),
      complexity: this.assessComplexity(analysisData),
      ecosystemVersion: ecosystemVersion,
    };

    return signature;
  }

  categorizeProjectSize(projectStructure) {
    const fileCount = projectStructure?.fileCount || 0;
    if (fileCount < 50) return 'small';
    if (fileCount < 200) return 'medium';
    if (fileCount < 1000) return 'large';
    return 'enterprise';
  }

  assessComplexity(analysisData) {
    let score = 0;
    score += (analysisData.techStack?.primaryLanguages?.length || 0) * 2;
    score += (analysisData.techStack?.frameworks?.length || 0) * 3;
    score += Math.min((analysisData.techStack?.libraries?.length || 0) * 0.5, 20);

    if (score < 10) return 'simple';
    if (score < 25) return 'moderate';
    if (score < 50) return 'complex';
    return 'highly-complex';
  }

  /**
   * Calculate template relevance score
   * @param {Object} template - Template object
   * @param {Object} projectSignature - Project signature
   * @param {string} contentType - Type of content being scored
   */
  calculateTemplateRelevance(template, projectSignature, contentType = 'rules') {
    let score = 0;
    const fileName = template.name.toLowerCase();
    const filePath = (template.path || '').toLowerCase();

    // Helper function for word boundary matching
    const containsWord = (text, word) => {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(text) || text.includes(word.toLowerCase());
    };

    // Helper function for framework matching
    const matchesFramework = (text, framework) => {
      const variations = [
        framework,
        framework.replace('-', ''),
        framework.replace('.', ''),
        framework.replace('/', ''),
        framework.replace(' ', ''),
      ];
      return variations.some(variation => containsWord(text, variation));
    };

    // Content-type specific base scoring
    if (contentType === 'commands') {
      score += 0.1;
      if (fileName.includes('develop') || fileName.includes('debug') || fileName.includes('review'))
        score += 0.7;
      if (fileName.includes('workflow') || fileName.includes('quality')) score += 0.6;
      if (fileName.includes('git') || fileName.includes('commit') || fileName.includes('pr'))
        score += 0.5;
      if (fileName.includes('test') || fileName.includes('security') || fileName.includes('audit'))
        score += 0.4;
    } else if (contentType === 'rules') {
      if (fileName.startsWith('0') && fileName.includes('core')) score += 0.8;
    }

    if (fileName.includes('mcp')) score += 0.3;
    if (fileName.includes('common-errors') || fileName.includes('project-context')) score += 0.6;
    if (fileName.includes('javascript') || fileName.includes('node') || fileName.includes('js'))
      score += 0.5;

    // Framework matching
    for (const framework of projectSignature.frameworks || []) {
      const frameworkLower = framework.toLowerCase();
      if (
        matchesFramework(fileName, frameworkLower) ||
        matchesFramework(filePath, frameworkLower)
      ) {
        score += 0.8;
      }
      if (frameworkLower.includes('tailwind') && fileName.includes('tailwind')) score += 0.8;
      if (frameworkLower.includes('shadcn') && fileName.includes('shadcn')) score += 0.8;
      if (
        frameworkLower.includes('supabase') &&
        (fileName.includes('supabase') || filePath.includes('supabase'))
      )
        score += 0.9;
      if (frameworkLower.includes('nextjs') && fileName.includes('nextjs')) score += 0.9;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Select relevant tasks based on project analysis
   */
  selectRelevantTasks(analysisData) {
    const tasks = ['file-operations']; // Always include basic file operations

    const frameworks = analysisData.techStack?.frameworks || [];
    const languages = analysisData.techStack?.primaryLanguages || [];
    const hasTests = analysisData.techStack?.testingFrameworks?.length > 0;
    const hasDocker = analysisData.techStack?.hasDocker;
    const hasDatabase = analysisData.techStack?.hasDatabase;

    // Framework-specific tasks
    if (frameworks.includes('React'))
      tasks.push('UI-Component', 'Component-Interfaces', 'Write-Tests');
    if (frameworks.includes('Next.js'))
      tasks.push('API-Endpoints', 'Service-Integration', 'UI-Component');
    if (frameworks.includes('Vue')) tasks.push('UI-Component', 'Component-Interfaces');
    if (frameworks.includes('Angular')) tasks.push('UI-Component', 'Service-Integration');
    if (frameworks.includes('Express') || frameworks.includes('FastAPI'))
      tasks.push('API-Endpoints', 'Service-Integration');

    // Language-specific tasks
    if (languages.includes('TypeScript')) tasks.push('Type-Definitions', 'Interface-Design');
    if (languages.includes('Python')) tasks.push('API-Endpoints', 'Data-Processing');

    // Infrastructure tasks
    if (hasDocker) tasks.push('DevOps-Tasks', 'Service-Integration');
    if (hasDatabase) tasks.push('Database-Schema', 'API-Endpoints');

    // Testing tasks
    if (hasTests) tasks.push('Write-Tests', 'Analyze-Coverage', 'Code-Quality-Review');

    return [...new Set(tasks)];
  }

  /**
   * Select relevant tools based on project analysis
   */
  selectRelevantTools(analysisData) {
    const tools = ['file-operations']; // Always include

    const packageManager = analysisData.techStack?.packageManager;
    const hasGit = analysisData.techStack?.hasGit;
    const hasDocker = analysisData.techStack?.hasDocker;
    const buildTools = analysisData.techStack?.buildTools || [];

    if (packageManager) tools.push('command-execution');
    if (hasGit) tools.push('code-search', 'version-control');
    if (hasDocker) tools.push('command-execution', 'container-management');
    if (buildTools.includes('webpack') || buildTools.includes('vite')) tools.push('build-tools');

    return [...new Set(tools)];
  }

  /**
   * Select relevant assistants based on detected integrations
   */
  selectRelevantAssistants(_analysisData, detectedIntegrations = []) {
    const assistants = [];

    // Use detected integrations from analysis
    if (detectedIntegrations.length > 0) {
      for (const integration of detectedIntegrations) {
        // Simple mapping from integration name to assistant ID
        const name = integration.name.toLowerCase();
        if (name.includes('claude')) assistants.push('claude');
        else if (name.includes('cursor')) assistants.push('cursor');
        else if (name.includes('copilot')) assistants.push('copilot');
        else if (name.includes('windsurf')) assistants.push('windsurf');
      }
    }

    return [...new Set(assistants)];
  }
}
