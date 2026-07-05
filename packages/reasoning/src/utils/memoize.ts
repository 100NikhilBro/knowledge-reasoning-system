import type {

  MemoizationCache

} from "../types/memoization-cache.js";

export function memoize<T>(

  cache: MemoizationCache,

  key: string,

  factory: () => T

): T {

  if (

    cache.entries.has(

      key

    )

  ) {

    return cache.entries.get(

      key

    ) as T;

  }

  const value =

    factory();

  cache.entries.set(

    key,

    value

  );

  return value;

}