/**
 * Point unique pour types Prisma (`ScenarioWhereInput`, etc.).
 * Le service métier importe depuis ce fichier — pas depuis `@prisma/client` directement.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type ScenarioWhereInput = Prisma.ScenarioWhereInput;
export type ScenarioInclude = Prisma.ScenarioInclude;
export type ScenarioGoalUpdateInput = Prisma.ScenarioGoalUpdateInput;
export type ScenarioVocabularyUpdateInput = Prisma.ScenarioVocabularyUpdateInput;

export type ScenarioBase = NonNullable<
  Awaited<ReturnType<typeof prisma.scenario.findUnique>>
>;

export type ScenarioGoalRow = NonNullable<
  Awaited<ReturnType<typeof prisma.scenarioGoal.findUnique>>
>;

export type ScenarioVocabRow = NonNullable<
  Awaited<ReturnType<typeof prisma.scenarioVocabulary.findUnique>>
>;

/** Row liste/détail avec includes optionnels pour `mapScenarioToApiItem`. */
export type ScenarioMappedSource = ScenarioBase & {
  _count?: { goals: number; vocabulary: number };
  goals?: ScenarioGoalRow[];
  vocabulary?: ScenarioVocabRow[];
};

// --- B2B ---------------------------------------------------------------------

export type B2bModuleWhereInput = Prisma.B2bModuleWhereInput;
export type ModulePackWhereInput = Prisma.ModulePackWhereInput;
export type CompanyWhereInput = Prisma.CompanyWhereInput;
export type CohortWhereInput = Prisma.CohortWhereInput;
export type CompanyLearnerWhereInput = Prisma.CompanyLearnerWhereInput;
export type B2bAssignmentWhereInput = Prisma.B2bAssignmentWhereInput;
export type PartnerUserWhereInput = Prisma.PartnerUserWhereInput;
export type PurchaseOrderWhereInput = Prisma.PurchaseOrderWhereInput;
export type CompanyCertificateWhereInput = Prisma.CompanyCertificateWhereInput;
export type CompanyReportWhereInput = Prisma.CompanyReportWhereInput;
export type TransactionClient = Prisma.TransactionClient;

export type B2bModuleRow = NonNullable<
  Awaited<ReturnType<typeof prisma.b2bModule.findUnique>>
>;

export type ModulePackRow = NonNullable<
  Awaited<ReturnType<typeof prisma.modulePack.findUnique>>
>;

export type ModulePackItemRow = NonNullable<
  Awaited<ReturnType<typeof prisma.modulePackItem.findUnique>>
>;

export type CompanyRow = NonNullable<Awaited<ReturnType<typeof prisma.company.findUnique>>>;

export type CohortRow = NonNullable<Awaited<ReturnType<typeof prisma.cohort.findUnique>>>;

export type CompanyLearnerRow = NonNullable<
  Awaited<ReturnType<typeof prisma.companyLearner.findUnique>>
>;

export type B2bAssignmentRow = NonNullable<
  Awaited<ReturnType<typeof prisma.b2bAssignment.findUnique>>
>;

export type PartnerUserRow = NonNullable<
  Awaited<ReturnType<typeof prisma.partnerUser.findUnique>>
>;

export type CompanyEntitlementRow = NonNullable<
  Awaited<ReturnType<typeof prisma.companyEntitlement.findUnique>>
>;

export type EntitlementCreditRow = NonNullable<
  Awaited<ReturnType<typeof prisma.entitlementCredit.findUnique>>
>;

export type PurchaseOrderRow = NonNullable<
  Awaited<ReturnType<typeof prisma.purchaseOrder.findUnique>>
>;
