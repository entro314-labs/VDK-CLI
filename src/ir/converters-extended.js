/**
 * VDK IR Extended Converters
 * ===========================
 *
 * Additional platform converters for platforms not covered in the base IR system.
 * This includes: JetBrains, Tabnine, Zed, Continue, Aider, Gemini CLI, OpenAI AGENTS.md
 */

import path from 'node:path';
import yaml from 'js-yaml';
import { extractFileReferences, parseMarkdownContent } from './index.js';
import { createIR } from './types.js';

// ============================================================================
// OpenAI AGENTS.md → IR
// ============================================================================

/**
 * Convert AGENTS.md format to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation[]} Array of agent IRs
 */
export function agentsToIR({ content, filePath }) {
  const agents = [];

  // Split by ## Agent Name pattern
  const agentSections = content.split(/^##\s+/m).filter(s => s.trim());

  for (const section of agentSections) {
    const lines = section.split('\n');
    const agentName = lines[0].trim();

    // Skip if this is the main title
    if (agentName.toLowerCase().includes('project agents')) continue;

    const ir = createIR('agent', agentName);

    // Parse natural language sections
    let role = '';
    const expertise = [];
    const responsibilities = [];
    const tools = [];
    let currentSection = '';

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();

      // Detect sections
      if (trimmed.startsWith('**Role**:')) {
        currentSection = 'role';
        role = trimmed.replace('**Role**:', '').trim();
      } else if (trimmed.startsWith('**Expertise**:')) {
        currentSection = 'expertise';
      } else if (trimmed.startsWith('**Responsibilities**:')) {
        currentSection = 'responsibilities';
      } else if (trimmed.startsWith('**Tools**:')) {
        currentSection = 'tools';
      } else if (trimmed.startsWith('**') || trimmed.startsWith('###')) {
        currentSection = '';
      } else if (trimmed.startsWith('-') || trimmed.match(/^\d+\./)) {
        // List item
        const item = trimmed.replace(/^-\s*|^\d+\.\s*/, '').trim();

        if (currentSection === 'expertise') expertise.push(item);
        else if (currentSection === 'responsibilities') responsibilities.push(item);
        else if (currentSection === 'tools') tools.push({ name: item });
      }
    }

    ir.description = role;
    ir.content = parseMarkdownContent(section);
    ir.tags = expertise;
    if (tools.length > 0) ir.tools = tools;

    // Store natural language metadata
    ir.platformSpecific = {
      'openai-codex': {
        role,
        expertise,
        responsibilities,
        originalFormat: 'natural-language',
      },
    };

    ir.conversionMetadata = {
      sourcePlatform: 'openai-codex',
      sourceFile: filePath,
      convertedAt: new Date().toISOString(),
      vdkVersion: '3.0.0',
      lossInfo: [],
      semanticScore: 100,
    };

    agents.push(ir);
  }

  return agents;
}

/**
 * Convert IR to AGENTS.md format
 * @param {IntermediateRepresentation[]} irs - Array of agent IRs
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToAgents(irs) {
  const lossInfo = [];
  let content = '# Project Agents\n\n';

  // Filter to only agents
  const agents = irs.filter(ir => ir.type === 'agent');

  if (agents.length === 0) {
    lossInfo.push({
      field: 'agents',
      reason: 'No agents found in IR bundle',
      originalValue: irs.length,
      suggestion: 'Only agent-type components can be converted to AGENTS.md',
    });
  }

  for (const ir of agents) {
    content += `## ${ir.name}\n\n`;

    // Role
    const role = ir.description || ir.platformSpecific?.['openai-codex']?.role || 'AI assistant';
    content += `**Role**: ${role}\n\n`;

    // Expertise
    if (ir.tags?.length || ir.platformSpecific?.['openai-codex']?.expertise?.length) {
      content += '**Expertise**:\n';
      const expertise = ir.tags || ir.platformSpecific?.['openai-codex']?.expertise || [];
      for (const item of expertise) {
        content += `- ${item}\n`;
      }
      content += '\n';
    }

    // Responsibilities (extract from content or use stored)
    const responsibilities = ir.platformSpecific?.['openai-codex']?.responsibilities;
    if (responsibilities?.length) {
      content += '**Responsibilities**:\n';
      for (let i = 0; i < responsibilities.length; i++) {
        content += `${i + 1}. ${responsibilities[i]}\n`;
      }
      content += '\n';
    } else if (ir.content?.sections?.length) {
      // Try to extract from sections
      const respSection = ir.content.sections.find(
        s =>
          s.title?.toLowerCase().includes('responsibilities') ||
          s.title?.toLowerCase().includes('process')
      );
      if (respSection) {
        content += '**Responsibilities**:\n';
        content += `${respSection.content}\n\n`;
      }
    }

    // Tools
    if (ir.tools?.length) {
      content += '**Tools**:\n';
      for (const tool of ir.tools) {
        content += `- ${tool.name}${tool.description ? `: ${tool.description}` : ''}\n`;
      }
      content += '\n';
    }

    content += '\n';
  }

  return {
    content: content.trim(),
    filePath: 'AGENTS.md',
    lossInfo,
  };
}

// ============================================================================
// Continue.dev → IR
// ============================================================================

/**
 * Convert Continue config.yaml to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content (YAML)
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation[]} Array of IRs (settings + slash commands)
 */
