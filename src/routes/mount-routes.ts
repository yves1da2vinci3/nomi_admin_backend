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
import { sessionsRouter } from "../modules/sessions/routes.js";
import {
  interpreterSessionsRouter,
  interpreterPracticeRunsRouter,
} from "../modules/interpreter-sessions/routes.js";
import { diaryRouter } from "../modules/diary/routes.js";
import { learnedWordsRouter } from "../modules/learned-words/routes.js";
import { opsRouter } from "../modules/ops/routes.js";
import { b2bModulesRouter } from "../modules/b2b/modules/routes.js";
import { modulePacksRouter } from "../modules/b2b/module-packs/routes.js";
import { companiesRouter } from "../modules/b2b/companies/routes.js";
import { b2bUsageRouter } from "../modules/b2b/usage/routes.js";

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
  app.use("/sessions", sessionsRouter);
  app.use("/interpreter-sessions", interpreterSessionsRouter);
  app.use("/interpreter-practice-runs", interpreterPracticeRunsRouter);
  app.use("/diary", diaryRouter);
  app.use("/learned-words", learnedWordsRouter);
  app.use("/ops", opsRouter);
  app.use("/modules", b2bModulesRouter);
  app.use("/module-packs", modulePacksRouter);
  app.use("/companies", companiesRouter);
  app.use("/b2b-usage", b2bUsageRouter);
}
