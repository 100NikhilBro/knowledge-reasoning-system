import type {
  GraphPath,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

/**
 * One node discovered during graph traversal, with real edge/path provenance.
 * Seeds have depth 0 and no inbound relationship.
 */
export interface TraversalHit {

  entity: KnowledgeEntity;

  /**
   * Hop distance from the nearest seed (0 = seed).
   */
  depth: number;

  /**
   * Real Neo4j relationship that discovered this entity from its predecessor.
   * Absent for seed nodes.
   */
  relationship?: KnowledgeRelationship;

  /**
   * Path from a seed to this entity (nodes + relationships in order).
   */
  path: GraphPath;

}
