import { Router } from "express";
import type { Env } from "../../../config/env.js";
import { getAnthropicClient } from "../../../lib/anthropic.js";
import {
  brainstormBodySchema,
  designBodySchema,
  reviewBodySchema,
  chatBodySchema,
  scenarioChatBodySchema,
  scenarioComplianceBodySchema,
} from "./schemas.js";
import {
  configureStudioAiEnv,
  generateBrainstormIdeas,
  generateDesign,
  generateReview,
  generateChatReply,
  generateScenarioFieldChat,
  generateScenarioCompliance,
} from "./service.js";

export function createStudioAiRouter(env: Env): Router {
  const studioAiRouter = Router();

  studioAiRouter.use((_req, res, next) => {
    configureStudioAiEnv(env);
    if (!getAnthropicClient(env)) {
      res.status(503).json({
        success: false,
        error: "AI unavailable: set ANTHROPIC_API_KEY (min. 10 characters) to use Studio AI endpoints.",
      });
      return;
    }
    next();
  });

  studioAiRouter.post("/brainstorm", async (req, res, next) => {
    try {
      const body = brainstormBodySchema.parse(req.body);
      const data = await generateBrainstormIdeas(body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  studioAiRouter.post("/design", async (req, res, next) => {
    try {
      const body = designBodySchema.parse(req.body);
      const data = await generateDesign(body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  studioAiRouter.post("/review", async (req, res, next) => {
    try {
      const body = reviewBodySchema.parse(req.body);
      const data = await generateReview(body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  studioAiRouter.post("/chat", async (req, res, next) => {
    try {
      const body = chatBodySchema.parse(req.body);
      const data = await generateChatReply(body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  studioAiRouter.post("/scenario-compliance", async (req, res, next) => {
    try {
      const body = scenarioComplianceBodySchema.parse(req.body);
      const data = await generateScenarioCompliance(body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  studioAiRouter.post("/scenario-chat", async (req, res, next) => {
    try {
      const body = scenarioChatBodySchema.parse(req.body);
      const data = await generateScenarioFieldChat(body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  });

  return studioAiRouter;
}
