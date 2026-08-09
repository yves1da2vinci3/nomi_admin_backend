import { describe, test, expect } from "bun:test";
import {
  adjustCreditsBodySchema,
  createCohortBodySchema,
  createCompanyBodySchema,
  createPartnerUserBodySchema,
  listCompaniesQuerySchema,
  updateCohortBodySchema,
  updateCompanyBodySchema,
} from "./schemas.js";

const opts = { abortEarly: false, stripUnknown: true, convert: true } as const;

describe("listCompaniesQuerySchema", () => {
  test("valeurs par défaut de pagination", () => {
    const { error, value } = listCompaniesQuerySchema.validate({}, opts);
    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBeGreaterThan(0);
  });

  test("coercition des query strings", () => {
    const { error, value } = listCompaniesQuerySchema.validate(
      { page: "3", limit: "10", isActive: "false", plan: "center" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ page: 3, limit: 10, isActive: false, plan: "center" });
  });

  test("plan hors enum → erreur", () => {
    const { error } = listCompaniesQuerySchema.validate({ plan: "gold" }, opts);
    expect(error).toBeDefined();
  });
});

describe("createCompanyBodySchema", () => {
  test("minimum requis + défauts", () => {
    const { error, value } = createCompanyBodySchema.validate(
      { name: "Binne Training", slug: "binne-training" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      orgType: "training_center",
      plan: "pilot",
      seatLimit: 0,
      timezone: "UTC",
      weeklyDigest: true,
      isActive: true,
    });
  });

  test("slug invalide → erreur", () => {
    const { error } = createCompanyBodySchema.validate(
      { name: "Binne", slug: "Binne Training!" },
      opts
    );
    expect(error).toBeDefined();
  });

  test("renewalDate ISO convertie en Date", () => {
    const { error, value } = createCompanyBodySchema.validate(
      { name: "Binne", slug: "binne", renewalDate: "2027-01-31T00:00:00.000Z" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.renewalDate).toBeInstanceOf(Date);
  });

  test("nom manquant → erreur", () => {
    const { error } = createCompanyBodySchema.validate({ slug: "binne" }, opts);
    expect(error).toBeDefined();
  });
});

describe("updateCompanyBodySchema", () => {
  test("patch partiel accepté sans défauts injectés", () => {
    const { error, value } = updateCompanyBodySchema.validate({ seatLimit: 80 }, opts);
    expect(error).toBeUndefined();
    expect(value).toEqual({ seatLimit: 80 });
  });

  test("patch vide refusé", () => {
    const { error } = updateCompanyBodySchema.validate({}, opts);
    expect(error).toBeDefined();
  });

  test("apiUsedMonth ajustable", () => {
    const { error, value } = updateCompanyBodySchema.validate({ apiUsedMonth: 120 }, opts);
    expect(error).toBeUndefined();
    expect(value.apiUsedMonth).toBe(120);
  });
});

describe("createCohortBodySchema", () => {
  test("endDate antérieure à startDate → erreur", () => {
    const { error } = createCohortBodySchema.validate(
      { name: "Promo A", startDate: "2026-09-01", endDate: "2026-08-01" },
      opts
    );
    expect(error).toBeDefined();
  });

  test("plage valide + instructorIds par défaut", () => {
    const { error, value } = createCohortBodySchema.validate(
      { name: "Promo A", startDate: "2026-09-01", endDate: "2026-12-01" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.instructorIds).toEqual([]);
    expect(value.startDate).toBeInstanceOf(Date);
  });

  test("instructorIds doit contenir des uuid uniques", () => {
    const id = "3f1b9a2c-5d6e-4f70-8a91-0b1c2d3e4f50";
    const dup = createCohortBodySchema.validate(
      { name: "P", startDate: "2026-09-01", endDate: "2026-12-01", instructorIds: [id, id] },
      opts
    );
    expect(dup.error).toBeDefined();
  });
});

describe("updateCohortBodySchema", () => {
  test("statut hors enum → erreur", () => {
    const { error } = updateCohortBodySchema.validate({ status: "paused" }, opts);
    expect(error).toBeDefined();
  });

  test("archivage accepté", () => {
    const { error, value } = updateCohortBodySchema.validate({ status: "archived" }, opts);
    expect(error).toBeUndefined();
    expect(value.status).toBe("archived");
  });
});

describe("createPartnerUserBodySchema", () => {
  test("email normalisé, rôle par défaut viewer", () => {
    const { error, value } = createPartnerUserBodySchema.validate(
      { email: "  Marie@Binne.CI " },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.email).toBe("marie@binne.ci");
    expect(value.portalRole).toBe("viewer");
  });

  test("mot de passe trop court → erreur", () => {
    const { error } = createPartnerUserBodySchema.validate(
      { email: "a@b.ci", password: "court" },
      opts
    );
    expect(error).toBeDefined();
  });
});

describe("adjustCreditsBodySchema", () => {
  test("delta nul refusé", () => {
    const { error } = adjustCreditsBodySchema.validate(
      { moduleId: "3f1b9a2c-5d6e-4f70-8a91-0b1c2d3e4f50", delta: 0 },
      opts
    );
    expect(error).toBeDefined();
  });

  test("delta négatif accepté (reprise de crédits)", () => {
    const { error, value } = adjustCreditsBodySchema.validate(
      { moduleId: "3f1b9a2c-5d6e-4f70-8a91-0b1c2d3e4f50", delta: -25 },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.delta).toBe(-25);
  });
});
