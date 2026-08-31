import type { KnowledgeEntity } from "@knowledge/shared";

import type { VectorRecord } from "../types/vector-record.js";

import { VectorStoreError } from "../errors/vector-store-error.js";

export const PAYLOAD_ENTITY_ID = "entityId";
export const PAYLOAD_TYPE = "type";
export const PAYLOAD_LABEL = "label";
export const PAYLOAD_SOURCE = "source";
export const PAYLOAD_CONFIDENCE = "confidence";
export const PAYLOAD_PROPERTIES = "properties";
export const PAYLOAD_METADATA = "metadata";

export function toQdrantPayload(
  record: VectorRecord
): Record<string, unknown> {

  const { entity } = record;

  return {
    [PAYLOAD_ENTITY_ID]: entity.id,
    [PAYLOAD_TYPE]: entity.type,
    [PAYLOAD_LABEL]: entity.label,
    [PAYLOAD_SOURCE]: entity.source,
    [PAYLOAD_CONFIDENCE]: entity.confidence,
    [PAYLOAD_PROPERTIES]: entity.properties ?? {},
    [PAYLOAD_METADATA]: record.metadata ?? {}
  };

}

export function payloadToEntity(
  payload: Record<string, unknown> | null | undefined
): KnowledgeEntity {

  if (!payload) {
    throw new VectorStoreError(
      "INVALID_PAYLOAD",
      "Search hit is missing payload"
    );
  }

  const entityId = payload[PAYLOAD_ENTITY_ID];
  const type = payload[PAYLOAD_TYPE];
  const label = payload[PAYLOAD_LABEL];
  const source = payload[PAYLOAD_SOURCE];
  const confidence = payload[PAYLOAD_CONFIDENCE];
  const properties = payload[PAYLOAD_PROPERTIES];

  if (
    typeof entityId !== "string" ||
    typeof type !== "string" ||
    typeof label !== "string" ||
    typeof source !== "string"
  ) {
    throw new VectorStoreError(
      "INVALID_PAYLOAD",
      "Search payload is missing required entity fields (entityId, type, label, source)"
    );
  }

  return {
    id: entityId,
    type,
    label,
    source,
    confidence:
      typeof confidence === "number"
        ? confidence
        : 0,
    properties:
      properties !== null &&
      typeof properties === "object" &&
      !Array.isArray(properties)
        ? properties as Record<string, unknown>
        : {}
  };

}

export function payloadMetadata(
  payload: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {

  const metadata = payload?.[PAYLOAD_METADATA];

  if (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, unknown>;
  }

  return undefined;

}
