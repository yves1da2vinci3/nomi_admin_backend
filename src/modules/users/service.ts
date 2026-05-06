import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export function mapUserToAdminRow(u: {
  id: string;
  uid: string;
  email: string;
  displayName: string | null;
  photoURL?: string | null;
  isSuspended?: boolean;
  learningLanguage: string | null;
  nativeLanguage: string | null;
  learningLanguages: string[];
  level: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL ?? null,
    isSuspended: u.isSuspended ?? false,
    learningLanguage: u.learningLanguage,
    nativeLanguage: u.nativeLanguage,
    learningLanguages: u.learningLanguages,
    level: u.level,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export type ListUsersFilters = {
  skip: number;
  take: number;
  search?: string;
  language?: string;
  level?: "all" | "beginner" | "intermediate" | "advanced";
  accountStatus?: "any" | "active" | "inactive" | "none";
};

function buildUserWhere(filters: ListUsersFilters): Prisma.UserWhereInput | null {
  const where: Prisma.UserWhereInput = {};

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
    ];
  }

  const lang = filters.language?.trim();
  if (lang && lang !== "All Languages") {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [{ learningLanguage: lang }, { learningLanguages: { has: lang } }],
      },
    ];
  }

  const lev = filters.level ?? "all";
  if (lev !== "all") {
    const needle =
      lev === "beginner" ? "beginner" : lev === "intermediate" ? "intermediate" : "advanced";
    where.level = { contains: needle, mode: "insensitive" };
  }

  const acc = filters.accountStatus ?? "any";
  if (acc === "active") {
    where.isSuspended = false;
  } else if (acc === "inactive") {
    where.isSuspended = true;
  } else if (acc === "none") {
    return null;
  }

  return where;
}

export async function listUsers(filters: ListUsersFilters) {
  const where = buildUserWhere(filters);
  if (where === null) {
    return { rows: [] as ReturnType<typeof mapUserToAdminRow>[], total: 0 };
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows: rows.map(mapUserToAdminRow), total };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data });
}

export async function updateUser(id: string, data: Prisma.UserUpdateInput) {
  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
