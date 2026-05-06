/**
 * Idempotent seed — upsert compte Admin (hash bcrypt via Bun).
 * Usage: DATABASE_URL=... bun run seed:admin
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@nomi.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";

async function main() {
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });

  const admin = await prisma.admin.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      displayName: "Seed Admin",
    },
    update: {
      passwordHash,
    },
  });

  console.log("[seed:admin] OK", admin.email, admin.id);
}

main()
  .catch((e) => {
    console.error("[seed:admin]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
