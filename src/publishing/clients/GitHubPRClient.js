/**
 * GitHubPRClient - Automated GitHub PR Creation
 *
 * Handles automated creation of pull requests to the VDK-Blueprints repository
 * for community rule contributions through the GitHub pathway.
 *
 * Features:
 * - Repository forking and branch creation
 * - Automated file creation and PR submission
 * - PR template with review checklist
 * - No registration required (uses GitHub account)
 * - Community review process integration
 */

import { Octokit } from '@octokit/rest'
import chalk from 'chalk'
import matter from 'gray-matter'

export class GitHubPRClient {
  constructor() {
    this.octokit = null
    this.repoOwner = 'entro314-labs'
    this.repoName = 'VDK-Blueprints'
    this.baseBranch = 'main'
  }

  /**
   * Initialize GitHub client with authentication
   */
  async initialize() {
    if (this.octokit) return

    const token = process.env.GITHUB_TOKEN || process.env.VDK_GITHUB_TOKEN

    if (!token) {
      throw new Error(`GitHub token required. Set GITHUB_TOKEN or VDK_GITHUB_TOKEN environment variable.
      
Get a token from: https://github.com/settings/tokens
Required permissions: public_repo, read:user`)
    }

    this.octokit = new Octokit({
      auth: token,
      userAgent: 'VDK-CLI/1.0.0',
    })

    // Verify token works
    try {
      await this.octokit.rest.users.getAuthenticated()
    } catch (error) {
      throw new Error(`GitHub authentication failed: ${error.message}`)
    }
  }

  /**
   * Create community blueprint PR
   */
  async createCommunityBlueprintPR({ blueprint, originalPath, projectContext, qualityScore, customName }) {
    await this.initialize()

    try {
      // Get authenticated user info
      const { data: user } = await this.octokit.rest.users.getAuthenticated()

      // Generate blueprint filename and ID
      const blueprintId = customName || this.generateBlueprintId(blueprint.frontmatter, user.login)
      const filename = `${blueprintId}.yaml`
      const filePath = `community/${blueprint.frontmatter.category}/${filename}`

      // Check if user has forked the repo
      const forkData = await this.ensureFork(user.login)

      // Create branch for this contribution
      const branchName = `community-blueprint-${blueprintId}`
      await this.createBranch(user.login, branchName)

      // Convert blueprint to YAML format for storage
      const yamlContent = this.convertBlueprintToYAML(blueprint, projectContext, originalPath)

      // Create file in the fork
      await this.createFile(user.login, branchName, filePath, yamlContent, blueprintId)

      // Create pull request
      const prData = await this.createPullRequest(user.login, branchName, blueprint.frontmatter, qualityScore, filePath)

      return {
        success: true,
        prUrl: prData.html_url,
        prNumber: prData.number,
        blueprintId: blueprintId,
        branchName: branchName,
        filePath: filePath,
      }
    } catch (error) {
      // Provide helpful error messages for common issues
      if (error.message.includes('Bad credentials')) {
        throw new Error('GitHub token is invalid. Please check your GITHUB_TOKEN environment variable.')
      }

      if (error.message.includes('Not Found')) {
        throw new Error(`Repository ${this.repoOwner}/${this.repoName} not found or not accessible.`)
      }

      throw new Error(`GitHub PR creation failed: ${error.message}`)
    }
  }

  /**
   * Ensure user has forked the repository
   */
  async ensureFork(username) {
    try {
      // Check if fork exists
      const { data: fork } = await this.octokit.rest.repos.get({
        owner: username,
        repo: this.repoName,
      })

      return fork
    } catch (error) {
      if (error.status === 404) {
        // Fork doesn't exist, create it
        console.log(chalk.gray('Creating fork of VDK-Blueprints repository...'))

        const { data: fork } = await this.octokit.rest.repos.createFork({
          owner: this.repoOwner,
          repo: this.repoName,
        })

        // Wait a moment for fork to be ready
        await new Promise((resolve) => setTimeout(resolve, 3000))

        return fork
      }

      throw error
    }
  }

  /**
   * Create branch for the new rule
   */
  async createBranch(username, branchName) {
    try {
      // Get the latest commit SHA from the base branch
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner: username,
        repo: this.repoName,
        ref: `heads/${this.baseBranch}`,
      })

