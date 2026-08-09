import { prisma } from "../../../lib/prisma.js";
import { httpError } from "../../../lib/http-error.js";
import type {
  CohortWhereInput,
  CompanyWhereInput,
  TransactionClient,
} from "../../../types/prisma-derived.js";
import { buildPagination, skipFor } from "../shared/pagination.js";
import { getEnabledModules, getSeatsUsage, grantPackToCompany } from "../quota-service.js";
import type {
  AdjustCreditsBody,
  CreateCohortBody,
  CreateCompanyBody,
  CreatePartnerUserBody,
  GrantEntitlementBody,
  ListCohortsQuery,
  ListCompaniesQuery,
  UpdateCohortBody,
  UpdateCompanyBody,
  UpdatePartnerUserBody,
} from "./schemas.js";

type CompanyCounts = {
  learners: number;
  cohorts: number;
  partnerUsers: number;
  assignments: number;
};

function mapCompany(row: {
  id: string;
  name: string;
  slug: string;
  orgType: string;
  plan: string;
  seatLimit: number;
  apiQuotaMonth: number;
  apiUsedMonth: number;
  logoUrl: string | null;
  timezone: string;
  renewalDate: Date | null;
  weeklyDigest: boolean;
  quotaAlert: boolean;
  monthlyReport: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: CompanyCounts;
}) {
  const learners = row._count?.learners ?? 0;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    orgType: row.orgType,
    plan: row.plan,
    seatLimit: row.seatLimit,
    // Toujours recompté, jamais stocké.
    seatsUsed: learners,
    seatsAvailable: Math.max(0, row.seatLimit - learners),
    apiQuotaMonth: row.apiQuotaMonth,
    apiUsedMonth: row.apiUsedMonth,
    logoUrl: row.logoUrl,
    timezone: row.timezone,
    renewalDate: row.renewalDate?.toISOString() ?? null,
    weeklyDigest: row.weeklyDigest,
    quotaAlert: row.quotaAlert,
    monthlyReport: row.monthlyReport,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    counts: row._count
      ? {
          learners: row._count.learners,
          cohorts: row._count.cohorts,
          partnerUsers: row._count.partnerUsers,
          assignments: row._count.assignments,
        }
      : undefined,
  };
}

const companyCountSelect = {
  select: { learners: true, cohorts: true, partnerUsers: true, assignments: true },
} as const;

