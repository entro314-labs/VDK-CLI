/**
 * VDK Intermediate Representation (IR) Type Definitions
 * ======================================================
 *
 * The IR system provides a unified, platform-agnostic representation
 * of AI context components. It enables:
 * - Semantic preservation during cross-platform conversion
 * - Loss tracking when converting to limited platforms
 * - Round-trip conversion validation
 *
 * Flow: Source Platform → IR → Target Platform(s)
 */

/**
 * Component types supported by the IR system
 * @typedef {'agent'|'rule'|'command'|'skill'|'workflow'|'main'|'settings'} ComponentType
 */

/**
 * Content format types
 * @typedef {'markdown'|'yaml'|'json'|'toml'|'mdc'|'xml'|'text'} ContentFormat
 */

/**
 * Activation modes for conditional rules
 * @typedef {'always'|'auto-attached'|'agent-requested'|'manual'|'path-based'} ActivationMode
 */

/**
 * Platform identifiers
 * @typedef {'claude-code'|'cursor'|'github-copilot'|'windsurf'|'continue'|'aider'|'gemini-cli'|'openai-codex'|'opencode'|'cline'|'roo-code'|'goose'|'junie'|'google-antigravity'|'kimi-cli'|'mistral-vibe'|'trae'|'jetbrains-ai'|'zed'|'tabnine'|'generic'} PlatformId
 */

/**
 * @typedef {Object} ConditionalRule
 * @property {string[]} [globs] - Glob patterns for file matching
 * @property {string[]} [paths] - Specific paths
 * @property {string[]} [languages] - Programming languages
 * @property {ActivationMode} activation - When the rule activates
 */

/**
 * @typedef {Object} FileReference
 * @property {string} path - File path (relative or absolute)
 * @property {string} [label] - Optional label for the reference
 * @property {'include'|'context'|'example'} [type] - Reference type
 */

/**
 * @typedef {Object} ContentSection
 * @property {string} title - Section heading
 * @property {string} content - Section content (markdown)
 * @property {number} level - Heading level (1-6)
 * @property {ContentSection[]} [children] - Nested sections
 */

/**
 * @typedef {Object} ContentStructure
 * @property {string} raw - Original raw content
 * @property {ContentFormat} format - Detected format
 * @property {ContentSection[]} sections - Parsed sections
 * @property {Object} [frontmatter] - YAML frontmatter if present
 * @property {boolean} hasFrontmatter - Whether frontmatter was detected
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name - Tool name
 * @property {string} [description] - Tool description
 * @property {string[]} [permissions] - Required permissions
 */

/**
 * @typedef {Object} LossInfo
 * @property {string} field - Field that was lost
 * @property {string} reason - Why it was lost
 * @property {*} originalValue - Original value
 * @property {string} [suggestion] - Suggested workaround
 */

/**
 * @typedef {Object} ConversionMetadata
 * @property {PlatformId} sourcePlatform - Original platform
 * @property {PlatformId} [targetPlatform] - Target platform (if converted)
 * @property {string} sourceFile - Original file path
 * @property {string} convertedAt - ISO timestamp of conversion
 * @property {string} vdkVersion - VDK version used
 * @property {LossInfo[]} lossInfo - Information about what was lost
 * @property {number} semanticScore - 0-100 semantic preservation score
 */

/**
 * Intermediate Representation of a single AI context component
 *
 * @typedef {Object} IntermediateRepresentation
 * @property {string} id - Unique component ID (UUID or generated)
 * @property {ComponentType} type - Component type
 * @property {string} name - Human-readable name
 * @property {string} description - Component description
 * @property {string} [version] - Component version
 * @property {ContentStructure} content - Parsed content structure
 *
 * @property {string[]} [triggers] - Activation triggers (for commands/skills)
 * @property {ToolDefinition[]} [tools] - Required/available tools
 * @property {string} [model] - Preferred model (e.g., 'claude-3-5-sonnet')
 * @property {number} [maxTokens] - Token limit
 *
 * @property {ConditionalRule} [conditionalRules] - Activation conditions
 * @property {FileReference[]} [fileReferences] - @path references
 *
 * @property {string[]} [tags] - Categorization tags
 * @property {string} [category] - Primary category
 * @property {'basic'|'intermediate'|'advanced'} [complexity] - Complexity level
 *
 * @property {Object} [platformSpecific] - Platform-specific preserved data
 * @property {ConversionMetadata} [conversionMetadata] - Conversion tracking
 */

