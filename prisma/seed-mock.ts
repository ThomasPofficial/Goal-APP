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

  // ── 3. Reset algorithm quotas so mock accounts can use teammate finder ─────
  console.log("\nResetting algorithm quotas...");
  const profiles = await prisma.profile.findMany({
    where: { handle: { in: ["alexrivera", "samchen", "jordanpark", "morganlee", "rileywalsh"] } },
    select: { id: true },
  });
  for (const p of profiles) {
    await prisma.algorithmQuota.deleteMany({ where: { profileId: p.id } });
  }
  console.log(`  OK Cleared quotas for ${profiles.length} profiles`);

  // ── 4. Apex Founders Fellowship ───────────────────────────────────────────
  console.log("\nCreating Apex Founders Fellowship...");

  const apexOrg = await prisma.org.upsert({
    where: { id: "mock-apex-org" } as never,
    update: {
      name: "Apex Founders Fellowship",
      tagline: "Turning ambitious students into first-time founders.",
      description: "Apex is a 12-week fellowship that takes high school and college students from idea to launched product. We do not want students who want to learn about startups. We want students who are already building and need the network, capital access, and mentorship to go further. Fellows ship real products, pitch real investors, and leave with real traction.",
      whatWeSeek: "Builders who have already started something — a project, a tool, a business, anything. We want proof of motion, not just potential.",
      category: "ACCELERATOR",
      status: "OPEN",
      accentColor: "#F59E0B",
      logoLetter: "A",
      logoBg: "#1C1408",
      logoColor: "#F59E0B",
      minTeamSize: 1,
      maxTeamSize: 3,
      gradeEligibility: "10,11,12",
      format: "Hybrid",
      founded: "2020",
      orgType: "Student Startup Accelerator",
      values: JSON.stringify(["Execution", "Ambition", "Ownership", "Speed"]),
      focusTags: JSON.stringify(["Startups", "Product", "Entrepreneurship", "Venture"]),
      memberCount: 8,
      stipend: "$2,000 equity-free grant",
    },
    create: {
      id: "mock-apex-org",
      name: "Apex Founders Fellowship",
      tagline: "Turning ambitious students into first-time founders.",
      description: "Apex is a 12-week fellowship that takes high school and college students from idea to launched product. We do not want students who want to learn about startups. We want students who are already building and need the network, capital access, and mentorship to go further. Fellows ship real products, pitch real investors, and leave with real traction.",
      whatWeSeek: "Builders who have already started something — a project, a tool, a business, anything. We want proof of motion, not just potential.",
      category: "ACCELERATOR",
      status: "OPEN",
      accentColor: "#F59E0B",
      logoLetter: "A",
      logoBg: "#1C1408",
      logoColor: "#F59E0B",
      minTeamSize: 1,
      maxTeamSize: 3,
      gradeEligibility: "10,11,12",
      format: "Hybrid",
      founded: "2020",
      orgType: "Student Startup Accelerator",
      values: JSON.stringify(["Execution", "Ambition", "Ownership", "Speed"]),
      focusTags: JSON.stringify(["Startups", "Product", "Entrepreneurship", "Venture"]),
      memberCount: 8,
      stipend: "$2,000 equity-free grant",
      createdById: creator!.id,
    },
  });

  await prisma.orgProject.upsert({
    where: { id: "mock-apex-project" } as never,
    update: {
      title: "Cohort 5 — Founder Teams",
      shortDescription: "12-week program to take your product from idea to launch with mentorship and a $2k grant.",
      description: "We accept teams of 1-3 founders with a product idea they are ready to sprint on. Over 12 weeks you get weekly founder coaching, access to our investor network, product reviews from operators at top companies, and a demo day with real funding on the table.",
      fullDescription: "Apex Cohort 5 runs June through August. Teams meet twice a week via Zoom and once per month in person (NYC or LA). Accepted teams receive a $2,000 equity-free grant on day one. By demo day, every team will have a live product, real users, and a pitch deck reviewed by our network of 40+ early-stage investors. We have had 11 fellows go on to raise pre-seed rounds. We do not care what school you go to.",
      openSpots: 6,
      requiredSkills: JSON.stringify(["Product Thinking", "Execution", "Communication", "Adaptability"]),
      roles: JSON.stringify(["Founder", "Co-Founder", "Technical Co-Founder"]),
      hoursPerWeek: "15-20 hrs",
      duration: "12 weeks",
      format: "Hybrid",
      status: "OPEN",
    },
    create: {
      id: "mock-apex-project",
      orgId: apexOrg.id,
      title: "Cohort 5 — Founder Teams",
      shortDescription: "12-week program to take your product from idea to launch with mentorship and a $2k grant.",
      description: "We accept teams of 1-3 founders with a product idea they are ready to sprint on. Over 12 weeks you get weekly founder coaching, access to our investor network, product reviews from operators at top companies, and a demo day with real funding on the table.",
      fullDescription: "Apex Cohort 5 runs June through August. Teams meet twice a week via Zoom and once per month in person (NYC or LA). Accepted teams receive a $2,000 equity-free grant on day one. By demo day, every team will have a live product, real users, and a pitch deck reviewed by our network of 40+ early-stage investors. We have had 11 fellows go on to raise pre-seed rounds. We do not care what school you go to.",
      openSpots: 6,
      requiredSkills: JSON.stringify(["Product Thinking", "Execution", "Communication", "Adaptability"]),
      roles: JSON.stringify(["Founder", "Co-Founder", "Technical Co-Founder"]),
      hoursPerWeek: "15-20 hrs",
      duration: "12 weeks",
      format: "Hybrid",
      status: "OPEN",
    },
  });

  await prisma.opportunity.upsert({
    where: { id: "mock-apex-opp" } as never,
    update: {
      title: "Apex Founders Fellowship — Cohort 5",
      description: "12-week accelerator for student builders ready to launch. $2k equity-free grant on acceptance. Real mentors, real investors, demo day. Grades 10-12.",
      category: "ACCELERATOR",
      isRemote: false,
      gradeEligibility: "10,11,12",
    },
    create: {
      id: "mock-apex-opp",
      orgId: apexOrg.id,
      title: "Apex Founders Fellowship — Cohort 5",
      description: "12-week accelerator for student builders ready to launch. $2k equity-free grant on acceptance. Real mentors, real investors, demo day. Grades 10-12.",
      category: "ACCELERATOR",
      isRemote: false,
      gradeEligibility: "10,11,12",
    },
  });

  console.log("  OK Apex Founders Fellowship — Cohort 5");

  // ── 5. Bridgepoint Policy Fellowship ──────────────────────────────────────
  console.log("Creating Bridgepoint Policy Fellowship...");

  const bridgeOrg = await prisma.org.upsert({
    where: { id: "mock-bridge-org" } as never,
    update: {
      name: "Bridgepoint Policy Fellows",
      tagline: "Putting the next generation of policy thinkers inside the rooms that matter.",
      description: "Bridgepoint places high school and college students inside government offices, think tanks, and advocacy organizations as embedded research fellows. You are not there to observe. You are there to contribute. Fellows produce real policy memos, legislative briefs, and public-facing reports that staff actually use. Past fellows have been cited in congressional testimony and published in national outlets.",
      whatWeSeek: "Writers and analysts who understand that good policy is really just good argument backed by evidence. Strong research skills required. Interest in economics, law, or public affairs preferred.",
      category: "FELLOWSHIP",
      status: "OPEN",
      accentColor: "#6366F1",
      logoLetter: "B",
      logoBg: "#0F0F2E",
      logoColor: "#6366F1",
      minTeamSize: 1,
      maxTeamSize: 2,
      gradeEligibility: "11,12",
      format: "Remote",
      founded: "2019",
      orgType: "Policy Research Fellowship",
      values: JSON.stringify(["Rigor", "Clarity", "Civic Responsibility", "Impact"]),
      focusTags: JSON.stringify(["Public Policy", "Law", "Economics", "Government", "Research"]),
      memberCount: 22,
      stipend: "$500 research stipend",
    },
    create: {
      id: "mock-bridge-org",
      name: "Bridgepoint Policy Fellows",
      tagline: "Putting the next generation of policy thinkers inside the rooms that matter.",
      description: "Bridgepoint places high school and college students inside government offices, think tanks, and advocacy organizations as embedded research fellows. You are not there to observe. You are there to contribute. Fellows produce real policy memos, legislative briefs, and public-facing reports that staff actually use. Past fellows have been cited in congressional testimony and published in national outlets.",
      whatWeSeek: "Writers and analysts who understand that good policy is really just good argument backed by evidence. Strong research skills required. Interest in economics, law, or public affairs preferred.",
      category: "FELLOWSHIP",
      status: "OPEN",
      accentColor: "#6366F1",
      logoLetter: "B",
      logoBg: "#0F0F2E",
      logoColor: "#6366F1",
      minTeamSize: 1,
      maxTeamSize: 2,
      gradeEligibility: "11,12",
      format: "Remote",
      founded: "2019",
      orgType: "Policy Research Fellowship",
      values: JSON.stringify(["Rigor", "Clarity", "Civic Responsibility", "Impact"]),
      focusTags: JSON.stringify(["Public Policy", "Law", "Economics", "Government", "Research"]),
      memberCount: 22,
      stipend: "$500 research stipend",
      createdById: creator!.id,
    },
  });

  await prisma.orgProject.upsert({
    where: { id: "mock-bridge-project" } as never,
    update: {
      title: "Economic Mobility Research Track",
      shortDescription: "Embedded fellowship producing real policy research on economic mobility and access.",
      description: "Fellows are matched with a partner organization (think tank, congressional office, or advocacy nonprofit) and spend 8 weeks producing a publishable research brief on a topic at the intersection of economic mobility, education access, or workforce policy. Your work goes out under your name.",
      fullDescription: "The Economic Mobility track focuses on the structural barriers that prevent talented young people from accessing economic opportunity — the exact problem Bridgepoint was built to fight. Fellows meet weekly with a senior research mentor, have access to our full dataset library, and receive editorial support before publication. Top fellows are invited to present findings at our annual Policy Forum in DC. Past outputs have included a brief on Pell Grant expansion cited in Senate committee discussions, and an analysis of vocational credentialing gaps featured in The 74.",
      openSpots: 4,
      requiredSkills: JSON.stringify(["Research", "Writing", "Data Analysis", "Critical Thinking"]),
      roles: JSON.stringify(["Lead Researcher", "Research Partner"]),
      hoursPerWeek: "10-14 hrs",
      duration: "8 weeks",
      format: "Remote",
      status: "OPEN",
    },
    create: {
      id: "mock-bridge-project",
      orgId: bridgeOrg.id,
      title: "Economic Mobility Research Track",
      shortDescription: "Embedded fellowship producing real policy research on economic mobility and access.",
      description: "Fellows are matched with a partner organization (think tank, congressional office, or advocacy nonprofit) and spend 8 weeks producing a publishable research brief on a topic at the intersection of economic mobility, education access, or workforce policy. Your work goes out under your name.",
      fullDescription: "The Economic Mobility track focuses on the structural barriers that prevent talented young people from accessing economic opportunity — the exact problem Bridgepoint was built to fight. Fellows meet weekly with a senior research mentor, have access to our full dataset library, and receive editorial support before publication. Top fellows are invited to present findings at our annual Policy Forum in DC. Past outputs have included a brief on Pell Grant expansion cited in Senate committee discussions, and an analysis of vocational credentialing gaps featured in The 74.",
      openSpots: 4,
      requiredSkills: JSON.stringify(["Research", "Writing", "Data Analysis", "Critical Thinking"]),
      roles: JSON.stringify(["Lead Researcher", "Research Partner"]),
      hoursPerWeek: "10-14 hrs",
      duration: "8 weeks",
      format: "Remote",
      status: "OPEN",
    },
  });

  await prisma.opportunity.upsert({
    where: { id: "mock-bridge-opp" } as never,
    update: {
      title: "Bridgepoint — Economic Mobility Research Fellow",
      description: "8-week embedded research fellowship producing real policy briefs on economic mobility and education access. Work published under your name. $500 stipend. Grades 11-12.",
      category: "FELLOWSHIP",
      isRemote: true,
      gradeEligibility: "11,12",
    },
    create: {
      id: "mock-bridge-opp",
      orgId: bridgeOrg.id,
      title: "Bridgepoint — Economic Mobility Research Fellow",
      description: "8-week embedded research fellowship producing real policy briefs on economic mobility and education access. Work published under your name. $500 stipend. Grades 11-12.",
      category: "FELLOWSHIP",
      isRemote: true,
      gradeEligibility: "11,12",
    },
  });

  console.log("  OK Bridgepoint Policy Fellows — Economic Mobility Track");

  console.log("\nSeed complete. Password: nivarro123");
  console.log("alex / sam / jordan / morgan / riley -- fresh, no type/traits/teams");
  console.log("Algorithm quotas cleared for all mock profiles");
  console.log("Orgs: Watershed Initiative / Apex Founders Fellowship / Bridgepoint Policy Fellows");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
