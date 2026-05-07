import { Router } from "express";
import {
  createProjectBodySchema,
  updateProjectBodySchema,
  listProjectsQuerySchema,
} from "./schemas.js";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "./service.js";
import { publishScenarioBodySchema } from "../ai/schemas.js";
import { generatePublishFormat } from "../ai/service.js";
import {
  createScenarioRaw,
  createGoalRaw,
  createVocabRaw,
} from "../../scenarios/service.js";
import { prisma } from "../../../lib/prisma.js";

export const studioProjectsRouter = Router();

studioProjectsRouter.get("/", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const q = listProjectsQuerySchema.parse(req.query);
    const result = await listProjects(adminId, q.page, q.limit);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
});

studioProjectsRouter.get("/:id", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const project = await getProject(adminId, req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: project });
  } catch (e) {
    next(e);
  }
});

studioProjectsRouter.post("/", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const body = createProjectBodySchema.parse(req.body);
    const project = await createProject(adminId, body.title, body.state ?? {});
    res.status(201).json({ success: true, data: project });
  } catch (e) {
    next(e);
  }
});

studioProjectsRouter.patch("/:id", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const body = updateProjectBodySchema.parse(req.body);
    const project = await updateProject(adminId, req.params.id, body);
    if (!project) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: project });
  } catch (e) {
    next(e);
  }
});

studioProjectsRouter.delete("/:id", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const deleted = await deleteProject(adminId, req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});

studioProjectsRouter.post("/:id/publish-scenario", async (req, res, next) => {
  try {
    const adminId = req.adminAuth?.sub;
    if (!adminId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const project = await getProject(adminId, req.params.id);
    if (!project) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }

    const body = publishScenarioBodySchema.parse(req.body);
    const formatted = await generatePublishFormat(body);

    const scenario = await createScenarioRaw({
      title: formatted.title,
      description: formatted.description,
      pnjRole: formatted.pnjRole,
      pnjPersonality: formatted.pnjPersonality,
      pnjTone: formatted.pnjTone,
      location: formatted.location,
      theme: body.segment || "General",
      isActive: false,
    });

    await Promise.all(
      formatted.goals.map((goal, index) =>
        createGoalRaw(scenario.id, {
          title: goal.title,
          description: goal.description,
          order: index,
          expectedWords: goal.expectedWords,
          expectedPhrases: [],
          minWords: 1,
          requiredWords: goal.requiredWords,
          optionalWords: goal.optionalWords,
          successMessage: goal.successMessage,
          failureMessage: goal.failureMessage,
        })
      )
    );

    await Promise.all(
      formatted.vocabulary.map((vocab) =>
        createVocabRaw(scenario.id, {
          word: vocab.word,
          translation: vocab.translation,
          category: vocab.category,
          difficulty: 1,
        })
      )
    );

    const currentState =
      typeof project.state === "object" && project.state !== null
        ? (project.state as Record<string, unknown>)
        : {};
    await prisma.studioProject.update({
      where: { id: project.id },
      data: { state: { ...currentState, publishedScenarioId: scenario.id } },
    });

    res.json({ success: true, data: { scenarioId: scenario.id } });
  } catch (e) {
    next(e);
  }
});
