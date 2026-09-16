import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";

import {
  buildGraphId,
  canonicalizeRelationshipType,
  isAllowedEntityType,
  isAllowedRelationshipType,
  RELATIONSHIP_TYPE_CONSTRAINTS,
  type AllowedRelationshipType
} from "@knowledge/shared";

import { EntityValidator } from "../validators/entity.validator.js";
import { RelationshipValidator } from "../validators/relationship.validator.js";

export interface ExtractionFinalizeResult {

  entities: KnowledgeEntity[];

  relationships: KnowledgeRelationship[];

  rejectedEntities: KnowledgeEntity[];

  rejectedRelationships: Array<{
    relationship: KnowledgeRelationship;
    reason: string;
  }>;

}

function resolveEntityKeyMaterial(
  entity: KnowledgeEntity
): string {

  switch (entity.type) {

    case "Proposal":
      return String(
        entity.properties.pep ??
        entity.label ??
        entity.id
      );

    case "Author":
      return String(
        entity.properties.name ??
        entity.label ??
        entity.id
      );

    case "Feature":
    case "Concern":
      return String(
        entity.properties.name ??
        entity.label ??
        entity.id
      );

    case "Decision":
      return String(
        entity.properties.outcome ??
        entity.label ??
        entity.id
      );

    case "PythonVersion":
      return String(
        entity.properties.version ??
        entity.label ??
        entity.id
      );

    default:
      return entity.label || entity.id;

  }

}

function mergeEntities(
  existing: KnowledgeEntity,
  incoming: KnowledgeEntity
): KnowledgeEntity {

  const preferIncoming =
    incoming.confidence >= existing.confidence;

  const primary =
    preferIncoming
      ? incoming
      : existing;

  const secondary =
    preferIncoming
      ? existing
      : incoming;

  return {
    ...primary,
    source: existing.source || incoming.source,
    properties: {
      ...secondary.properties,
      ...primary.properties
    }
  };

}

/**
 * Schema validation → ID canonicalization → entity resolution
 * → relationship validation → relationship dedupe.
 *
 * Invalid graph objects are quarantined and never returned
 * for Neo4j persistence.
 */
export function finalizeExtraction(
  entities: KnowledgeEntity[],
  relationships: KnowledgeRelationship[]
): ExtractionFinalizeResult {

  const entityValidator =
    new EntityValidator();

  const relationshipValidator =
    new RelationshipValidator();

  const rejectedEntities: KnowledgeEntity[] = [];
  const rejectedRelationships: ExtractionFinalizeResult["rejectedRelationships"] = [];

  const idRemap =
    new Map<string, string>();

  const resolvedById =
    new Map<string, KnowledgeEntity>();

  for (const entity of entities) {

    if (!entityValidator.validate(entity)) {
      rejectedEntities.push(entity);
      continue;
    }

    if (!isAllowedEntityType(entity.type)) {
      rejectedEntities.push(entity);
      continue;
    }

    const canonicalId =
      buildGraphId(
        entity.type,
        resolveEntityKeyMaterial(entity)
      );

    idRemap.set(entity.id, canonicalId);

    const canonicalEntity: KnowledgeEntity = {
      ...entity,
      id: canonicalId
    };

    const existing =
      resolvedById.get(canonicalId);

    if (existing) {
      resolvedById.set(
        canonicalId,
        mergeEntities(existing, canonicalEntity)
      );
    } else {
      resolvedById.set(canonicalId, canonicalEntity);
    }

  }

  const resolvedEntities =
    [...resolvedById.values()];

  const entityById =
    new Map(
      resolvedEntities.map(entity => [
        entity.id,
        entity
      ])
    );

  const relationshipKeys =
    new Set<string>();

  const resolvedRelationships: KnowledgeRelationship[] = [];

  for (const relationship of relationships) {

    const remapped: KnowledgeRelationship = {
      ...relationship,
      from:
        idRemap.get(relationship.from) ??
        relationship.from,
      to:
        idRemap.get(relationship.to) ??
        relationship.to,
      type: canonicalizeRelationshipType(
        relationship.type
      ),
      properties: relationship.properties ?? {}
    };

    if (!relationshipValidator.validate(remapped)) {
      rejectedRelationships.push({
        relationship: remapped,
        reason: "missing_required_fields"
      });
      continue;
    }

    if (!isAllowedRelationshipType(remapped.type)) {
      rejectedRelationships.push({
        relationship: remapped,
        reason: "unsupported_relationship_type"
      });
      continue;
    }

    const fromEntity =
      entityById.get(remapped.from);

    const toEntity =
      entityById.get(remapped.to);

    if (!fromEntity || !toEntity) {
      rejectedRelationships.push({
        relationship: remapped,
        reason: "missing_endpoint_entity"
      });
      continue;
    }

    const constraint =
      RELATIONSHIP_TYPE_CONSTRAINTS[
        remapped.type as AllowedRelationshipType
      ];

    if (
      !constraint.from.includes(
        fromEntity.type as typeof constraint.from[number]
      ) ||
      !constraint.to.includes(
        toEntity.type as typeof constraint.to[number]
      )
    ) {
      rejectedRelationships.push({
        relationship: remapped,
        reason: "invalid_endpoint_types"
      });
      continue;
    }

    if (
      !relationshipValidator.validateEndpoints(
        remapped,
        fromEntity,
        toEntity
      )
    ) {
      rejectedRelationships.push({
        relationship: remapped,
        reason: "invalid_endpoint_types"
      });
      continue;
    }

    const key =
      `${remapped.from}|${remapped.type}|${remapped.to}`;

    if (relationshipKeys.has(key)) {
      continue;
    }

    relationshipKeys.add(key);
    resolvedRelationships.push(remapped);

  }

  return {
    entities: resolvedEntities,
    relationships: resolvedRelationships,
    rejectedEntities,
    rejectedRelationships
  };

}
