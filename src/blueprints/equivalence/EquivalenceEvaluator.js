import { createIR, trackConversionLoss } from '../../ir/types.js';
import {
  normalizePlatformId,
  resolveBlueprintPlatformConfig,
} from '../../shared/platform-resolution.js';

const COMPONENT_KEY_TO_IR_TYPE = {
  main: 'main',
  agents: 'agent',
  rules: 'rule',
  commands: 'command',
  skills: 'skill',
  workflows: 'workflow',
  config: 'settings',
  settings: 'settings',
  'repo-level': 'main',
  'directory-level': 'main',
};

const PLATFORM_COMPONENT_SUPPORT = {
  'claude-code': new Set(['main', 'agent', 'rule', 'command', 'skill', 'settings']),
  'claude-desktop': new Set(['main', 'agent', 'rule', 'command', 'skill', 'settings']),
  cursor: new Set(['main', 'rule']),
  windsurf: new Set(['rule', 'workflow']),
  'windsurf-next': new Set(['rule', 'workflow']),
  'github-copilot': new Set(['main', 'rule']),
  vscode: new Set(['main', 'rule', 'settings']),
  'vscode-insiders': new Set(['main', 'rule', 'settings']),
  'vs-code-insiders': new Set(['main', 'rule', 'settings']),
  vscodium: new Set(['main', 'rule', 'settings']),
  continue: new Set(['settings', 'command', 'rule', 'main']),
  aider: new Set(['settings', 'main', 'rule']),
  'openai-codex': new Set(['main', 'agent', 'rule']),
  'google-antigravity': new Set(['main', 'rule', 'workflow', 'settings']),
  'gemini-cli': new Set(['main', 'settings', 'rule']),
  'kimi-cli': new Set(['main', 'settings', 'rule']),
  'mistral-vibe': new Set(['main', 'agent', 'settings', 'rule']),
  trae: new Set(['main', 'settings', 'rule']),
  opencode: new Set(['main', 'rule', 'skill', 'settings']),
  'jetbrains-ai': new Set(['settings', 'rule']),
  zed: new Set(['settings', 'rule']),
  tabnine: new Set(['rule', 'settings', 'main']),
  acp: new Set(['main', 'agent', 'rule', 'settings']),
};

export class EquivalenceEvaluator {
  evaluateBlueprintForPlatform(blueprint, targetPlatform) {
    const requestedPlatform = normalizePlatformId(targetPlatform);
    const resolution = resolveBlueprintPlatformConfig(blueprint, requestedPlatform);
    const platformId = resolution.matchedPlatform || requestedPlatform;
    const platformConfig = resolution.platformConfig;

    if (!platformConfig) {
      return {
        outcome: 'unsupported',
        targetPlatform: requestedPlatform,
        reason: `Blueprint has no platform config for ${requestedPlatform} (checked: ${resolution.candidates.join(', ')})`,
        resolvedPlatform: null,
        usedAliasFallback: false,
        supportedComponents: [],
        unsupportedComponents: [],
        lossItems: [],
      };
    }

    const extractedComponents = this.extractEnabledComponents(platformConfig.components || {});

    if (extractedComponents.length === 0) {
      return {
        outcome: 'unsupported',
        targetPlatform: requestedPlatform,
        reason: `No enabled components found for ${platformId}`,
        resolvedPlatform: platformId,
        usedAliasFallback: resolution.matchedViaAlias,
        supportedComponents: [],
        unsupportedComponents: [],
        lossItems: [],
      };
    }

    const supportedTypes =
      PLATFORM_COMPONENT_SUPPORT[requestedPlatform] ||
      PLATFORM_COMPONENT_SUPPORT[platformId] ||
      null;
    const supportedComponents = [];
    const unsupportedComponents = [];
    const lossItems = [];

    for (const component of extractedComponents) {
      if (supportedTypes && !supportedTypes.has(component.irType)) {
        unsupportedComponents.push({
          component: component.componentKey,
          name: component.name,
          reason: `${platformId} does not support ${component.irType}`,
        });
        continue;
      }

      supportedComponents.push({
        component: component.componentKey,
        name: component.name,
        irType: component.irType,
      });

      const sourceIR = this.createSourceIR(component, blueprint);
      const losses = trackConversionLoss(sourceIR, sourceIR, platformId);

      for (const loss of losses) {
        lossItems.push({
          ...loss,
          component: component.componentKey,
          componentName: component.name,
        });
      }
    }

    if (supportedComponents.length === 0) {
      return {
        outcome: 'unsupported',
        targetPlatform: requestedPlatform,
        reason: `All blueprint components are unsupported on ${platformId}`,
        resolvedPlatform: platformId,
        usedAliasFallback: resolution.matchedViaAlias,
        supportedComponents,
        unsupportedComponents,
        lossItems,
      };
    }

    const hasLoss = lossItems.length > 0 || unsupportedComponents.length > 0;

    return {
      outcome: hasLoss ? 'lossy' : 'lossless',
      targetPlatform: requestedPlatform,
      resolvedPlatform: platformId,
      usedAliasFallback: resolution.matchedViaAlias,
      reason: hasLoss
        ? `Deployable with losses (${lossItems.length} conversion loss, ${unsupportedComponents.length} unsupported component${resolution.matchedViaAlias ? `, fallback from ${requestedPlatform} to ${platformId}` : ''})`
        : 'No semantic loss detected',
      supportedComponents,
      unsupportedComponents,
      lossItems,
    };
  }

  toWarningMessages(result, label = result.targetPlatform) {
    if (!result || result.outcome === 'lossless') {
      return [];
    }

    if (result.outcome === 'unsupported') {
      return [`${label}: unsupported equivalence (${result.reason})`];
    }

    const messages = [
      `${label}: lossy equivalence (${result.lossItems.length} loss item(s), ${result.unsupportedComponents.length} unsupported component(s))`,
    ];

    const samples = [
      ...result.unsupportedComponents.map(item => `${item.component}: ${item.reason}`),
      ...result.lossItems.map(item => `${item.component}: ${item.reason}`),
    ].slice(0, 3);

    for (const sample of samples) {
      messages.push(`${label}: ${sample}`);
    }

    return messages;
  }

  extractEnabledComponents(components) {
    const extracted = [];

    for (const [componentKey, config] of Object.entries(components || {})) {
      if (!config || config.enabled === false) {
        continue;
      }

      const irType = COMPONENT_KEY_TO_IR_TYPE[componentKey] || 'rule';
      const manifests =
        Array.isArray(config.manifests) && config.manifests.length > 0
          ? config.manifests
          : [{ name: componentKey, file: config.location }];

      for (const manifest of manifests) {
        extracted.push({
          componentKey,
          irType,
          name: manifest?.name || manifest?.file || componentKey,
          manifest,
        });
      }
    }

    return extracted;
  }

  createSourceIR(component, blueprint) {
    const ir = createIR(component.irType, component.name);

    const raw = component?.manifest?.content || blueprint?.source?.content || '';
    ir.content.raw = raw;

    const metadataTools = Array.isArray(blueprint?.metadata?.tools) ? blueprint.metadata.tools : [];

    if (metadataTools.length > 0) {
      ir.tools = metadataTools.map(tool => ({ name: String(tool) }));
    }

    const metadataTriggers = Array.isArray(blueprint?.metadata?.triggers)
      ? blueprint.metadata.triggers
      : [];

    if (metadataTriggers.length > 0) {
      ir.triggers = metadataTriggers;
    }

    return ir;
  }
}

export const equivalenceEvaluator = new EquivalenceEvaluator();
