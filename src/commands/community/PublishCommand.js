/**
 * PublishCommand
 * -----------------------
 * Publish your VDK rules to the community via Hub or GitHub PR.
 */

import { colors } from '../../utils/cli-styles.js';
import { BaseCommand } from '../base/BaseCommand.js';
import { commandContext } from '../shared/CommandContext.js';

export class PublishCommand extends BaseCommand {
  constructor() {
    super('publish', 'Publish your VDK rules to the community');
  }

  /**
   * Configure command-specific options
   */
  configureOptions(command) {
    return command
      .argument('[rule-file]', 'Rule file to publish (.mdc, .md, .json, .xml)')
      .option(
        '--github',
        'Publish via GitHub PR instead of VDK Hub (no registration required)',
        false
      )
      .option('--private', 'Create private share link (Hub only)', false)
      .option('--name <name>', 'Custom name for the published rule')
      .option('--preview', 'Preview what would be published without actually publishing', false)
      .option('-v, --verbose', 'Enable verbose output', false);
  }

  /**
   * Execute the publish command
   */
  async execute(options) {
    await commandContext.initialize();
    this.showHeader();

    const ruleFile = options.args?.[0];
    if (!ruleFile) {
      this.exitWithError('Rule file argument is required. Use --help for usage information');
    }

    try {
      const { PublishManager } = await import('../../publishing/PublishManager.js');
      const publisher = new PublishManager(process.cwd());

      if (options.preview) {
        return await this.showPublishPreview(publisher, ruleFile);
      }

      return await this.executePublish(publisher, ruleFile, options);
    } catch (error) {
      this.exitWithError(`Publishing failed: ${error.message}`, error);
    }
  }

  /**
   * Show publish preview
   */
  async showPublishPreview(publisher, ruleFile) {
    const spinner = this.createSpinner('Generating publication preview...');
    spinner.start();

    const preview = await publisher.previewPublication(ruleFile);
    spinner.succeed('Preview generated');

    console.log('');
    console.log(this.colorCyan('📋 Publication Preview:'));
    console.log(colors.muted(`   ${preview.summary}`));
    console.log('');

    if (preview.validation.qualityScore) {
      console.log(this.colorCyan(`📊 Quality Score: ${preview.validation.qualityScore}/10`));
    }

    if (preview.recommendations.length > 0) {
      console.log('');
      console.log(colors.warning('💡 Recommendations:'));
      preview.recommendations.forEach(rec => {
        console.log(colors.muted(`   • ${rec}`));
      });
    }

    if (preview.validation.warnings.length > 0) {
      console.log('');
      console.log(colors.warning('⚠️  Warnings:'));
      preview.validation.warnings.forEach(warning => {
        console.log(colors.warning(`   • ${warning}`));
      });
    }

    return preview;
  }

  /**
   * Execute actual publishing
   */
  async executePublish(publisher, ruleFile, options) {
    const result = await publisher.publish(ruleFile, {
      github: options.github,
      private: options.private,
      name: options.name,
      verbose: options.verbose,
    });

    if (result.success) {
      console.log('');
      console.log(colors.green('🎉 Rule published successfully!'));

      if (result.platform === 'hub') {
        this.showHubPublishResult(result);
      } else if (result.platform === 'github') {
        this.showGitHubPublishResult(result);
      }

      this.trackSuccess({
        platform: result.platform,
        ruleFile: ruleFile,
        private: options.private,
      });
    }

    return result;
  }

  /**
   * Show Hub publication result
   */
  showHubPublishResult(result) {
    console.log('');
    console.log(this.colorCyan('🔗 Share your rule:'));
    console.log(colors.muted(`   ${result.shareUrl}`));
    console.log('');
    console.log(this.colorCyan('📧 Check your email to activate permanent sharing'));
    console.log(this.colorCyan('💡 Community can use with:'));
    console.log(colors.muted('   vdk sync'));
  }

  /**
   * Show GitHub publication result
   */
  showGitHubPublishResult(result) {
    console.log('');
    console.log(this.colorCyan('📝 GitHub PR created:'));
    console.log(colors.muted(`   ${result.prUrl}`));
    console.log('');
    console.log(this.colorCyan('⏳ After community review and merge:'));
    console.log(colors.muted('   vdk sync'));
  }
}
