import type { RequestHandler, Request } from "express";
import type Joi from "joi";

export type ValidationSource = "body" | "query" | "params";

/**
 * `req.query` est un getter avec `@types/express` 5 : passer par
 * `defineProperty` pour écrire la valeur convertie sans casser le typage.
 */
function assignValidated(req: Request, source: ValidationSource, value: unknown) {
  Object.defineProperty(req, source, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Valide `req[source]` avec Joi et remplace la source par la valeur convertie
 * (coercition des query strings, valeurs par défaut, `stripUnknown`).
 *
 * Répond **400** directement : `error-handler.ts` ne traite aucune erreur de
 * validation et renverrait 500 via `next(e)`.
 */
export function validate(
  schema: Joi.Schema,
  source: ValidationSource = "body"
): RequestHandler {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.details.map((d) => ({
          path: d.path.join("."),
          message: d.message,
        })),
      });
      return;
    }

    assignValidated(req, source, value);
    next();
  };
}
