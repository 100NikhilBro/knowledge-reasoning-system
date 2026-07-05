import type {

  CompressionSummary

} from "../types/compression-summary.js";

export function buildCompressionSummary(

  original: number,

  compressed: number

): CompressionSummary {

  return {

    original,

    compressed,

    removed:

      original - compressed

  };

}