/**
 * VDK IR Performance Optimizations
 * ==================================
 *
 * Performance enhancements for the IR system:
 * - LRU caching for parsed content
 * - Streaming for large files
 * - Batch processing
 * - Memory usage tracking
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

// ============================================================================
// LRU Cache Implementation
// ============================================================================

class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  set(key, value) {
    // Delete if already exists (will re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }

  get stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: (this.cache.size / this.maxSize) * 100,
    };
  }
}

// ============================================================================
// Global Caches
// ============================================================================

// Cache for parsed content (file hash → parsed IR)
const contentCache = new LRUCache(100);

// Cache for file stats (file path → {hash, mtime, size})
const fileStatsCache = new LRUCache(500);

// Cache hit/miss statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0,
};

// ============================================================================
// File Hashing
// ============================================================================

/**
 * Calculate file hash for cache key
 * @param {string} filePath - Path to file
 * @returns {string|null} File hash or null if error
 */
function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  } catch (_error) {
    return null;
  }
}

/**
 * Get file stats with caching
 * @param {string} filePath - Path to file
 * @returns {{hash: string, mtime: number, size: number}|null}
 */
function getCachedFileStats(filePath) {
  // Check cache first
  const cached = fileStatsCache.get(filePath);
  if (cached) {
    try {
      const stats = fs.statSync(filePath);
      // Check if file was modified
      if (stats.mtimeMs === cached.mtime && stats.size === cached.size) {
        return cached;
      }
    } catch (_error) {
      // File no longer exists or error reading
      fileStatsCache.delete(filePath);
      return null;
    }
  }

  // Calculate fresh stats
  try {
    const stats = fs.statSync(filePath);
    const hash = getFileHash(filePath);

    if (!hash) return null;

    const fileStats = {
      hash,
      mtime: stats.mtimeMs,
      size: stats.size,
    };

    fileStatsCache.set(filePath, fileStats);
    return fileStats;
  } catch (_error) {
    return null;
  }
}

// ============================================================================
// Cached Parsing
// ============================================================================

/**
 * Parse content with caching
 * @param {string} content - Content to parse
 * @param {Function} parserFn - Parser function to use
 * @param {string} [cacheKey] - Optional cache key (defaults to content hash)
 * @returns {*} Parsed result
 */
export function cachedParse(content, parserFn, cacheKey = null) {
  cacheStats.totalRequests++;

  // Generate cache key from content if not provided
  const key =
    cacheKey || crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

  // Check cache
  if (contentCache.has(key)) {
    cacheStats.hits++;
    return contentCache.get(key);
  }

  // Parse and cache
  cacheStats.misses++;
  const result = parserFn(content);
  contentCache.set(key, result);

  return result;
}

/**
 * Parse file with caching (uses file hash)
 * @param {string} filePath - File to parse
 * @param {Function} parserFn - Parser function that takes content and filePath
 * @returns {*} Parsed result or null if error
 */
export function cachedParseFile(filePath, parserFn) {
  cacheStats.totalRequests++;

  // Get file stats
  const fileStats = getCachedFileStats(filePath);
  if (!fileStats) {
    cacheStats.misses++;
    return null;
  }

  const cacheKey = `file:${filePath}:${fileStats.hash}`;

  // Check cache
  if (contentCache.has(cacheKey)) {
    cacheStats.hits++;
    return contentCache.get(cacheKey);
  }

  // Read and parse
  cacheStats.misses++;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parserFn(content, filePath);
    contentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error.message);
    return null;
  }
}

// ============================================================================
// Large File Handling
// ============================================================================

const LARGE_FILE_THRESHOLD = 512 * 1024; // 512KB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Check if file is too large for normal processing
 * @param {string} filePath - File to check
 * @returns {{isLarge: boolean, size: number, shouldStream: boolean}}
 */
export function checkFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);

    return {
      isLarge: stats.size > LARGE_FILE_THRESHOLD,
      size: stats.size,
      shouldStream: stats.size > MAX_FILE_SIZE,
      exceedsLimit: stats.size > MAX_FILE_SIZE,
    };
  } catch (error) {
    return {
      isLarge: false,
      size: 0,
      shouldStream: false,
      exceedsLimit: false,
      error: error.message,
    };
  }
}

/**
 * Read large file in chunks
 * @param {string} filePath - File to read
 * @param {Function} chunkHandler - Function to call for each chunk (chunk, offset)
 * @param {number} [chunkSize] - Chunk size in bytes (default: 64KB)
 * @returns {Promise<void>}
 */
export async function readLargeFile(filePath, chunkHandler, chunkSize = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      highWaterMark: chunkSize,
    });

    let offset = 0;

    stream.on('data', chunk => {
      chunkHandler(chunk, offset);
      offset += chunk.length;
    });

    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

/**
 * Parse large file in chunks (for markdown section extraction)
 * @param {string} filePath - File to parse
 * @returns {Promise<Object>} Parsed sections
 */
