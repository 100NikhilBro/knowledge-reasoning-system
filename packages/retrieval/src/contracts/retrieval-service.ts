import type { RetrievalQuery } from "../types/retrieval-query.js";
import type { RetrievalResult } from "../types/retrieval-result.js";

export interface RetrievalService {

  retrieve(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]>;

}