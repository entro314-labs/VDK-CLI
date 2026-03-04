/**
 * Unified Sync Operations
 * ----------------------
 * Consolidated sync functionality used by both blueprints and team sync commands.
 * Eliminates duplication between SyncCommand and TeamSyncCommand.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { downloadRule, fetchRuleList } from '../blueprints-client.js';
import { BLUEPRINT_ARTIFACT_KINDS } from './blueprint-artifact-paths.js';

/**
 * Base sync operations that both blueprint and team sync can use
 */
export class SyncOperations {
  constructor(command) {
    this.command = command;
    this.hubOps = command.hubOps;
  }

  /**
   * Sync from Hub with unified error handling and progress tracking
   */
  async syncFromHub(targetDir, options = {}) {
    const { force = false, category = null, type = 'blueprints' } = options;
    const spinner = this.command.createSpinner(`Syncing ${type} from VDK Hub...`);
    spinner.start();

    try {
      if (type === 'blueprints') {
        return await this.syncBlueprintsFromHub(targetDir, { force, category }, spinner);
      } else if (type === 'team-config') {
        return await this.syncTeamConfigFromHub(targetDir, options, spinner);
      }

      throw new Error(`Unsupported sync type: ${type}`);
    } catch (error) {
      spinner.fail(`Hub sync failed`);
      this.command.logWarning(`Hub error: ${error.message}`);
      return { synced: 0, error: error.message };
    }
  }

  /**
   * Sync blueprints from Hub (original blueprint sync logic)
   */
  async syncBlueprintsFromHub(artifactsRoot, options, spinner) {
    const hubResult = await this.hubOps.syncBlueprints(options);
    const synced = hubResult.blueprints.length;

    // Save Hub blueprints by kind
    for (const blueprint of hubResult.blueprints) {
      const kind = this.resolveBlueprintKind(blueprint);
      const kindDir = path.join(artifactsRoot, kind);
      await fs.mkdir(kindDir, { recursive: true });

      const fileName = `${blueprint.slug || blueprint.id}.hub.md`;
      const filePath = path.join(kindDir, fileName);
      await fs.writeFile(filePath, blueprint.content);
    }

    spinner.succeed(`Synced ${synced} blueprints from Hub`);

    // Show change summary
    if (hubResult.changes.added.length > 0) {
      this.command.logInfo(`+ ${hubResult.changes.added.length} new`);
    }
    if (hubResult.changes.updated.length > 0) {
      this.command.logInfo(`↻ ${hubResult.changes.updated.length} updated`);
    }

    return { synced, changes: hubResult.changes };
  }

  /**
   * Sync team configuration from Hub (team sync logic)
   */
  async syncTeamConfigFromHub(projectPath, options, spinner) {
    const { teamId, force = false } = options;
    const finalTeamId = teamId || process.env.VDK_TEAM_ID;

    if (!finalTeamId) {
      throw new Error('Team ID required for Hub sync');
    }

    const { VDKHubClient } = await import('../hub/VDKHubClient.js');
    const hubClient = new VDKHubClient();

    // Check authentication
    const authStatus = await hubClient.checkAuth();
    if (!authStatus.authenticated) {
      throw new Error('VDK Hub authentication required');
    }

    // Fetch team configuration
    const teamConfig = await hubClient.getTeamConfig(finalTeamId);
    if (!teamConfig) {
      throw new Error('Team configuration not found');
    }

    // Apply team configuration
    const appliedFiles = await this.applyHubConfiguration(projectPath, teamConfig);

    spinner.succeed(`Team configuration synced from Hub`);

    return {
      synced: appliedFiles.length,
      appliedFiles,
      teamId: finalTeamId,
      lastUpdated: teamConfig.lastUpdated,
    };
  }

