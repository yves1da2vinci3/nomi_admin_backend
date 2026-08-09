import { describe, test, expect } from "bun:test";
import { MODULE_KEYS } from "../../b2b/usage/matching.js";
import { listContentsQuerySchema } from "./schemas.js";

const opts = { abortEarly: false, stripUnknown: true, convert: true } as const;

describe("listContentsQuerySchema", () => {
  test("moduleKey requis", () => {
    expect(listContentsQuerySchema.validate({}, opts).error).toBeDefined();
  });

  test("les 5 clés de module seedées sont acceptées, limit par défaut à 50", () => {
    for (const moduleKey of MODULE_KEYS) {
      const { error, value } = listContentsQuerySchema.validate({ moduleKey }, opts);
      expect(error).toBeUndefined();
      expect(value).toEqual({ moduleKey, limit: 50 });
    }
  });

  test("moduleKey hors enum refusé", () => {
    expect(listContentsQuerySchema.validate({ moduleKey: "podcast" }, opts).error).toBeDefined();
  });

  test("limit coercée depuis la query string et bornée", () => {
    const ok = listContentsQuerySchema.validate({ moduleKey: "scenario", limit: "25" }, opts);
    expect(ok.error).toBeUndefined();
    expect(ok.value.limit).toBe(25);
    expect(
      listContentsQuerySchema.validate({ moduleKey: "scenario", limit: 0 }, opts).error
    ).toBeDefined();
    expect(
      listContentsQuerySchema.validate({ moduleKey: "scenario", limit: 500 }, opts).error
    ).toBeDefined();
  });

  test("search rognée, trop longue refusée", () => {
    const ok = listContentsQuerySchema.validate(
      { moduleKey: "interpreter", search: "  hôtel  " },
      opts
    );
    expect(ok.error).toBeUndefined();
    expect(ok.value.search).toBe("hôtel");
    expect(
      listContentsQuerySchema.validate({ moduleKey: "interpreter", search: "x".repeat(121) }, opts)
        .error
    ).toBeDefined();
  });

  test("champ inconnu retiré", () => {
    const { error, value } = listContentsQuerySchema.validate(
      { moduleKey: "scenario", companyId: "x" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value).toEqual({ moduleKey: "scenario", limit: 50 });
  });
});
