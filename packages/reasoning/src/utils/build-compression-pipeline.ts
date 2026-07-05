import type {
  Evidence
} from "@knowledge/shared";

import type {
  CompressionPipeline
} from "../types/compression-pipeline.js";

import {
  compressEvidence
} from "./compress-evidence.js";

import {
  applyEvidenceBudget
} from "./apply-evidence-budget.js";

import {
  buildCompressionSummary
} from "./build-compression-summary.js";

export function buildCompressionPipeline(

  evidence: Evidence[],

  maxEvidence = 10

): CompressionPipeline {

  const compressed =

    compressEvidence(

      evidence

    );

  const limited =

    applyEvidenceBudget(

      compressed,

      {

        maxEvidence

      }

    );

  const summary =

    buildCompressionSummary(

      evidence.length,

      limited.length

    );

  return {

    evidence: limited,

    summary

  };

}