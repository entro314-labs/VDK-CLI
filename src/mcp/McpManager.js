/**
 * MCP Manager
 * ===========
 * Manages Model Context Protocol (MCP) server configurations and discovery.
 * Supports standard MCP config locations (Clause, VS Code, etc.).
 */

import { existsSync, writeFileSync } from 'node:fs'; // Sync for operations where shared libs might expect sync, or refactor to async
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateMCPConfigurationFile } from '../shared/editor-path-resolver.js';
import * as ideConfig from '../shared/ide-configuration.js';

export class McpManager {
  constructor() {
    this.configs = new Map();
  }

  /**
   * Discover MCP configurations in standard locations
   */
  async discover() {
    const locations = [
      path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json'),
      path.join(os.homedir(), '.config/Claude/claude_desktop_config.json'), // Linux
      path.join(os.homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json'), // Windows
      // Add other IDE locations if known
    ];

    for (const loc of locations) {
      try {
        const content = await fs.readFile(loc, 'utf8');
        const config = JSON.parse(content);
        if (config.mcpServers) {
          this.configs.set(loc, config.mcpServers);
        }
      } catch {
        // Ignore missing files
      }
    }

    return this.configs;
  }

  /**
   * Get combined list of known MCP servers
   */
  getServers() {
    const servers = {};
    for (const [source, serverMap] of this.configs) {
      for (const [name, config] of Object.entries(serverMap)) {
        servers[name] = { ...config, source };
      }
    }
    return servers;
  }
  /**
   * Update MCP configuration in project
   */
  async updateProjectConfig(projectPath, options = {}) {
    const force = options.force;

    // Detect IDEs
    const detectedIDEs = ideConfig.detectIDEs(projectPath);

    if (detectedIDEs.length === 0 && !force) {
      return { success: false, message: 'No IDE configurations detected (use force to override)' };
    }

    // Find rule directories
    const ruleDirectories = [];

    // Check detected IDEs
    detectedIDEs.forEach(ide => {
      const rulePath = path.join(projectPath, ide.rulesFolder);
      if (existsSync(rulePath)) {
        ruleDirectories.push({ path: rulePath, source: ide.name });
      }
    });

    // Check common paths if none found
    if (ruleDirectories.length === 0) {
      const commonPaths = [
        '.vdk/blueprints/rules',
        '.vscode/ai-rules',
        '.cursor/rules',
        '.claude/rules',
        '.windsurf/rules',
        '.zed/ai-rules',
        '.idea/ai-rules',
      ];

      for (const rulePath of commonPaths) {
        const fullPath = path.join(projectPath, rulePath);
        if (existsSync(fullPath)) {
          ruleDirectories.push({ path: fullPath, source: 'Common Path' });
        }
      }
    }

    // Create default if forced
    if (ruleDirectories.length === 0 && force) {
      const defaultPath = path.join(projectPath, '.vdk/blueprints/rules');
      if (!existsSync(defaultPath)) {
        await fs.mkdir(defaultPath, { recursive: true });
      }
      ruleDirectories.push({ path: defaultPath, source: 'Default' });
    }

    if (ruleDirectories.length === 0) {
      return { success: false, message: 'No rule directories found' };
    }

    // Update configs
    let successCount = 0;
    const results = [];

    for (const ruleDir of ruleDirectories) {
      // Ensure file exists
      const mcpFilePath = path.join(ruleDir.path, '03-mcp-configuration.mdc');
      if (!existsSync(mcpFilePath)) {
        this.createDefaultMcpFile(mcpFilePath);
      }

      // Update file
      const success = updateMCPConfigurationFile(projectPath, ruleDir.path);
      results.push({ path: ruleDir.path, success });
      if (success) successCount++;
    }

    return {
      success: successCount > 0,
      updated: successCount,
      total: ruleDirectories.length,
      details: results,
    };
  }

  createDefaultMcpFile(filePath) {
    const content = `---
description: Defines the available Model Context Protocol (MCP) servers and their capabilities.
globs:
alwaysApply: false
version: "2.1.0"
lastUpdated: "${new Date().toISOString().split('T')[0]}"
compatibleWith: ["Memory-MCP", "Sequential-Thinking-Advanced", "MCP-Integration"]
---
# MCP Server Configuration

This file documents the Model Context Protocol (MCP) servers available in your environment.
`;
    writeFileSync(filePath, content, 'utf8');
  }
}

export const mcpManager = new McpManager();
