import type {

  ReasoningBatch

} from "../types/reasoning-batch.js";

export function processReasoningBatch<T, R>(

  batch: ReasoningBatch<T>,

  processor: (

    item: T

  ) => R

): R[] {

  return batch.items.map(

    processor

  );

}