export async function listCompanies(params: ListCompaniesQuery) {
  const where: CompanyWhereInput = {};
  if (params.orgType) where.orgType = params.orgType;
  if (params.plan) where.plan = params.plan;
  if (params.isActive !== undefined) where.isActive = params.isActive;
  const q = params.search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { _count: companyCountSelect },
      orderBy: { createdAt: "desc" },
      skip: skipFor(params.page, params.limit),
      take: params.limit,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    companies: rows.map(mapCompany),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

export async function getCompanyById(id: string) {
  const row = await prisma.company.findUnique({
    where: { id },
    include: { _count: companyCountSelect },
  });
  if (!row) return null;

  const [enabledModules, entitlements] = await Promise.all([
    getEnabledModules(id),
    prisma.companyEntitlement.findMany({
      where: { companyId: id },
      include: {
        pack: { select: { id: true, slug: true, name: true, tier: true, billingPeriod: true } },
        credits: { include: { module: { select: { id: true, key: true } } } },
      },
      orderBy: { purchasedAt: "desc" },
    }),
  ]);

  return {
    ...mapCompany(row),
    enabledModules,
    entitlements: entitlements.map((ent) => ({
      id: ent.id,
      status: ent.status,
      purchasedAt: ent.purchasedAt.toISOString(),
      expiresAt: ent.expiresAt?.toISOString() ?? null,
      pack: ent.pack,
      credits: ent.credits.map((c) => ({
        moduleId: c.moduleId,
        moduleKey: c.module.key,
        creditsRemaining: c.creditsRemaining,
      })),
    })),
  };
}

export async function createCompany(body: CreateCompanyBody) {
  const clash = await prisma.company.findUnique({ where: { slug: body.slug } });
  if (clash) throw httpError(409, `Company slug already used: ${body.slug}`);

  const created = await prisma.company.create({
    data: {
      name: body.name,
      slug: body.slug,
      orgType: body.orgType,
      plan: body.plan,
      seatLimit: body.seatLimit,
      apiQuotaMonth: body.apiQuotaMonth,
      logoUrl: body.logoUrl || null,
      timezone: body.timezone,
      renewalDate: body.renewalDate ?? null,
      weeklyDigest: body.weeklyDigest,
      quotaAlert: body.quotaAlert,
      monthlyReport: body.monthlyReport,
      isActive: body.isActive,
    },
    include: { _count: companyCountSelect },
  });
  return mapCompany(created);
}

export async function updateCompany(id: string, body: UpdateCompanyBody) {
  const current = await prisma.company.findUnique({ where: { id } });
  if (!current) return null;

  if (body.slug && body.slug !== current.slug) {
    const clash = await prisma.company.findUnique({ where: { slug: body.slug } });
    if (clash) throw httpError(409, `Company slug already used: ${body.slug}`);
  }

  const updated = await prisma.company.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.orgType !== undefined ? { orgType: body.orgType } : {}),
      ...(body.plan !== undefined ? { plan: body.plan } : {}),
      ...(body.seatLimit !== undefined ? { seatLimit: body.seatLimit } : {}),
      ...(body.apiQuotaMonth !== undefined ? { apiQuotaMonth: body.apiQuotaMonth } : {}),
      ...(body.apiUsedMonth !== undefined ? { apiUsedMonth: body.apiUsedMonth } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl || null } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.renewalDate !== undefined ? { renewalDate: body.renewalDate ?? null } : {}),
      ...(body.weeklyDigest !== undefined ? { weeklyDigest: body.weeklyDigest } : {}),
      ...(body.quotaAlert !== undefined ? { quotaAlert: body.quotaAlert } : {}),
      ...(body.monthlyReport !== undefined ? { monthlyReport: body.monthlyReport } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: { _count: companyCountSelect },
  });
  return mapCompany(updated);
}

/** Suppression bloquée si des apprenants existent — désactiver à la place. */
export async function deleteCompany(id: string) {
  const row = await prisma.company.findUnique({
    where: { id },
    include: { _count: companyCountSelect },
  });
  if (!row) return false;

  if (row._count.learners > 0) {
    throw httpError(
      409,
      `Entreprise avec ${row._count.learners} apprenant(s) — la désactiver au lieu de la supprimer`
    );
  }

  await prisma.company.delete({ where: { id } });
  return true;
}

export async function getCompanyUsage(id: string) {
  const [seats, modules, company] = await Promise.all([
    getSeatsUsage(id),
    getEnabledModules(id),
    prisma.company.findUnique({
      where: { id },
      select: { apiQuotaMonth: true, apiUsedMonth: true },
    }),
  ]);
  if (!company) throw httpError(404, "Company not found");

  return {
    seats,
    api: {
      quotaMonth: company.apiQuotaMonth,
      usedMonth: company.apiUsedMonth,
      usagePct:
        company.apiQuotaMonth > 0
          ? Math.round((company.apiUsedMonth / company.apiQuotaMonth) * 100)
          : 0,
    },
    modules,
  };
}

// --- Cohortes ---------------------------------------------------------------

