/**
 * SchemaMigrateCommand
 * -----------------------
 * Migrate existing blueprints to AI Context Schema v2.1.0 format.
 * Supports dry-run mode and comprehensive migration reporting.
 */

import { BaseCommand } from '../base/BaseCommand.js'
import { commandContext } from '../shared/CommandContext.js'
import path from 'node:path'

export class SchemaMigrateCommand extends BaseCommand {
  constructor() {
    super('schema-migrate', 'Migrate existing blueprints to AI Context Schema v2.1.0 format')
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .option('-i, --input <path>', 'Input directory containing blueprints', './.vdk/rules')
      .option('-o, --output <path>', 'Output directory for migrated blueprints')
      .option('--force', 'Force migration even if already in v2.1.0 format', false)
      .option('--dry-run', 'Preview migration without making changes', false)
      .option('-v, --verbose', 'Show detailed migration progress', false)
  }

  /**
   * Execute the schema migration command
   */
  async execute(options) {
    await commandContext.initialize()
    this.showHeader()

    try {
      const { SchemaMigrator } = await import('../../migration/converters/schema-migrator.js')

      const inputPath = path.resolve(options.input)
      const outputPath = options.output ? path.resolve(options.output) : inputPath + '_v2'

      if (options.dryRun) {
        this.logInfo('DRY RUN: No files will be modified')
      }

      console.log(`Input:  ${this.formatPath(inputPath)}`)
      console.log(`Output: ${this.formatPath(outputPath)}`)

      const migrator = new SchemaMigrator({ verbose: options.verbose })

      if (options.dryRun) {
        return await this.performDryRun(migrator, inputPath)
      } else {
        return await this.performMigration(migrator, inputPath, outputPath, options)
      }
    } catch (error) {
      this.exitWithError(`Schema migration failed: ${error.message}`, error)
    }
  }

  /**
   * Perform dry run analysis
   */
  async performDryRun(migrator, inputPath) {
    const spinner = this.createSpinner('Analyzing blueprints for migration...')
    spinner.start()

    try {
      const files = await migrator.findBlueprintFiles(inputPath)
      spinner.text = `Analyzing ${files.length} blueprint files...`

      let needsMigration = 0
      let alreadyMigrated = 0

      for (const filePath of files) {
        try {
          const fs = await import('node:fs/promises')
          const matter = (await import('gray-matter')).default

          const content = await fs.readFile(filePath, 'utf8')
          const parsed = matter(content)

          if (migrator.isAlreadyMigrated(parsed.data)) {
            alreadyMigrated++
          } else {
            needsMigration++
          }
        } catch (error) {
          // Skip problematic files for dry run
          if (this.verbose) {
            this.logWarning(`Skipped problematic file: ${filePath}`)
          }
        }
      }

      spinner.succeed('Analysis complete')

      console.log(`\nMigration Preview:`)
      console.log(`- Files found: ${files.length}`)
      console.log(`- Need migration: ${needsMigration}`)
      console.log(`- Already migrated: ${alreadyMigrated}`)

      if (needsMigration > 0) {
        this.logInfo('Run without --dry-run to perform migration')
      } else {
        this.logSuccess('All blueprints are already in v2.1.0 format')
      }

      this.trackSuccess({
        mode: 'dry-run',
        filesFound: files.length,
        needsMigration,
        alreadyMigrated,
      })

      return {
        filesFound: files.length,
        needsMigration,
        alreadyMigrated,
        dryRun: true,
      }
    } catch (error) {
      spinner.fail('Analysis failed')
      throw error
    }
  }

  /**
   * Perform actual migration
   */
  async performMigration(migrator, inputPath, outputPath, options) {
    const spinner = this.createSpinner('Migrating blueprints...')
    spinner.start()

    try {
      const results = await migrator.migrateBlueprints(inputPath, outputPath, {
        force: options.force,
        verbose: options.verbose,
      })

      spinner.succeed('Migration complete')

      this.displayMigrationResults(results, outputPath, options.verbose)

      this.trackSuccess({
        mode: 'migration',
        processed: results.processed,
        migrated: results.migrated,
        skipped: results.skipped,
        errors: results.errors,
      })

      return results
    } catch (error) {
      spinner.fail('Migration failed')
      throw error
    }
  }

  /**
   * Display migration results
   */
  displayMigrationResults(results, outputPath, verbose) {
    console.log(`\nResults:`)
    console.log(`- Processed: ${results.processed}`)
    console.log(`- Migrated: ${results.migrated}`)
    console.log(`- Skipped: ${results.skipped}`)
    console.log(`- Errors: ${results.errors}`)

    if (results.migrated > 0) {
      this.logSuccess(`${results.migrated} blueprints migrated to v2.1.0`)
      this.logInfo(`Run ${this.colorPrimary('vdk validate --path ' + outputPath)} to verify migrations`)
    }

    if (results.errors > 0) {
      this.logWarning(`${results.errors} files had errors during migration`)
      if (verbose && results.files) {
        results.files.filter((f) => f.error).forEach((f) => console.log(`  ✗ ${f.file}: ${f.error}`))
      }
    }

    if (results.migrated === 0 && results.errors === 0) {
      this.logInfo('No blueprints required migration')
    }
  }
}
