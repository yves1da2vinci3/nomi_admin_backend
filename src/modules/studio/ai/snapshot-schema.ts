import { z } from "zod";

const langRecordSchema = z.object({ fr: z.string(), en: z.string() });
const ideaSnapshotLangSchema = z.object({
  fr: z.string(),
  en: z.string(),
  es: z.string().optional(),
});

const snapshotIdeaSchema = z.object({
  id: z.string(),
  theme: z.string(),
  status: z.enum(["idea", "toValidate", "approved"]),
  title: ideaSnapshotLangSchema,
  desc: ideaSnapshotLangSchema,
  descTruncated: z.boolean().optional(),
  badge: z.string().nullable().optional(),
  progress: z.number().optional(),
  comments: z.number().optional(),
  match: z.number().optional(),
});

const objectiveSchema = z.object({
  id: z.string(),
  icon: z.enum(["check", "dots", "smile"]),
  title: langRecordSchema,
  desc: langRecordSchema,
});

const keywordSchema = z.object({
  id: z.string(),
  label: langRecordSchema,
});

const snapshotDialogueSchema = z.object({
  id: z.string(),
  segment: z.string(),
  tone: z.string().optional(),
  duration: z.string().optional(),
  ai: z.boolean().optional(),
  text: langRecordSchema,
  textTruncated: z.boolean().optional(),
});

const qaCheckSchema = z.object({
  id: z.string(),
  title: z.string(),
  desc: z.string(),
  state: z.enum(["pass", "fail", "progress", "todo"]),
});

const snapshotChatMsgSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "agent"]),
  text: z.string(),
  textTruncated: z.boolean().optional(),
  time: z.string().optional(),
});

/** Aligné sur `StudioProjectAiSnapshot` côté admin. */
export const studioProjectSnapshotSchema = z.object({
  meta: z.object({
    id: z.string(),
    serverId: z.string().nullable(),
    name: z.string(),
    segment: z.string(),
    phase: z.enum(["brainstorming", "design", "review", "production"]),
    createdAt: z.string(),
    updatedAt: z.string(),
    scenarioId: z.string().nullable(),
  }),
  brainstorming: z.object({
    activeIdeaId: z.string().nullable(),
    ideas: z.array(snapshotIdeaSchema),
  }),
  design: z.object({
    aiProposal: z.string(),
    aiProposalTruncated: z.boolean().optional(),
    recommendedActions: z.array(z.string()),
    objectives: z.array(objectiveSchema),
    keywords: z.array(keywordSchema),
    dialogue: z.array(snapshotDialogueSchema),
  }),
  review: z.object({
    targetCEFR: z.string(),
    consistency: z.number(),
    criticalIssues: z.number(),
    reviewProgress: z.number(),
    qaChecklist: z.array(qaCheckSchema),
  }),
  production: z.object({
    productionReady: z.boolean(),
    productionSteps: z.array(z.object({ label: z.string(), done: z.boolean() })),
    publishedScenarioId: z.string().nullable(),
  }),
  agentChat: z.object({
    messages: z.array(snapshotChatMsgSchema),
    chatNotes: z.string().optional(),
  }),
});

export type StudioProjectSnapshotPayload = z.infer<typeof studioProjectSnapshotSchema>;
