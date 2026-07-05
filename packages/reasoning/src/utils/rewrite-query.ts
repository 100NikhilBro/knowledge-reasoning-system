import type {

  QueryRewrite

} from "../types/query-rewrite.js";

import {

  queryRewritePipeline

} from "./query-rewrite-pipeline.js";

export function rewriteQuery(

  query: string

): QueryRewrite {

  const rewritten =

    queryRewritePipeline(

      query

    );

  return {

    original: query,

    rewritten,

    changed:

      rewritten !== query

  };

}