/**
 * Migration Manager
 * -----------------
 * Orchestrates the migration of existing AI contexts to VDK format
 * by leveraging existing VDK components (scanners, analyzers, generators).
 * 
 * Integrates with:
 * - ProjectScanner for file discovery
 * - TechnologyAnalyzer for tech stack detection
 * - RuleGenerator for blueprint creation
 * - IntegrationManager for platform-specific deployment
 * - Existing schema validation and templating systems
 */

import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import matter from 'gray-matter'

// Use existing VDK components
import { ProjectScanner } from '../scanner/core/ProjectScanner.js'
import { TechnologyAnalyzer } from '../scanner/core/TechnologyAnalyzer.js'
import { RuleGenerator } from '../scanner/core/RuleGenerator.js'
import { createIntegrationManager } from '../integrations/index.js'
import { format, status, spinners } from '../utils/cli-styles.js'
import { MigrationDetector } from './core/migration-detector.js'
import { MigrationAdapter } from './core/migration-adapter.js'

export class MigrationManager {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd()
    this.outputPath = options.outputPath || path.join(this.projectPath, '.ai', 'rules')
    this.migrationOutputPath = options.migrationOutputPath || path.join(this.projectPath, 'vdk-migration')
    this.verbose = options.verbose
    
    // Use existing VDK components
    this.projectScanner = new ProjectScanner({
      projectPath: this.projectPath,
      verbose: this.verbose
    })
    
    this.techAnalyzer = new TechnologyAnalyzer({ verbose: this.verbose })
    
    this.ruleGenerator = new RuleGenerator(
      this.outputPath,
      'migration', // Use migration template
      true, // Allow overwrite
      { verbose: this.verbose, projectPath: this.projectPath }
    )
    
    // Migration-specific components
    this.migrationDetector = new MigrationDetector(this.projectPath)
    this.migrationAdapter = new MigrationAdapter()
    
    // Integration manager for deployment
    this.integrationManager = null
    