/**
 * Collection of related IR components (e.g., full project context)
 *
 * @typedef {Object} IRBundle
 * @property {string} id - Bundle ID
 * @property {string} name - Bundle name (typically project name)
 * @property {string} [description] - Bundle description
 * @property {IntermediateRepresentation[]} components - All components
 * @property {Object} projectContext - Project context information
 * @property {ConversionMetadata} [metadata] - Bundle-level metadata
 */

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty IR component with defaults
 * @param {ComponentType} type - Component type
 * @param {string} name - Component name
 * @returns {IntermediateRepresentation}
 */
export function createIR(type, name) {
  return {
    id: generateIRId(),
    type,
    name,
    description: '',
    content: {
      raw: '',
      format: 'markdown',
      sections: [],
      hasFrontmatter: false,
    },
    tags: [],
    fileReferences: [],
    platformSpecific: {},
  };
}

/**
 * Create an IR bundle from components
 * @param {string} name - Bundle name
 * @param {IntermediateRepresentation[]} components - Components to bundle
 * @param {Object} [projectContext] - Project context
 * @returns {IRBundle}
 */
export function createIRBundle(name, components = [], projectContext = {}) {
  return {
    id: generateIRId(),
    name,
    components,
    projectContext,
  };
}

/**
 * Generate a unique IR ID
 * @returns {string}
 */
