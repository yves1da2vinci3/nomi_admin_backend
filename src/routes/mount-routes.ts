import type { Router } from "express";
import { dashboardRouter } from "../modules/dashboard/routes.js";
import { usersRouter } from "../modules/users/routes.js";
import { scenariosRouter } from "../modules/scenarios/routes.js";
import { generatedGamesRouter } from "../modules/generated-games/routes.js";
import { storyPlaysRouter } from "../modules/story-plays/routes.js";
import { notificationsRouter } from "../modules/notifications/routes.js";
import { subscriptionsRouter } from "../modules/subscriptions/routes.js";

export function mountRoutes(app: Router) {
  app.use("/dashboard", dashboardRouter);
  app.use("/users", usersRouter);
  app.use("/scenarios", scenariosRouter);
  app.use("/generated-games", generatedGamesRouter);
  app.use("/story-plays", storyPlaysRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/subscriptions", subscriptionsRouter);
}
