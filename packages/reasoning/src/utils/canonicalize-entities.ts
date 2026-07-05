const ENTITY_MAP = new Map<string, string>([

  ["node", "node.js"],

  ["reactjs", "react"],

  ["mongodb", "mongo"],

  ["gpt4", "gpt-4"],

  ["gpt-4o", "gpt-4o"]

]);

export function canonicalizeEntities(

  query: string

): string {

  return query

    .split(/\s+/)

    .map(

      word =>

        ENTITY_MAP.get(

          word.toLowerCase()

        ) ?? word

    )

    .join(" ");

}