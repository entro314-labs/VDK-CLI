/**
 * VDK Integrations Module
 * ----------------------
 * Central export point for all VDK integrations.
 *
 * Integration Priority System:
 * 1. CONTEXT PLATFORMS (HIGH): Create their own context ecosystems
 *    - Cursor, Windsurf, Claude Code CLI
 * 2. TRADITIONAL IDEs (MEDIUM): Use extensions/plugins for AI
 *    - VS Code, JetBrains, Zed (fallback when no context platforms detected)
 */

// Context Platform Integrations (Priority 1 - HIGH)
import { ClaudeCodeCLIIntegration } from './claude-code-integration.js'
import { CursorContextIntegration } from './cursor-integration.js'
import { WindsurfContextIntegration } from './windsurf-integration.js'

// Traditional IDE Integrations (Priority 2 - MEDIUM)
import { GenericIDEIntegration } from './generic-ide-integration.js'
import { GitHubCopilotIntegration } from './github-copilot-integration.js'
import { IntegrationManager } from './integration-manager.js'

// New integrations
import { JetBrainsIntegration } from './jetbrains-integration.js'
import { ZedIntegration } from './zed-integration.js'
import { VSCodeInsidersIntegration, VSCodiumIntegration } from './vscode-variants-integration.js'
import { GenericAIIntegration } from './generic-ai-integration.js'

export { BaseIntegration } from './base-integration.js'

// Context Platform Integrations (Priority 1 - HIGH)
export { ClaudeCodeCLIIntegration } from './claude-code-integration.js'
export { CursorContextIntegration } from './cursor-integration.js'
export { WindsurfContextIntegration } from './windsurf-integration.js'

// Traditional IDE Integrations (Priority 2 - MEDIUM)
export { GenericIDEIntegration } from './generic-ide-integration.js'
export { GitHubCopilotIntegration } from './github-copilot-integration.js'
export { IntegrationManager } from './integration-manager.js'

// New integrations
export { JetBrainsIntegration } from './jetbrains-integration.js'
export { ZedIntegration } from './zed-integration.js'
export { VSCodeInsidersIntegration, VSCodiumIntegration } from './vscode-variants-integration.js'
export { GenericAIIntegration } from './generic-ai-integration.js'

// Helper function to create a pre-configured integration manager
// with correct priority-based registration
export function createIntegrationManager(projectPath = process.cwd()) {
  const manager = new IntegrationManager(projectPath)

  // PRIORITY 1: Context Platform Integrations (HIGH PRIORITY)
  // These create their own context ecosystems and should be detected first
  manager.register(new ClaudeCodeCLIIntegration(projectPath))
  manager.register(new CursorContextIntegration(projectPath))
  manager.register(new WindsurfContextIntegration(projectPath))

  // PRIORITY 2: Traditional IDE Integrations (MEDIUM PRIORITY)
  // These are fallbacks for when no context platforms are detected
  manager.register(new GitHubCopilotIntegration(projectPath))
  manager.register(new GenericIDEIntegration(projectPath))
  manager.register(new JetBrainsIntegration(projectPath))
  manager.register(new ZedIntegration(projectPath))
  manager.register(new VSCodeInsidersIntegration(projectPath))
  manager.register(new VSCodiumIntegration(projectPath))
  manager.register(new GenericAIIntegration(projectPath))

  return manager
}
