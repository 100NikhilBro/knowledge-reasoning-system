import type {
  Evidence
} from "@knowledge/shared";

import type {
  CompressionSummary
} from "./compression-summary.js";

export interface CompressionPipeline {

  evidence: Evidence[];

  summary: CompressionSummary;

}