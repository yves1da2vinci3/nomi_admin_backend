import {
  getAnthropicClient,
  studioModelFromEnv,
} from "../../../lib/anthropic.js";
import type { Env } from "../../../config/env.js";
import type Anthropic from "@anthropic-ai/sdk";

let _studioEnv: Env | undefined;

/** Called by studio AI router middleware before handlers. */
export function configureStudioAiEnv(env: Env): void {
  _studioEnv = env;
}

function anthropicClient(): Anthropic {
  const c = getAnthropicClient(_studioEnv!);
  if (!c) throw new Error("ANTHROPIC_UNAVAILABLE");
  return c;
}

function studioModel(): string {
  return studioModelFromEnv(_studioEnv!);
}
import type {
  BrainstormBody,
  DesignBody,
  ReviewBody,
  ChatBody,
  PublishScenarioBody,
  ScenarioChatBody,
  ScenarioComplianceBody,
} from "./schemas.js";

type LangRecord = { fr: string; en: string };

// ─── Tool definitions ────────────────────────────────────────────────────────

const LANG_OBJ = {
  type: "object" as const,
  properties: { fr: { type: "string" }, en: { type: "string" } },
  required: ["fr", "en"],
};

const BRAINSTORM_TOOL: Anthropic.Tool = {
  name: "brainstorm_ideas",
  description:
    "Generate scenario concept ideas for a language learning studio project.",
  input_schema: {
    type: "object" as const,
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            theme: { type: "string" },
            title: LANG_OBJ,
            desc: LANG_OBJ,
          },
          required: ["theme", "title", "desc"],
        },
      },
    },
    required: ["ideas"],
  },
};

const DESIGN_TOOL: Anthropic.Tool = {
  name: "design_scenario",
  description:
    "Generate objectives, keywords, and an optional dialogue node for a language learning scenario.",
  input_schema: {
    type: "object" as const,
    properties: {
      objectives: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: LANG_OBJ,
            desc: LANG_OBJ,
            icon: { type: "string", enum: ["check", "dots", "smile"] },
          },
          required: ["title", "desc", "icon"],
        },
      },
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: { label: LANG_OBJ },
          required: ["label"],
        },
      },
      dialogueNode: {
        type: "object",
        properties: {
          segment: { type: "string" },
          text: LANG_OBJ,
          tone: { type: "string" },
        },
        required: ["segment", "text", "tone"],
      },
    },
    required: ["objectives", "keywords"],
  },
};

const REVIEW_TOOL: Anthropic.Tool = {
  name: "review_scenario",
  description:
    "Provide pedagogical suggestions for a language learning scenario draft.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            message: { type: "string" },
            severity: {
              type: "string",
              enum: ["info", "warning", "critical"],
            },
          },
          required: ["category", "message", "severity"],
        },
      },
      summary: { type: "string" },
    },
    required: ["suggestions", "summary"],
  },
};

const CHAT_TOOL: Anthropic.Tool = {
  name: "brainstorm_chat_reply",
  description:
    "Reply as a collaborative AI studio agent helping to develop a language learning scenario. When suggesting a specific concrete idea that could be added as an idea card to the board, include it in structuredIdea.",
  input_schema: {
    type: "object" as const,
    properties: {
      reply: { type: "string" },
      suggestedActions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
          },
          required: ["id", "label"],
        },
      },
      structuredIdea: {
        type: "object",
        description: "Include only when the reply contains a specific concrete scenario idea to add to the board.",
        properties: {
          theme: { type: "string" },
          title: LANG_OBJ,
          desc: LANG_OBJ,
        },
        required: ["theme", "title", "desc"],
      },
    },
    required: ["reply"],
  },
};

