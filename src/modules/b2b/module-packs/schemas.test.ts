import { describe, test, expect } from "bun:test";
import { createPackBodySchema, listPacksQuerySchema, updatePackBodySchema } from "./schemas.js";

const opts = { abortEarly: false, stripUnknown: true, convert: true } as const;
const moduleA = "3f1b9a2c-5d6e-4f70-8a91-0b1c2d3e4f50";
const moduleB = "8c0f7f4e-1e5a-4a1e-9c11-2f1f0a11b222";

const validPack = {
  slug: "pack-diary",
  name: "Pack Journal",
  priceFcfa: 15000,
  items: [{ moduleId: moduleA, sessionCredits: 300 }],
};

describe("listPacksQuerySchema", () => {
  test("coercition isActive + défauts", () => {
    const { error, value } = listPacksQuerySchema.validate({ isActive: "true" }, opts);
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ isActive: true, page: 1 });
  });

  test("tier hors enum → erreur", () => {
    expect(listPacksQuerySchema.validate({ tier: "premium" }, opts).error).toBeDefined();
  });
});

describe("createPackBodySchema", () => {
  test("pack minimal + défauts", () => {
    const { error, value } = createPackBodySchema.validate(validPack, opts);
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      tier: "addon",
      billingPeriod: "monthly",
      priceUsdCents: 0,
      features: [],
      isActive: true,
    });
  });

  test("pack sans ligne de module → erreur", () => {
    const { error } = createPackBodySchema.validate({ ...validPack, items: [] }, opts);
    expect(error).toBeDefined();
  });

  test("même module deux fois → erreur", () => {
    const { error } = createPackBodySchema.validate(
      {
        ...validPack,
        items: [
          { moduleId: moduleA, sessionCredits: 100 },
          { moduleId: moduleA, sessionCredits: 200 },
        ],
      },
      opts
    );
    expect(error).toBeDefined();
  });

  test("plusieurs modules distincts acceptés", () => {
    const { error, value } = createPackBodySchema.validate(
      {
        ...validPack,
        items: [
          { moduleId: moduleA, sessionCredits: 100 },
          { moduleId: moduleB, sessionCredits: 200 },
        ],
      },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.items).toHaveLength(2);
  });

  test("prix négatif → erreur", () => {
    expect(createPackBodySchema.validate({ ...validPack, priceFcfa: -1 }, opts).error).toBeDefined();
  });

  test("badge hors enum → erreur, badge connu accepté", () => {
    expect(createPackBodySchema.validate({ ...validPack, badge: "hot" }, opts).error).toBeDefined();
    const ok = createPackBodySchema.validate({ ...validPack, badge: "popular" }, opts);
    expect(ok.error).toBeUndefined();
  });
});

describe("updatePackBodySchema", () => {
  test("patch d'un seul champ : aucun défaut réinjecté", () => {
    const { error, value } = updatePackBodySchema.validate({ priceFcfa: 20000 }, opts);
    expect(error).toBeUndefined();
    expect(value).toEqual({ priceFcfa: 20000 });
  });

  test("items optionnel au patch mais toujours non vide s'il est fourni", () => {
    expect(updatePackBodySchema.validate({ items: [] }, opts).error).toBeDefined();
    const ok = updatePackBodySchema.validate({ items: validPack.items }, opts);
    expect(ok.error).toBeUndefined();
  });

  test("patch vide refusé", () => {
    expect(updatePackBodySchema.validate({}, opts).error).toBeDefined();
  });
});
