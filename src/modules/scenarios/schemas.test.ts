import { describe, test, expect } from "bun:test";
import { updateGoalBodySchema, updateVocabBodySchema } from "./schemas.js";

describe("updateGoalBodySchema", () => {
  test("accepts partial valid goal", () => {
    const result = updateGoalBodySchema.safeParse({
      title: { fr: "Objectif test", en: "Test objective" },
      order: 1,
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty object (all fields optional)", () => {
    const result = updateGoalBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects wrong types", () => {
    const result = updateGoalBodySchema.safeParse({ order: "not-a-number" });
    expect(result.success).toBe(false);
  });
});

describe("updateVocabBodySchema", () => {
  test("accepts partial valid vocab", () => {
    const result = updateVocabBodySchema.safeParse({
      word: "bonjour",
      category: "greetings",
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty object (all fields optional)", () => {
    const result = updateVocabBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects wrong type for difficulty", () => {
    const result = updateVocabBodySchema.safeParse({ difficulty: "easy" });
    expect(result.success).toBe(false);
  });
});
