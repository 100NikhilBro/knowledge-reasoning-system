export class VectorStoreError extends Error {

  readonly code: string;

  constructor(
    code: string,
    message: string,
    options?: ErrorOptions
  ) {

    super(message, options);

    this.name = "VectorStoreError";
    this.code = code;

  }

}
