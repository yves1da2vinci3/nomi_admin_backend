import Stripe from "stripe";
import type { Env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import { grantPackToCompany } from "../../b2b/quota-service.js";

/**
 * Paiement des packs. Contrairement au prototype (`checkout.server.ts` appelé
 * depuis le navigateur, sans signature), la session Stripe est créée ici et
 * l'entitlement n'est accordé que sur un événement Stripe vérifié — ou sur
 * relecture de la session côté serveur.
 */

let client: Stripe | null = null;

function stripeClient(env: Env): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

/** XOF est une devise sans décimale : le montant Stripe est le montant FCFA. */
function stripeAmountFor(currency: "XOF" | "USD", amountFcfa: number, priceUsdCents: number) {
  return currency === "XOF" ? amountFcfa : priceUsdCents;
}

export type CheckoutResult = {
  order: Awaited<ReturnType<typeof mapOrder>>;
  checkoutUrl: string | null;
  simulated: boolean;
};

async function mapOrder(orderId: string) {
  const row = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { pack: { select: { id: true, slug: true, name: true } } },
  });
  return {
    id: row.id,
    pack: row.pack,
    amountFcfa: row.amountFcfa,
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripeSessionId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createCheckout(
  env: Env,
  companyId: string,
  packId: string
): Promise<CheckoutResult> {
  const pack = await prisma.modulePack.findFirst({ where: { id: packId, isActive: true } });
  if (!pack) throw httpError(404, "Pack introuvable");

  const alreadyOwned = await prisma.companyEntitlement.findFirst({
    where: {
      companyId,
      packId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (alreadyOwned && pack.badge === "included_in_plan") {
    throw httpError(409, "Ce pack est déjà inclus dans votre plan.");
  }

  const order = await prisma.purchaseOrder.create({
    data: {
      companyId,
      packId,
      amountFcfa: pack.priceFcfa,
      currency: "XOF",
      status: "pending",
    },
  });

  const stripe = stripeClient(env);
  // Pack gratuit ou Stripe non configuré : la confirmation reste explicite.
  if (!stripe || pack.priceFcfa === 0) {
    return { order: await mapOrder(order.id), checkoutUrl: null, simulated: true };
  }

  const portal = env.B2B_PORTAL_URL.replace(/\/+$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "xof",
          unit_amount: stripeAmountFor("XOF", pack.priceFcfa, pack.priceUsdCents),
          product_data: { name: pack.name, ...(pack.tagline ? { description: pack.tagline } : {}) },
        },
      },
    ],
    client_reference_id: order.id,
    metadata: { orderId: order.id, companyId, packId },
    success_url: `${portal}/catalog/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${portal}/catalog?checkout=cancelled`,
  });

  await prisma.purchaseOrder.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  });

  return { order: await mapOrder(order.id), checkoutUrl: session.url, simulated: false };
}

async function markPaidAndGrant(orderId: string) {
  const order = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
  if (!order) throw httpError(404, "Commande introuvable");
  if (order.status === "paid") {
    // Idempotent : un webhook rejoué ne recrédite pas les sessions.
    return { order: await mapOrder(orderId), entitlementId: null };
  }

  const entitlementId = await grantPackToCompany({
    companyId: order.companyId,
    packId: order.packId,
  });
  await prisma.purchaseOrder.update({ where: { id: orderId }, data: { status: "paid" } });
  return { order: await mapOrder(orderId), entitlementId };
}

/**
 * Confirmation demandée par le portail au retour de Stripe. L'état de paiement
 * est relu chez Stripe : le client ne peut pas déclarer un paiement réussi.
 */
export async function confirmOrder(env: Env, companyId: string, orderId: string) {
  const order = await prisma.purchaseOrder.findFirst({ where: { id: orderId, companyId } });
  if (!order) throw httpError(404, "Commande introuvable");
  if (order.status === "paid") {
    return { order: await mapOrder(orderId), entitlementId: null };
  }

  const stripe = stripeClient(env);
  if (stripe && order.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.payment_status !== "paid") {
      throw httpError(402, "Paiement non confirmé par Stripe.");
    }
    return markPaidAndGrant(orderId);
  }

  if (stripe && order.amountFcfa > 0) {
    throw httpError(402, "Aucune session Stripe associée à cette commande.");
  }

  // Sans Stripe configuré (dev) ou pack gratuit : activation directe.
  return markPaidAndGrant(orderId);
}

export type WebhookOutcome = { handled: boolean; type: string };

/** Vérifie la signature Stripe puis applique l'événement. */
export async function handleStripeWebhook(
  env: Env,
  rawBody: Buffer | string,
  signature: string | undefined
): Promise<WebhookOutcome> {
  const stripe = stripeClient(env);
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    throw httpError(503, "Stripe non configuré");
  }
  if (!signature) throw httpError(400, "Signature Stripe manquante");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw httpError(400, "Signature Stripe invalide");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId && session.payment_status === "paid") {
      await markPaidAndGrant(orderId);
      return { handled: true, type: event.type };
    }
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId) {
      await prisma.purchaseOrder.updateMany({
        where: { id: orderId, status: "pending" },
        data: { status: "failed" },
      });
      return { handled: true, type: event.type };
    }
  }

  return { handled: false, type: event.type };
}
