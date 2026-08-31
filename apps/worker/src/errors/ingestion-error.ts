export class IngestionError extends Error {

  readonly code: string;

  constructor(
    code: string,
    message: string,
    options?: ErrorOptions
  ) {

    super(message, options);

    this.name = "IngestionError";
    this.code = code;

  }

}
