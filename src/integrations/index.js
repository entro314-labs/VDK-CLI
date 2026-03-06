/**
 * VDK Integrations Module
 * ----------------------
 * Central export point for all VDK integrations.
 *
 * Integration Priority System:
 * 1. CONTEXT PLATFORMS (HIGH): Create their own context ecosystems
 *    - Cursor, Windsurf, Claude Code CLI
 * 2. TRADITIONAL IDEs (MEDIUM): Use extensions/plugins for AI
 *    - VS Code, JetBrains, Zed
 */

// CLI Platform Integrations (Priority 1 - HIGH)
import { AiderIntegration } from './aider-integration.js';
import { ACPIntegration } from './acp-integration.js';
import { AntigravityIntegration } from './antigravity-integration.js';
// Context Platform Integrations (Priority 1 - HIGH)
import { ClaudeCodeCLIIntegration } from './claude-code-integration.js';
import { ClineIntegration } from './cline-integration.js';
import { ContinueIntegration } from './continue-integration.js';
import { CursorContextIntegration } from './cursor-integration.js';
import { GeminiCLIIntegration } from './gemini-cli-integration.js';
// Traditional IDE Integrations (Priority 2 - MEDIUM)
import { GitHubCopilotIntegration } from './github-copilot-integration.js';
import { GooseIntegration } from './goose-integration.js';
import { IntegrationManager } from './integration-manager.js';
import { JetBrainsIntegration } from './jetbrains-integration.js';
import { JunieIntegration } from './junie-integration.js';
import { KimiCLIIntegration } from './kimi-cli-integration.js';
import { MistralVibeIntegration } from './mistral-vibe-integration.js';
import { OpenAICodexIntegration } from './openai-codex-integration.js';
import { OpenCodeIntegration } from './opencode-integration.js';
import { RooCodeIntegration } from './roo-code-integration.js';
import { TraeIntegration } from './trae-integration.js';
import { VSCodeInsidersIntegration, VSCodiumIntegration } from './vscode-variants-integration.js';
import { WindsurfContextIntegration } from './windsurf-integration.js';
import { ZedIntegration } from './zed-integration.js';

// CLI Platform Integrations (Priority 1 - HIGH)
export { AiderIntegration } from './aider-integration.js';
export { ACPIntegration } from './acp-integration.js';
export { AntigravityIntegration } from './antigravity-integration.js';
export { BaseIntegration } from './base-integration.js';
// Context Platform Integrations (Priority 1 - HIGH)
export { ClaudeCodeCLIIntegration } from './claude-code-integration.js';
export { ClineIntegration } from './cline-integration.js';
export { ContinueIntegration } from './continue-integration.js';
export { CursorContextIntegration } from './cursor-integration.js';
export { GeminiCLIIntegration } from './gemini-cli-integration.js';
// Traditional IDE Integrations (Priority 2 - MEDIUM)
export { GitHubCopilotIntegration } from './github-copilot-integration.js';
export { GooseIntegration } from './goose-integration.js';
export { IntegrationManager } from './integration-manager.js';
export { JetBrainsIntegration } from './jetbrains-integration.js';
export { JunieIntegration } from './junie-integration.js';
export { KimiCLIIntegration } from './kimi-cli-integration.js';
export { MistralVibeIntegration } from './mistral-vibe-integration.js';
export { OpenAICodexIntegration } from './openai-codex-integration.js';
export { OpenCodeIntegration } from './opencode-integration.js';
export { RooCodeIntegration } from './roo-code-integration.js';
export { TraeIntegration } from './trae-integration.js';
export { VSCodeInsidersIntegration, VSCodiumIntegration } from './vscode-variants-integration.js';
export { WindsurfContextIntegration } from './windsurf-integration.js';
export { ZedIntegration } from './zed-integration.js';

// Helper function to create a pre-configured integration manager
// with correct priority-based registration
export function createIntegrationManager(projectPath = process.cwd()) {
  const manager = new IntegrationManager(projectPath);

  // PRIORITY 1: Context Platform Integrations (HIGH PRIORITY)
  // These create their own context ecosystems and should be detected first
  manager.register(new ClaudeCodeCLIIntegration(projectPath));
  manager.register(new CursorContextIntegration(projectPath));
  manager.register(new WindsurfContextIntegration(projectPath));

  // CLI Platform Integrations (HIGH PRIORITY)
  manager.register(new OpenAICodexIntegration(projectPath));
  manager.register(new OpenCodeIntegration(projectPath));
  manager.register(new GeminiCLIIntegration(projectPath));
  manager.register(new ACPIntegration(projectPath));
  manager.register(new ContinueIntegration(projectPath));
  manager.register(new AiderIntegration(projectPath));
  manager.register(new ClineIntegration(projectPath));
  manager.register(new RooCodeIntegration(projectPath));
  manager.register(new GooseIntegration(projectPath));
  manager.register(new JunieIntegration(projectPath));
  manager.register(new AntigravityIntegration(projectPath));
  manager.register(new KimiCLIIntegration(projectPath));
  manager.register(new MistralVibeIntegration(projectPath));
  manager.register(new TraeIntegration(projectPath));

  // PRIORITY 2: Traditional IDE Integrations (MEDIUM PRIORITY)
  manager.register(new GitHubCopilotIntegration(projectPath));
  manager.register(new JetBrainsIntegration(projectPath));
  manager.register(new ZedIntegration(projectPath));
  manager.register(new VSCodeInsidersIntegration(projectPath));
  manager.register(new VSCodiumIntegration(projectPath));

  return manager;
}
