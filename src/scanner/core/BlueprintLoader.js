import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import yaml from 'js-yaml';

import { validateBlueprint } from '../../utils/schema-validator.js';
import { applyLightTemplating, prepareTemplateVariables } from '../utils/light-templating.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class BlueprintLoader {
  constructor(options = {}, technologyMapper) {
    this.verbose = options.verbose;
    this.projectPath = options.projectPath || process.cwd();
    this.enableRemoteFetch = options.enableRemoteFetch !== false;
    this.repositoryEndpoint =
      options.repositoryEndpoint || 'https://api.github.com/repos/vdkit/VDK-Blueprints';
    this.ecosystemVersion = options.ecosystemVersion || '3.0.0';
    this.schemaValidation = options.schemaValidation !== false;
    this.technologyMapper = technologyMapper;
  }

  getRepositoryHeaders() {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': `VDK-CLI/${this.ecosystemVersion}`,
    };

    if (process.env.VDK_GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`;
    }

    return headers;
  }

  async fetchRepositoryDirectory(itemOrPath) {
    const headers = this.getRepositoryHeaders();

    const targetUrl =
      typeof itemOrPath === 'string'
        ? `${this.repositoryEndpoint}/contents/${itemOrPath}`
        : itemOrPath?.url || `${this.repositoryEndpoint}/contents/${itemOrPath?.path || ''}`;

    const response = await fetch(targetUrl, { headers });
    if (!response.ok) {
      throw new Error(`Repository API failed: ${response.status} (${targetUrl})`);
    }

    return await response.json();
  }

  /**
   * Load standardized rules from local rules directory
   */
  async loadStandardizedRules(analysisData = {}) {
    const candidateRuleDirs = [
      // Project-local generated rules
      path.resolve(this.projectPath || '', '.vdk/blueprints/rules'),

      // CLI-local fallback
      path.resolve(__dirname, '../../../.vdk/blueprints/rules'),

      // Monorepo fallback: curated source library
      path.resolve(__dirname, '../../../../VDK-Blueprints/library/rules'),
    ].filter(Boolean);

    let rulesDir = null;

    for (const candidate of [...new Set(candidateRuleDirs)]) {
      try {
        const stats = await fs.stat(candidate);
        if (stats.isDirectory()) {
          rulesDir = candidate;
          break;
        }
      } catch {
        // Candidate path does not exist; continue fallback chain.
      }
    }

    const rules = [];

    if (!rulesDir) {
      if (this.verbose) {
        console.warn(chalk.yellow('No local rule directory found in fallback chain.'));
      }
      return rules;
    }

    if (this.verbose) {
      console.log(chalk.gray(`Loading standardized rules from: ${rulesDir}`));
    }

    try {
      const ruleFiles = await this.findRuleFiles(rulesDir);

      for (const filePath of ruleFiles) {
        try {
          const rawContent = await fs.readFile(filePath, 'utf8');
          const frontmatter = this.parseFrontmatter(rawContent);

          if (frontmatter.framework === 'vdk' && this.technologyMapper) {
            frontmatter.framework = this.technologyMapper.inferFrameworkFromFile(
              filePath,
              rawContent
            );
          }

          const templateVariables = prepareTemplateVariables(analysisData);
          const templatedContent = applyLightTemplating(rawContent, templateVariables);

          if (this.verbose && rawContent !== templatedContent) {
            console.log(chalk.gray(`Applied light templating to ${path.basename(filePath)}`));
          }

          rules.push({
            filePath,
            frontmatter,
            content: templatedContent,
          });
        } catch (error) {
          if (this.verbose) {
            console.warn(chalk.yellow(`Failed to load rule file ${filePath}: ${error.message}`));
          }
        }
      }
    } catch (error) {
      if (this.verbose) {
        console.warn(chalk.yellow(`Failed to load rules directory: ${error.message}`));
      }
    }

    return rules;
  }

  async findRuleFiles(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await this.findRuleFiles(fullPath)));
        } else if (entry.name.endsWith('.mdc') || entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore directory access errors
    }
    return files;
  }

  /**
   * Fetch templates from Repository
   */
  async fetchFromRepository(
    analysisData,
    contentType = 'rules',
    platform = null,
    categoryFilter = null
  ) {
    if (!this.enableRemoteFetch) return [];

    try {
      if (this.verbose) {
        console.log(chalk.gray(`📚 Fetching ${contentType} from VDK Blueprints Repository...`));
      }

      // Use mapper to generate signature
      const projectSignature = this.technologyMapper
        ? this.technologyMapper.generateProjectSignature(analysisData, this.ecosystemVersion)
        : {};

      // Inject analysisData for templating
      projectSignature.analysisData = analysisData;

      const templates = await this.fetchRepositoryContent(
        projectSignature,
        contentType,
        platform,
        categoryFilter
      );

      return templates;
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`⚠️ Could not fetch remote ${contentType}: ${error.message}`));
      }
      return [];
    }
  }

  async fetchRepositoryContent(
    projectSignature,
    contentType = 'rules',
    platform = null,
    categoryFilter = null
  ) {
    try {
      const apiUrl = `${this.repositoryEndpoint}/contents/${this.resolveCanonicalContentPath(contentType)}`;
      const headers = this.getRepositoryHeaders();

      const response = await fetch(apiUrl, { headers });
      if (!response.ok) throw new Error(`Repository API failed: ${response.status}`);

      const contents = await response.json();

      let allTemplates;
      if (contentType === 'commands' && platform) {
        allTemplates = await this.expandRepositoryDirectoriesWithCategories(
          contents,
          contentType,
          platform,
          categoryFilter
        );
      } else {
        allTemplates = await this.expandRepositoryDirectories(contents, contentType);
      }

      const relevantTemplates = this.filterRelevantTemplates(
        allTemplates,
        projectSignature,
        contentType
      );

      const templates = [];
      const qualityThreshold = contentType === 'commands' ? 0.2 : 0.3;
      const maxLimit = 25;

      const qualityTemplates = relevantTemplates
        .filter(
          (t, i) => t.relevanceScore >= qualityThreshold || (i < 10 && t.relevanceScore >= 0.1)
        )
        .slice(0, maxLimit);

      for (const template of qualityTemplates) {
        try {
          const rawTemplateContent = await this.fetchTemplateContent(template.download_url);
          const templateVariables = prepareTemplateVariables(projectSignature.analysisData || {});
          const templatedContent = applyLightTemplating(rawTemplateContent, templateVariables);
          const frontmatter = this.parseFrontmatter(templatedContent);

          templates.push({
            name: template.name,
            content: templatedContent,
            source: 'repository',
            path: template.path,
            relevanceScore: template.relevanceScore,
            frontmatter: frontmatter,
          });
        } catch {
          // ignore
        }
      }
      return templates;
    } catch {
      return [];
    }
  }

  resolveCanonicalContentPath(contentType) {
    const pathMap = {
      rules: 'library/rules',
      commands: 'library/commands',
      docs: 'docs',
      schemas: 'schemas',
    };

    return pathMap[contentType] || `library/${contentType}`;
  }

  async fetchTemplateContent(downloadUrl) {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Template fetch failed: ${response.status}`);
    return await response.text();
  }

  filterRelevantTemplates(contents, projectSignature, contentType) {
    const relevant = [];
    const exts = this.getFileExtensions(contentType);

    for (const item of contents) {
      if (item.type === 'file' && exts.some(ext => item.name.endsWith(ext))) {
        // Use mapper for calculation
        const score = this.technologyMapper
          ? this.technologyMapper.calculateTemplateRelevance(item, projectSignature, contentType)
          : 0.5; // fallback

        relevant.push({ ...item, relevanceScore: score });
      }
    }
    return relevant
      .filter(t => t.relevanceScore > 0)
      .toSorted((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getFileExtensions(contentType) {
    return (
      {
        rules: ['.mdc', '.md'],
        commands: ['.md'],
        docs: ['.md'],
        schemas: ['.json'],
      }[contentType] || ['.md', '.mdc']
    );
  }

  async expandRepositoryDirectories(contents, contentType, maxDepth = 4, currentDepth = 0) {
    const allFiles = [];
    const exts = this.getFileExtensions(contentType);

    for (const item of contents) {
      if (item.type === 'file' && exts.some(ext => item.name.endsWith(ext))) {
        allFiles.push(item);
        continue;
      }

      if (item.type === 'dir' && currentDepth < maxDepth) {
        try {
          const subContents = await this.fetchRepositoryDirectory(item);
          const subFiles = await this.expandRepositoryDirectories(
            subContents,
            contentType,
            maxDepth,
            currentDepth + 1
          );
          allFiles.push(...subFiles);
        } catch (error) {
          if (this.verbose) {
            console.warn(
              chalk.yellow(`Failed to expand repository directory ${item.path}: ${error.message}`)
            );
          }
        }
      }
    }

    const byPath = new Map();
    for (const file of allFiles) {
      byPath.set(file.path || file.name, file);
    }

    return [...byPath.values()];
  }

  async expandRepositoryDirectoriesWithCategories(contents, contentType, platform, filter) {
    const expandedFiles = await this.expandRepositoryDirectories(contents, contentType, 6, 0);

    const normalizedPlatform = String(platform || '')
      .toLowerCase()
      .trim();
    const normalizedFilter = String(filter || '')
      .toLowerCase()
      .trim();

    const filtered = expandedFiles.filter(file => {
      const filePath = String(file.path || '').toLowerCase();

      const platformMatch =
        !normalizedPlatform ||
        filePath.includes(`/${normalizedPlatform}/`) ||
        filePath.endsWith(`/${normalizedPlatform}`) ||
        filePath.includes(`-${normalizedPlatform}-`) ||
        filePath.includes(`_${normalizedPlatform}_`);

      const categoryMatch = !normalizedFilter || filePath.includes(`/${normalizedFilter}/`);

      return platformMatch && categoryMatch;
    });

    // If filtering was too strict, fall back to all expanded command files
    if (filtered.length === 0 && (normalizedPlatform || normalizedFilter)) {
      return expandedFiles;
    }

    return filtered;
  }

  parseFrontmatter(content) {
    if (!content.startsWith('---')) return {};
    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) return {};
    try {
      return yaml.load(content.slice(3, endIndex).trim()) || {};
    } catch {
      return {};
    }
  }

  async validateRulesWithVDKSchema(_standardRules, remoteTemplates) {
    if (!this.schemaValidation) return [];
    const errors = [];
    for (const t of remoteTemplates) {
      try {
        const parsed = this.parseFrontmatter(t.content);
        const result = await validateBlueprint(parsed); // using imported validator
        if (result.errors?.length) errors.push({ template: t.name, errors: result.errors });
      } catch (e) {
        errors.push({ template: t.name, errors: [e.message] });
      }
    }
    return errors;
  }
}
