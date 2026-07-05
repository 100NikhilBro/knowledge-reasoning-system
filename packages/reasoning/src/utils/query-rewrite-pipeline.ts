import {

  removeStopWords

} from "./remove-stopwords.js";

import {

  expandSynonyms

} from "./expand-synonyms.js";

import {

  canonicalizeEntities

} from "./canonicalize-entities.js";

export function queryRewritePipeline(

  query: string

): string {

  const normalized =

    query

      .trim()

      .replace(/\s+/g, " ")

      .toLowerCase();

  const cleaned =

    removeStopWords(

      normalized

    );

  const expanded =

    expandSynonyms(

      cleaned

    );

  return canonicalizeEntities(

    expanded

  );

}