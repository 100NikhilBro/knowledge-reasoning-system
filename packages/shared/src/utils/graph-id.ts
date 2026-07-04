export function buildGraphId(
  type: string,
  value: string
): string {

  return `${type.toLowerCase()}:${value}`;

}