import type { Router } from "express";
import type { Env } from "../config/env.js";
import { dashboardRouter } from "../modules/dashboard/routes.js";
import { usersRouter } from "../modules/users/routes.js";
import { scenariosRouter } from "../modules/scenarios/routes.js";
import { generatedGamesRouter } from "../modules/generated-games/routes.js";
import { storyPlaysRouter } from "../modules/story-plays/routes.js";
import { notificationsRouter } from "../modules/notifications/routes.js";
import { subscriptionsRouter } from "../modules/subscriptions/routes.js";
import { studioProjectsRouter } from "../modules/studio/projects/routes.js";
import { createStudioAiRouter } from "../modules/studio/ai/routes.js";
import { interpreterRouter } from "../modules/interpreter/routes.js";
import { settingsRouter } from "../modules/settings/routes.js";

export function mountRoutes(app: Router, env: Env) {
  app.use("/dashboard", dashboardRouter);
  app.use("/users", usersRouter);
  app.use("/scenarios", scenariosRouter);
  app.use("/generated-games", generatedGamesRouter);
  app.use("/story-plays", storyPlaysRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/subscriptions", subscriptionsRouter);
  app.use("/studio/projects", studioProjectsRouter);
  app.use("/studio/ai", createStudioAiRouter(env));
  app.use("/interpreter-scenarios", interpreterRouter);
  app.use("/settings", settingsRouter);
}