const FORMAT_SCENARIO_TOOL: Anthropic.Tool = {
  name: "format_scenario",
  description:
    "Format a Studio project into a complete Nomi language learning Scenario structure.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: LANG_OBJ,
      description: LANG_OBJ,
      pnjRole: { type: "string" },
      pnjPersonality: { type: "string" },
      pnjTone: { type: "string" },
      location: { type: "string" },
      goals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: LANG_OBJ,
            description: LANG_OBJ,
            expectedWords: { type: "array", items: { type: "string" } },
            requiredWords: { type: "array", items: { type: "string" } },
            optionalWords: { type: "array", items: { type: "string" } },
            successMessage: LANG_OBJ,
            failureMessage: LANG_OBJ,
          },
          required: [
            "title",
            "description",
            "expectedWords",
            "requiredWords",
            "optionalWords",
            "successMessage",
            "failureMessage",
          ],
        },
      },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            word: { type: "string" },
            translation: LANG_OBJ,
            category: { type: "string" },
          },
          required: ["word", "translation", "category"],
        },
      },
    },
    required: [
      "title",
      "description",
      "pnjRole",
      "pnjPersonality",
      "pnjTone",
      "location",
      "goals",
      "vocabulary",
    ],
  },
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function extractToolInput<T>(
  response: Anthropic.Message,
  toolName: string
): T {
  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === toolName
  );
  if (!block) throw new Error(`AI did not return expected tool: ${toolName}`);
  return block.input as T;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function generateBrainstormIdeas(body: BrainstormBody) {
  const systemPrompt = `You are a creative scenario designer for Nomi, an AI language learning platform. \
Generate diverse, engaging scenario concepts for the "${body.segment}" segment. \
All text fields (title, desc) must be provided in both French (fr) and English (en). \
Ideas should be grounded in realistic social interactions, culturally relevant, and teachable in 5–15 minutes.`;

  const userPrompt = `Generate ${body.count} brainstorm ideas for a project called "${body.projectName}" \
in the "${body.theme}" theme.${body.prompt ? `\n\nAdditional direction: ${body.prompt}` : ""}`;

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 1200,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [BRAINSTORM_TOOL],
    tool_choice: { type: "tool", name: "brainstorm_ideas" },
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractToolInput<{
    ideas: { theme: string; title: LangRecord; desc: LangRecord }[];
  }>(response, "brainstorm_ideas");
}

export async function generateDesign(body: DesignBody) {
  const systemPrompt = `You are a scenario design expert for Nomi language learning platform. \
Structure interactive dialogue-based scenarios with measurable learning objectives. \
Target CEFR B1–B2 unless context specifies otherwise. \
All text fields (title, desc, text, label) must be provided in both French (fr) and English (en).`;

  const userPrompt = `Design elements for the project "${body.projectName}" (${body.segment || "general"} segment).
Scope: ${body.scope}.
${body.prompt ? `Context: ${body.prompt}` : ""}
${body.scope.includes("Goals") ? "- Provide 3 objectives with title, desc (both fr/en), and icon (check/dots/smile)." : ""}
${body.scope.includes("Keywords") ? "- Provide 5–8 vocabulary keywords, each with label in fr and en." : ""}
${body.scope.includes("Node") || body.scope === "Just a Node" ? "- Provide one opening dialogue node (segment label, text in fr/en, tone)." : ""}`;

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 1200,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [DESIGN_TOOL],
    tool_choice: { type: "tool", name: "design_scenario" },
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractToolInput<{
    objectives: { title: LangRecord; desc: LangRecord; icon: string }[];
    keywords: { label: LangRecord }[];
    dialogueNode?: { segment: string; text: LangRecord; tone: string } | null;
  }>(response, "design_scenario");
}

export async function generateReview(body: ReviewBody) {
  const systemPrompt = `You are a pedagogical critic agent for Nomi language learning scenarios. \
Analyze scenario drafts for CEFR level consistency, vocabulary appropriateness, tone, \
grammar complexity, and cultural inclusivity. Be concise and actionable. \
Write suggestions and summary in French.`;

  const userPrompt = `Review the scenario "${body.projectName}" targeting CEFR ${body.targetCEFR}.
Focus: ${body.focus}.
${body.dialogueSnippet ? `\nScenario excerpt:\n${body.dialogueSnippet}` : ""}
${body.prompt ? `\nSpecific question: ${body.prompt}` : ""}

Provide targeted suggestions and a one-sentence summary.`;

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 800,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [REVIEW_TOOL],
    tool_choice: { type: "tool", name: "review_scenario" },
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractToolInput<{
    suggestions: { category: string; message: string; severity: string }[];
    summary: string;
  }>(response, "review_scenario");
}