export function generateIRId() {
  // Simple ID generation - could use uuid in production
  return `ir_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Valid component types
 */
export const COMPONENT_TYPES = [
  'agent',
  'rule',
  'command',
  'skill',
  'workflow',
  'main',
  'settings',
];

/**
 * Valid content formats
 */
export const CONTENT_FORMATS = ['markdown', 'yaml', 'json', 'toml', 'mdc', 'xml', 'text'];

/**
 * Valid activation modes
 */
export const ACTIVATION_MODES = [
  'always',
  'auto-attached',
  'agent-requested',
  'manual',
  'path-based',
];

/**
 * Valid platform identifiers
 */
export const PLATFORM_IDS = [
  'claude-code',
  'cursor',
  'github-copilot',
  'windsurf',
  'continue',
  'aider',
  'gemini-cli',
  'openai-codex',
  'opencode',
  'cline',
  'roo-code',
  'goose',
  'junie',
  'google-antigravity',
  'kimi-cli',
  'mistral-vibe',
  'trae',
  'jetbrains-ai',
  'zed',
  'tabnine',
  'generic',
];

/**
 * Validate an IR component
 * @param {IntermediateRepresentation} ir - IR to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateIR(ir) {
  const errors = [];

  if (!ir.id) errors.push('Missing required field: id');
  if (!ir.type) errors.push('Missing required field: type');
  if (!ir.name) errors.push('Missing required field: name');

  if (ir.type && !COMPONENT_TYPES.includes(ir.type)) {
    errors.push(`Invalid component type: ${ir.type}`);
  }

  if (ir.content?.format && !CONTENT_FORMATS.includes(ir.content.format)) {
    errors.push(`Invalid content format: ${ir.content.format}`);
  }

  if (
    ir.conditionalRules?.activation &&
    !ACTIVATION_MODES.includes(ir.conditionalRules.activation)
  ) {
    errors.push(`Invalid activation mode: ${ir.conditionalRules.activation}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an IR bundle
 * @param {IRBundle} bundle - Bundle to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateIRBundle(bundle) {
  const errors = [];

  if (!bundle.id) errors.push('Missing required field: id');
  if (!bundle.name) errors.push('Missing required field: name');
  if (!Array.isArray(bundle.components)) {
    errors.push('components must be an array');
  }

  // Validate each component
  if (Array.isArray(bundle.components)) {
    bundle.components.forEach((component, index) => {
      const componentValidation = validateIR(component);
      if (!componentValidation.valid) {
        errors.push(
          `Component ${index} (${component.name || 'unnamed'}): ${componentValidation.errors.join(', ')}`
        );
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate semantic preservation score when converting IR
 * @param {IntermediateRepresentation} source - Source IR
 * @param {IntermediateRepresentation} converted - Converted IR
 * @returns {number} Score from 0-100
 */
export function calculateSemanticScore(source, converted) {
  let score = 100;
  const penalties = {
    missingContent: 30,
    missingTriggers: 10,
    missingTools: 10,
    missingFileRefs: 5,
    missingConditionalRules: 15,
    typeChange: 20,
  };

  // Check content preservation
  if (!converted.content?.raw && source.content?.raw) {
    score -= penalties.missingContent;
  } else if (source.content?.raw && converted.content?.raw) {
    // Rough content similarity check
    const similarity = converted.content.raw.length / Math.max(source.content.raw.length, 1);
    if (similarity < 0.8) {
      score -= Math.floor((1 - similarity) * penalties.missingContent);
    }
  }

  // Check triggers preservation
  if (source.triggers?.length && !converted.triggers?.length) {
    score -= penalties.missingTriggers;
  }

  // Check tools preservation
  if (source.tools?.length && !converted.tools?.length) {
    score -= penalties.missingTools;
  }

  // Check file references
  if (source.fileReferences?.length && !converted.fileReferences?.length) {
    score -= penalties.missingFileRefs;
  }

  // Check conditional rules
  if (source.conditionalRules && !converted.conditionalRules) {
    score -= penalties.missingConditionalRules;
  }

  // Check type preservation
  if (source.type !== converted.type) {
    score -= penalties.typeChange;
  }

  return Math.max(0, score);
}

/**
 * Track what was lost during conversion
 * @param {IntermediateRepresentation} source - Source IR
 * @param {IntermediateRepresentation} converted - Converted IR
 * @param {PlatformId} targetPlatform - Target platform
 * @returns {LossInfo[]}
 */
export function trackConversionLoss(source, _converted, targetPlatform) {
  const losses = [];

  // Platform-specific limitations
  const platformLimitations = {
    'github-copilot': {
      maxLength: 3000,
      noAgents: true,
      noCommands: true,
      noSkills: true,
    },
    cursor: {
      noAgents: true,
      noSettings: true,
    },
    windsurf: {
      noSkills: true,
    },
  };

  const limits = platformLimitations[targetPlatform] || {};

  // Check for agent conversion loss
  if (limits.noAgents && source.type === 'agent') {
    losses.push({
      field: 'type',
      reason: `${targetPlatform} does not support agents`,
      originalValue: 'agent',
      suggestion: 'Converted to rule with agent-like behavior',
    });
  }

  // Check for character limit truncation
  if (limits.maxLength && source.content?.raw?.length > limits.maxLength) {
    losses.push({
      field: 'content',
      reason: `${targetPlatform} has ${limits.maxLength} character limit`,
      originalValue: `${source.content.raw.length} characters`,
      suggestion: 'Content was truncated with priority preservation',
    });
  }

  // Check for command conversion loss
  if (limits.noCommands && source.type === 'command') {
    losses.push({
      field: 'type',
      reason: `${targetPlatform} does not support commands`,
      originalValue: 'command',
      suggestion: 'Converted to rule',
    });
  }

  return losses;
}

/**
 * Filter IR bundle components by type
 * @param {IRBundle} bundle - IR bundle
 * @param {ComponentType} type - Type to filter by
 * @returns {IntermediateRepresentation[]}
 */
export function filterByType(bundle, type) {
  return bundle.components.filter(c => c.type === type);
}

/**
 * Merge multiple IR bundles
 * @param {IRBundle[]} bundles - Bundles to merge
 * @param {string} name - Name for merged bundle
 * @returns {IRBundle}
 */
export function mergeBundles(bundles, name) {
  const allComponents = bundles.flatMap(b => b.components);
  const mergedContext = bundles.reduce((acc, b) => ({ ...acc, ...b.projectContext }), {});

  return createIRBundle(name, allComponents, mergedContext);
}

export default {
  createIR,
  createIRBundle,
  generateIRId,
  validateIR,
  validateIRBundle,
  calculateSemanticScore,
  trackConversionLoss,
  filterByType,
  mergeBundles,
  COMPONENT_TYPES,
  CONTENT_FORMATS,
  ACTIVATION_MODES,
  PLATFORM_IDS,
};
