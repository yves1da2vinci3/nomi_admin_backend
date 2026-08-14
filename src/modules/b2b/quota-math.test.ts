import { describe, test, expect } from "bun:test";
import {
  computeSeatsUsage,
  defaultExpiryFor,
  exceedsSeats,
  laterOf,
  planCreditDebit,
  remainingCapacity,
  splitByCapacity,
  type CreditRow,
} from "./quota-math.js";

describe("computeSeatsUsage", () => {
  test("usage partiel", () => {
    expect(computeSeatsUsage(50, 32)).toEqual({
      seatLimit: 50,
      seatsUsed: 32,
      seatsAvailable: 18,
      usagePct: 64,
    });
  });

  test("dépassement : seatsAvailable jamais négatif", () => {
    expect(computeSeatsUsage(10, 14)).toMatchObject({ seatsAvailable: 0, usagePct: 140 });
  });

  test("limite à 0 = illimité, pas de division par zéro", () => {
    expect(computeSeatsUsage(0, 7)).toEqual({
      seatLimit: 0,
      seatsUsed: 7,
      seatsAvailable: 0,
      usagePct: 0,
    });
  });
});

describe("exceedsSeats", () => {
  test("refuse l'ajout au-delà du plafond", () => {
    expect(exceedsSeats(computeSeatsUsage(10, 9), 2)).toBe(true);
  });

  test("accepte l'ajout qui atteint exactement le plafond", () => {
    expect(exceedsSeats(computeSeatsUsage(10, 9), 1)).toBe(false);
  });

  test("plafond illimité", () => {
    expect(exceedsSeats(computeSeatsUsage(0, 999), 500)).toBe(false);
  });
});

describe("remainingCapacity", () => {
  test("places restantes d'une cohorte", () => {
    expect(remainingCapacity(20, 12)).toBe(8);
  });

  test("cohorte pleine ou dépassée : zéro, jamais négatif", () => {
    expect(remainingCapacity(20, 20)).toBe(0);
    expect(remainingCapacity(20, 25)).toBe(0);
  });

  test("plafond à 0 = illimité", () => {
    expect(remainingCapacity(0, 42)).toBeNull();
  });
});

describe("splitByCapacity", () => {
  const entrants = ["a", "b", "c", "d"];

  test("capacité illimitée : tout le monde entre", () => {
    expect(splitByCapacity(entrants, null)).toEqual({ accepted: entrants, rejected: [] });
  });

  test("import partiel : le surplus est rejeté dans l'ordre", () => {
    expect(splitByCapacity(entrants, 2)).toEqual({
      accepted: ["a", "b"],
      rejected: ["c", "d"],
    });
  });

  test("capacité nulle : tout est rejeté", () => {
    expect(splitByCapacity(entrants, 0)).toEqual({ accepted: [], rejected: entrants });
  });
});

describe("planCreditDebit", () => {
  const soon = new Date("2026-09-01T00:00:00.000Z");
  const later = new Date("2026-12-01T00:00:00.000Z");

  test("solde insuffisant : aucun débit", () => {
    const rows: CreditRow[] = [{ id: "a", creditsRemaining: 2, expiresAt: null }];
    const plan = planCreditDebit(rows, 5);
    expect(plan.ok).toBe(false);
    expect(plan.total).toBe(2);
  });

  test("vide d'abord l'entitlement qui expire le plus tôt", () => {
    const rows: CreditRow[] = [
      { id: "perpetuel", creditsRemaining: 100, expiresAt: null },
      { id: "tardif", creditsRemaining: 5, expiresAt: later },
      { id: "proche", creditsRemaining: 3, expiresAt: soon },
    ];
    const plan = planCreditDebit(rows, 6);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.debits).toEqual([
      { id: "proche", take: 3 },
      { id: "tardif", take: 3 },
    ]);
    expect(plan.total).toBe(108);
  });

  test("débit exact sur une seule ligne", () => {
    const rows: CreditRow[] = [{ id: "a", creditsRemaining: 4, expiresAt: soon }];
    const plan = planCreditDebit(rows, 4);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.debits).toEqual([{ id: "a", take: 4 }]);
  });

  test("les lignes vides sont ignorées", () => {
    const rows: CreditRow[] = [
      { id: "vide", creditsRemaining: 0, expiresAt: soon },
      { id: "plein", creditsRemaining: 2, expiresAt: later },
    ];
    const plan = planCreditDebit(rows, 2);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.debits).toEqual([{ id: "plein", take: 2 }]);
  });

  test("n'altère pas le tableau reçu", () => {
    const rows: CreditRow[] = [
      { id: "b", creditsRemaining: 1, expiresAt: later },
      { id: "a", creditsRemaining: 1, expiresAt: soon },
    ];
    planCreditDebit(rows, 1);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("defaultExpiryFor", () => {
  const from = new Date("2026-01-15T00:00:00.000Z");

  test("mensuel : +1 mois", () => {
    expect(defaultExpiryFor("monthly", from).toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  test("trimestriel : +3 mois", () => {
    expect(defaultExpiryFor("quarterly", from).toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  test("achat unique : +12 mois", () => {
    expect(defaultExpiryFor("one_time", from).toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});

describe("laterOf", () => {
  const a = new Date("2026-03-01T00:00:00.000Z");
  const b = new Date("2026-06-01T00:00:00.000Z");

  test("garde la date la plus lointaine", () => {
    expect(laterOf(a, b)).toBe(b);
    expect(laterOf(b, a)).toBe(b);
  });

  test("null = sans expiration, donc gagne toujours", () => {
    expect(laterOf(null, b)).toBeNull();
    expect(laterOf(a, null)).toBeNull();
  });
});
