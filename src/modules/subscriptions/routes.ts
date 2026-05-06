import { Router } from "express";

/** Pas de table billing — payload démo aligné admin SPA SubscriptionsOverviewDemo. */
export const subscriptionsRouter = Router();

subscriptionsRouter.get("/overview", (_req, res) => {
  res.json({
    success: true,
    data: {
      demo: true,
      plans: [
        {
          planId: "plan_free",
          name: "FREE",
          activeSubscribers: 0,
          trialSubscribers: 0,
          mrrEstimate: 0,
        },
        {
          planId: "plan_plus",
          name: "PLUS",
          activeSubscribers: 0,
          trialSubscribers: 0,
          mrrEstimate: 0,
        },
      ],
      global: {
        totalActive: 0,
        totalTrial: 0,
        monthlyRevenueEstimate: 0,
      },
      note: "Remplace par intégration Stripe/facturation quand disponible.",
    },
  });
});
