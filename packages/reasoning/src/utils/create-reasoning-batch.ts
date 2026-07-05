import type {

  ReasoningBatch

} from "../types/reasoning-batch.js";

export function createReasoningBatch<T>(

  items: T[]

): ReasoningBatch<T> {

  return {

    items

  };

}