export function continueToIR({ content, filePath }) {
  const irs = [];

  try {
    const config = yaml.load(content);

    // Main config as settings
    const settingsIR = createIR('settings', 'continue-config');
    settingsIR.description = 'Continue.dev configuration';
    settingsIR.platformSpecific = {
      continue: { config },
    };
    settingsIR.content = {
      raw: content,
      format: 'yaml',
      sections: [],
      hasFrontmatter: false,
    };
    settingsIR.conversionMetadata = {
      sourcePlatform: 'continue',
      sourceFile: filePath,
      convertedAt: new Date().toISOString(),
      vdkVersion: '3.0.0',
      lossInfo: [],
      semanticScore: 100,
    };
    irs.push(settingsIR);

    // Extract slash commands as separate IRs
    if (config.slashCommands) {
      for (const cmd of config.slashCommands) {
        const cmdIR = createIR('command', cmd.name);
        cmdIR.description = cmd.description || '';
        cmdIR.content = parseMarkdownContent(cmd.prompt || '');
        cmdIR.platformSpecific = {
          continue: { slashCommand: cmd },
        };
        cmdIR.conversionMetadata = {
          sourcePlatform: 'continue',
          sourceFile: filePath,
          convertedAt: new Date().toISOString(),
          vdkVersion: '3.0.0',
          lossInfo: [],
          semanticScore: 100,
        };
        irs.push(cmdIR);
      }
    }
  } catch (error) {
    console.error('Error parsing Continue config:', error.message);
  }

  return irs;
}

/**
 * Convert IR to Continue config.yaml
 * @param {IntermediateRepresentation[]} irs - Array of IRs
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToContinue(irs) {
  const lossInfo = [];

  // Extract settings IR if present
  const settingsIR = irs.find(ir => ir.type === 'settings');
  const baseConfig = settingsIR?.platformSpecific?.continue?.config || {};

  // Extract commands
  const commands = irs.filter(ir => ir.type === 'command');
  const slashCommands = commands.map(cmd => ({
    name: cmd.name,
    description: cmd.description,
    prompt: cmd.content?.raw || '',
  }));

  const config = {
    ...baseConfig,
    slashCommands: slashCommands.length > 0 ? slashCommands : baseConfig.slashCommands,
  };

  const content = yaml.dump(config, { indent: 2 });

  return {
    content,
    filePath: '~/.continue/config.yaml',
    lossInfo,
  };
}

// ============================================================================
// Aider → IR
// ============================================================================

/**
 * Convert Aider .aider.conf.yml to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content (YAML)
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function aiderToIR({ content, filePath }) {
  const ir = createIR('settings', 'aider-config');
  ir.description = 'Aider configuration';

  try {
    const config = yaml.load(content);
    ir.platformSpecific = {
      aider: { config },
    };
  } catch (error) {
    console.error('Error parsing Aider config:', error.message);
  }

  ir.content = {
    raw: content,
    format: 'yaml',
    sections: [],
    hasFrontmatter: false,
  };

  ir.conversionMetadata = {
    sourcePlatform: 'aider',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert IR to Aider config
 * @param {IntermediateRepresentation} ir - IR (settings type)
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToAider(ir) {
  const lossInfo = [];
  const config = ir.platformSpecific?.aider?.config || {};
  const content = yaml.dump(config, { indent: 2 });

  return {
    content,
    filePath: '.aider.conf.yml',
    lossInfo,
  };
}

// ============================================================================
// Gemini CLI → IR
// ============================================================================

/**
 * Convert Gemini GEMINI.md to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function geminiToIR({ content, filePath }) {
  const ir = createIR('main', 'gemini-context');
  ir.content = parseMarkdownContent(content);
  ir.fileReferences = extractFileReferences(content);
  ir.description = ir.content.sections[0]?.content?.substring(0, 200) || '';

  ir.platformSpecific = {
    'gemini-cli': {
      originalPath: filePath,
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'gemini-cli',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert IR to Gemini format
 * @param {IntermediateRepresentation} ir - IR to convert
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToGemini(ir) {
  const lossInfo = [];
  let content = '';

  // Build content from sections
  if (ir.content?.sections?.length) {
    content = ir.content.sections
      .map(s => {
        const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
        return heading + s.content;
      })
      .join('\n\n');
  } else if (ir.content?.raw) {
    content = ir.content.raw;
  }

  return {
    content: content.trim(),
    filePath: 'GEMINI.md',
    lossInfo,
  };
}

// ============================================================================
// Zed Editor → IR
// ============================================================================

/**
 * Convert Zed settings.json to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content (JSON)
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function zedToIR({ content, filePath }) {
  const ir = createIR('settings', 'zed-settings');
  ir.description = 'Zed editor settings';

  try {
    const settings = JSON.parse(content);
    ir.platformSpecific = {
      zed: { settings },
    };
  } catch (error) {
    console.error('Error parsing Zed settings:', error.message);
  }

  ir.content = {
    raw: content,
    format: 'json',
    sections: [],
    hasFrontmatter: false,
  };

  ir.conversionMetadata = {
    sourcePlatform: 'zed',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert IR to Zed settings
 * @param {IntermediateRepresentation} ir - IR (settings type)
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToZed(ir) {
  const lossInfo = [];
  const settings = ir.platformSpecific?.zed?.settings || {};
  const content = JSON.stringify(settings, null, 2);

  return {
    content,
    filePath: '~/.config/zed/settings.json',
    lossInfo,
  };
}

// ============================================================================
// Tabnine → IR
// ============================================================================

/**
 * Convert Tabnine guideline to IR
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function tabnineToIR({ content, filePath }) {
  const fileName = path.basename(filePath);
  const ir = createIR('rule', fileName.replace(/\.md$/, ''));
  ir.content = parseMarkdownContent(content);
  ir.fileReferences = extractFileReferences(content);
  ir.description = ir.content.frontmatter?.description || '';

  ir.platformSpecific = {
    tabnine: {
      originalPath: filePath,
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'tabnine',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert IR to Tabnine guideline
 * @param {IntermediateRepresentation} ir - IR to convert
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToTabnine(ir) {
  const lossInfo = [];
  let content = '';

  // Build content from sections
  if (ir.content?.sections?.length) {
    content = ir.content.sections
      .map(s => {
        const heading = s.title ? `${'#'.repeat(s.level || 1)} ${s.title}\n\n` : '';
        return heading + s.content;
      })
      .join('\n\n');
  } else if (ir.content?.raw) {
    content = ir.content.raw;
  }

  return {
    content: content.trim(),
    filePath: `.tabnine/guidelines/${sanitizeFileName(ir.name)}.md`,
    lossInfo,
  };
}

// ============================================================================
// JetBrains → IR
// ============================================================================

/**
 * Convert JetBrains .aiignore to IR
 * Note: JetBrains settings are primarily UI-based, so this handles .aiignore only
 * @param {Object} options - Conversion options
 * @param {string} options.content - File content
 * @param {string} options.filePath - File path
 * @returns {IntermediateRepresentation}
 */