function mapCohort(row: {
  id: string;
  companyId: string;
  name: string;
  inviteCode: string;
  startDate: Date;
  endDate: Date;
  seatLimit: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { learners: number };
  instructors?: {
    partnerUserId: string;
    partnerUser: { id: string; email: string; displayName: string | null };
  }[];
}) {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    inviteCode: row.inviteCode,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    seatLimit: row.seatLimit,
    status: row.status,
    enrolled: row._count?.learners ?? 0,
    instructors:
      row.instructors?.map((i) => ({
        id: i.partnerUser.id,
        email: i.partnerUser.email,
        displayName: i.partnerUser.displayName,
      })) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const cohortInclude = {
  _count: { select: { learners: true } },
  instructors: {
    include: { partnerUser: { select: { id: true, email: true, displayName: true } } },
  },
} as const;

/** Code d'invitation lisible, unique en base (retry en cas de collision). */
async function generateInviteCode(companySlug: string): Promise<string> {
  const prefix = companySlug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "NOMI";
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const code = `${prefix}-${year}-${suffix}`;
    const exists = await prisma.cohort.findUnique({ where: { inviteCode: code } });
    if (!exists) return code;
  }
  throw httpError(500, "Impossible de générer un code d'invitation unique");
}

function cohortStatusFor(startDate: Date, endDate: Date): "upcoming" | "active" | "ended" {
  const now = Date.now();
  if (startDate.getTime() > now) return "upcoming";
  if (endDate.getTime() < now) return "ended";
  return "active";
}

export async function listCohorts(companyId: string, params: ListCohortsQuery) {
  const where: CohortWhereInput = { companyId };
  if (params.status) where.status = params.status;
  const q = params.search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { inviteCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.cohort.findMany({
      where,
      include: cohortInclude,
      orderBy: { startDate: "desc" },
      skip: skipFor(params.page, params.limit),
      take: params.limit,
    }),
    prisma.cohort.count({ where }),
  ]);

  return {
    cohorts: rows.map(mapCohort),
    pagination: buildPagination(params.page, params.limit, total),
  };
}

export async function createCohort(companyId: string, body: CreateCohortBody) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { slug: true },
  });
  if (!company) throw httpError(404, "Company not found");

  await assertPartnerUsersBelongToCompany(companyId, body.instructorIds);

  const inviteCode = await generateInviteCode(company.slug);
  const created = await prisma.cohort.create({
    data: {
      companyId,
      name: body.name,
      inviteCode,
      startDate: body.startDate,
      endDate: body.endDate,
      seatLimit: body.seatLimit,
      status: cohortStatusFor(body.startDate, body.endDate),
      instructors: {
        create: body.instructorIds.map((partnerUserId) => ({ partnerUserId })),
      },
    },
    include: cohortInclude,
  });
  return mapCohort(created);
}

