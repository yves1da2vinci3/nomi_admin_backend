/**
 * Erreur portant un code HTTP — `error-handler.ts` lit la propriété `status`.
 * Permet aux services métier de refuser une opération sans dépendre d'Express.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function httpError(status: number, message: string): HttpError {
  return new HttpError(status, message);
}
