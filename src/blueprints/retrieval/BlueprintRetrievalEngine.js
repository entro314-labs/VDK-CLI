import { canonicalKindClassifier } from './CanonicalKindClassifier.js';
import { slugNormalizer } from './SlugNormalizer.js';
import { specificityClassifier } from './SpecificityClassifier.js';

export const DEFAULT_LAYER_BLEND = {
  L0: 0.2,
  L1: 0.35,
  L2: 0.3,
  L3: 0.15,
  L4: 0,
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function clampScore(value) {
  return Math.max(0, Math.min(1, value));
}

function isPlatformSelectable(platformConfig) {
  if (!platformConfig || typeof platformConfig !== 'object') {
    return false;
  }

  if (platformConfig.compatible === false || platformConfig.enabled === false) {
    return false;
  }

  return true;
}

function parseDateScore(dateLike) {
  if (!dateLike) return 0.5;
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return 0.5;

  const now = Date.now();
  const ageDays = Math.max(0, (now - parsed.getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.8;
  if (ageDays <= 365) return 0.65;
  if (ageDays <= 730) return 0.5;
  return 0.35;
}

export class BlueprintRetrievalEngine {
  constructor(options = {}) {
    this.layerBlend = {
      ...DEFAULT_LAYER_BLEND,
      ...options.layerBlend,
    };
  }

  enrichBlueprint(blueprint) {
    const normalized = slugNormalizer.normalizeFromBlueprint(blueprint);
    const kind = canonicalKindClassifier.classify(blueprint);
    const specificity = specificityClassifier.classify(blueprint, normalized, kind.canonicalKind);

    return {
      ...blueprint,
      retrieval: {
        normalizedSlug: normalized.normalized,
        canonicalName: normalized.canonicalName,
        provenance: normalized.provenance,
        canonicalKind: kind.canonicalKind,
        canonicalKindConfidence: kind.confidence,
        specificityLayer: specificity.layer,
        specificityConfidence: specificity.confidence,
      },
    };
  }

  enrichBlueprints(blueprints = []) {
    return blueprints.map(blueprint => {
      if (blueprint?.retrieval?.canonicalName && blueprint?.retrieval?.specificityLayer) {
        return blueprint;
      }
      return this.enrichBlueprint(blueprint);
    });
  }

  search(blueprints = [], criteria = {}) {
    const enriched = this.enrichBlueprints(blueprints);
    const filtered = enriched.filter(blueprint => this.matchesCriteria(blueprint, criteria));
    const scored = filtered
      .map(blueprint => this.attachScores(blueprint, criteria))
      .toSorted((a, b) => b.retrieval.finalScore - a.retrieval.finalScore);

    const deduped = this.dedupeByCanonicalName(scored, criteria);
    const selected = this.selectByLayerBlend(deduped, criteria);

    return {
      results: selected,
      total: deduped.length,
      totalBeforeDedupe: scored.length,
      totalEnriched: enriched.length,
    };
  }

  matchesCriteria(blueprint, criteria) {
    const metadata = blueprint.metadata || {};
    const retrieval = blueprint.retrieval || {};

    if (!(criteria.includeL4 || criteria.auditProvenance) && retrieval.specificityLayer === 'L4') {
      return false;
    }

    if (criteria.kind && retrieval.canonicalKind !== criteria.kind) {
      return false;
    }

    if (criteria.specificity && retrieval.specificityLayer !== criteria.specificity) {
      return false;
    }

    if (criteria.platform) {
      const platformConfig = blueprint.platforms?.[criteria.platform];
      if (!isPlatformSelectable(platformConfig)) return false;
    }

    if (criteria.category && metadata.category !== criteria.category) {
      return false;
    }

    if (criteria.complexity && blueprint.complexity !== criteria.complexity) {
      return false;
    }

    if (criteria.scope && blueprint.scope !== criteria.scope) {
      return false;
    }

    if (criteria.audience && blueprint.audience !== criteria.audience) {
      return false;
    }

    if (criteria.maturity && blueprint.maturity !== criteria.maturity) {
      return false;
    }

    if (criteria.tags && Array.isArray(criteria.tags)) {
      const blueprintTags = (metadata.tags || []).map(tag => normalizeText(tag));
      const hasMatch = criteria.tags.some(tag => blueprintTags.includes(normalizeText(tag)));
      if (!hasMatch) return false;
    }

    if (criteria.query) {
      const semantic = this.computeSemanticScore(blueprint, criteria.query);
      if (criteria.exactMatch && !semantic.exact) {
        return false;
      }
      if (!(criteria.fuzzy || criteria.exactMatch) && semantic.score <= 0) {
        return false;
      }
    }

    return true;
  }

  attachScores(blueprint, criteria) {
    const semantic = criteria.query
      ? this.computeSemanticScore(blueprint, criteria.query)
      : { score: 0.5, exact: false };

    const qualityScore = this.computeQualityScore(blueprint);
    const portabilityScore = this.computePortabilityScore(blueprint);
    const freshnessScore = this.computeFreshnessScore(blueprint);

    const finalScore = clampScore(
      0.55 * semantic.score + 0.2 * qualityScore + 0.15 * portabilityScore + 0.1 * freshnessScore
    );

    return {
      ...blueprint,
      retrieval: {
        ...blueprint.retrieval,
        semanticScore: semantic.score,
        exactMatch: semantic.exact,
        qualityScore,
        portabilityScore,
        freshnessScore,
        finalScore,
      },
    };
  }

  computeSemanticScore(blueprint, query) {
    const queryText = normalizeText(query);
    if (!queryText) {
      return { score: 0.5, exact: false };
    }

    const retrieval = blueprint.retrieval || {};
    const metadata = blueprint.metadata || {};

    const id = normalizeText(metadata.id);
    const canonicalName = normalizeText(retrieval.canonicalName);
    const title = normalizeText(metadata.title);
    const description = normalizeText(metadata.description);

    if ([id, canonicalName, title].includes(queryText)) {
      return { score: 1, exact: true };
    }

    const haystacks = [id, canonicalName, title, description].filter(Boolean);
    if (haystacks.some(text => text.includes(queryText))) {
      return { score: 0.85, exact: false };
    }

    const queryTokens = queryText.split(/[-\s]+/).filter(Boolean);
    if (queryTokens.length === 0) {
      return { score: 0, exact: false };
    }

    const bag = new Set(
      [id, canonicalName, title, description]
        .join(' ')
        .split(/[-\s]+/)
        .filter(Boolean)
    );

    const overlap = queryTokens.filter(token => bag.has(token)).length;
    const tokenRatio = overlap / queryTokens.length;
    return { score: clampScore(tokenRatio * 0.75), exact: false };
  }

  computeQualityScore(blueprint) {
    const maturity = normalizeText(blueprint?.maturity);
    const validationBonus = blueprint?.valid ? 0.2 : -0.1;

    let maturityScore = 0.5;
    if (maturity === 'stable') maturityScore = 0.9;
    if (maturity === 'beta') maturityScore = 0.75;
    if (maturity === 'experimental') maturityScore = 0.55;
    if (maturity === 'deprecated') maturityScore = 0.2;

    return clampScore(maturityScore + validationBonus);
  }

  computePortabilityScore(blueprint) {
    const platforms = blueprint?.platforms || {};
    const compatibleCount = Object.values(platforms).filter(config =>
      isPlatformSelectable(config)
    ).length;
    if (compatibleCount === 0) return 0.35;
    return clampScore(Math.min(compatibleCount / 8, 1));
  }

  computeFreshnessScore(blueprint) {
    const metadata = blueprint?.metadata || {};
    return parseDateScore(metadata.lastUpdated || metadata.created);
  }

  dedupeByCanonicalName(scoredBlueprints, criteria = {}) {
    if (criteria.auditProvenance) {
      return scoredBlueprints;
    }

    const grouped = new Map();
    for (const blueprint of scoredBlueprints) {
      const key = blueprint?.retrieval?.canonicalName || blueprint?.metadata?.id || blueprint?.name;
      if (!grouped.has(key)) {
        grouped.set(key, [blueprint]);
      } else {
        grouped.get(key).push(blueprint);
      }
    }

    const deduped = [];
    for (const variants of grouped.values()) {
      variants.sort((a, b) => b.retrieval.finalScore - a.retrieval.finalScore);
      const primary = {
        ...variants[0],
        retrieval: {
          ...variants[0].retrieval,
          variants: variants.slice(1).map(item => ({
            id: item?.metadata?.id || item?.name,
            layer: item?.retrieval?.specificityLayer,
            provenance: item?.retrieval?.provenance,
          })),
        },
      };
      deduped.push(primary);
    }

    return deduped.toSorted((a, b) => b.retrieval.finalScore - a.retrieval.finalScore);
  }

  selectByLayerBlend(blueprints, criteria = {}) {
    const limit = Math.max(1, Number.parseInt(criteria.limit || '20', 10));

    if (criteria.specificity || criteria.query || criteria.exactMatch) {
      return blueprints.slice(0, limit);
    }

    const layerBuckets = {
      L0: [],
      L1: [],
      L2: [],
      L3: [],
      L4: [],
    };

    for (const blueprint of blueprints) {
      const layer = blueprint?.retrieval?.specificityLayer || 'L0';
      if (!criteria.includeL4 && layer === 'L4') continue;
      layerBuckets[layer].push(blueprint);
    }

    for (const layer of Object.keys(layerBuckets)) {
      layerBuckets[layer].sort((a, b) => b.retrieval.finalScore - a.retrieval.finalScore);
    }

    const targetCounts = this.calculateTargetCounts(limit, criteria.includeL4 === true);
    const selected = [];

    for (const [layer, count] of Object.entries(targetCounts)) {
      if (count <= 0) continue;
      selected.push(...layerBuckets[layer].splice(0, count));
    }

    if (selected.length < limit) {
      const leftovers = Object.values(layerBuckets)
        .flat()
        .toSorted((a, b) => b.retrieval.finalScore - a.retrieval.finalScore);

      selected.push(...leftovers.slice(0, limit - selected.length));
    }

    return selected
      .toSorted((a, b) => b.retrieval.finalScore - a.retrieval.finalScore)
      .slice(0, limit);
  }

  calculateTargetCounts(limit, includeL4) {
    const blend = includeL4
      ? { ...this.layerBlend, L4: this.layerBlend.L4 || 0.05 }
      : this.layerBlend;

    const counts = {
      L0: 0,
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };

    const layers = includeL4 ? ['L0', 'L1', 'L2', 'L3', 'L4'] : ['L0', 'L1', 'L2', 'L3'];
    let allocated = 0;

    for (const layer of layers) {
      counts[layer] = Math.floor((blend[layer] || 0) * limit);
      allocated += counts[layer];
    }

    let remaining = limit - allocated;
    const sortedByWeight = [...layers].toSorted((a, b) => (blend[b] || 0) - (blend[a] || 0));
    let index = 0;

    while (remaining > 0 && sortedByWeight.length > 0) {
      const layer = sortedByWeight[index % sortedByWeight.length];
      counts[layer] += 1;
      remaining -= 1;
      index += 1;
    }

    return counts;
  }
}

export const blueprintRetrievalEngine = new BlueprintRetrievalEngine();