export function jetbrainsToIR({ content, filePath }) {
  const ir = createIR('settings', 'jetbrains-aiignore');
  ir.description = 'JetBrains AI exclusion patterns';

  ir.content = {
    raw: content,
    format: 'text',
    sections: [
      {
        title: 'AI Ignore Patterns',
        level: 1,
        content: content,
        children: [],
      },
    ],
    hasFrontmatter: false,
  };

  ir.platformSpecific = {
    jetbrains: {
      originalPath: filePath,
      patterns: content.split('\n').filter(l => l.trim() && !l.startsWith('#')),
    },
  };

  ir.conversionMetadata = {
    sourcePlatform: 'jetbrains',
    sourceFile: filePath,
    convertedAt: new Date().toISOString(),
    vdkVersion: '3.0.0',
    lossInfo: [],
    semanticScore: 100,
  };

  return ir;
}

/**
 * Convert IR to JetBrains .aiignore
 * @param {IntermediateRepresentation} ir - IR to convert
 * @returns {{content: string, filePath: string, lossInfo: Array}}
 */
export function irToJetbrains(ir) {
  const lossInfo = [];
  const patterns = ir.platformSpecific?.jetbrains?.patterns || [];
  const content = patterns.join('\n');

  return {
    content,
    filePath: '.aiignore',
    lossInfo,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Sanitize a string for use as a filename
 * @param {string} name - Name to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Auto-detect platform and use appropriate converter
 * @param {Object} options - Conversion options
 * @returns {IntermediateRepresentation|IntermediateRepresentation[]}
 */
export function autoConvertExtendedToIR({ content, filePath }) {
  const normalizedPath = filePath.toLowerCase();

  if (normalizedPath.includes('agents.md')) return agentsToIR({ content, filePath });
  if (normalizedPath.includes('.continue')) return continueToIR({ content, filePath });
  if (normalizedPath.includes('.aider')) return aiderToIR({ content, filePath });
  if (normalizedPath.includes('gemini.md') || normalizedPath.includes('.gemini')) {
    return geminiToIR({ content, filePath });
  }
  if (normalizedPath.includes('.config/zed')) return zedToIR({ content, filePath });
  if (normalizedPath.includes('.tabnine')) return tabnineToIR({ content, filePath });
  if (normalizedPath.includes('.aiignore')) return jetbrainsToIR({ content, filePath });

  return null; // Not an extended platform
}

export default {
  // AGENTS.md
  agentsToIR,
  irToAgents,

  // Continue
  continueToIR,
  irToContinue,

  // Aider
  aiderToIR,
  irToAider,

  // Gemini CLI
  geminiToIR,
  irToGemini,

  // Zed
  zedToIR,
  irToZed,

  // Tabnine
  tabnineToIR,
  irToTabnine,

  // JetBrains
  jetbrainsToIR,
  irToJetbrains,

  // Utilities
  autoConvertExtendedToIR,
  sanitizeFileName,
};