export async function updateCohort(companyId: string, cohortId: string, body: UpdateCohortBody) {
  const current = await prisma.cohort.findFirst({ where: { id: cohortId, companyId } });
  if (!current) return null;

  const startDate = body.startDate ?? current.startDate;
  const endDate = body.endDate ?? current.endDate;
  if (endDate.getTime() < startDate.getTime()) {
    throw httpError(400, "endDate doit être postérieure à startDate");
  }
  if (body.instructorIds) {
    await assertPartnerUsersBelongToCompany(companyId, body.instructorIds);
  }

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.cohort.update({
      where: { id: cohortId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
        ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
        ...(body.seatLimit !== undefined ? { seatLimit: body.seatLimit } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    if (!body.instructorIds) return;
    await tx.cohortInstructor.deleteMany({
      where: { cohortId, partnerUserId: { notIn: body.instructorIds } },
    });
    for (const partnerUserId of body.instructorIds) {
      await tx.cohortInstructor.upsert({
        where: { cohortId_partnerUserId: { cohortId, partnerUserId } },
        create: { cohortId, partnerUserId },
        update: {},
      });
    }
  });

  const row = await prisma.cohort.findUnique({ where: { id: cohortId }, include: cohortInclude });
  return row ? mapCohort(row) : null;
}

/** Archive au lieu de supprimer : l'historique des apprenants reste lisible. */
export async function archiveCohort(companyId: string, cohortId: string) {
  const current = await prisma.cohort.findFirst({ where: { id: cohortId, companyId } });
  if (!current) return null;
  const row = await prisma.cohort.update({
    where: { id: cohortId },
    data: { status: "archived" },
    include: cohortInclude,
  });
  return mapCohort(row);
}

// --- Utilisateurs portail ---------------------------------------------------

async function assertPartnerUsersBelongToCompany(companyId: string, ids: string[]) {
  if (ids.length === 0) return;
  const count = await prisma.partnerUser.count({ where: { companyId, id: { in: ids } } });
  if (count !== ids.length) throw httpError(400, "Unknown partnerUserId for this company");
}

async function assertCohortsBelongToCompany(companyId: string, ids: string[]) {
  if (ids.length === 0) return;
  const count = await prisma.cohort.count({ where: { companyId, id: { in: ids } } });
  if (count !== ids.length) throw httpError(400, "Unknown cohortId for this company");
}

const partnerUserInclude = {
  cohortInstructors: { include: { cohort: { select: { id: true, name: true } } } },
} as const;

function mapPartnerUser(row: {
  id: string;
  companyId: string;
  email: string;
  displayName: string | null;
  portalRole: string;
  status: string;
  passwordHash: string | null;
  lastLoginAt: Date | null;
  invitedAt: Date;
  cohortInstructors?: { cohort: { id: string; name: string } }[];
}) {
  return {
    id: row.id,
    companyId: row.companyId,
    email: row.email,
    displayName: row.displayName,
    portalRole: row.portalRole,
    status: row.status,
    hasPassword: Boolean(row.passwordHash),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    invitedAt: row.invitedAt.toISOString(),
    cohorts: row.cohortInstructors?.map((c) => c.cohort) ?? [],
  };
}

export async function listPartnerUsers(companyId: string) {
  const rows = await prisma.partnerUser.findMany({
    where: { companyId },
    include: partnerUserInclude,
    orderBy: { invitedAt: "desc" },
  });
  return rows.map(mapPartnerUser);
}

export async function createPartnerUser(companyId: string, body: CreatePartnerUserBody) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw httpError(404, "Company not found");

  const clash = await prisma.partnerUser.findUnique({ where: { email: body.email } });
  if (clash) throw httpError(409, `Email already used: ${body.email}`);
  await assertCohortsBelongToCompany(companyId, body.cohortIds);

  const passwordHash = body.password ? await Bun.password.hash(body.password) : null;
  const created = await prisma.partnerUser.create({
    data: {
      companyId,
      email: body.email,
      displayName: body.displayName ?? null,
      portalRole: body.portalRole,
      passwordHash,
      status: passwordHash ? "active" : "pending",
      cohortInstructors: {
        create: body.cohortIds.map((cohortId) => ({ cohortId })),
      },
    },
    include: partnerUserInclude,
  });
  return mapPartnerUser(created);
}

export async function updatePartnerUser(
  companyId: string,
  partnerUserId: string,
  body: UpdatePartnerUserBody
) {
  const current = await prisma.partnerUser.findFirst({
    where: { id: partnerUserId, companyId },
  });
  if (!current) return null;

  if (body.cohortIds) await assertCohortsBelongToCompany(companyId, body.cohortIds);

  if (body.portalRole && body.portalRole !== "org_admin" && current.portalRole === "org_admin") {
    await assertNotLastOrgAdmin(companyId, partnerUserId);
  }

  const passwordHash = body.password ? await Bun.password.hash(body.password) : undefined;

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.partnerUser.update({
      where: { id: partnerUserId },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.portalRole !== undefined ? { portalRole: body.portalRole } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(passwordHash ? { passwordHash, status: "active" as const } : {}),
      },
    });

    if (!body.cohortIds) return;
    await tx.cohortInstructor.deleteMany({
      where: { partnerUserId, cohortId: { notIn: body.cohortIds } },
    });
    for (const cohortId of body.cohortIds) {
      await tx.cohortInstructor.upsert({
        where: { cohortId_partnerUserId: { cohortId, partnerUserId } },
        create: { cohortId, partnerUserId },
        update: {},
      });
    }
  });

  const row = await prisma.partnerUser.findUnique({
    where: { id: partnerUserId },
    include: partnerUserInclude,
  });
  return row ? mapPartnerUser(row) : null;
}

