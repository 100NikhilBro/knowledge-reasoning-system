/**
 * Controlled PEP-domain graph ontology.
 * Keep in sync with extractor relationship rules and Neo4j labels.
 */

export const ALLOWED_ENTITY_TYPES = [
  "Proposal",
  "Author",
  "Feature",
  "Concern",
  "Decision",
  "PythonVersion"
] as const;

export type AllowedEntityType =
  (typeof ALLOWED_ENTITY_TYPES)[number];

export const ALLOWED_RELATIONSHIP_TYPES = [
  "PROPOSED_BY",
  "INTRODUCES",
  "ADDRESSES",
  "RESULTS_IN",
  "IMPLEMENTED_IN"
] as const;

export type AllowedRelationshipType =
  (typeof ALLOWED_RELATIONSHIP_TYPES)[number];

export interface RelationshipTypeConstraint {
  from: readonly AllowedEntityType[];
  to: readonly AllowedEntityType[];
}

/**
 * Allowed source → relationship → target combinations.
 * Anything outside this matrix is rejected before Neo4j.
 */
export const RELATIONSHIP_TYPE_CONSTRAINTS: Record<
  AllowedRelationshipType,
  RelationshipTypeConstraint
> = {
  PROPOSED_BY: {
    from: ["Proposal"],
    to: ["Author"]
  },
  INTRODUCES: {
    from: ["Proposal"],
    to: ["Feature"]
  },
  ADDRESSES: {
    from: ["Proposal"],
    to: ["Concern"]
  },
  RESULTS_IN: {
    from: ["Proposal"],
    to: ["Decision"]
  },
  IMPLEMENTED_IN: {
    from: ["Decision"],
    to: ["PythonVersion"]
  }
};

export function isAllowedEntityType(
  type: string
): type is AllowedEntityType {

  return (ALLOWED_ENTITY_TYPES as readonly string[])
    .includes(type);

}

/**
 * Normalize relationship type spelling/casing to canonical SCREAMING_SNAKE.
 */
export function canonicalizeRelationshipType(
  type: string
): string {

  return type
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

}

export function isAllowedRelationshipType(
  type: string
): type is AllowedRelationshipType {

  const canonical =
    canonicalizeRelationshipType(type);

  return (ALLOWED_RELATIONSHIP_TYPES as readonly string[])
    .includes(canonical);

}
