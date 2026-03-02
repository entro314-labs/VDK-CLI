import { resolveCanonicalKind } from '../../shared/canonical-kind.js';

export class CanonicalKindClassifier {
  classify(blueprint) {
    const resolution = resolveCanonicalKind({
      kind: blueprint?.metadata?.kind || blueprint?.kind,
      componentType: blueprint?.metadata?.componentType,
    });

    if (!resolution) {
      throw new Error('Blueprint missing canonical metadata.kind');
    }

    return {
      canonicalKind: resolution.canonicalKind,
      confidence: resolution.confidence,
      reason: resolution.reason,
    };
  }
}

export const canonicalKindClassifier = new CanonicalKindClassifier();
