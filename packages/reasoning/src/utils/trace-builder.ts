import type {
  Evidence,
  EvidenceSet,
  ReasoningTrace,
  ReasoningStep
} from "@knowledge/shared";

/**
 * Build a reasoning-path trace from evidence.
 *
 * Co-seeded endpoints that carry the same underlying relationship
 * (from|type|to) produce one path step — not one step per attachment.
 * Direction and provenance of the preferred attachment are preserved.
 */
export function buildTrace(
  evidenceSet: EvidenceSet
): ReasoningTrace {

  const steps: ReasoningStep[] = [];

  const seenRelationships =
    new Set<string>();

  const entitiesCoveredByRelationship =
    new Set<string>();

  const seenEntityOnly =
    new Set<string>();

  const labelById =
    buildLabelIndex(evidenceSet.evidence);

  for (const item of evidenceSet.evidence) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seenRelationships.has(key)) {
      continue;
    }

    seenRelationships.add(key);
    entitiesCoveredByRelationship.add(relationship.from);
    entitiesCoveredByRelationship.add(relationship.to);

    const preferred =
      preferSourceAttachment(
        evidenceSet.evidence,
        relationship.from,
        relationship.to,
        key
      ) ?? item;

    const fromLabel =
      labelById.get(relationship.from) ??
      relationship.from;

    const toLabel =
      labelById.get(relationship.to) ??
      relationship.to;

    const fromType =
      preferred.entity.id === relationship.from
        ? preferred.entity.type
        : inferType(labelById, relationship.from);

    steps.push({
      description:
        `Selected ${fromType}: ${fromLabel} via ${relationship.type} (${relationship.from} → ${relationship.to})`,
      evidence: [preferred]
    });

  }

  for (const item of evidenceSet.evidence) {

    if (item.relationship) {
      continue;
    }

    if (entitiesCoveredByRelationship.has(item.entity.id)) {
      continue;
    }

    if (seenEntityOnly.has(item.entity.id)) {
      continue;
    }

    seenEntityOnly.add(item.entity.id);

    steps.push({
      description:
        `Selected ${item.entity.type}: ${item.entity.label}`,
      evidence: [item]
    });

  }

  return {
    steps
  };

}

function buildLabelIndex(
  evidence: Evidence[]
): Map<string, string> {

  const labels =
    new Map<string, string>();

  for (const item of evidence) {
    if (!labels.has(item.entity.id)) {
      labels.set(item.entity.id, item.entity.label);
    }

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    if (
      item.entity.id === relationship.from &&
      !labels.has(relationship.from)
    ) {
      labels.set(relationship.from, item.entity.label);
    }

    if (
      item.entity.id === relationship.to &&
      !labels.has(relationship.to)
    ) {
      labels.set(relationship.to, item.entity.label);
    }
  }

  return labels;

}

function preferSourceAttachment(
  evidence: Evidence[],
  fromId: string,
  toId: string,
  relationshipKey: string
): Evidence | undefined {

  const matching =
    evidence.filter(item => {
      const relationship =
        item.relationship;

      if (!relationship) {
        return false;
      }

      return (
        `${relationship.from}|${relationship.type}|${relationship.to}` ===
        relationshipKey
      );
    });

  return (
    matching.find(item => item.entity.id === fromId) ??
    matching.find(item => item.entity.id === toId) ??
    matching[0]
  );

}

function inferType(
  _labelById: Map<string, string>,
  entityId: string
): string {

  const prefix =
    entityId.split(":")[0];

  if (!prefix) {
    return "Entity";
  }

  return prefix.charAt(0).toUpperCase() + prefix.slice(1);

}