  /**
   * Sync from repository with unified error handling
   */
  async syncFromRepository(targetDir, options = {}) {
    const { force = false, category = null, type = 'blueprints' } = options;
    const spinner = this.command.createSpinner(`Syncing ${type} from repository...`);
    spinner.start();

    try {
      if (type === 'blueprints') {
        return await this.syncBlueprintsFromRepository(targetDir, { force, category }, spinner);
      } else if (type === 'team-config') {
        return await this.syncTeamConfigFromGit(targetDir, options, spinner);
      }

      throw new Error(`Unsupported sync type: ${type}`);
    } catch (error) {
      spinner.fail(`Repository sync failed`);
      this.command.logWarning(`Repository error: ${error.message}`);
      return { synced: 0, error: error.message };
    }
  }

  /**
   * Sync blueprints from repository (original repository sync logic)
   */
  async syncBlueprintsFromRepository(artifactsRoot, options, spinner) {
    const { force, category } = options;
    const remoteRules = await fetchRuleList();

    const rulesDir = path.join(artifactsRoot, 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    if (remoteRules.length === 0) {
      spinner.fail('No blueprints found in repository or failed to connect');
      return { synced: 0 };
    }

    const localRules = await fs.readdir(rulesDir).catch(() => []);
    let updatedCount = 0;
    let newCount = 0;

    for (const remoteRule of remoteRules) {
      // Skip if category filter is specified and doesn't match
      if (category && remoteRule.category !== category) {
        continue;
      }

      const ruleContent = await downloadRule(remoteRule.download_url);
      if (ruleContent) {
        const fileName = remoteRule.name.endsWith('.repo.md')
          ? remoteRule.name
          : `${remoteRule.name.replace(/\.md$/, '')}.repo.md`;
        const localPath = path.join(rulesDir, fileName);

        if (localRules.includes(fileName)) {
          if (force || (await this.shouldUpdate(localPath, ruleContent))) {
            await fs.writeFile(localPath, ruleContent);
            updatedCount++;
          }
        } else {
          await fs.writeFile(localPath, ruleContent);
          newCount++;
        }
      }
    }

    const totalSynced = newCount + updatedCount;
    spinner.succeed(`Synced ${totalSynced} blueprints from repository`);

    if (newCount > 0) {
      this.command.logInfo(`+ ${newCount} new`);
    }
    if (updatedCount > 0) {
      this.command.logInfo(`↻ ${updatedCount} updated`);
    }

    return { synced: totalSynced, new: newCount, updated: updatedCount };
  }

  /**
   * Sync team configuration from Git (team sync logic)
   */
  async syncTeamConfigFromGit(projectPath, options, spinner) {
    const { force = false } = options;

    // Check if this is a Git repository
    try {
      execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'ignore' });
    } catch {
      throw new Error('This project is not a Git repository');
    }

    // Pull latest changes (non-dry-run)
    if (!options.dryRun) {
      try {
        execSync('git pull', { cwd: projectPath, stdio: 'inherit' });
      } catch (_error) {
        this.command.logWarning('⚠️  Git pull failed - continuing with local files');
      }
    }

    // Check for VDK files in repository
    const vdkFiles = [];
    const filesToCheck = ['.vdk/blueprints/', '.vdk/config.json'];

