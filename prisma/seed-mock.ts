/**
 * Mock account seeder — creates 5 loginable test scholars + 1 sample team.
 *
 * Run against the live Render DB:
 *   DATABASE_URL="<render-postgres-url>" npx tsx prisma/seed-mock.ts
 *
 * All accounts use password: nivarro123
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

const PASSWORD = "nivarro123";

// ─── Mock account definitions ────────────────────────────────────────────────

const ACCOUNTS = [
  {
    email: "alex@nivarro.test",
    name: "Alex Rivera",
    handle: "alexrivera",
    headline: "Builder & Systems Thinker",
    bio: "I build platforms that help ambitious people find each other and do serious work. Happiest when I'm shipping something that didn't exist last week.",
    strengthSummary: "Sees patterns across complex systems and translates vision into executable plans quickly. High output, strong judgment.",
    geniusType: "DYNAMO" as const,
    grade: 11,
    schoolName: "Stuyvesant High School",
    interests: ["Software Engineering", "Startups", "Systems Design", "AI / ML"],
    currentFocus: "Building tools that reduce friction between ambitious people",
    traits: ["visionary", "analytical", "decisive", "self-starter", "problem-solver"],
  },
  {
    email: "sam@nivarro.test",
    name: "Sam Chen",
    handle: "samchen",
    headline: "Team Builder & People Leader",
    bio: "The best products come from teams that genuinely understand each other. I focus on building those teams.",
    strengthSummary: "Exceptional at aligning teams and keeping morale high without losing momentum. Makes everyone around them sharper.",
    geniusType: "BLAZE" as const,
    grade: 12,
    schoolName: "Phillips Exeter Academy",
    interests: ["Leadership", "Psychology", "Community Building", "Film & Media"],
    currentFocus: "Studying how high-performing teams form and sustain themselves",
    traits: ["charismatic", "motivator", "empathetic", "storyteller", "cooperative"],
  },
  {
    email: "jordan@nivarro.test",
    name: "Jordan Park",
    handle: "jordanpark",
    headline: "Operations & Execution Lead",
    bio: "I turn ambitious plans into running systems. Give me a goal and a deadline and I'll build the infrastructure in between.",
    strengthSummary: "Unmatched at building operational backbone. The reason complex projects don't fall apart.",
    geniusType: "TEMPO" as const,
    grade: 10,
    schoolName: "Thomas Jefferson High School for Science and Technology",
    interests: ["Engineering", "Productivity Systems", "Research", "Science"],
    currentFocus: "Designing repeatable workflows for student-led research projects",
    traits: ["organized", "reliable", "disciplined", "systematic", "detail-oriented"],
  },
  {
    email: "morgan@nivarro.test",
    name: "Morgan Lee",
    handle: "morganlee",
    headline: "Data Researcher & Analytical Strategist",
    bio: "I find the signal in the noise. Give me a messy dataset or a broken process and I'll have a framework by Friday.",
    strengthSummary: "Exceptional analytical depth with clear communication. Makes complex findings accessible without losing precision.",
    geniusType: "STEEL" as const,
    grade: 11,
    schoolName: "BASIS Scottsdale",
    interests: ["Data Science", "Behavioral Economics", "Public Policy", "Mathematics"],
    currentFocus: "Researching how recommendation algorithms affect student opportunity access",
    traits: ["analytical", "critical-thinker", "objective", "strategic", "curious"],
    isFirstGen: true,
  },
  {
    email: "riley@nivarro.test",
    name: "Riley Walsh",
    handle: "rileywalsh",
    headline: "Creative Strategist & Product Thinker",
    bio: "I think in narratives and design in systems. Interested in the overlap between UX, storytelling, and behavior.",
    strengthSummary: "Rare combination of creative instinct and structured thinking. Brings visual and narrative clarity to teams.",
    geniusType: "DYNAMO" as const,
    grade: 12,
    schoolName: "School of the Arts, San Francisco",
    interests: ["UX Design", "Brand Strategy", "Writing", "Social Science"],
    currentFocus: "Redesigning how students discover and evaluate opportunities",
    traits: ["creative", "innovative", "storyteller", "conceptual-thinker", "adaptable"],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Hashing password...");
  const pw = await bcrypt.hash(PASSWORD, 10);

  const profileIds: Record<string, string> = {};

  for (const acct of ACCOUNTS) {
    console.log(`Creating ${acct.name} (${acct.email})...`);

    const user = await prisma.user.upsert({
      where: { email: acct.email },
      update: { passwordHash: pw },
      create: { email: acct.email, name: acct.name, passwordHash: pw },
    });

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        onboardingComplete: true,
        handle: acct.handle,
        geniusType: acct.geniusType,
        currentFocus: acct.currentFocus ?? null,
      },
      create: {
        userId: user.id,
        displayName: acct.name,
        handle: acct.handle,
        headline: acct.headline,
        bio: acct.bio,
        strengthSummary: acct.strengthSummary,
        geniusType: acct.geniusType,
        grade: acct.grade,
        schoolName: acct.schoolName,
        interests: JSON.stringify(acct.interests),
        currentFocus: acct.currentFocus ?? null,
        isFirstGen: (acct as { isFirstGen?: boolean }).isFirstGen ?? false,
        onboardingComplete: true,
      },
    });

    profileIds[acct.handle] = profile.id;

    // Traits
    const traits = await prisma.trait.findMany({
      where: { slug: { in: acct.traits } },
    });
    for (let i = 0; i < traits.length; i++) {
      await prisma.profileTrait.upsert({
        where: { profileId_traitId: { profileId: profile.id, traitId: traits[i].id } },
        update: {},
        create: { profileId: profile.id, traitId: traits[i].id, order: i },
      });
    }
    console.log(`  ✓ ${profile.displayName} — ${acct.geniusType} — ${traits.length} traits`);
  }

  // ── Sample team: Alex + Sam ───────────────────────────────────────────────
  console.log("\nCreating sample team...");
  const alexUser = await prisma.user.findUnique({ where: { email: "alex@nivarro.test" } });
  const existingTeam = await prisma.team.findFirst({
    where: { name: "Watershed Project", createdById: alexUser!.id },
  });

  if (!existingTeam) {
    const team = await prisma.team.create({
      data: {
        name: "Watershed Project",
        description: "Building a data-driven tool to surface hidden academic opportunity gaps for first-gen students.",
        status: "ACTIVE",
        createdById: alexUser!.id,
      },
    });

    await prisma.teamMember.createMany({
      data: [
        { teamId: team.id, profileId: profileIds["alexrivera"], role: "ADMIN" },
        { teamId: team.id, profileId: profileIds["samchen"], role: "MEMBER" },
      ],
      skipDuplicates: true,
    });

    // Team conversation
    await prisma.conversation.create({
      data: {
        type: "TEAM",
        teamId: team.id,
        participants: {
          create: [
            { userId: alexUser!.id },
            { userId: (await prisma.user.findUnique({ where: { email: "sam@nivarro.test" } }))!.id },
          ],
        },
        messages: {
          create: [
            {
              senderId: alexUser!.id,
              content: "Hey Sam — let's scope this out. I'm thinking we start with the data collection layer first before touching the frontend.",
            },
          ],
        },
      },
    });

    console.log("  ✓ Team 'Watershed Project' created with Alex + Sam");
  } else {
    console.log("  Team already exists — skipping");
  }

  console.log("\n✅ Mock seed complete\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Password for all accounts: nivarro123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  alex@nivarro.test    → Alex Rivera  (DYNAMO)  grade 11");
  console.log("  sam@nivarro.test     → Sam Chen     (BLAZE)   grade 12");
  console.log("  jordan@nivarro.test  → Jordan Park  (TEMPO)   grade 10");
  console.log("  morgan@nivarro.test  → Morgan Lee   (STEEL)   grade 11");
  console.log("  riley@nivarro.test   → Riley Walsh  (DYNAMO)  grade 12");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