export async function generateChatReply(body: ChatBody) {
  const systemPrompt = `Tu es un agent studio collaboratif appelé Nomi qui aide un concepteur pédagogique \
à développer un scénario d'apprentissage des langues pour le segment "${body.segment || "général"}". \
Sois concis, créatif et actionnable. Propose des prochaines étapes concrètes. \
Réponds toujours avec une réponse structurée et 1–3 actions suggérées que le concepteur peut cliquer.`;

  const history: Anthropic.MessageParam[] = body.history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: body.message },
  ];

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 512,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [CHAT_TOOL],
    tool_choice: { type: "tool", name: "brainstorm_chat_reply" },
    messages,
  });

  return extractToolInput<{
    reply: string;
    suggestedActions?: { id: string; label: string }[];
    structuredIdea?: { theme: string; title: LangRecord; desc: LangRecord };
  }>(response, "brainstorm_chat_reply");
}

const SCENARIO_COMPLIANCE_TOOL: Anthropic.Tool = {
  name: "scenario_compliance",
  description:
    "Analyse a Nomi scenario draft for completeness and pedagogical quality. Return a score, per-field items, a summary, and corrections. IMPORTANT: corrections must ALWAYS contain improved values for title, description, pnjRole, and location — even if the current value is acceptable, provide a polished version.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: { type: "number", description: "Overall compliance score 0–100" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            label: { type: "string" },
            suggestion: { type: "string" },
          },
          required: ["ok", "label"],
        },
      },
      summary: { type: "string" },
      corrections: {
        type: "object",
        description: "Polished/corrected values for ALL four fields. Always provide all four, even for passing fields (return the current value improved if nothing is wrong).",
        properties: {
          title: { type: "string", description: "Polished title" },
          description: { type: "string", description: "Improved description (min 60 chars)" },
          pnjRole: { type: "string", description: "Clear PNJ role description" },
          location: { type: "string", description: "Specific location name" },
        },
        required: ["title", "description", "pnjRole", "location"],
      },
    },
    required: ["score", "items", "summary", "corrections"],
  },
};

