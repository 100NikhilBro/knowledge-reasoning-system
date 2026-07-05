const STOP_WORDS = new Set([

  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "of",
  "to",
  "for",
  "about",
  "tell",
  "me",
  "what",
  "who"

]);

export function removeStopWords(

  query: string

): string {

  return query

    .split(/\s+/)

    .filter(

      word =>

        !STOP_WORDS.has(

          word.toLowerCase()

        )

    )

    .join(" ");

}