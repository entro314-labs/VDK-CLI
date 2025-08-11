/**
 * VDK Integrations Module
 * ----------------------
 * Central export point for all VDK integrations.
 * Provides a clean interface for importing integration components.
 */

// Core integration infrastructure
// Import for internal use
import { ClaudeCodeIntegration } from './claude-code-integration.js'
import { CursorIntegration } from './cursor-integration.js'
import { GenericIDEIntegration } from './generic-ide-integration.js'
import { GitHubCopilotIntegration } from './github-copilot-integration.js'
import { IntegrationManager } from './integration-manager.js'
import { WindsurfIntegration } from './windsurf-integration.js'

// New integrations
import { JetBrainsIntegration } from './jetbrains-integration.js'
import { ZedIntegration } from './zed-integration.js'
import { VSCodeInsidersIntegration, VSCodiumIntegration } from './vscode-variants-integration.js'
import { GenericAIIntegration } from './generic-ai-integration.js'

export { BaseIntegration } from './base-integration.js'
// Specific integrations
export { ClaudeCodeIntegration } from './claude-code-integration.js'
export { CursorIntegration } from './cursor-integration.js'
export { GenericIDEIntegration } from './generic-ide-integration.js'
export { GitHubCopilotIntegration } from './github-copilot-integration.js'
export { IntegrationManager } from './integration-manager.js'
export { WindsurfIntegration } from './windsurf-integration.js'

// New integrations
export { JetBrainsIntegration } from './jetbrains-integration.js'
export { ZedIntegration } from './zed-integration.js'
export { VSCodeInsidersIntegration, VSCodiumIntegration } from './vscode-variants-integration.js'
export { GenericAIIntegration } from './generic-ai-integration.js'

// Helper function to create a pre-configured integration manager
export function createIntegrationManager(projectPath = process.cwd()) {
  const manager = new IntegrationManager(projectPath)

  // Auto-register all available integrations
  manager.register(new ClaudeCodeIntegration(projectPath))
  manager.register(new CursorIntegration(projectPath))
  manager.register(new WindsurfIntegration(projectPath))
  manager.register(new GitHubCopilotIntegration(projectPath))
  manager.register(new GenericIDEIntegration(projectPath))

  // Register new integrations
  manager.register(new JetBrainsIntegration(projectPath))
  manager.register(new ZedIntegration(projectPath))
  manager.register(new VSCodeInsidersIntegration(projectPath))
  manager.register(new VSCodiumIntegration(projectPath))
  manager.register(new GenericAIIntegration(projectPath))

  return manager
}
