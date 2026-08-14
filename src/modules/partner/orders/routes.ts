import express, { Router } from "express";
import Joi from "joi";
import type { Env } from "../../../config/env.js";
import { validate } from "../../../middleware/validate.js";
import { requireCompanyId, requirePortalRole } from "../../../middleware/auth-partner.js";
import { routeParam } from "../../b2b/shared/params.js";
import { listOrders } from "../catalog/service.js";
import { confirmOrder, createCheckout, handleStripeWebhook } from "./service.js";

type CheckoutBody = { packId: string };

const checkoutBodySchema = Joi.object<CheckoutBody>({
  packId: Joi.string().uuid().required(),
});

/** Historique et achat de packs — l'achat est réservé aux `org_admin`. */
export function createPartnerOrdersRouter(env: Env): Router {
  const r = Router();

  r.get("/", async (req, res, next) => {
    try {
      const orders = await listOrders(requireCompanyId(req));
      res.json({ success: true, data: { orders } });
    } catch (e) {
      next(e);
    }
  });

  r.post(
    "/checkout",
    requirePortalRole("org_admin"),
    validate(checkoutBodySchema),
    async (req, res, next) => {
      try {
        const { packId } = req.body as CheckoutBody;
        const result = await createCheckout(env, requireCompanyId(req), packId);
        res.status(201).json({ success: true, data: result });
      } catch (e) {
        next(e);
      }
    }
  );

  r.post("/:orderId/confirm", requirePortalRole("org_admin"), async (req, res, next) => {
    try {
      const result = await confirmOrder(env, requireCompanyId(req), routeParam(req, "orderId"));
      res.json({ success: true, data: result });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

/**
 * Webhook Stripe — public, non authentifié, corps brut obligatoire pour la
 * vérification de signature (donc monté avant `express.json`).
 */
export function createStripeWebhookRouter(env: Env): Router {
  const r = Router();

  r.post(
    "/",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res, next) => {
      try {
        const signature = req.header("stripe-signature");
        const result = await handleStripeWebhook(env, req.body as Buffer, signature);
        res.json({ received: true, ...result });
      } catch (e) {
        next(e);
      }
    }
  );

  return r;
}