    // Migration results
    this.results = {
      detected: [],
      converted: [],
      generated: [],
      deployed: { successful: [], failed: [], integrations: [] },
      failed: [],
      skipped: []
    }
  }

  /**
   * Main migration workflow using existing VDK architecture
   * @param {Object} options Migration options
   * @returns {Object} Migration results
   */
  async migrate(options = {}) {
    const { dryRun = false, overwrite = false, deployToIdes = true } = options
    const spinner = ora({ text: 'Starting AI context migration...', color: 'cyan' })
    
    try {
      spinner.start()
      console.log(chalk.blue('🚀 VDK Migration System'))
      
      // Step 1: Scan project using existing ProjectScanner
      spinner.text = 'Scanning project structure...'
      const projectData = await this.projectScanner.scanProject(this.projectPath)
      
      // Step 2: Analyze technologies using existing TechnologyAnalyzer  
      spinner.text = 'Analyzing technology stack...'
      const techData = await this.techAnalyzer.analyzeTechnologies(projectData)
      
      // Step 3: Detect existing AI contexts in the project
      spinner.text = 'Detecting existing AI contexts...'
      const migrationContexts = await this.migrationDetector.detectAIContexts(projectData)
      
      spinner.succeed(`Found ${migrationContexts.length} AI contexts to migrate`)
      this.results.detected = migrationContexts
      
      if (migrationContexts.length === 0) {
        console.log(chalk.yellow('No existing AI contexts found to migrate'))
        console.log(chalk.gray('Tip: Run `vdk init` to generate fresh AI contexts for your project'))
        return this.results
      }
      
      // Step 4: Adapt contexts to VDK format
      spinner.text = 'Converting contexts to VDK format...'
      const adaptedContexts = await this.migrationAdapter.adaptContextsToVDK(
        migrationContexts, 
        { projectData, techData }
      )
      
      this.results.converted = adaptedContexts.successful
      this.results.failed = adaptedContexts.failed
      
      if (!dryRun) {
        // Step 5: Generate VDK blueprints using existing RuleGenerator
        spinner.text = 'Generating VDK blueprints...'
        const generatedRules = await this.generateVDKBlueprints(adaptedContexts.successful, {
          projectData,
          techData,
          overwrite
        })
        
        // Keep it as array for consistency
        if (generatedRules && typeof generatedRules === 'object') {
          this.results.generated.push({
            id: 'vdk-rules',
            path: this.outputPath,
            type: 'rules-package',
            details: generatedRules
          })
        }
        
        // Step 6: Deploy to IDE integrations if requested
        if (deployToIdes) {
          spinner.text = 'Deploying to IDE integrations...'
          const deployResults = await this.deployToIntegrations(generatedRules)
          this.results.deployed = deployResults
        }
        
        // Step 7: Create migration report
        await this.generateMigrationReport()
        
        spinner.succeed('Migration completed successfully!')
        this.showResults()
      } else {
        spinner.succeed('Dry run completed')
        this.showDryRunResults()
      }
      
      return this.results
    } catch (error) {
      spinner.fail(`Migration failed: ${error.message}`)
      if (this.verbose) {
        console.error(chalk.red(error.stack))
      }
      throw error
    }
  }

  /**
   * Generate VDK blueprints from adapted contexts using existing RuleGenerator
   * @param {Array} adaptedContexts Adapted contexts
   * @param {Object} options Generation options
   * @returns {Array} Generated blueprints
   */
  async generateVDKBlueprints(adaptedContexts, options = {}) {
    const { projectData, techData, overwrite } = options
    const generatedRules = []
    
    // Prepare analysis data for RuleGenerator (using existing format)
    const analysisData = {
      projectStructure: {
        root: this.projectPath,
        files: projectData.files,
        directories: projectData.directories,
        fileCount: projectData.files?.length || 0,
        directoryCount: projectData.directories?.length || 0,
        fileTypes: projectData.fileTypes
      },
      technologyData: techData,
      patterns: { migrationContexts: adaptedContexts }, // Pass contexts as patterns
      outputPath: this.outputPath,
      migrationMode: true // Flag to indicate migration mode
    }
    
    try {
      // Use existing RuleGenerator to create IDE-specific files
      const ruleResults = await this.ruleGenerator.generateIDESpecificRules(analysisData)
      
      // Also create migration-specific blueprints
      await this.createMigrationBlueprints(adaptedContexts)
      
      // Track generated files
      if (ruleResults?.generatedRules) {
        for (const [integration, rules] of Object.entries(ruleResults.generatedRules)) {
          if (rules?.files) {
            for (const file of rules.files) {
              this.results.generated.push({
                id: `${integration}-rule`,
                path: file.path || file,
                type: 'rule'
              })
            }
          }
        }
      }
      
      return ruleResults
    } catch (error) {
      throw new Error(`Blueprint generation failed: ${error.message}`)
    }
  }

  /**
   * Create migration-specific blueprint files
   * @param {Array} adaptedContexts Adapted contexts
   */
  async createMigrationBlueprints(adaptedContexts) {
    // Ensure migration output directory exists
    await fs.promises.mkdir(this.migrationOutputPath, { recursive: true })
    
    for (const context of adaptedContexts) {
      const filename = `${context.id}.blueprint.md`
      const filepath = path.join(this.migrationOutputPath, filename)
      
      // Create blueprint content with frontmatter + content
      const frontmatter = {
        id: context.id,
        title: context.title,
        description: context.description,
        version: context.version,
        category: context.category,
        platforms: context.platforms,
        tags: context.tags,
        author: context.author,
        lastUpdated: context.lastUpdated,
        migration: context.migration
      }
      
      // Remove undefined values
      Object.keys(frontmatter).forEach(key => {
        if (frontmatter[key] === undefined) {
          delete frontmatter[key]
        }
      })
      
      const blueprintContent = matter.stringify(context.content || '', frontmatter)
      
      await fs.promises.writeFile(filepath, blueprintContent, 'utf-8')
      this.results.generated.push({
        id: context.id,
        path: filepath,
        type: 'blueprint'
      })
    }
  }

  /**
   * Deploy generated blueprints to IDE integrations using existing IntegrationManager
   * @param {Array} generatedRules Generated rules from RuleGenerator
   * @returns {Object} Deployment results
   */
  async deployToIntegrations(generatedRules) {
    if (!this.integrationManager) {
      this.integrationManager = createIntegrationManager(this.projectPath)
      
      // Discover and scan integrations
      await this.integrationManager.discoverIntegrations({ verbose: this.verbose })
      await this.integrationManager.scanAll({ verbose: this.verbose })
    }
    
    // Initialize active integrations
    const initResults = await this.integrationManager.initializeActive({ 
      verbose: this.verbose,
      migrationMode: true // Flag to indicate this is migration deployment
    })
    
    return {
      successful: initResults.successful,
      failed: initResults.failed,
      integrations: this.integrationManager.getActiveIntegrations().map(i => i.name)
    }
  }

  /**
   * Show migration results
   */
  showResults() {
    console.log(chalk.green('\n✅ Migration completed successfully!'))
    
    if (this.results.detected.length > 0) {
      console.log(chalk.blue('\n📊 Migration Summary:'))
      console.log(`• Detected contexts: ${this.results.detected.length}`)
      console.log(`• Converted contexts: ${this.results.converted.length}`)
      console.log(`• Generated blueprints: ${this.results.generated.length}`)
      
      if (this.results.deployed.successful?.length > 0) {
        console.log(`• Deployed to IDEs: ${this.results.deployed.successful.length}`)
      }
      
      if (this.results.failed.length > 0) {
        console.log(chalk.yellow(`• Failed conversions: ${this.results.failed.length}`))
      }
    }
    
    console.log(chalk.cyan('\n📁 Generated Files:'))
    if (this.results.generated.length > 0) {
      this.results.generated.forEach(file => {
        console.log(`• ${file.path}`)
      })
    }
    
    console.log(chalk.cyan('\n🎯 Next Steps:'))
    console.log('1. Review migrated blueprints in vdk-migration/ folder')
    console.log('2. Copy desired blueprints to .ai/rules/ directory')  
    console.log('3. Run `vdk init --overwrite` to apply migrated contexts')
    console.log('4. Test AI assistant integrations with new contexts')
    
    if (this.results.deployed.integrations?.length > 0) {
      console.log(chalk.green(`\n🚀 Auto-deployed to: ${this.results.deployed.integrations.join(', ')}`))
    }
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport() {
    const report = {
      migrationDate: new Date().toISOString(),
      projectPath: this.projectPath,
      outputPath: this.outputPath,
      migrationOutputPath: this.migrationOutputPath,
      summary: {
        detected: this.results.detected.length,
        converted: this.results.converted.length,
        generated: this.results.generated.length,
        deployed: this.results.deployed.successful?.length || 0,
        failed: this.results.failed.length,
        skipped: this.results.skipped.length
      },
      detectedContexts: this.results.detected.map(ctx => ({
        type: ctx.type,
        source: ctx.source,
        filePath: ctx.filePath,
        confidence: ctx.confidence
      })),
      convertedContexts: this.results.converted.map(ctx => ({
        id: ctx.id,
        title: ctx.title,
        category: ctx.category,
        originalSource: ctx.migration?.originalSource,
        originalPath: ctx.migration?.originalPath
      })),
      generatedFiles: this.results.generated.map(file => ({
        id: file.id,
        path: file.path,
        type: file.type
      })),
      deploymentResults: this.results.deployed,
      failedConversions: this.results.failed.map(fail => ({
        originalFile: fail.context?.filePath || fail.context?.relativePath,
        error: fail.error
      })),
      skippedContexts: this.results.skipped.map(skip => ({
        originalFile: skip.context?.filePath || skip.context?.relativePath,
        reason: skip.reason
      }))
    }
    
    const reportPath = path.join(this.migrationOutputPath, 'migration-report.json')
    await fs.promises.mkdir(this.migrationOutputPath, { recursive: true })
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    // Also create a human-readable report
    const readmePath = path.join(this.migrationOutputPath, 'README.md')
    const readmeContent = this.generateReadmeContent(report)
    await fs.promises.writeFile(readmePath, readmeContent)
    
    if (this.verbose) {
      console.log(chalk.gray(`Migration report saved to ${reportPath}`))
    }
  }

  /**
   * Show dry run results
   */
  showDryRunResults() {
    console.log(chalk.blue('\n🔍 Dry Run Results:'))
    console.log(`• Would detect: ${this.results.detected.length} AI contexts`)
    console.log(`• Would convert: ${this.results.converted.length} contexts`)
    
    if (this.results.failed.length > 0) {
      console.log(chalk.yellow(`• Would fail: ${this.results.failed.length} conversions`))
      console.log('\nFailure details:')
      this.results.failed.forEach(failure => {
        console.log(`  • ${failure.context.relativePath}: ${failure.error}`)
      })
    }
    
    if (this.results.detected.length > 0) {
      console.log('\nDetected contexts by type:')
      const byType = {}
      this.results.detected.forEach(ctx => {
        byType[ctx.type] = (byType[ctx.type] || 0) + 1
      })
      
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`  • ${type}: ${count} contexts`)
      })
    }
    
    console.log(chalk.gray('\nRun without --dry-run to perform actual migration.'))
  }

  /**
   * Show dry run results
   */
  showDryRunResults() {
    console.log(chalk.blue('\n🔍 Dry Run Results:'))
    console.log(`• Would detect: ${this.results.detected.length} AI contexts`)
    console.log(`• Would convert: ${this.results.converted.length} contexts`)
    
    if (this.results.failed.length > 0) {
      console.log(chalk.yellow(`• Would fail: ${this.results.failed.length} conversions`))
      console.log('\\nFailure details:')
      this.results.failed.forEach(failure => {
        const filePath = failure.context?.filePath || failure.context?.relativePath || 'unknown'
        console.log(`  • ${filePath}: ${failure.error}`)
      })
    }
  }

  /**
   * Generate README content for migration
   * @param {Object} report Migration report data
   * @returns {string} README content
   */
  generateReadmeContent(report) {
    const detectionsByType = report.detectedContexts.reduce((acc, ctx) => {
      acc[ctx.type] = (acc[ctx.type] || 0) + 1
      return acc
    }, {})

    return `# VDK Migration Report

Generated on: ${new Date(report.migrationDate).toLocaleString()}

## Summary

- **Detected contexts**: ${report.summary.detected}
- **Converted contexts**: ${report.summary.converted}
- **Generated blueprints**: ${report.summary.generated}
- **Deployed to IDEs**: ${report.summary.deployed}
- **Failed conversions**: ${report.summary.failed}
- **Skipped contexts**: ${report.summary.skipped}

## Migration Process

This migration used VDK's existing infrastructure:
- **ProjectScanner** for file discovery
- **TechnologyAnalyzer** for tech stack detection  
- **RuleGenerator** for blueprint creation
- **IntegrationManager** for IDE deployment

## Next Steps

1. **Review Generated Blueprints**
   - Check the generated blueprint files in this directory
   - Verify the content and metadata are correct

2. **Apply to Project**
   - Copy desired blueprints to your project's \`.ai/rules/\` directory
   - Or run \`vdk init --overwrite\` to regenerate with migrated contexts

3. **Test AI Integration**
   - Verify your AI assistant can access the new contexts
   - Test that the rules and memories work as expected

## Generated Files

${report.generatedFiles.map(file => `- \`${path.basename(file.path)}\` (${file.type})`).join('\n')}

## Detected Context Types

${Object.entries(detectionsByType).map(([type, count]) => `- **${type}**: ${count} contexts`).join('\n')}

${report.failedConversions.length > 0 ? `\n## Failed Conversions\n\n${report.failedConversions.map(fail => `- \`${fail.originalFile}\`: ${fail.error}`).join('\n')}\n` : ''}

---

*This migration was powered by VDK*
`
  }

  /**
   * Get migration statistics
   * @returns {Object} Migration statistics
   */
  getStats() {
    return {
      detected: this.results.detected.length,
      converted: this.results.converted.length,
      generated: this.results.generated.length,
      deployed: this.results.deployed.successful?.length || 0,
      failed: this.results.failed.length,
      skipped: this.results.skipped.length,
      successRate: this.results.detected.length > 0 
        ? ((this.results.converted.length / this.results.detected.length) * 100).toFixed(1)
        : 0
    }
  }
}