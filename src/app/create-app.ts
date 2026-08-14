import express from "express";
import cors from "cors";
import morgan from "morgan";
import type { Env } from "../config/env.js";
import { createAuthApiKeyMiddleware } from "../middleware/auth-api-key.js";
import { createPartnerAuthMiddleware } from "../middleware/auth-partner.js";
import { errorHandler } from "../middleware/error-handler.js";
import { mountRoutes } from "../routes/mount-routes.js";
import { mountPartnerRoutes } from "../routes/mount-partner-routes.js";
import { createPublicAuthRouter } from "../modules/auth/routes.js";
import { authMeRouter } from "../modules/auth/me-routes.js";
import { createPartnerPublicAuthRouter } from "../modules/partner/auth/routes.js";
import { createStripeWebhookRouter } from "../modules/partner/orders/routes.js";
import { uploadRouter } from "../modules/upload/routes.js";

export function createApp(env: Env) {
  const app = express();

  const corsOrigins = [env.ADMIN_CORS_ORIGIN, env.PARTNER_CORS_ORIGIN].filter(
    (o): o is string => typeof o === "string" && o.length > 0
  );

  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    })
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  // Corps brut requis pour vérifier la signature : monté avant `express.json`.
  app.use("/api/v1/partner/stripe/webhook", createStripeWebhookRouter(env));

  app.use(express.json({ limit: "15mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "nomi-admin-backend" });
  });

  const api = express.Router();

  api.use("/auth", createPublicAuthRouter(env));

  // Portail B2B : chemin d'auth séparé (JWT PartnerUser), monté avant le
  // routeur `secured` pour ne pas passer par l'auth admin.
  const partner = express.Router();
  partner.use("/auth", createPartnerPublicAuthRouter(env));
  const partnerSecured = express.Router();
  partnerSecured.use(createPartnerAuthMiddleware(env));
  mountPartnerRoutes(partnerSecured, env);
  partner.use(partnerSecured);
  api.use("/partner", partner);

  const secured = express.Router();
  secured.use(createAuthApiKeyMiddleware(env));
  secured.use("/auth", authMeRouter);
  secured.use("/upload", uploadRouter);
  mountRoutes(secured, env);
  api.use(secured);

  app.use("/api/v1", api);

  app.use(errorHandler);
  return app;
}