      // Create new branch
      await this.octokit.rest.git.createRef({
        owner: username,
        repo: this.repoName,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      })
    } catch (error) {
      if (error.status === 422) {
        // Branch might already exist
        console.warn(chalk.yellow(`Branch ${branchName} may already exist, continuing...`))
        return
      }

      throw new Error(`Failed to create branch: ${error.message}`)
    }
  }

  /**
   * Create file with rule content
   */
  async createFile(username, branchName, filePath, content, blueprintId) {
    try {
      const message = `Add community blueprint: ${blueprintId}`

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: username,
        repo: this.repoName,
        path: filePath,
        message: message,
        content: Buffer.from(content).toString('base64'),
        branch: branchName,
      })
    } catch (error) {
      throw new Error(`Failed to create file: ${error.message}`)
    }
  }

  /**
   * Create pull request
   */
  async createPullRequest(username, branchName, frontmatter, qualityScore, filePath) {
    const title = `Add community blueprint: ${frontmatter.title}`
    const body = this.generatePRDescription(frontmatter, qualityScore, filePath)

    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner: this.repoOwner,
        repo: this.repoName,
        title: title,
        head: `${username}:${branchName}`,
        base: this.baseBranch,
        body: body,
        maintainer_can_modify: true,
      })

      return pr
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error.message}`)
    }
  }

  /**
   * Convert VDK rule to YAML format for GitHub storage
   */
  convertBlueprintToYAML(blueprint, projectContext, originalPath) {
    const yamlFrontmatter = {
      ...blueprint.frontmatter,
      // Add GitHub-specific metadata
      contributedBy: 'VDK CLI Community',
      contributedAt: new Date().toISOString(),
      originalFile: originalPath ? originalPath.split('/').pop() : 'unknown',
      projectContext: {
        name: projectContext.name,
        framework: projectContext.framework,
        language: projectContext.language,
        technologies: projectContext.technologies,
      },
    }

    // Use matter to serialize back to frontmatter + content
    const yamlContent = matter.stringify(blueprint.content, yamlFrontmatter)

    return yamlContent
  }

  /**
   * Generate rule ID for filename
   */
  generateBlueprintId(frontmatter, username) {
    const title = frontmatter.title || 'untitled-blueprint'
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30)

    const usernameSuffix = username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 10)
    const timestamp = Date.now().toString(36).substring(-6)

    return `${cleanTitle}-${usernameSuffix}-${timestamp}`
  }

  /**
   * Generate PR description with review template
   */
  generatePRDescription(frontmatter, qualityScore, filePath) {
    return `## Community Blueprint Contribution

**Blueprint Title**: ${frontmatter.title}
**Category**: ${frontmatter.category}
**Quality Score**: ${qualityScore}/10
**File Path**: \`${filePath}\`

### Description
${frontmatter.description}

### Technologies
${frontmatter.tags.join(', ')}

### Target Platforms
${Object.keys(frontmatter.platforms).join(', ')}

### Submission Details
- **Complexity**: ${frontmatter.complexity}
- **Scope**: ${frontmatter.scope}
- **Audience**: ${frontmatter.audience}
- **Maturity**: ${frontmatter.maturity}

### Review Checklist
- [ ] Blueprint follows VDK Blueprint Schema v2.1.0 format
- [ ] Content is clear and actionable
- [ ] No sensitive information (secrets, API keys) included
- [ ] Examples provided where appropriate
- [ ] Platform compatibility settings are appropriate
- [ ] Tags and categories are accurate

### Community Guidelines
This blueprint was contributed via the VDK CLI community sharing system. The content has been:
- Automatically validated for format compliance
- Scanned for security issues
- Quality-scored based on structure and examples
- Converted to universal VDK Blueprint format

### Next Steps
After review and approval, this blueprint will be available for deployment via:
\`\`\`bash
vdk deploy ${this.generateBlueprintId(frontmatter, 'community')}
\`\`\`

---

🤖 **Generated by VDK CLI** - Community Sharing System
📊 **Quality Score**: ${qualityScore}/10 | **Format**: ${frontmatter.originalFormat || 'unknown'}
🔗 **Original Project**: ${frontmatter.projectContext?.name || 'Unknown'}

Thank you for contributing to the VDK community! 🎉`
  }

  /**
   * Check PR status
   */
  async checkPRStatus(username, branchName) {
    try {
      const { data: prs } = await this.octokit.rest.pulls.list({
        owner: this.repoOwner,
        repo: this.repoName,
        head: `${username}:${branchName}`,
        state: 'all',
      })

      if (prs.length === 0) {
        return { exists: false }
      }

      const pr = prs[0]
      return {
        exists: true,
        status: pr.state,
        merged: pr.merged_at !== null,
        url: pr.html_url,
        number: pr.number,
      }
    } catch (error) {
      return { exists: false, error: error.message }
    }
  }
}
