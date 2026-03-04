/**
 * Canonical VDK blueprint artifact paths
 * --------------------------------------
 * Raw fetched/generated artifacts are stored by kind under:
 * .vdk/blueprints/{rules,commands,agents,skills,workflows,plugins}
 */

export const VDK_ROOT_DIR = '.vdk';
export const BLUEPRINT_ARTIFACTS_ROOT = `${VDK_ROOT_DIR}/blueprints`;

export const BLUEPRINT_ARTIFACT_KINDS = Object.freeze([
  'rules',
  'commands',
  'agents',
  'skills',
  'workflows',
  'plugins',
]);

export const DEFAULT_BLUEPRINT_RULES_PATH = `${BLUEPRINT_ARTIFACTS_ROOT}/rules`;

export function getBlueprintKindPath(kind) {
  const normalizedKind = String(kind || '')
    .toLowerCase()
    .trim();

  if (!BLUEPRINT_ARTIFACT_KINDS.includes(normalizedKind)) {
    throw new Error(`Unsupported blueprint artifact kind: ${kind}`);
  }

  return `${BLUEPRINT_ARTIFACTS_ROOT}/${normalizedKind}`;
}