export async function generateScenarioCompliance(body: ScenarioComplianceBody) {
  const systemPrompt = `Tu es un expert pédagogique Nomi. Tu analyses la complétude et la qualité d'un scénario d'apprentissage. \
Évalue chaque aspect et fournis un score global 0–100, une liste d'items (ok/non-ok) avec suggestions, et un résumé. \
Ton de l'analyse : ${body.tone}. Public prioritaire : ${body.audience}. \
Réponds en français. Sois précis et actionnable. \
IMPORTANT : le champ "corrections" doit TOUJOURS contenir les quatre clés (title, description, pnjRole, location). \
Si un champ est déjà correct, retourne-en une version légèrement améliorée ou identique — ne laisse jamais une clé absente.`;

  const contextLines = [
    `Titre : "${body.title || "(vide)"}"`,
    `Description : "${body.description ? body.description.slice(0, 200) : "(vide)"}"`,
    `PNJ/Rôle : "${body.pnjRole || "(vide)"}"`,
    `Lieu : "${body.location || "(vide)"}"`,
    `Nombre d'objectifs : ${body.goalsCount}`,
    `Objectifs traduits FR+EN : ${body.goalsTitlesComplete ? "oui" : "non"}`,
    `Messages succès/échec définis : ${body.goalsMessagesComplete ? "oui" : "non"}`,
    `Image de fond : ${body.hasImage ? "oui" : "non"}`,
    body.focus ? `Points à vérifier en priorité : ${body.focus}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 1000,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [SCENARIO_COMPLIANCE_TOOL],
    tool_choice: { type: "tool", name: "scenario_compliance" },
    messages: [{ role: "user", content: contextLines }],
  });

  return extractToolInput<{
    score: number;
    items: { ok: boolean; label: string; suggestion?: string }[];
    summary: string;
    corrections: { title?: string; description?: string; pnjRole?: string; location?: string };
  }>(response, "scenario_compliance");
}

const SCENARIO_FIELD_CHAT_TOOL: Anthropic.Tool = {
  name: "scenario_field_assist",
  description:
    "Reply to the editor helping fill in a specific field of a Nomi language learning scenario. Provide a conversational reply and, when ready, a proposedValue string ready to insert into the field.",
  input_schema: {
    type: "object" as const,
    properties: {
      reply: { type: "string" },
      proposedValue: { type: "string" },
    },
    required: ["reply"],
  },
};

export async function generateScenarioFieldChat(body: ScenarioChatBody) {
  const systemPrompt = `Tu es un assistant éditorial Nomi. Tu aides un concepteur à rédiger le contenu \
d'un champ spécifique d'un scénario pédagogique d'apprentissage des langues. \
Réponds en français. Sois concis et actionnable. \
Quand tu proposes un texte prêt à insérer dans le champ, fournis-le dans "proposedValue".`;

  const history: Anthropic.MessageParam[] = body.history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));

  const contextMsg = `Scénario : "${body.scenarioTitle}"${body.theme ? ` (${body.theme})` : ""}.
Champ à remplir : "${body.fieldLabel}".
Valeur actuelle : ${body.currentValue ? `"${body.currentValue}"` : "(vide)"}.

Message : ${body.message}`;

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: contextMsg },
  ];

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 512,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [SCENARIO_FIELD_CHAT_TOOL],
    tool_choice: { type: "tool", name: "scenario_field_assist" },
    messages,
  });

  return extractToolInput<{ reply: string; proposedValue?: string }>(
    response,
    "scenario_field_assist"
  );
}

export async function generatePublishFormat(body: PublishScenarioBody) {
  const systemPrompt = `Tu es un expert pédagogique Nomi. Formate un projet Studio en structure complète de Scénario. \
Tous les champs texte doivent être en français (fr) ET en anglais (en). \
Pour pnjRole, pnjPersonality, location : déduis-les du contexte du projet. \
Pour les goals : crée les expectedWords depuis les keywords du projet. \
Génère des successMessage et failureMessage pédagogiques et encourageants.`;

  const contextLines = [
    `Projet : "${body.projectName}" (segment : ${body.segment || "général"})`,
    body.aiProposal ? `Proposition IA : ${body.aiProposal}` : "",
    body.objectives.length
      ? `Objectifs : ${body.objectives.map((o) => o.title.fr).join(", ")}`
      : "",
    body.keywords.length
      ? `Keywords : ${body.keywords.map((k) => k.label.fr).join(", ")}`
      : "",
    body.dialogue.length
      ? `Dialogue (extrait) : "${body.dialogue[0].text.fr}" (ton: ${body.dialogue[0].tone ?? "neutre"})`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropicClient().messages.create({
    model: studioModel(),
    max_tokens: 2500,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    tools: [FORMAT_SCENARIO_TOOL],
    tool_choice: { type: "tool", name: "format_scenario" },
    messages: [{ role: "user", content: contextLines }],
  });

  return extractToolInput<{
    title: LangRecord;
    description: LangRecord;
    pnjRole: string;
    pnjPersonality: string;
    pnjTone: string;
    location: string;
    goals: {
      title: LangRecord;
      description: LangRecord;
      expectedWords: string[];
      requiredWords: string[];
      optionalWords: string[];
      successMessage: LangRecord;
      failureMessage: LangRecord;
    }[];
    vocabulary: { word: string; translation: LangRecord; category: string }[];
  }>(response, "format_scenario");
}
