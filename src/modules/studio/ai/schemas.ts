import { z } from "zod";
import { studioProjectSnapshotSchema } from "./snapshot-schema.js";

const langRecordSchema = z.object({ fr: z.string(), en: z.string() });

const chatMessageSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
});

export const studioChatContextSchema = z
  .object({
    studioPhase: z.enum(["brainstorming", "design", "review", "production"]).optional(),
    activeIdeaId: z.string().nullable().optional(),
    activeIdeaSummary: z
      .object({
        fr: z.string(),
        en: z.string(),
        es: z.string().optional(),
      })
      .optional(),
    ideasOverview: z
      .object({
        idea: z.number().int().nonnegative(),
        toValidate: z.number().int().nonnegative(),
        approved: z.number().int().nonnegative(),
      })
      .optional(),
    designSummary: z
      .object({
        objectives: z.number().int().nonnegative(),
        keywords: z.number().int().nonnegative(),
        dialogueNodes: z.number().int().nonnegative(),
      })
      .optional(),
    reviewSummary: z
      .object({
        targetCEFR: z.string(),
        qaPassed: z.number().int().nonnegative(),
        qaTotal: z.number().int().nonnegative(),
      })
      .optional(),
    productionSummary: z
      .object({
        publishedScenarioId: z.string().nullable(),
        productionReady: z.boolean(),
        serverId: z.string().nullable(),
      })
      .optional(),
    studioProjectSnapshot: studioProjectSnapshotSchema.optional(),
  })
  .optional();

/** Contexte Studio : snapshot peut diverger légèrement du schéma Zod strict ; on accepte tout objet pour ne pas bloquer les routes IA. */
const looseStudioContextSchema = z.any().optional();

export const brainstormBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default("General"),
  theme: z.string().optional().default("General"),
  prompt: z.string().optional().default(""),
  count: z.coerce.number().int().min(1).max(8).default(5),
  context: looseStudioContextSchema,
});

export const designBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default(""),
  prompt: z.string().optional().default(""),
  scope: z
    .enum(["Goals + Keywords", "Goals + Keywords + Node", "Just a Node"])
    .default("Goals + Keywords + Node"),
  context: looseStudioContextSchema,
});

export const reviewBodySchema = z.object({
  projectName: z.string().min(1),
  targetCEFR: z.string().optional().default("B2"),
  focus: z.string().optional().default("All of the above"),
  prompt: z.string().optional().default(""),
  dialogueSnippet: z.string().optional().default(""),
  context: looseStudioContextSchema,
});

export const chatBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default(""),
  message: z.string().min(1),
  history: z.array(chatMessageSchema).max(20).default([]),
  context: studioChatContextSchema,
});

export const publishScenarioBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default(""),
  aiProposal: z.string().optional().default(""),
  objectives: z
    .array(z.object({ title: langRecordSchema, desc: langRecordSchema }))
    .default([]),
  keywords: z.array(z.object({ label: langRecordSchema })).default([]),
  dialogue: z
    .array(
      z.object({
        segment: z.string(),
        text: langRecordSchema,
        tone: z.string().optional(),
      })
    )
    .default([]),
});

export const scenarioComplianceBodySchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  pnjRole: z.string().default(""),
  location: z.string().default(""),
  goalsCount: z.coerce.number().int().default(0),
  hasImage: z.boolean().default(false),
  goalsTitlesComplete: z.boolean().default(false),
  goalsMessagesComplete: z.boolean().default(false),
  tone: z.string().optional().default("Constructif"),
  audience: z.string().optional().default("Mixte"),
  focus: z.string().optional().default(""),
});

export const scenarioChatBodySchema = z.object({
  scenarioTitle: z.string().min(1),
  theme: z.string().optional().default(""),
  fieldLabel: z.string().min(1),
  currentValue: z.string().default(""),
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "agent"]), text: z.string() }))
    .max(20)
    .default([]),
  scenarioSnapshot: z
    .object({
      desc: z.string().optional(),
      pnj: z.string().optional(),
      location: z.string().optional(),
      theme: z.string().optional(),
      tone: z.string().optional(),
      level: z.string().optional(),
      status: z.string().optional(),
      titleByLang: z.record(z.string()).optional(),
      descriptionByLang: z.record(z.string()).optional(),
      goals: z
        .array(
          z.object({
            id: z.string(),
            titleFr: z.string(),
            titleEn: z.string().optional(),
            titleEs: z.string().optional(),
            descFr: z.string().optional(),
            descEn: z.string().optional(),
            descEs: z.string().optional(),
            successMessage: z.string().optional(),
            failureMessage: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

export type ScenarioComplianceBody = z.infer<typeof scenarioComplianceBodySchema>;
export type BrainstormBody = z.infer<typeof brainstormBodySchema>;
export type DesignBody = z.infer<typeof designBodySchema>;
export type ReviewBody = z.infer<typeof reviewBodySchema>;
export type ChatBody = z.infer<typeof chatBodySchema>;
export type StudioChatContext = z.infer<typeof studioChatContextSchema>;
export type PublishScenarioBody = z.infer<typeof publishScenarioBodySchema>;
export type ScenarioChatBody = z.infer<typeof scenarioChatBodySchema>;
