import type {

  QueryCache

} from "../types/query-cache.js";

export function clearQueryCache(

  cache: QueryCache

): void {

  cache.entries.clear();

}