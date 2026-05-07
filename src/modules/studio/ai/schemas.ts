import { z } from "zod";

const langRecordSchema = z.object({ fr: z.string(), en: z.string() });

export const brainstormBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default("General"),
  theme: z.string().optional().default("General"),
  prompt: z.string().optional().default(""),
  count: z.coerce.number().int().min(1).max(8).default(5),
});

export const designBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default(""),
  prompt: z.string().optional().default(""),
  scope: z
    .enum(["Goals + Keywords", "Goals + Keywords + Node", "Just a Node"])
    .default("Goals + Keywords + Node"),
});

export const reviewBodySchema = z.object({
  projectName: z.string().min(1),
  targetCEFR: z.string().optional().default("B2"),
  focus: z.string().optional().default("All of the above"),
  prompt: z.string().optional().default(""),
  dialogueSnippet: z.string().optional().default(""),
});

const chatMessageSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
});

export const chatBodySchema = z.object({
  projectName: z.string().min(1),
  segment: z.string().optional().default(""),
  message: z.string().min(1),
  history: z.array(chatMessageSchema).max(20).default([]),
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
});

export type ScenarioComplianceBody = z.infer<typeof scenarioComplianceBodySchema>;
export type BrainstormBody = z.infer<typeof brainstormBodySchema>;
export type DesignBody = z.infer<typeof designBodySchema>;
export type ReviewBody = z.infer<typeof reviewBodySchema>;
export type ChatBody = z.infer<typeof chatBodySchema>;
export type PublishScenarioBody = z.infer<typeof publishScenarioBodySchema>;
export type ScenarioChatBody = z.infer<typeof scenarioChatBodySchema>;
