/**
 * Seed B2B idempotent — 5 modules, les packs du catalogue, une entreprise de
 * démo, ses cohortes et un `PartnerUser` `org_admin` capable de se connecter au
 * portail.
 *
 * Usage: DATABASE_URL=... bun run seed:b2b
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const companySlug = process.env.SEED_B2B_COMPANY_SLUG ?? "binne";
const partnerEmail = process.env.SEED_B2B_PARTNER_EMAIL ?? "marie@binne.ci";
const partnerPassword = process.env.SEED_B2B_PARTNER_PASSWORD ?? "changeme123";

const MODULES = [
  { key: "scenario", name: { fr: "Scénarios", en: "Scenarios" }, icon: "MessagesSquare" },
  { key: "diary", name: { fr: "Journal vocal", en: "Voice diary" }, icon: "BookOpen" },
  { key: "interpreter", name: { fr: "The Interpreter", en: "The Interpreter" }, icon: "Languages" },
  {
    key: "listening_story",
    name: { fr: "Histoires à écouter", en: "Listening stories" },
    icon: "Headphones",
  },
  { key: "review_game", name: { fr: "Jeux de révision", en: "Review games" }, icon: "Gamepad2" },
] as const;

type PackSeed = {
  slug: string;
  name: string;
  tagline: string;
  tier: "base" | "addon" | "boost";
  billingPeriod: "monthly" | "quarterly" | "one_time";
  priceFcfa: number;
  priceUsdCents: number;
  badge: "popular" | "included_in_plan" | "new" | null;
  features: string[];
  credits: Record<string, number>;
};

const PACKS: PackSeed[] = [
  {
    slug: "practice-pack",
    name: "Practice Pack",
    tagline: "Le socle pédagogique Nomi pour vos promotions",
    tier: "base",
    billingPeriod: "monthly",
    priceFcfa: 0,
    priceUsdCents: 0,
    badge: "included_in_plan",
    features: [
      "Scénarios conversation assignables",
      "Nomi Diary — routine quotidienne",
      "Jeux de révision automatiques",
      "Accès org-wide pour tous les apprenants",
    ],
    credits: { scenario: 900, diary: 300, review_game: 150 },
  },
  {
    slug: "interpreter-pro",
    name: "Interpreter Pro",
    tagline: "Médiation et accueil client en situation réelle",
    tier: "addon",
    billingPeriod: "monthly",
    priceFcfa: 45_000,
    priceUsdCents: 6_900,
    badge: "popular",
    features: [
      "Module The Interpreter débloqué",
      "50 sessions / mois pour l'organisation",
      "Devoirs médiation & accueil",
      "Suivi objectifs par apprenant",
    ],
    credits: { interpreter: 50 },
  },
  {
    slug: "listening-premium",
    name: "Listening Premium",
    tagline: "Écoute active et compréhension avant le cours",
    tier: "addon",
    billingPeriod: "monthly",
    priceFcfa: 35_000,
    priceUsdCents: 5_500,
    badge: null,
    features: [
      "Bibliothèque histoires audio",
      "120 sessions écoute / mois",
      "Questions compréhension",
      "Assignation par cohorte",
    ],
    credits: { listening_story: 120 },
  },
  {
    slug: "diary-boost",
    name: "Diary Boost",
    tagline: "+100 sessions journal vocal pour l'organisation",
    tier: "boost",
    billingPeriod: "one_time",
    priceFcfa: 12_000,
    priceUsdCents: 1_800,
    badge: null,
    features: [
      "Recharge immédiate des crédits diary",
      "Équivalent 10 packs Extra B2C",
      "Valable jusqu'à épuisement",
      "Idéal pics d'activité avant examen",
    ],
    credits: { diary: 100 },
  },
  {
    slug: "full-nomi-suite",
    name: "Full Nomi Suite",
    tagline: "Les 5 modules Nomi avec crédits généreux",
    tier: "addon",
    billingPeriod: "quarterly",
    priceFcfa: 95_000,
    priceUsdCents: 14_500,
    badge: "popular",
    features: [
      "Tous les modules Nomi débloqués",
      "Crédits sessions trimestriels",
      "Priorité support formateur",
      "Rapport ROI trimestriel inclus",
    ],
    credits: {
      scenario: 1200,
      diary: 400,
      interpreter: 80,
      listening_story: 160,
      review_game: 200,
    },
  },
];

const COHORTS = [
  { name: "Promo Hôtellerie 2026", inviteCode: "BINNE-HOTEL-26", seatLimit: 20, monthsAhead: 3 },
  { name: "Promo Commerce 2026", inviteCode: "BINNE-COM-26", seatLimit: 20, monthsAhead: 5 },
];

function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  const moduleIdByKey = new Map<string, string>();
  for (const [index, mod] of MODULES.entries()) {
    const row = await prisma.b2bModule.upsert({
      where: { key: mod.key },
      create: { key: mod.key, name: mod.name, icon: mod.icon, sortOrder: index },
      update: { name: mod.name, icon: mod.icon, sortOrder: index },
    });
    moduleIdByKey.set(mod.key, row.id);
  }
  console.log(`[seed:b2b] modules: ${moduleIdByKey.size}`);

  const packIdBySlug = new Map<string, string>();
  for (const pack of PACKS) {
    const { credits, ...data } = pack;
    const row = await prisma.modulePack.upsert({
      where: { slug: pack.slug },
      create: data,
      update: data,
    });
    packIdBySlug.set(pack.slug, row.id);

    for (const [key, sessionCredits] of Object.entries(credits)) {
      const moduleId = moduleIdByKey.get(key);
      if (!moduleId) throw new Error(`Module inconnu dans le pack ${pack.slug}: ${key}`);
      await prisma.modulePackItem.upsert({
        where: { packId_moduleId: { packId: row.id, moduleId } },
        create: { packId: row.id, moduleId, sessionCredits },
        update: { sessionCredits },
      });
    }
  }
  console.log(`[seed:b2b] packs: ${packIdBySlug.size}`);

  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    create: {
      name: "Binne Training",
      slug: companySlug,
      orgType: "training_center",
      plan: "center",
      seatLimit: 40,
      apiQuotaMonth: 5000,
      timezone: "Africa/Abidjan",
      renewalDate: monthsFromNow(12),
    },
    update: {},
  });
  console.log(`[seed:b2b] company: ${company.slug} (${company.id})`);

  for (const cohort of COHORTS) {
    await prisma.cohort.upsert({
      where: { inviteCode: cohort.inviteCode },
      create: {
        companyId: company.id,
        name: cohort.name,
        inviteCode: cohort.inviteCode,
        startDate: new Date(),
        endDate: monthsFromNow(cohort.monthsAhead),
        seatLimit: cohort.seatLimit,
        status: "active",
      },
      update: { name: cohort.name, seatLimit: cohort.seatLimit },
    });
  }
  console.log(`[seed:b2b] cohortes: ${COHORTS.length}`);

  const passwordHash = await Bun.password.hash(partnerPassword, {
    algorithm: "bcrypt",
    cost: 10,
  });
  const partner = await prisma.partnerUser.upsert({
    where: { email: partnerEmail },
    create: {
      companyId: company.id,
      email: partnerEmail,
      passwordHash,
      displayName: "Marie Kouassi",
      portalRole: "org_admin",
      status: "active",
    },
    update: { passwordHash, portalRole: "org_admin", status: "active" },
  });
  console.log(`[seed:b2b] partner: ${partner.email} (${partner.portalRole})`);

  // Le pack de base est inclus dans le plan : entitlement accordé sans paiement.
  const basePackId = packIdBySlug.get("practice-pack");
  if (basePackId) {
    const existing = await prisma.companyEntitlement.findFirst({
      where: { companyId: company.id, packId: basePackId },
    });
    const entitlement =
      existing ??
      (await prisma.companyEntitlement.create({
        data: {
          companyId: company.id,
          packId: basePackId,
          status: "active",
          purchasedAt: new Date(),
          expiresAt: monthsFromNow(12),
        },
      }));

    for (const [key, sessionCredits] of Object.entries(
      PACKS.find((p) => p.slug === "practice-pack")!.credits
    )) {
      const moduleId = moduleIdByKey.get(key)!;
      await prisma.entitlementCredit.upsert({
        where: { entitlementId_moduleId: { entitlementId: entitlement.id, moduleId } },
        create: { entitlementId: entitlement.id, moduleId, creditsRemaining: sessionCredits },
        update: {},
      });
    }
    console.log(`[seed:b2b] entitlement practice-pack: ${entitlement.id}`);
  }

  console.log("[seed:b2b] OK");
}

main()
  .catch((e) => {
    console.error("[seed:b2b]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
