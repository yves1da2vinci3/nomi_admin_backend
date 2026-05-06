import express from "express";
import cors from "cors";
import morgan from "morgan";
import type { Env } from "../config/env.js";
import { createAuthApiKeyMiddleware } from "../middleware/auth-api-key.js";
import { errorHandler } from "../middleware/error-handler.js";
import { mountRoutes } from "../routes/mount-routes.js";
import { createPublicAuthRouter } from "../modules/auth/routes.js";
import { authMeRouter } from "../modules/auth/me-routes.js";

export function createApp(env: Env) {
  const app = express();

  app.use(
    cors({
      origin: env.ADMIN_CORS_ORIGIN ?? true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "15mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "nomi-admin-backend" });
  });

  const api = express.Router();

  api.use("/auth", createPublicAuthRouter(env));

  const secured = express.Router();
  secured.use(createAuthApiKeyMiddleware(env));
  secured.use("/auth", authMeRouter);
  mountRoutes(secured);
  api.use(secured);

  app.use("/api/v1", api);

  app.use(errorHandler);
  return app;
}
