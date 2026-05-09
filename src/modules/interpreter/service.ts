import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { z } from "zod";
import type {
  createScenarioSchema,
  updateScenarioSchema,
  createObjectiveSchema,
  updateObjectiveSchema,
} from "./schemas.js";

type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
type CreateObjectiveInput = z.infer<typeof createObjectiveSchema>;
type UpdateObjectiveInput = z.infer<typeof updateObjectiveSchema>;

export async function listScenarios(page: number, limit: number) {
  const [items, total] = await Promise.all([
    prisma.interpreterScenario.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { objectives: true } } },
    }),
    prisma.interpreterScenario.count(),
  ]);
  return { items, total };
}

export async function createScenario(data: CreateScenarioInput) {
  return prisma.interpreterScenario.create({
    data: data as Prisma.InterpreterScenarioCreateInput,
  });
}

export async function getScenario(id: string) {
  const scenario = await prisma.interpreterScenario.findUnique({
    where: { id },
    include: { objectives: { orderBy: { order: "asc" } } },
  });
  if (!scenario) {
    const err = new Error("InterpreterScenario not found") as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
  return scenario;
}

export async function updateScenario(id: string, data: UpdateScenarioInput) {
  return prisma.interpreterScenario.update({
    where: { id },
    data: data as Prisma.InterpreterScenarioUpdateInput,
  });
}

export async function deleteScenario(id: string) {
  await prisma.interpreterScenario.delete({ where: { id } });
}

export async function addObjective(scenarioId: string, data: CreateObjectiveInput) {
  return prisma.interpreterObjective.create({
    data: { ...data, scenarioId } as Prisma.InterpreterObjectiveUncheckedCreateInput,
  });
}

export async function updateObjective(scenarioId: string, objId: string, data: UpdateObjectiveInput) {
  return prisma.interpreterObjective.update({
    where: { id: objId, scenarioId },
    data: data as Prisma.InterpreterObjectiveUpdateInput,
  });
}

export async function deleteObjective(scenarioId: string, objId: string) {
  await prisma.interpreterObjective.delete({ where: { id: objId, scenarioId } });
}
