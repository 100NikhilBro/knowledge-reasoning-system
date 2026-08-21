// export function buildGraphId(
//   type: string,
//   value: string
// ): string {

//   return `${type.toLowerCase()}:${value}`;

// }


export function buildGraphId(
  type: string,
  value: string
): string {

  const prefix =
    `${type.toLowerCase()}:`;

  if (
    value.toLowerCase().startsWith(
      prefix
    )
  ) {

    return value;

  }

  return `${prefix}${value}`;

}