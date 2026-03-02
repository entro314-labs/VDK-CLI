/**
 * VDK Blueprints Client
 * -----------------------
 * This module is responsible for all communication with the VDK-Blueprints repository,
 * which includes fetching rule lists, downloading rule files, and checking for updates.
 *
 * Canonical taxonomy support:
 * - Blueprint metadata parsing and validation
 * - Platform targeting and filtering
 * - Dependency relationship processing
 * - Search and discovery
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { glob } from 'glob';
import matter from 'gray-matter';
import ora from 'ora';
import { blueprintRetrievalEngine } from './blueprints/retrieval/BlueprintRetrievalEngine.js';
import { resolveCanonicalKind } from './shared/canonical-kind.js';
import { validateBlueprint } from './utils/schema-validator.js';

const VDK_BLUEPRINTS_BASE_URL = 'https://api.github.com/repos/vdkit/VDK-Blueprints/contents';

const CACHE_TTL_MS = 30_000;
const cacheStore = new Map();

async function isDirectory(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function resolveLocalBlueprintsRepoPath() {
  const configuredPath = (process.env.VDK_LOCAL_REPO_PATH || '').trim();
  const candidateSet = new Set();

  if (configuredPath) {
    candidateSet.add(path.resolve(configuredPath));
  }

  // Common workspace layouts (CLI and Blueprints as sibling repositories)
  candidateSet.add(path.resolve(process.cwd(), '../VDK-Blueprints'));
  candidateSet.add(path.resolve(process.cwd(), '../../VDK-Blueprints'));

  // Resolve from CLI module location
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  candidateSet.add(path.resolve(moduleDir, '..', '..', 'VDK-Blueprints'));

  for (const candidate of candidateSet) {
    const libraryPath = path.join(candidate, 'library');
    if (await isDirectory(libraryPath)) {
      return candidate;
    }
  }

  return '';
}

function getCache(key) {
  const hit = cacheStore.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return hit.value;
}

function setCache(key, value) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function isPlatformEnabled(platformConfig) {
  if (!platformConfig || typeof platformConfig !== 'object') {
    return false;
  }

  if (platformConfig.compatible === false || platformConfig.enabled === false) {
    return false;
  }

  return true;
}

function enrichMetadataWithCanonicalKind(metadata, item) {
  const resolution = resolveCanonicalKind({
    kind: metadata?.kind,
    componentType: metadata?.componentType,
  });

  if (!resolution) {
    throw new Error(
      `Blueprint '${item?.path || item?.name || 'unknown'}' is missing canonical metadata.kind`
    );
  }

  const base = { ...(metadata || {}), kind: resolution.canonicalKind };

  if (!base.id) {
    throw new Error(`Blueprint '${item?.path || item?.name || 'unknown'}' is missing metadata.id`);
  }

  if (!base.title) {
    throw new Error(
      `Blueprint '${item?.path || item?.name || 'unknown'}' is missing metadata.title`
    );
  }

  return base;
}

async function fetchGitHubDirectoryRecursive(directoryPath, headers) {
  const queue = [directoryPath];
  const files = [];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const response = await fetch(`${VDK_BLUEPRINTS_BASE_URL}/${currentPath}?ref=main`, {
      headers,
    });

    if (response.status === 404) {
      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch ${currentPath}. Status: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      continue;
    }

    for (const entry of data) {
      if (entry.type === 'dir') {
        queue.push(entry.path);
        continue;
      }

      if (entry.type !== 'file') continue;
      if (
        !(entry.name.endsWith('.md') || entry.name.endsWith('.mdc') || entry.name.endsWith('.json'))
      )
        continue;
      files.push(entry);
    }
  }

  return files;
}

/**
 * Fetches the list of available blueprints from all categories in the new structure.
 * @returns {Promise<Array>} A promise that resolves to an array of blueprint file objects.
 */
