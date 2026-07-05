import type { KnowledgeEntity } from "@knowledge/shared";

export function calculateScore(
  entity: KnowledgeEntity
): number {

  let score = entity.confidence;

  switch (entity.type) {

    case "Proposal":
      score += 5;
      break;

    case "Feature":
      score += 4;
      break;

    case "Author":
      score += 3;
      break;

    case "Concern":
      score += 2;
      break;

    default:
      score += 1;

  }

  return score;

}