import { describe, test, expect } from "bun:test";
import {
  cursorFrom,
  matchesAssignment,
  MODULE_KEYS,
  SOURCE_DEFINITIONS,
  SOURCE_TYPES,
  startOfMonthUtc,
  type AssignmentCandidate,
} from "./matching.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const hour = 60 * 60 * 1000;
const day = 24 * hour;

describe("SOURCE_DEFINITIONS", () => {
  test("couvre les 5 modules seedés, un par source", () => {
    expect(SOURCE_DEFINITIONS).toHaveLength(5);
    expect([...SOURCE_DEFINITIONS].map((d) => d.moduleKey).sort()).toEqual([...MODULE_KEYS].sort());
  });

  test("chaque sourceType est déclaré et unique", () => {
    const types = SOURCE_DEFINITIONS.map((d) => d.sourceType);
    expect(new Set(types).size).toBe(types.length);
    for (const type of types) {
      expect(SOURCE_TYPES).toContain(type);
    }
  });
});

describe("cursorFrom", () => {
  test("première ingestion : borne à la fenêtre d'amorçage", () => {
    const cursor = cursorFrom(null, now, { bootstrapDays: 90 });
    expect(cursor.getTime()).toBe(now.getTime() - 90 * day);
  });

  test("recule d'une heure sur le dernier événement", () => {
    const last = new Date(now.getTime() - 3 * hour);
    expect(cursorFrom(last, now).getTime()).toBe(last.getTime() - hour);
  });

  test("un dernier événement très ancien ne fait pas relire tout l'historique", () => {
    const last = new Date(now.getTime() - 400 * day);
    const cursor = cursorFrom(last, now, { bootstrapDays: 90 });
    expect(cursor.getTime()).toBe(now.getTime() - 90 * day);
  });

  test("recouvrement configurable", () => {
    const last = new Date(now.getTime() - 10 * hour);
    expect(cursorFrom(last, now, { overlapMs: 0 }).getTime()).toBe(last.getTime());
  });
});

describe("matchesAssignment", () => {
  const moduleA = "mod-scenario";
  const moduleB = "mod-diary";
  const base: AssignmentCandidate = {
    id: "a1",
    moduleId: moduleA,
    status: "active",
    contentId: null,
  };

  test("devoir sans contenu précis : toute session du module compte", () => {
    expect(matchesAssignment({ moduleId: moduleA, contentId: "scenario-7" }, base)).toBe(true);
    expect(matchesAssignment({ moduleId: moduleA, contentId: null }, base)).toBe(true);
  });

  test("module différent : aucun rattachement", () => {
    expect(matchesAssignment({ moduleId: moduleB, contentId: null }, base)).toBe(false);
  });

  test("contenu ciblé : seule la bonne session compte", () => {
    const targeted = { ...base, contentId: "scenario-7" };
    expect(matchesAssignment({ moduleId: moduleA, contentId: "scenario-7" }, targeted)).toBe(true);
    expect(matchesAssignment({ moduleId: moduleA, contentId: "scenario-9" }, targeted)).toBe(false);
    expect(matchesAssignment({ moduleId: moduleA, contentId: null }, targeted)).toBe(false);
  });

  test("un devoir en retard reste validable", () => {
    expect(matchesAssignment({ moduleId: moduleA, contentId: null }, { ...base, status: "overdue" })).toBe(
      true
    );
  });

  test("devoir annulé ou terminé : plus de validation", () => {
    for (const status of ["cancelled", "completed"]) {
      expect(matchesAssignment({ moduleId: moduleA, contentId: null }, { ...base, status })).toBe(
        false
      );
    }
  });
});

describe("startOfMonthUtc", () => {
  test("ramène au premier jour du mois en UTC", () => {
    expect(startOfMonthUtc(now).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  test("stable en fin de mois tardive", () => {
    expect(startOfMonthUtc(new Date("2026-01-31T23:59:59.999Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });
});