export async function parseLargeFileInChunks(filePath) {
  const sections = [];
  let currentSection = null;
  let contentBuffer = [];
  let lineBuffer = '';

  await readLargeFile(filePath, chunk => {
    // Add chunk to line buffer
    lineBuffer += chunk;

    // Process complete lines
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() || ''; // Keep last incomplete line

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = contentBuffer.join('\n').trim();
          sections.push(currentSection);
        }

        currentSection = {
          title: headingMatch[2],
          level: headingMatch[1].length,
          content: '',
          children: [],
        };
        contentBuffer = [];
      } else {
        contentBuffer.push(line);
      }
    }
  });

  // Save last section
  if (currentSection) {
    currentSection.content = contentBuffer.join('\n').trim();
    sections.push(currentSection);
  } else if (contentBuffer.length > 0) {
    sections.push({
      title: '',
      level: 0,
      content: contentBuffer.join('\n').trim(),
      children: [],
    });
  }

  return {
    sections,
    raw: fs.readFileSync(filePath, 'utf8'), // Read full content for raw
    format: 'markdown',
    hasFrontmatter: false,
  };
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process multiple files in batch with progress tracking
 * @param {string[]} filePaths - Files to process
 * @param {Function} processFn - Function to process each file (filePath)
 * @param {Object} [options] - Batch options
 * @param {number} [options.concurrency] - Max concurrent operations (default: 5)
 * @param {Function} [options.onProgress] - Progress callback (current, total)
 * @returns {Promise<Array>} Results array
 */
export async function batchProcess(filePaths, processFn, options = {}) {
  const { concurrency = 5, onProgress } = options;

  const results = [];
  const queue = [...filePaths];
  let activeCount = 0;
  let completed = 0;

  return new Promise((resolve, _reject) => {
    const processNext = () => {
      while (activeCount < concurrency && queue.length > 0) {
        const filePath = queue.shift();
        activeCount++;

        Promise.resolve(processFn(filePath))
          .then(result => {
            results.push({ filePath, result, success: true });
          })
          .catch(error => {
            results.push({ filePath, error, success: false });
          })
          .finally(() => {
            activeCount--;
            completed++;

            if (onProgress) {
              onProgress(completed, filePaths.length);
            }

            if (completed === filePaths.length) {
              resolve(results);
            } else {
              processNext();
            }
          });
      }
    };

    processNext();
  });
}

// ============================================================================
// Memory Usage Tracking
// ============================================================================

/**
 * Get current memory usage
 * @returns {Object} Memory usage stats
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();

  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    heapUtilization: `${((usage.heapUsed / usage.heapTotal) * 100).toFixed(2)}%`,
  };
}

/**
 * Check if memory usage is within limits
 * @param {number} [maxHeapMB] - Maximum heap size in MB (default: 512)
 * @returns {{withinLimit: boolean, usage: Object}}
 */
export function checkMemoryLimit(maxHeapMB = 512) {
  const usage = getMemoryUsage();

  return {
    withinLimit: usage.heapUsed < maxHeapMB,
    usage,
    threshold: maxHeapMB,
    exceedsBy: Math.max(0, usage.heapUsed - maxHeapMB),
  };
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear all caches
 */
export function clearCaches() {
  contentCache.clear();
  fileStatsCache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.totalRequests = 0;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    ...cacheStats,
    hitRate:
      cacheStats.totalRequests > 0
        ? `${((cacheStats.hits / cacheStats.totalRequests) * 100).toFixed(2)}%`
        : '0%',
    contentCache: contentCache.stats,
    fileStatsCache: fileStatsCache.stats,
  };
}

/**
 * Prune caches to reduce memory usage
 * @param {number} targetSizePercent - Target size as percentage of max (default: 50%)
 */
export function pruneCaches(targetSizePercent = 50) {
  const targetContentSize = Math.floor(contentCache.maxSize * (targetSizePercent / 100));
  const targetFileStatsSize = Math.floor(fileStatsCache.maxSize * (targetSizePercent / 100));

  // Clear oldest entries from content cache
  while (contentCache.size > targetContentSize) {
    const firstKey = contentCache.cache.keys().next().value;
    contentCache.cache.delete(firstKey);
  }

  // Clear oldest entries from file stats cache
  while (fileStatsCache.size > targetFileStatsSize) {
    const firstKey = fileStatsCache.cache.keys().next().value;
    fileStatsCache.cache.delete(firstKey);
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Measure function execution time
 * @param {Function} fn - Function to measure
 * @param {string} [label] - Label for measurement
 * @returns {*} Function result
 */
export function measure(fn, label = 'operation') {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;

  console.log(`[Performance] ${label}: ${durationMs.toFixed(2)}ms`);

  return result;
}

/**
 * Measure async function execution time
 * @param {Function} fn - Async function to measure
 * @param {string} [label] - Label for measurement
 * @returns {Promise<*>} Function result
 */
export async function measureAsync(fn, label = 'operation') {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;

  console.log(`[Performance] ${label}: ${durationMs.toFixed(2)}ms`);

  return result;
}

/**
 * Get performance report
 * @returns {Object} Performance summary
 */
export function getPerformanceReport() {
  return {
    cache: getCacheStats(),
    memory: getMemoryUsage(),
    timestamp: new Date().toISOString(),
  };
}

export default {
  // Caching
  cachedParse,
  cachedParseFile,

  // Large files
  checkFileSize,
  readLargeFile,
  parseLargeFileInChunks,

  // Batch processing
  batchProcess,

  // Memory
  getMemoryUsage,
  checkMemoryLimit,

  // Cache management
  clearCaches,
  getCacheStats,
  pruneCaches,

  // Performance monitoring
  measure,
  measureAsync,
  getPerformanceReport,
};