    for (const file of filesToCheck) {
      const fullPath = path.join(projectPath, file);
      if (
        await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false)
      ) {
        vdkFiles.push(file);
      }
    }

    if (vdkFiles.length === 0) {
      throw new Error('No team VDK configuration found in repository');
    }

    spinner.succeed(`Synced ${vdkFiles.length} configuration files from Git`);

    return { synced: vdkFiles.length, files: vdkFiles };
  }

  /**
   * Check if local file should be updated (shared logic)
   */
  async shouldUpdate(localPath, remoteContent) {
    try {
      const localContent = await fs.readFile(localPath, 'utf8');
      return localContent.trim() !== remoteContent.trim();
    } catch {
      return true; // File doesn't exist or can't be read, should update
    }
  }

  /**
   * Create backup before sync operations (shared logic)
   */
  async createBackup(targetPath, type = 'vdk') {
    if (
      !(await fs
        .access(targetPath)
        .then(() => true)
        .catch(() => false))
    ) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(targetPath), `.${type}-backup-${timestamp}`);

    execSync(`cp -r "${targetPath}" "${backupPath}"`);
    this.command.logInfo(`📂 Configuration backed up to: .${type}-backup-${timestamp}`);

    return backupPath;
  }

  /**
   * Detect conflicts before sync (shared logic)
   */
  async detectConflicts(targetPath, force = false) {
    if (force) return [];

    const conflicts = [];

    if (
      await fs
        .access(targetPath)
        .then(() => true)
        .catch(() => false)
    ) {
      const stats = await fs.stat(targetPath);
      if (stats.isDirectory()) {
        const files = await fs.readdir(targetPath);
        files.forEach(file => {
          conflicts.push(path.join(targetPath, file));
        });
      } else {
        conflicts.push(targetPath);
      }
    }

    return conflicts;
  }

  /**
   * Apply Hub configuration (shared Hub config logic)
   */
  async applyHubConfiguration(projectPath, teamConfig) {
    const appliedFiles = [];
    const vdkPath = path.join(projectPath, '.vdk');
    const blueprintsPath = path.join(vdkPath, 'blueprints');

    // Ensure .vdk directory exists
    await fs.mkdir(vdkPath, { recursive: true });
    await fs.mkdir(blueprintsPath, { recursive: true });

    // Apply main configuration
    if (teamConfig.main) {
      const configPath = path.join(vdkPath, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(teamConfig.main, null, 2));
      appliedFiles.push('.vdk/config.json');
    }

    // Apply rule artifacts from legacy team payload
    if (teamConfig.rules) {
      await this.writeBlueprintKindFiles(blueprintsPath, 'rules', teamConfig.rules, appliedFiles);
    }

    // Apply structured artifact payload by kind
    if (teamConfig.blueprints && typeof teamConfig.blueprints === 'object') {
      for (const [kind, files] of Object.entries(teamConfig.blueprints)) {
        await this.writeBlueprintKindFiles(blueprintsPath, kind, files, appliedFiles);
      }
    }

    return appliedFiles;
  }

  resolveBlueprintKind(blueprint) {
    const normalizedKind = String(blueprint?.kind || '')
      .toLowerCase()
      .trim();

    if (BLUEPRINT_ARTIFACT_KINDS.includes(normalizedKind)) {
      return normalizedKind;
    }

    const sourceCandidates = [
      blueprint?.sourcePath,
      blueprint?.path,
      blueprint?.slug,
      blueprint?.id,
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());

    for (const candidate of sourceCandidates) {
      for (const kind of BLUEPRINT_ARTIFACT_KINDS) {
        if (
          candidate.includes(`/library/${kind}/`) ||
          candidate.includes(`/${kind}/`) ||
          candidate.startsWith(`${kind}/`)
        ) {
          return kind;
        }
      }
    }

    throw new Error(
      `Unable to determine blueprint kind for item: ${blueprint?.id || blueprint?.slug || 'unknown'}`
    );
  }

  async writeBlueprintKindFiles(blueprintsPath, kind, files, appliedFiles) {
    const normalizedKind = String(kind || '')
      .toLowerCase()
      .trim();

    if (!BLUEPRINT_ARTIFACT_KINDS.includes(normalizedKind)) {
      throw new Error(`Unsupported blueprint artifact kind: ${kind}`);
    }

    if (!files || typeof files !== 'object') {
      return;
    }

    const kindPath = path.join(blueprintsPath, normalizedKind);
    await fs.mkdir(kindPath, { recursive: true });

    for (const [relativeFilePath, content] of Object.entries(files)) {
      const outputPath = path.join(kindPath, relativeFilePath);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, content);
      appliedFiles.push(`.vdk/blueprints/${normalizedKind}/${relativeFilePath}`);
    }
  }
}
