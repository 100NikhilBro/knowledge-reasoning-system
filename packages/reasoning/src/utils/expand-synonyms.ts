const SYNONYMS = new Map<string, string>([

  ["js", "javascript"],

  ["ts", "typescript"],

  ["ai", "artificial intelligence"],

  ["db", "database"],

  ["api", "application programming interface"]

]);

export function expandSynonyms(

  query: string

): string {

  return query

    .split(/\s+/)

    .map(

      word =>

        SYNONYMS.get(

          word.toLowerCase()

        ) ?? word

    )

    .join(" ");

}