/** Aligné sur nomi_backend getMultilingualField */
export function getMultilingualField(
  jsonField: unknown,
  language: string,
  fallback = "fr"
): string {
  if (!jsonField || typeof jsonField !== "object") return "";
  const o = jsonField as Record<string, string>;
  return o[language] || o[fallback] || String(Object.values(o)[0] ?? "");
}
