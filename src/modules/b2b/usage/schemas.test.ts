import { describe, test, expect } from "bun:test";
import { ingestUsageBodySchema } from "./schemas.js";

const opts = { abortEarly: false, stripUnknown: true, convert: true } as const;

describe("ingestUsageBodySchema", () => {
  test("corps vide accepté : balayage depuis le curseur", () => {
    const { error, value } = ingestUsageBodySchema.validate({}, opts);
    expect(error).toBeUndefined();
    expect(value).toEqual({});
  });

  test("since ISO converti en Date", () => {
    const { error, value } = ingestUsageBodySchema.validate(
      { since: "2026-07-01T00:00:00.000Z" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.since).toBeInstanceOf(Date);
  });

  test("since dans le futur refusé", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(ingestUsageBodySchema.validate({ since: future }, opts).error).toBeDefined();
  });

  test("limit coercée et bornée", () => {
    const ok = ingestUsageBodySchema.validate({ limit: "500" }, opts);
    expect(ok.error).toBeUndefined();
    expect(ok.value.limit).toBe(500);
    expect(ingestUsageBodySchema.validate({ limit: 0 }, opts).error).toBeDefined();
    expect(ingestUsageBodySchema.validate({ limit: 999999 }, opts).error).toBeDefined();
  });

  test("champ inconnu retiré", () => {
    const { error, value } = ingestUsageBodySchema.validate({ companyId: "x" }, opts);
    expect(error).toBeUndefined();
    expect(value).toEqual({});
  });
});
