import type {
  NextFunction,
  Request,
  Response
} from "express";

/**
 * Minimal security headers appropriate for a JSON API-key service.
 */
export function createSecurityHeadersMiddleware() {

  return function securityHeadersMiddleware(

    _req: Request,

    res: Response,

    next: NextFunction

  ): void {

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "X-Frame-Options",
      "DENY"
    );

    res.setHeader(
      "Referrer-Policy",
      "no-referrer"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    next();

  };

}