async function fetchRuleList() {
  const localRepoPath = await resolveLocalBlueprintsRepoPath();
  const cacheKey = `rule-list:${localRepoPath || 'remote'}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const allBlueprints = [];

  if (localRepoPath) {
    const spinner = ora(`Scanning local repository: ${localRepoPath}...`).start();
    try {
      const files = await glob(path.join(localRepoPath, 'library', '**', '*.{md,mdc,json}'), {
        nodir: true,
      });

      for (const file of files) {
        const relPath = path.relative(path.join(localRepoPath, 'library'), file);

        allBlueprints.push({
          name: path.basename(file),
          path: `library/${relPath.replace(/\\/g, '/')}`,
          download_url: `file://${file}`,
          sourceType: 'canonical-library',
          type: 'file',
        });
      }

      spinner.succeed(`Found ${allBlueprints.length} items in local repository.`);
      setCache(cacheKey, allBlueprints);
      return allBlueprints;
    } catch (err) {
      spinner.fail(`Failed to scan local repo: ${err.message}`);
      return [];
    }
  }

  // ... Original GitHub fetch logic ...
  const spinner = ora('Connecting to VDK-Blueprints repository...').start();
  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
    };

    // Use GitHub token if available to avoid rate limiting
    if (process.env.VDK_GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.VDK_GITHUB_TOKEN}`;
    } else {
      spinner.warn('VDK_GITHUB_TOKEN not set. You may encounter rate limiting.');
    }

    spinner.text = 'Fetching canonical library blueprints...';
    const files = await fetchGitHubDirectoryRecursive('library', headers);
    const components = files.map(component => ({
      ...component,
      sourceType: 'canonical-library',
    }));
    allBlueprints.push(...components);

    spinner.succeed(`Successfully fetched ${allBlueprints.length} items from VDK repository.`);
    setCache(cacheKey, allBlueprints);
    return allBlueprints;
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    return [];
  }
}

/**
 * Downloads the content of a specific rule file.
 * @param {string} downloadUrl - The URL to download the file from.
 * @returns {Promise<string>} A promise that resolves to the content of the file.
 */
/**
 * Downloads the content of a specific rule file.
 * @param {string} downloadUrl - The URL to download the file from.
 * @returns {Promise<string>} A promise that resolves to the content of the file.
 */
async function downloadRule(downloadUrl) {
  try {
    if (downloadUrl.startsWith('file://')) {
      return await fs.readFile(fileURLToPath(downloadUrl), 'utf8');
    }
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download rule. Status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(chalk.red(`Error downloading rule from ${downloadUrl}: ${error.message}`));
    return null;
  }
}

/**
 * Canonical blueprint fetching with enriched metadata parsing
 * @param {Object} options - Fetching options
 * @returns {Promise<Array>} Array of blueprint objects with metadata
 */
async function fetchBlueprintsWithMetadata(options = {}) {
  const localRepoPath = await resolveLocalBlueprintsRepoPath();
  const cacheKey = `blueprints-with-metadata:${localRepoPath || 'remote'}`;

  if (!options.noCache) {
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const spinner = ora('Fetching blueprints with metadata...').start();

  try {
    const rawBlueprints = await fetchRuleList();
    const blueprintsWithMetadata = [];

    spinner.text = `Parsing ${rawBlueprints.length} blueprint files...`;

    for (const blueprint of rawBlueprints) {
      try {
        const content = await downloadRule(blueprint.download_url);
        if (content) {
          const parsed = matter(content);
          const metadata = enrichMetadataWithCanonicalKind(parsed.data, blueprint);
          const validation = await validateBlueprint(metadata);

          if (!validation.valid) {
            if (options.verbose) {
              console.warn(
                `Skipping non-canonical blueprint ${blueprint.path}: ${validation.errors.join('; ')}`
              );
            }
            continue;
          }

          const canonicalBlueprint = {
            ...blueprint,
            metadata,
            schemaVersion: metadata.schemaVersion || '3.0',
            content: parsed.content,
            source: {
              content: parsed.content,
              format: blueprint.name?.endsWith('.json') ? 'json' : 'markdown',
              hasYAMLFrontmatter: Object.keys(parsed.data || {}).length > 0,
            },
            valid: validation.valid,
            validationErrors: validation.errors,
            // Canonical metadata projection for search/filtering
            complexity: metadata.complexity,
            scope: metadata.scope,
            audience: metadata.audience,
            maturity: metadata.maturity,
            platforms: metadata.platforms || {},
            relationships: {
              requires: metadata.requires || [],
              suggests: metadata.suggests || [],
              conflicts: metadata.conflicts || [],
              supersedes: metadata.supersedes || [],
            },
          };

          blueprintsWithMetadata.push(blueprintRetrievalEngine.enrichBlueprint(canonicalBlueprint));
        }
      } catch (error) {
        // Skip problematic blueprints but log the issue
        if (options.verbose) {
          console.warn(`Warning: Failed to parse ${blueprint.name}: ${error.message}`);
        }
      }
    }

    setCache(cacheKey, blueprintsWithMetadata);
    spinner.succeed(`Loaded ${blueprintsWithMetadata.length} canonical blueprints with metadata`);
    return blueprintsWithMetadata;
  } catch (error) {
    spinner.fail('Failed to fetch blueprints');
    throw error;
  }
}

/**
 * Search blueprints by canonical metadata criteria
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Array>} Filtered blueprint results
 */
async function searchBlueprints(criteria = {}) {
  const allBlueprints = await fetchBlueprintsWithMetadata();

  const { results } = blueprintRetrievalEngine.search(allBlueprints, criteria);
  return results;
}

/**
 * Get blueprint dependencies and check for conflicts
 * @param {string} blueprintId - Blueprint ID to analyze
 * @returns {Promise<Object>} Dependency analysis result
 */
async function analyzeBlueprintDependencies(blueprintId) {
  const allBlueprints = await fetchBlueprintsWithMetadata();
  const blueprint = allBlueprints.find(b => b.metadata.id === blueprintId);

  if (!blueprint) {
    throw new Error(`Blueprint '${blueprintId}' not found`);
  }

  const analysis = {
    blueprint: blueprint.metadata,
    dependencies: {
      required: [],
      suggested: [],
      missing: [],
      available: [],
    },
    conflicts: [],
    superseded: [],
  };

  // Find required dependencies
  if (blueprint.relationships.requires) {
    for (const requiredId of blueprint.relationships.requires) {
      const dependency = allBlueprints.find(b => b.metadata.id === requiredId);
      if (dependency) {
        analysis.dependencies.required.push(dependency.metadata);
        analysis.dependencies.available.push(dependency.metadata);
      } else {
        analysis.dependencies.missing.push(requiredId);
      }
    }
  }

  // Find suggested dependencies
  if (blueprint.relationships.suggests) {
    for (const suggestedId of blueprint.relationships.suggests) {
      const suggestion = allBlueprints.find(b => b.metadata.id === suggestedId);
      if (suggestion) {
        analysis.dependencies.suggested.push(suggestion.metadata);
        analysis.dependencies.available.push(suggestion.metadata);
      }
    }
  }

  // Find conflicts
  if (blueprint.relationships.conflicts) {
    for (const conflictId of blueprint.relationships.conflicts) {
      const conflict = allBlueprints.find(b => b.metadata.id === conflictId);
      if (conflict) {
        analysis.conflicts.push(conflict.metadata);
      }
    }
  }

  // Find superseded blueprints
  if (blueprint.relationships.supersedes) {
    for (const supersededId of blueprint.relationships.supersedes) {
      const superseded = allBlueprints.find(b => b.metadata.id === supersededId);
      if (superseded) {
        analysis.superseded.push(superseded.metadata);
      }
    }
  }

  return analysis;
}

/**
 * Get platform-specific blueprint configurations
 * @param {string} platform - Platform identifier (e.g., 'claude-code', 'cursor')
 * @returns {Promise<Array>} Blueprints compatible with the platform
 */
async function getBlueprintsForPlatform(platform) {
  const allBlueprints = await fetchBlueprintsWithMetadata();

  return allBlueprints
    .filter(blueprint => {
      const platformConfig = blueprint.platforms[platform];
      return isPlatformEnabled(platformConfig);
    })
    .map(blueprint => ({
      ...blueprint.metadata,
      platformConfig: blueprint.platforms[platform],
    }));
}

/**
 * Get blueprint statistics for the repository
 * @returns {Promise<Object>} Statistics about the blueprint repository
 */
async function getBlueprintStatistics() {
  const allBlueprints = await fetchBlueprintsWithMetadata();

  const stats = {
    total: allBlueprints.length,
    valid: allBlueprints.filter(b => b.valid).length,
    invalid: allBlueprints.filter(b => !b.valid).length,
    byCategory: {},
    byComplexity: {},
    byMaturity: {},
    byAudience: {},
    platformSupport: {},
    relationships: {
      withDependencies: allBlueprints.filter(
        b => b.relationships.requires.length > 0 || b.relationships.suggests.length > 0
      ).length,
      withConflicts: allBlueprints.filter(b => b.relationships.conflicts.length > 0).length,
    },
  };

  // Count by categories
  allBlueprints.forEach(blueprint => {
    const category = blueprint.metadata.category || 'unknown';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

    const complexity = blueprint.complexity || 'unknown';
    stats.byComplexity[complexity] = (stats.byComplexity[complexity] || 0) + 1;

    const maturity = blueprint.maturity || 'unknown';
    stats.byMaturity[maturity] = (stats.byMaturity[maturity] || 0) + 1;

    const audience = blueprint.audience || 'unknown';
    stats.byAudience[audience] = (stats.byAudience[audience] || 0) + 1;

    // Count platform support
    Object.keys(blueprint.platforms).forEach(platform => {
      if (isPlatformEnabled(blueprint.platforms[platform])) {
        stats.platformSupport[platform] = (stats.platformSupport[platform] || 0) + 1;
      }
    });
  });

  return stats;
}

export {
  downloadRule,
  fetchRuleList,
  fetchBlueprintsWithMetadata,
  searchBlueprints,
  analyzeBlueprintDependencies,
  getBlueprintsForPlatform,
  getBlueprintStatistics,
};
