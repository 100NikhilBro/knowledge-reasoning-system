import type {

  ReasoningBatch

} from "../types/reasoning-batch.js";

export function buildBatchSummary<T>(

  batch: ReasoningBatch<T>

): string {

  return `Processed ${batch.items.length} reasoning requests.`;

}