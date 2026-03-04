/**
 * MigrationBackup - Backup and rollback system for migrations
 *
 * Provides safety mechanisms for migration operations including:
 * - Creating backups before migration
 * - Rollback capability for failed migrations
 * - Backup verification and validation
 * - Cleanup of old backups
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

export class MigrationBackup {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.backupDir = path.join(projectPath, '.vdk', 'backups');
    this.migrationId = null;
  }

  /**
   * Create a backup before migration
   * @param {Object} migrationInfo - Information about the migration
   * @returns {string} Backup ID for rollback
   */
  async createBackup(migrationInfo = {}) {
    try {
      // Generate unique backup ID based on timestamp and content hash
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const contentHash = createHash('md5')
        .update(JSON.stringify(migrationInfo))
        .digest('hex')
        .substring(0, 8);

      this.migrationId = `migration-${timestamp}-${contentHash}`;
      const backupPath = path.join(this.backupDir, this.migrationId);

      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Create backup metadata
      const backupMetadata = {
        id: this.migrationId,
        timestamp: new Date().toISOString(),
        projectPath: this.projectPath,
        migrationInfo,
        version: '1.0.0',
        files: [],
        directories: [],
      };

      // Backup existing VDK configuration and rules
      const itemsToBackup = await this.identifyBackupTargets();

      for (const item of itemsToBackup) {
        await this.backupItem(item, backupPath, backupMetadata);
      }

      // Save backup metadata
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(backupMetadata, null, 2));

      // Create backup integrity check
      await this.createIntegrityCheck(backupPath, backupMetadata);

      console.log(chalk.green(`✅ Backup created: ${this.migrationId}`));
      console.log(chalk.gray(`   Location: ${backupPath}`));
      console.log(
        chalk.gray(
          `   Items backed up: ${backupMetadata.files.length + backupMetadata.directories.length}`
        )
      );

      return this.migrationId;
    } catch (error) {
      throw new Error(`Failed to create migration backup: ${error.message}`);
    }
  }

  /**
   * Rollback migration using backup
   * @param {string} backupId - ID of backup to restore
   * @param {Object} options - Rollback options
   */
  async rollback(backupId, options = {}) {
    try {
      const backupPath = path.join(this.backupDir, backupId);
      const metadataPath = path.join(backupPath, 'backup-metadata.json');

      // Verify backup exists and is valid
      if (!(await this.fileExists(backupPath))) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      if (!(await this.fileExists(metadataPath))) {
        throw new Error(`Backup metadata not found: ${backupId}`);
      }

      // Load and verify backup metadata
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

      // Verify backup integrity
      const isValid = await this.verifyBackupIntegrity(backupPath, metadata);
      if (!isValid) {
        throw new Error(`Backup integrity check failed: ${backupId}`);
      }

      console.log(chalk.blue(`🔄 Rolling back migration: ${backupId}`));
      console.log(chalk.gray(`   Created: ${metadata.timestamp}`));

      // Remove current VDK files/directories that would conflict
      await this.removeCurrentVDKFiles(options);

      // Restore files from backup
      let restoredCount = 0;

      for (const fileInfo of metadata.files) {
        await this.restoreFile(fileInfo, backupPath);
        restoredCount++;
      }

      for (const dirInfo of metadata.directories) {
        await this.restoreDirectory(dirInfo, backupPath);
        restoredCount++;
      }

      console.log(chalk.green(`✅ Rollback completed successfully`));
      console.log(chalk.gray(`   Restored items: ${restoredCount}`));

      // Optionally remove backup after successful rollback
      if (options.removeBackup) {
        await this.removeBackup(backupId);
        console.log(chalk.gray(`   Backup removed: ${backupId}`));
      }

      return { success: true, restoredCount, backupId };
    } catch (error) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * List all available backups
   * @returns {Array} List of backup information
   */
  async listBackups() {
    try {
      if (!(await this.fileExists(this.backupDir))) {
        return [];
      }

      const backupEntries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const backups = [];

      for (const entry of backupEntries) {
        if (entry.isDirectory() && entry.name.startsWith('migration-')) {
          const metadataPath = path.join(this.backupDir, entry.name, 'backup-metadata.json');

          try {
            if (await this.fileExists(metadataPath)) {
              const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
              const isValid = await this.verifyBackupIntegrity(
                path.join(this.backupDir, entry.name),
                metadata
              );

              backups.push({
                id: entry.name,
                timestamp: metadata.timestamp,
                itemCount: metadata.files.length + metadata.directories.length,
                isValid,
                migrationInfo: metadata.migrationInfo,
                path: path.join(this.backupDir, entry.name),
              });
            }
          } catch (_error) {
            // Skip invalid backup entries
            console.warn(chalk.yellow(`Warning: Invalid backup metadata for ${entry.name}`));
          }
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Failed to list backups: ${error.message}`));
      return [];
    }
  }

  /**
   * Remove old backups beyond retention limit
   * @param {number} retentionCount - Number of backups to keep
   */
  async cleanupOldBackups(retentionCount = 5) {
    try {
      const backups = await this.listBackups();

      if (backups.length <= retentionCount) {
        console.log(
          chalk.gray(
            `No backup cleanup needed (${backups.length} backups, keeping ${retentionCount})`
          )
        );
        return;
      }

      const backupsToRemove = backups.slice(retentionCount);
      let removedCount = 0;

      for (const backup of backupsToRemove) {
        try {
          await this.removeBackup(backup.id);
          removedCount++;
        } catch (error) {
          console.warn(
            chalk.yellow(`Warning: Failed to remove backup ${backup.id}: ${error.message}`)
          );
        }
      }

      if (removedCount > 0) {
        console.log(chalk.green(`✅ Cleaned up ${removedCount} old backups`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Backup cleanup failed: ${error.message}`));
    }
  }

  /**
   * Verify backup integrity
   * @param {string} backupPath - Path to backup directory
   * @param {Object} metadata - Backup metadata
   * @returns {boolean} True if backup is valid
   */
  async verifyBackupIntegrity(backupPath, metadata) {
    try {
      const integrityPath = path.join(backupPath, 'integrity.json');

      if (!(await this.fileExists(integrityPath))) {
        return false;
      }

      const integrity = JSON.parse(await fs.readFile(integrityPath, 'utf8'));

      // Verify all files exist and have correct checksums
      for (const fileInfo of metadata.files) {
        const backupFilePath = path.join(backupPath, 'files', fileInfo.relativePath);

        if (!(await this.fileExists(backupFilePath))) {
          return false;
        }

        const expectedChecksum = integrity.files[fileInfo.relativePath];
        if (expectedChecksum) {
          const actualChecksum = await this.calculateFileChecksum(backupFilePath);
          if (actualChecksum !== expectedChecksum) {
            return false;
          }
        }
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Identify items that need to be backed up
   * @returns {Array} List of items to backup
   * @private
   */
  async identifyBackupTargets() {
    const targets = [];

    // VDK configuration file
    const vdkConfigPath = path.join(this.projectPath, 'vdk.config.json');
    if (await this.fileExists(vdkConfigPath)) {
      targets.push({
        type: 'file',
        path: vdkConfigPath,
        relativePath: 'vdk.config.json',
      });
    }

    // VDK rule artifacts directory
    const rulesDir = path.join(this.projectPath, '.vdk', 'blueprints', 'rules');
    if (await this.fileExists(rulesDir)) {
      targets.push({
        type: 'directory',
        path: rulesDir,
        relativePath: '.vdk/blueprints/rules',
      });
    }

    // VDK migration staging directories (primary + legacy)
    const migrationDirs = [
      { path: path.join(this.projectPath, '.vdk', 'migrate'), relativePath: '.vdk/migrate' },
      { path: path.join(this.projectPath, '.vdk', 'import'), relativePath: '.vdk/import' },
    ];

    for (const migrationDir of migrationDirs) {
      if (await this.fileExists(migrationDir.path)) {
        targets.push({
          type: 'directory',
          path: migrationDir.path,
          relativePath: migrationDir.relativePath,
        });
      }
    }

    // IDE-specific configuration files that VDK might modify
    const ideConfigs = [
      '.cursorrules',
      '.cursor/rules/',
      '.windsurf/rules/',
      '.claude/',
      '.github/copilot-instructions.md',
    ];

    for (const configPath of ideConfigs) {
      const fullPath = path.join(this.projectPath, configPath);
      if (await this.fileExists(fullPath)) {
        const stats = await fs.stat(fullPath);
        targets.push({
          type: stats.isDirectory() ? 'directory' : 'file',
          path: fullPath,
          relativePath: configPath,
        });
      }
    }

    return targets;
  }

  /**
   * Backup a single item (file or directory)
   * @param {Object} item - Item to backup
   * @param {string} backupPath - Backup directory path
   * @param {Object} metadata - Backup metadata to update
   * @private
   */
  async backupItem(item, backupPath, metadata) {
    try {
      if (item.type === 'file') {
        await this.backupFile(item, backupPath, metadata);
      } else if (item.type === 'directory') {
        await this.backupDirectory(item, backupPath, metadata);
      }
    } catch (error) {
      console.warn(
        chalk.yellow(`Warning: Failed to backup ${item.relativePath}: ${error.message}`)
      );
    }
  }

  /**
   * Backup a single file
   * @param {Object} fileInfo - File information
   * @param {string} backupPath - Backup directory path
   * @param {Object} metadata - Backup metadata to update
   * @private
   */
  async backupFile(fileInfo, backupPath, metadata) {
    const backupFilePath = path.join(backupPath, 'files', fileInfo.relativePath);
    await fs.mkdir(path.dirname(backupFilePath), { recursive: true });
    await fs.copyFile(fileInfo.path, backupFilePath);

    metadata.files.push({
      ...fileInfo,
      checksum: await this.calculateFileChecksum(fileInfo.path),
    });
  }

  /**
   * Backup a directory recursively
   * @param {Object} dirInfo - Directory information
   * @param {string} backupPath - Backup directory path
   * @param {Object} metadata - Backup metadata to update
   * @private
   */
  async backupDirectory(dirInfo, backupPath, metadata) {
    const backupDirPath = path.join(backupPath, 'directories', dirInfo.relativePath);

    // Copy directory recursively
    await this.copyDirectoryRecursive(dirInfo.path, backupDirPath);

    metadata.directories.push(dirInfo);
  }

  /**
   * Copy directory recursively
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   * @private
   */
  async copyDirectoryRecursive(src, dest) {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Create integrity check file for backup
   * @param {string} backupPath - Backup directory path
   * @param {Object} metadata - Backup metadata
   * @private
   */
  async createIntegrityCheck(backupPath, metadata) {
    const integrity = {
      created: new Date().toISOString(),
      files: {},
      directories: metadata.directories.map(d => d.relativePath),
    };

    // Calculate checksums for all backed up files
    for (const fileInfo of metadata.files) {
      const backupFilePath = path.join(backupPath, 'files', fileInfo.relativePath);
      integrity.files[fileInfo.relativePath] = await this.calculateFileChecksum(backupFilePath);
    }

    const integrityPath = path.join(backupPath, 'integrity.json');
    await fs.writeFile(integrityPath, JSON.stringify(integrity, null, 2));
  }

  /**
   * Calculate MD5 checksum for a file
   * @param {string} filePath - Path to file
   * @returns {string} MD5 checksum
   * @private
   */
  async calculateFileChecksum(filePath) {
    const content = await fs.readFile(filePath);
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Check if file or directory exists
   * @param {string} filePath - Path to check
   * @returns {boolean} True if exists
   * @private
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restore a file from backup
   * @param {Object} fileInfo - File information
   * @param {string} backupPath - Backup directory path
   * @private
   */
  async restoreFile(fileInfo, backupPath) {
    const backupFilePath = path.join(backupPath, 'files', fileInfo.relativePath);
    const restorePath = path.join(this.projectPath, fileInfo.relativePath);

    await fs.mkdir(path.dirname(restorePath), { recursive: true });
    await fs.copyFile(backupFilePath, restorePath);
  }

  /**
   * Restore a directory from backup
   * @param {Object} dirInfo - Directory information
   * @param {string} backupPath - Backup directory path
   * @private
   */
  async restoreDirectory(dirInfo, backupPath) {
    const backupDirPath = path.join(backupPath, 'directories', dirInfo.relativePath);
    const restorePath = path.join(this.projectPath, dirInfo.relativePath);

    // Remove existing directory if it exists
    try {
      await fs.rm(restorePath, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    // Copy directory from backup
    await this.copyDirectoryRecursive(backupDirPath, restorePath);
  }

  /**
   * Remove current VDK files that would conflict with restoration
   * @param {Object} options - Removal options
   * @private
   */
  async removeCurrentVDKFiles(options = {}) {
    const filesToRemove = ['vdk.config.json', '.vdk/blueprints/rules'];

    for (const relativePath of filesToRemove) {
      const fullPath = path.join(this.projectPath, relativePath);
      try {
        if (await this.fileExists(fullPath)) {
          await fs.rm(fullPath, { recursive: true, force: true });
        }
      } catch (error) {
        if (!options.ignoreErrors) {
          throw error;
        }
        console.warn(chalk.yellow(`Warning: Failed to remove ${relativePath}: ${error.message}`));
      }
    }
  }

  /**
   * Remove a backup directory
   * @param {string} backupId - ID of backup to remove
   * @private
   */
  async removeBackup(backupId) {
    const backupPath = path.join(this.backupDir, backupId);
    await fs.rm(backupPath, { recursive: true, force: true });
  }
}
