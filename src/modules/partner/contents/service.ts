import { prisma } from "../../../lib/prisma.js";
import type { ListContentsQuery } from "./schemas.js";

/**
 * Contenus assignables par module. Seuls `scenario` et `interpreter` ont un
 * catalogue partagé : les histoires et jeux sont des `GeneratedGame`, générés
 * par apprenant, et le journal est libre — rien à cibler pour ces trois-là.
 */

export type ModuleContentDto = {
  id: string;
  title: string;
  theme: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
};

export type ModuleContentsDto = {
  moduleKey: ListContentsQuery["moduleKey"];
  /** Faux quand le module n'a pas de contenu partagé : le devoir porte sur tout le module. */
  supportsTargeting: boolean;
  contents: ModuleContentDto[];
};

/** Les titres sont des `Json` i18n : on prend la langue du portail, puis un repli. */
function pickText(value: unknown, locales = ["fr", "en"]): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const locale of locales) {
    const candidate = record[locale];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  for (const candidate of Object.values(record)) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}

function matchesSearch(title: string, theme: string | null, search?: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return title.toLowerCase().includes(needle) || (theme ?? "").toLowerCase().includes(needle);
}

export async function listModuleContents(params: ListContentsQuery): Promise<ModuleContentsDto> {
  const { moduleKey, search, limit } = params;

  if (moduleKey === "scenario") {
    const rows = await prisma.scenario.findMany({
      where: { isActive: true },
      select: { id: true, title: true, theme: true },
      orderBy: { createdAt: "desc" },
    });
    const contents = rows
      .map((row) => ({
        id: row.id,
        title: pickText(row.title),
        theme: row.theme,
        difficulty: null,
        estimatedMinutes: null,
      }))
      .filter((row) => row.title && matchesSearch(row.title, row.theme, search))
      .slice(0, limit);
    return { moduleKey, supportsTargeting: true, contents };
  }

  if (moduleKey === "interpreter") {
    const rows = await prisma.interpreterScenario.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        theme: true,
        difficulty: true,
        estimatedMinutes: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const contents = rows
      .map((row) => ({
        id: row.id,
        title: pickText(row.title),
        theme: row.theme,
        difficulty: row.difficulty,
        estimatedMinutes: row.estimatedMinutes,
      }))
      .filter((row) => row.title && matchesSearch(row.title, row.theme, search))
      .slice(0, limit);
    return { moduleKey, supportsTargeting: true, contents };
  }

  return { moduleKey, supportsTargeting: false, contents: [] };
}