/** Une entreprise doit toujours conserver au moins un `org_admin` actif. */
async function assertNotLastOrgAdmin(companyId: string, excludedId: string) {
  const remaining = await prisma.partnerUser.count({
    where: {
      companyId,
      portalRole: "org_admin",
      status: "active",
      id: { not: excludedId },
    },
  });
  if (remaining === 0) {
    throw httpError(409, "Dernier administrateur de l'entreprise — impossible de le retirer");
  }
}

export async function deletePartnerUser(companyId: string, partnerUserId: string) {
  const current = await prisma.partnerUser.findFirst({
    where: { id: partnerUserId, companyId },
  });
  if (!current) return false;

  if (current.portalRole === "org_admin") {
    await assertNotLastOrgAdmin(companyId, partnerUserId);
  }

  await prisma.partnerUser.delete({ where: { id: partnerUserId } });
  return true;
}

// --- Entitlements et crédits ------------------------------------------------

export async function grantEntitlement(companyId: string, body: GrantEntitlementBody) {
  const entitlementId = await grantPackToCompany({
    companyId,
    packId: body.packId,
    expiresAt: body.expiresAt ?? undefined,
  });

  const row = await prisma.companyEntitlement.findUnique({
    where: { id: entitlementId },
    include: {
      pack: { select: { id: true, slug: true, name: true } },
      credits: { include: { module: { select: { id: true, key: true } } } },
    },
  });
  if (!row) throw httpError(500, "Entitlement introuvable après création");

  return {
    id: row.id,
    status: row.status,
    purchasedAt: row.purchasedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    pack: row.pack,
    credits: row.credits.map((c) => ({
      moduleId: c.moduleId,
      moduleKey: c.module.key,
      creditsRemaining: c.creditsRemaining,
    })),
  };
}

export async function revokeEntitlement(companyId: string, entitlementId: string) {
  const current = await prisma.companyEntitlement.findFirst({
    where: { id: entitlementId, companyId },
  });
  if (!current) return false;
  await prisma.companyEntitlement.update({
    where: { id: entitlementId },
    data: { status: "expired", expiresAt: new Date() },
  });
  return true;
}

/**
 * Ajustement manuel de crédits (geste commercial, correction).
 * Sans `entitlementId`, cible l'entitlement actif le plus récent du module.
 */
export async function adjustCredits(companyId: string, body: AdjustCreditsBody) {
  const entitlement = body.entitlementId
    ? await prisma.companyEntitlement.findFirst({
        where: { id: body.entitlementId, companyId },
      })
    : await prisma.companyEntitlement.findFirst({
        where: {
          companyId,
          status: "active",
          pack: { items: { some: { moduleId: body.moduleId } } },
        },
        orderBy: { purchasedAt: "desc" },
      });

  if (!entitlement) {
    throw httpError(404, "Aucun entitlement actif pour ce module — octroyer un pack d'abord");
  }

  const existing = await prisma.entitlementCredit.findUnique({
    where: {
      entitlementId_moduleId: { entitlementId: entitlement.id, moduleId: body.moduleId },
    },
  });

  const nextValue = Math.max(0, (existing?.creditsRemaining ?? 0) + body.delta);
  const row = await prisma.entitlementCredit.upsert({
    where: {
      entitlementId_moduleId: { entitlementId: entitlement.id, moduleId: body.moduleId },
    },
    create: {
      entitlementId: entitlement.id,
      moduleId: body.moduleId,
      creditsRemaining: nextValue,
    },
    update: { creditsRemaining: nextValue },
    include: { module: { select: { id: true, key: true } } },
  });

  return {
    entitlementId: entitlement.id,
    moduleId: row.moduleId,
    moduleKey: row.module.key,
    creditsRemaining: row.creditsRemaining,
  };
}
