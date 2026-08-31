/**
 * L2-normalize a vector. Returns a zero vector unchanged.
 */
export function normalizeVector(
  values: readonly number[]
): number[] {

  let sumSquares = 0;

  for (const value of values) {
    sumSquares += value * value;
  }

  if (sumSquares === 0) {
    return [...values];
  }

  const norm = Math.sqrt(sumSquares);

  return values.map(value => value / norm);

}
