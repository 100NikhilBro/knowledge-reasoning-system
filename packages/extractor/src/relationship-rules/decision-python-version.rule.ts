import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";

/**
 * Decision IMPLEMENTED_IN PythonVersion when both entities were extracted.
 */
export class DecisionPythonVersionRule implements RelationshipRule {

  readonly name = "DecisionPythonVersionRule";

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship | null {

    const decision = entities.find(
      entity => entity.type === "Decision"
    );

    const pythonVersion = entities.find(
      entity => entity.type === "PythonVersion"
    );

    if (!decision || !pythonVersion) {
      return null;
    }

    return {
      from: decision.id,
      to: pythonVersion.id,
      type: "IMPLEMENTED_IN",
      confidence: 1.0
    };

  }

}
