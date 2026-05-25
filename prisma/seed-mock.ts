/**
 * Mock seeder — 5 fresh scholars + Watershed Initiative as official org/project.
 * Accounts have NO genius type, NO traits, NO teams — truly just started.
 *
 * Run: DATABASE_URL="<render-postgres-url>" npx tsx prisma/seed-mock.ts
 * Password: nivarro123
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

const ACCOUNTS = [
  { email: "alex@nivarro.test",   name: "Alex Rivera", handle: "alexrivera",  headline: "Builder & Systems Thinker",              bio: "I build platforms that help ambitious people find each other." },
  { email: "sam@nivarro.test",    name: "Sam Chen",    handle: "samchen",     headline: "Team Builder & People Leader",            bio: "The best products come from teams that genuinely understand each other." },
  { email: "jordan@nivarro.test", name: "Jordan Park", handle: "jordanpark",  headline: "Operations & Execution Lead",             bio: "I turn ambitious plans into running systems." },
  { email: "morgan@nivarro.test", name: "Morgan Lee",  handle: "morganlee",   headline: "Data Researcher & Analytical Strategist", bio: "I find the signal in the noise." },
  { email: "riley@nivarro.test",  name: "Riley Walsh", handle: "rileywalsh",  headline: "Creative Strategist & Product Thinker",   bio: "I think in narratives and design in systems." },
];

async function main() {
  console.log("Hashing password...");
  const pw = await bcrypt.hash(PASSWORD, 10);

  // 1. Reset all accounts to fresh state
  for (const acct of ACCOUNTS) {
    console.log(`Resetting ${acct.name}...`);

    const user = await prisma.user.upsert({
      where: { email: acct.email },
      update: { passwordHash: pw },
      create: { email: acct.email, name: acct.name, passwordHash: pw },
    });

    const existing = await prisma.profile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (existing) {
      await prisma.profileTrait.deleteMany({ where: { profileId: existing.id } });
      await prisma.teamMember.deleteMany({ where: { profileId: existing.id } });
    }

    await prisma.profile.upsert({
      where: { userId: user.id },
      update: {
        displayName: acct.name,
        handle: acct.handle,
        headline: acct.headline,
        bio: acct.bio,
        geniusType: null,
        secondaryGeniusType: null,
        currentFocus: null,
        onboardingComplete: false,
      },
      create: {
        userId: user.id,
        displayName: acct.name,
        handle: acct.handle,
        headline: acct.headline,
        bio: acct.bio,
        onboardingComplete: false,
      },
    });

    console.log(`  OK ${acct.name} — no type / no traits / no teams`);
  }

  // 2. Watershed Initiative — official org + project + opportunity listing
  console.log("\nCreating Watershed Initiative...");
  const creator = await prisma.user.findUnique({ where: { email: "alex@nivarro.test" } });

  const org = await prisma.org.upsert({
    where: { id: "mock-watershed-org" } as never,
    update: {
      name: "Watershed Initiative",
      tagline: "Closing the academic opportunity gap through data and technology.",
      description: "Watershed Initiative partners with student teams to build data tools exposing hidden opportunity gaps in college admissions and academic access. Our work directly informs policy and helps first-generation students find paths they never knew existed.",
      whatWeSeek: "Teams with at least one analyst and one builder. Someone who can read data and someone who can ship product. Strong communicators a plus.",
      category: "RESEARCH",
      status: "OPEN",
      accentColor: "#3B82F6",
      logoLetter: "W",
      logoBg: "#0D1F35",
      logoColor: "#3B82F6",
      minTeamSize: 2,
      maxTeamSize: 4,
      gradeEligibility: "9,10,11,12",
      format: "Remote",
      founded: "2021",
      orgType: "Nonprofit Research Program",
      values: JSON.stringify(["Equity", "Rigor", "Access", "Impact"]),
      focusTags: JSON.stringify(["Data Science", "Public Policy", "EdTech", "Research"]),
      memberCount: 14,
    },
    create: {
      id: "mock-watershed-org",
      name: "Watershed Initiative",
      tagline: "Closing the academic opportunity gap through data and technology.",
      description: "Watershed Initiative partners with student teams to build data tools exposing hidden opportunity gaps in college admissions and academic access. Our work directly informs policy and helps first-generation students find paths they never knew existed.",
      whatWeSeek: "Teams with at least one analyst and one builder. Someone who can read data and someone who can ship product. Strong communicators a plus.",
      category: "RESEARCH",
      status: "OPEN",
      accentColor: "#3B82F6",
      logoLetter: "W",
      logoBg: "#0D1F35",
      logoColor: "#3B82F6",
      minTeamSize: 2,
      maxTeamSize: 4,
      gradeEligibility: "9,10,11,12",
      format: "Remote",
      founded: "2021",
      orgType: "Nonprofit Research Program",
      values: JSON.stringify(["Equity", "Rigor", "Access", "Impact"]),
      focusTags: JSON.stringify(["Data Science", "Public Policy", "EdTech", "Research"]),
      memberCount: 14,
      createdById: creator!.id,
    },
  });

  console.log("  OK Org: Watershed Initiative");

  await prisma.orgProject.upsert({
    where: { id: "mock-watershed-project" } as never,
    update: {
      title: "Academic Opportunity Gap Tracker",
      shortDescription: "Build a data tool that surfaces hidden opportunity gaps for first-gen students.",
      description: "Design and ship v1 of a recommendation tool that maps academic programs, competitions, and internships to underrepresented zip codes. Help counselors and students see what is available that they are currently missing.",
      fullDescription: "10-week remote project. Three phases: data collection (scraping and cleaning public datasets), gap analysis (scoring model to identify access deserts), and a counselor-facing dashboard. We provide mentorship, weekly check-ins with our research director, and letters of recommendation for all completing members.",
      openSpots: 3,
      requiredSkills: JSON.stringify(["Data Analysis", "Python", "Research", "Communication"]),
      preferredGeniusTypes: JSON.stringify(["STEEL", "DYNAMO", "TEMPO"]),
      roles: JSON.stringify(["Data Lead", "Product Builder", "Research Writer"]),
      hoursPerWeek: "8-12 hrs",
      duration: "10 weeks",
      format: "Remote",
      status: "OPEN",
    },
    create: {
      id: "mock-watershed-project",
      orgId: org.id,
      title: "Academic Opportunity Gap Tracker",
      shortDescription: "Build a data tool that surfaces hidden opportunity gaps for first-gen students.",
      description: "Design and ship v1 of a recommendation tool that maps academic programs, competitions, and internships to underrepresented zip codes. Help counselors and students see what is available that they are currently missing.",
      fullDescription: "10-week remote project. Three phases: data collection (scraping and cleaning public datasets), gap analysis (scoring model to identify access deserts), and a counselor-facing dashboard. We provide mentorship, weekly check-ins with our research director, and letters of recommendation for all completing members.",
      openSpots: 3,
      requiredSkills: JSON.stringify(["Data Analysis", "Python", "Research", "Communication"]),
      preferredGeniusTypes: JSON.stringify(["STEEL", "DYNAMO", "TEMPO"]),
      roles: JSON.stringify(["Data Lead", "Product Builder", "Research Writer"]),
      hoursPerWeek: "8-12 hrs",
      duration: "10 weeks",
      format: "Remote",
      status: "OPEN",
    },
  });

  console.log("  OK Project: Academic Opportunity Gap Tracker (open)");

  await prisma.opportunity.upsert({
    where: { id: "mock-watershed-opp" } as never,
    update: {
      title: "Research Team — Opportunity Gap Tracker",
      description: "10-week remote project. Build a data tool mapping academic access gaps for first-gen students. Roles: Data Lead, Product Builder, Research Writer. All grades welcome.",
      category: "RESEARCH",
      isRemote: true,
      gradeEligibility: "9,10,11,12",
    },
    create: {
      id: "mock-watershed-opp",
      orgId: org.id,
      title: "Research Team — Opportunity Gap Tracker",
      description: "10-week remote project. Build a data tool mapping academic access gaps for first-gen students. Roles: Data Lead, Product Builder, Research Writer. All grades welcome.",
      category: "RESEARCH",
      isRemote: true,
      gradeEligibility: "9,10,11,12",
    },
  });

  console.log("  OK Opportunity listing visible in dashboard feed");
  console.log("\nSeed complete. Password: nivarro123");
  console.log("alex / sam / jordan / morgan / riley -- fresh, no type/traits/teams");
  console.log("Watershed Initiative -- open org, project accepting applications");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
