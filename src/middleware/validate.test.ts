import { describe, test, expect, mock } from "bun:test";
import Joi from "joi";
import { validate } from "./validate.js";
import type { Request, Response } from "express";

function makeReqRes(init: { body?: unknown; query?: unknown; params?: unknown }) {
  const req = { ...init } as unknown as Request;

  const resMock = { statusCode: 200, body: null as unknown };
  const res = {
    status(code: number) {
      resMock.statusCode = code;
      return this;
    },
    json(body: unknown) {
      resMock.body = body;
      return this;
    },
  } as unknown as Response;

  const next = mock(() => {});

  return { req, res, resMock, next };
}

describe("validate", () => {
  const bodySchema = Joi.object<{ name: string; seatLimit: number }>({
    name: Joi.string().min(2).required(),
    seatLimit: Joi.number().integer().min(1).required(),
  });

  test("corps valide → next, champs inconnus retirés", () => {
    const { req, res, next } = makeReqRes({
      body: { name: "Binne Training", seatLimit: 50, isAdmin: true },
    });
    validate(bodySchema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: "Binne Training", seatLimit: 50 });
  });

  test("corps invalide → 400 avec le détail des champs, next non appelé", () => {
    const { req, res, resMock, next } = makeReqRes({ body: { name: "B" } });
    validate(bodySchema)(req, res, next);
    expect(resMock.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
    const body = resMock.body as { error: string; details: Array<{ path: string }> };
    expect(body.error).toBe("Validation error");
    expect(body.details.map((d) => d.path).sort()).toEqual(["name", "seatLimit"]);
  });

  test("query : coercition des strings et valeurs par défaut", () => {
    const querySchema = Joi.object<{ page: number; limit: number; active: boolean }>({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      active: Joi.boolean(),
    });
    const { req, res, next } = makeReqRes({ query: { limit: "50", active: "true" } });
    validate(querySchema, "query")(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.query as unknown).toEqual({ page: 1, limit: 50, active: true });
  });

  test("params : uuid invalide → 400", () => {
    const paramsSchema = Joi.object<{ id: string }>({ id: Joi.string().uuid().required() });
    const { req, res, resMock, next } = makeReqRes({ params: { id: "not-a-uuid" } });
    validate(paramsSchema, "params")(req, res, next);
    expect(resMock.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("PATCH vide refusé par .min(1)", () => {
    const patchSchema = Joi.object({ name: Joi.string() }).min(1);
    const { req, res, resMock, next } = makeReqRes({ body: {} });
    validate(patchSchema)(req, res, next);
    expect(resMock.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });
});
