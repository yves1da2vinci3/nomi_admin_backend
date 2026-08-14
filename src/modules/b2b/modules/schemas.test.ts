import { describe, test, expect } from "bun:test";
import {
  createModuleBodySchema,
  listModulesQuerySchema,
  updateModuleBodySchema,
} from "./schemas.js";

const opts = { abortEarly: false, stripUnknown: true, convert: true } as const;

describe("listModulesQuerySchema", () => {
  test("limite plafonnée à 100", () => {
    expect(listModulesQuerySchema.validate({ limit: "500" }, opts).error).toBeDefined();
  });

  test("recherche et isActive", () => {
    const { error, value } = listModulesQuerySchema.validate(
      { search: "  diary ", isActive: "false" },
      opts
    );
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ search: "diary", isActive: false });
  });
});

describe("createModuleBodySchema", () => {
  test("clé normalisée en minuscules + défauts", () => {
    const { error, value } = createModuleBodySchema.validate(
      { key: "Listening_Story", name: { fr: "Histoire à écouter", en: "Listening story" } },
      opts
    );
    expect(error).toBeUndefined();
    expect(value.key).toBe("listening_story");
    expect(value).toMatchObject({ isActive: true, sortOrder: 0 });
  });

  test("clé avec espaces → erreur", () => {
    const { error } = createModuleBodySchema.validate(
      { key: "listening story", name: { fr: "x" } },
      opts
    );
    expect(error).toBeDefined();
  });

  test("nom i18n vide → erreur", () => {
    expect(createModuleBodySchema.validate({ key: "diary", name: {} }, opts).error).toBeDefined();
  });

  test("nom absent → erreur", () => {
    expect(createModuleBodySchema.validate({ key: "diary" }, opts).error).toBeDefined();
  });
});

describe("updateModuleBodySchema", () => {
  test("patch partiel sans défauts réinjectés", () => {
    const { error, value } = updateModuleBodySchema.validate({ sortOrder: 3 }, opts);
    expect(error).toBeUndefined();
    expect(value).toEqual({ sortOrder: 3 });
  });

  test("patch vide refusé", () => {
    expect(updateModuleBodySchema.validate({}, opts).error).toBeDefined();
  });
});
