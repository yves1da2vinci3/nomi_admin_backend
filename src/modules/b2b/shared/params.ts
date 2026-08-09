import type { Request } from "express";

/**
 * Lit un paramètre de route. Nécessaire sur les sous-routeurs
 * `Router({ mergeParams: true })` : le typage Express ne connaît que les
 * paramètres du chemin local, pas ceux hérités du parent.
 */
export function routeParam(req: Request, name: string): string {
  const value = (req.params as Record<string, string | undefined>)[name];
  if (!value) throw new Error(`Missing route param: ${name}`);
  return value;
}
