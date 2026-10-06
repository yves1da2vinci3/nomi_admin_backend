import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

const QUEUE_NAMES = [
  "game-generator",
  "story-finalize",
  "session-finalization",
  "push-notifications",
  "engagement-reminders",
  "keywords-hints",
  "interpreter-feedback",
  "interpreter-pregen",
  "assisted-diary",
  "interpreter-practice-prep",
  "interpreter-practice-feedback",
] as const;

let connection: Redis | null | undefined;
const queues = new Map<string, Queue>();

function getConnection(): Redis | null {
  if (connection !== undefined) return connection;
  const url = process.env.REDIS_URL;
  connection = url ? new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true }) : null;
  return connection;
}

function getQueue(name: string, conn: Redis): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: conn });
    queues.set(name, q);
  }
  return q;
}

export type QueueStatus =
  | { available: false }
  | {
      available: true;
      queues: Array<{
        name: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      }>;
    };

export async function getQueueStatus(): Promise<QueueStatus> {
  const conn = getConnection();
  if (!conn) return { available: false };

  const results = await Promise.all(
    QUEUE_NAMES.map(async (name) => {
      try {
        const q = getQueue(name, conn);
        const counts = await q.getJobCounts("waiting", "active", "completed", "failed", "delayed");
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        };
      } catch {
        return { name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
      }
    })
  );

  return { available: true, queues: results };
}

const OPS_ID = "default";

const pushLang = z.enum(["en", "es", "fr", "de", "it", "pt"]);
const worldLang = z.enum(["en", "es", "de", "fr", "nl", "it", "ja"]);

export const opsSwitchPatchSchema = z
  .object({
    allOff: z.boolean().optional(),
    pushRemindersEnabled: z.boolean().optional(),
    pushRemindersLangsOff: z.array(pushLang).optional(),
    worldEnabled: z.boolean().optional(),
    worldLangsOff: z.array(worldLang).optional(),
  })
  .strict();

export type OpsSwitchPatch = z.infer<typeof opsSwitchPatchSchema>;

export type OpsSwitches = {
  allOff: boolean;
  pushRemindersEnabled: boolean;
  pushRemindersLangsOff: string[];
  worldEnabled: boolean;
  worldLangsOff: string[];
  updatedAt: string;
};

function toOpsSwitches(row: {
  allOff: boolean;
  pushRemindersEnabled: boolean;
  pushRemindersLangsOff: string[];
  worldEnabled: boolean;
  worldLangsOff: string[];
  updatedAt: Date;
}): OpsSwitches {
  return {
    allOff: row.allOff,
    pushRemindersEnabled: row.pushRemindersEnabled,
    pushRemindersLangsOff: row.pushRemindersLangsOff,
    worldEnabled: row.worldEnabled,
    worldLangsOff: row.worldLangsOff,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOpsSwitches(): Promise<OpsSwitches> {
  const row = await prisma.opsControl.upsert({
    where: { id: OPS_ID },
    create: { id: OPS_ID },
    update: {},
  });
  return toOpsSwitches(row);
}

export async function patchOpsSwitches(patch: OpsSwitchPatch): Promise<OpsSwitches> {
  const row = await prisma.opsControl.upsert({
    where: { id: OPS_ID },
    create: { id: OPS_ID, ...patch },
    update: patch,
  });
  return toOpsSwitches(row);
}
