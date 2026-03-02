const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const SHORT_HASH_SUFFIX_REGEX = /-([a-f0-9]{8})$/i;

const KNOWN_PROVENANCE_TAILS = [
  'claude-skills',
  'agent-skills',
  'plurigrid-asi',
  'code-plugins',
  'claude-settings',
  'community-hub',
  'vdk-blueprints',
];

function sanitizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractCandidateFromBlueprint(blueprint) {
  return (
    blueprint?.metadata?.id ||
    blueprint?.metadata?.name ||
    blueprint?.name ||
    blueprint?.metadata?.title ||
    blueprint?.path ||
    ''
  );
}

export class SlugNormalizer {
  normalize(input) {
    const original = String(input || '').trim();
    const normalized = sanitizeSlug(original);

    const provenance = {
      variantSuffix: null,
      uuid: null,
      sourceTail: null,
    };

    let canonical = normalized;

    const uuidMatch = canonical.match(UUID_REGEX);
    if (uuidMatch) {
      provenance.uuid = uuidMatch[0].toLowerCase();
      canonical = canonical.replace(uuidMatch[0], '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    const shortHashMatch = canonical.match(SHORT_HASH_SUFFIX_REGEX);
    if (shortHashMatch) {
      provenance.variantSuffix = shortHashMatch[1].toLowerCase();
      canonical = canonical.replace(SHORT_HASH_SUFFIX_REGEX, '');
    }

    for (const tail of KNOWN_PROVENANCE_TAILS) {
      if (canonical === tail || canonical.endsWith(`-${tail}`)) {
        provenance.sourceTail = tail;
        canonical = canonical === tail ? '' : canonical.slice(0, -(tail.length + 1));
        break;
      }
    }

    canonical = canonical.replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!canonical) {
      canonical = normalized;
    }

    return {
      original,
      normalized,
      canonicalName: canonical,
      tokens: canonical.split('-').filter(Boolean),
      provenance,
    };
  }

  normalizeFromBlueprint(blueprint) {
    return this.normalize(extractCandidateFromBlueprint(blueprint));
  }
}

export const slugNormalizer = new SlugNormalizer();
