/**
 * SchemaUpgradeCommand
 * ====================
 * Upgrade blueprints from v2.x to AI Context Schema v3.0
 */

import path from 'node:path';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class SchemaUpgradeCommand extends BaseCommand {
  constructor() {
    super('schema-upgrade', 'Upgrade blueprints from v2.x to AI Context Schema v3.0');
  }

  /**
   * Configure command options
   */
  configureOptions(command) {
    return command
      .option('-i, --input <path>', 'Input directory containing blueprints', './blueprints')
      .option('-o, --output <path>', 'Output directory for v3.0 blueprints')
      .option('--force', 'Force upgrade even if already v3.0', false)
      .option('--dry-run', 'Preview upgrade without making changes', false)
      .option('--in-place', 'Upgrade files in-place (overwrites originals)', false)
      .option('-v, --verbose', 'Show detailed upgrade progress', false);
  }

  /**
   * Execute schema upgrade
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    try {
      const { SchemaV3Migrator } = await import('../../migration/converters/schema-v3-migrator.js');

      const inputPath = path.resolve(options.input);
      const outputPath = options.inPlace
        ? inputPath
        : options.output
          ? path.resolve(options.output)
          : `${inputPath}_v3`;

      if (options.dryRun) {
        this.logInfo('🔍 DRY RUN: No files will be modified\n');
      }

      if (options.inPlace && !options.dryRun) {
        this.logWarning('⚠️  IN-PLACE MODE: Original files will be overwritten');
        this.logInfo('   Consider backing up your files first\n');
      }

      console.log(`Input:  ${this.formatPath(inputPath)}`);
      console.log(`Output: ${this.formatPath(outputPath)}`);
      console.log('');

      const migrator = new SchemaV3Migrator({
        verbose: options.verbose,
        force: options.force,
      });

      if (options.dryRun) {
        return await this.performDryRun(migrator, inputPath);
      } else {
        return await this.performUpgrade(migrator, inputPath, outputPath, options);
      }
    } catch (error) {
      this.exitWithError(`Schema upgrade failed: ${error.message}`, error);
    }
  }

  /**
   * Perform dry run analysis
   */
  async performDryRun(migrator, inputPath) {
    const spinner = this.createSpinner('Analyzing blueprints for v3.0 upgrade...');
    spinner.start();

    try {
      const files = await migrator.findBlueprintFiles(inputPath);
      spinner.text = `Analyzing ${files.length} blueprint files...`;

      let needsUpgrade = 0;
      let alreadyV3 = 0;
      const filesToUpgrade = [];

      for (const filePath of files) {
        try {
          const fs = await import('node:fs/promises');
          const matter = (await import('gray-matter')).default;

          const content = await fs.readFile(filePath, 'utf8');
          const parsed = matter(content);

          if (migrator.isV3Format(parsed.data)) {
            alreadyV3++;
          } else {
            needsUpgrade++;
            filesToUpgrade.push(path.basename(filePath));
          }
        } catch (error) {
          if (this.verbose) {
            this.logWarning(`Skipped problematic file: ${filePath}`);
          }
        }
      }

      spinner.succeed('Analysis complete');

      console.log(`\n📊 Upgrade Preview:`);
      console.log(`   Files found: ${files.length}`);
      console.log(`   Need upgrade: ${needsUpgrade}`);
      console.log(`   Already v3.0: ${alreadyV3}`);

      if (needsUpgrade > 0) {
        console.log(`\n📝 Files to upgrade (showing first 10):`);
        filesToUpgrade.slice(0, 10).forEach(f => console.log(`   • ${f}`));
        if (needsUpgrade > 10) {
          console.log(`   ... and ${needsUpgrade - 10} more`);
        }
      }

      return {
        success: true,
        mode: 'dry-run',
        filesFound: files.length,
        needsUpgrade,
        alreadyV3,
      };
    } catch (error) {
      spinner.fail('Analysis failed');
      throw error;
    }
  }

  /**
   * Perform actual upgrade
   */
  async performUpgrade(migrator, inputPath, outputPath, options) {
    const spinner = this.createSpinner('Upgrading blueprints to v3.0...');
    spinner.start();

    try {
      const results = await migrator.migrateBlueprints(inputPath, outputPath, options);

      spinner.succeed(`Upgraded ${results.migrated} blueprint(s) to v3.0`);

      console.log(`\n✅ Upgrade Summary:`);
      console.log(`   Processed: ${results.processed}`);
      console.log(`   Upgraded: ${results.migrated}`);
      console.log(`   Skipped: ${results.skipped}`);

      if (results.errors > 0) {
        console.log(`   Errors: ${results.errors}`);
      }

      if (options.verbose && results.migrated > 0) {
        console.log(`\n📝 Changes made:`);
        console.log(`   • Added schemaVersion: "3.0" to all files`);
        console.log(`   • Restructured platforms with components architecture`);
        console.log(`   • Added source tracking metadata`);
        console.log(`   • Migrated component manifests`);
      }

      console.log(`\n📂 Output: ${this.formatPath(outputPath)}`);

      return {
        success: true,
        mode: 'upgrade',
        ...results,
      };
    } catch (error) {
      spinner.fail('Upgrade failed');
      throw error;
    }
  }
}

export default SchemaUpgradeCommand;
