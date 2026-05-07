import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";

export async function listProjects(
  adminId: string,
  page: number,
  limit: number
) {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.studioProject.findMany({
      where: { adminId },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.studioProject.count({ where: { adminId } }),
  ]);
  return {
    projects: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
}

export async function getProject(adminId: string, id: string) {
  return prisma.studioProject.findFirst({ where: { id, adminId } });
}

export async function createProject(
  adminId: string,
  title: string,
  state: Record<string, unknown>
) {
  return prisma.studioProject.create({
    data: { adminId, title, state: state as Prisma.InputJsonValue },
  });
}

export async function updateProject(
  adminId: string,
  id: string,
  patch: { title?: string; state?: Record<string, unknown> }
) {
  const existing = await prisma.studioProject.findFirst({
    where: { id, adminId },
  });
  if (!existing) return null;
  return prisma.studioProject.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.state !== undefined
        ? { state: patch.state as Prisma.InputJsonValue }
        : {}),
    },
  });
}

export async function deleteProject(adminId: string, id: string) {
  const existing = await prisma.studioProject.findFirst({
    where: { id, adminId },
  });
  if (!existing) return null;
  return prisma.studioProject.delete({ where: { id } });
}
