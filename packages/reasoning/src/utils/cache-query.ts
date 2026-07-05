import type {

  QueryCache

} from "../types/query-cache.js";

export function cacheQuery(

  cache: QueryCache,

  key: string,

  value: unknown

): void {

  cache.entries.set(

    key,

    value

  );

}