import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "@prisma/client";

export function mapUserToAdminRow(u: {
  id: string;
  uid: string;
  email: string;
  displayName: string | null;
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
    learningLanguage: u.learningLanguage,
    nativeLanguage: u.nativeLanguage,
    learningLanguages: u.learningLanguages,
    level: u.level,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function listUsers(skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
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
