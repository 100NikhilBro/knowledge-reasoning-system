export declare const ALLOWED_ENTITY_TYPES: readonly [
  "Proposal",
  "Author",
  "Feature",
  "Concern",
  "Decision",
  "PythonVersion"
];

export type AllowedEntityType =
  (typeof ALLOWED_ENTITY_TYPES)[number];

export declare const ALLOWED_RELATIONSHIP_TYPES: readonly [
  "PROPOSED_BY",
  "INTRODUCES",
  "ADDRESSES",
  "RESULTS_IN",
  "IMPLEMENTED_IN"
];

export type AllowedRelationshipType =
  (typeof ALLOWED_RELATIONSHIP_TYPES)[number];

export interface RelationshipTypeConstraint {
  from: readonly AllowedEntityType[];
  to: readonly AllowedEntityType[];
}

export declare const RELATIONSHIP_TYPE_CONSTRAINTS: Record<
  AllowedRelationshipType,
  RelationshipTypeConstraint
>;

export declare function isAllowedEntityType(
  type: string
): type is AllowedEntityType;

export declare function canonicalizeRelationshipType(
  type: string
): string;

export declare function isAllowedRelationshipType(
  type: string
): type is AllowedRelationshipType;
