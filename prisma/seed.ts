import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TRAITS } from "../data/traits";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding traits...");
  for (const trait of TRAITS) {
    await prisma.trait.upsert({
      where: { slug: trait.slug },
      create: { slug: trait.slug, name: trait.name, description: trait.description, category: trait.category },
      update: { name: trait.name, description: trait.description, category: trait.category },
    });
  }
  console.log(`Seeded ${TRAITS.length} traits.`);

  // Use a placeholder createdById — the first user in the DB, or a fixed cuid
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  const creatorId = firstUser?.id ?? "seed-placeholder";

  // Seed the Nivarro Team demo org (idempotent)
  const existing = await prisma.org.findFirst({ where: { name: "Nivarro Team" } });
  if (!existing) {
    console.log("Seeding Nivarro Team org...");

    const org = await prisma.org.create({
      data: {
        name: "Nivarro Team",
        tagline: "Help build the platform from the inside.",
        description:
          "Nivarro is looking for driven high school students to join our internal operations team. " +
          "You'll work directly on growing the platform — everything from community outreach and content creation " +
          "to UX feedback and ambassador programs. This is a chance to be part of building something from the ground up.",
        whatWeSeek:
          "Self-starters who communicate clearly, follow through on commitments, and care about building something real. " +
          "No prior experience required — just curiosity, work ethic, and a genuine interest in the platform's mission.",
        category: "FELLOWSHIP",
        status: "OPEN",
        accentColor: "#4A80F0",
        minTeamSize: 1,
        maxTeamSize: 4,
        format: "Remote",
        stipend: "Unpaid — equity in the community you help build",
        autoAccept: true,
        createdById: creatorId,
      },
    });

    await prisma.orgProject.create({
      data: {
        orgId: org.id,
        title: "Platform Growth & Community Team",
        description:
          "Join Nivarro's internal growth team. Responsibilities span community management, " +
          "ambassador outreach, content creation, and direct product feedback. " +
          "You'll be the first generation of the Nivarro Team — shaping what the platform becomes.",
        requiredSkills: JSON.stringify([
          "Communication",
          "Social Media",
          "Content Creation",
          "Community Building",
          "Research",
        ]),
        openSpots: 3,
        listingStatus: "OPEN",
      },
    });

    console.log("Nivarro Team org seeded.");
  } else {
    console.log("Nivarro Team org already exists — skipping.");
  }

  // ── Seed scholars: Priya, Marcus, Zoe ──────────────────────────────────
  console.log("Seeding seed scholars...");

  const priyaUser = await prisma.user.upsert({
    where: { email: "priya@nivarro.io" },
    update: {},
    create: { email: "priya@nivarro.io", name: "Priya Nair", passwordHash: "$2a$10$seed.placeholder.hash.priya" },
  });
  const priyaProfile = await prisma.profile.upsert({
    where: { userId: priyaUser.id },
    update: { isDemo: true },
    create: {
      userId: priyaUser.id,
      displayName: "Priya Nair",
      isDemo: true,
      handle: "priyanair",
      headline: "Data Researcher & Systems Analyst",
      bio: "I find the signal in the noise. Give me a messy dataset or a broken process and I'll have a framework for it by Friday.",
      strengthSummary: "Exceptional analytical depth combined with clear written communication. Makes complex findings accessible without losing precision.",
      grade: 11,
      schoolName: "Thomas Jefferson High School for Science and Technology",
      isFirstGen: true,
      onboardingComplete: true,
      interests: JSON.stringify(["Data Science", "Behavioral Economics", "Public Policy", "Mathematics"]),
    },
  });

  const marcusUser = await prisma.user.upsert({
    where: { email: "marcus@nivarro.io" },
    update: {},
    create: { email: "marcus@nivarro.io", name: "Marcus Webb", passwordHash: "$2a$10$seed.placeholder.hash.marcus" },
  });
  const marcusProfile = await prisma.profile.upsert({
    where: { userId: marcusUser.id },
    update: { isDemo: true },
    create: {
      userId: marcusUser.id,
      displayName: "Marcus Webb",
      isDemo: true,
      handle: "marcuswebb",
      headline: "Entrepreneur & Impact Strategist",
      bio: "I think in systems and move in sprints. Most interested in projects where the output creates something that wasn't there before.",
      strengthSummary: "Natural leader with strong vision-to-execution instincts. Energizes teams and keeps momentum without losing strategic clarity.",
      grade: 12,
      schoolName: "BASIS Scottsdale",
      onboardingComplete: true,
      interests: JSON.stringify(["Entrepreneurship", "Social Impact", "Venture Capital", "Philosophy"]),
    },
  });

  const zoeUser = await prisma.user.upsert({
    where: { email: "zoe@nivarro.io" },
    update: {},
    create: { email: "zoe@nivarro.io", name: "Zoe Kim", passwordHash: "$2a$10$seed.placeholder.hash.zoe" },
  });
  const zoeProfile = await prisma.profile.upsert({
    where: { userId: zoeUser.id },
    update: { isDemo: true },
    create: {
      userId: zoeUser.id,
      displayName: "Zoe Kim",
      isDemo: true,
      handle: "zoekim",
      headline: "Builder & Full-Stack Developer",
      bio: "I build things that work. Fast iterations, clean code, and a preference for shipping over theorizing.",
      strengthSummary: "Remarkable execution speed paired with solid technical judgment. Rare combination of builder instinct and product taste.",
      grade: 11,
      schoolName: "Phillips Exeter Academy",
      onboardingComplete: true,
      interests: JSON.stringify(["Software Engineering", "Product Design", "Open Source", "AI / ML"]),
    },
  });
  console.log("Seed scholars seeded.");

  // ── Research Cohort org + project + reviews ────────────────────────────
  const existingResearchOrg = await prisma.org.findFirst({ where: { name: "Nivarro Research Cohort" } });
  if (!existingResearchOrg) {
    console.log("Seeding Research Cohort org...");

    const researchOrg = await prisma.org.create({
      data: {
        name: "Nivarro Research Cohort",
        tagline: "A selective research program for high school scholars serious about original work.",
        description:
          "Nivarro's Research Cohort brings together students with genuine intellectual curiosity to work on real " +
          "research questions — not simulated ones. Cohort members are matched to projects based on their research interests " +
          "and expertise, and commit to a 10-week structured sprint. Work is reviewed and published.",
        whatWeSeek:
          "Students who have already done serious independent work. Not looking for resume padding — looking for scholars " +
          "who get uncomfortable when they're not learning something hard.",
        category: "RESEARCH",
        status: "OPEN",
        accentColor: "#1060d8",
        minTeamSize: 2,
        maxTeamSize: 4,
        format: "Remote",
        stipend: "Unpaid — published work and platform-verified reviews",
        autoAccept: false,
        createdById: firstUser?.id ?? "seed-placeholder",
        logoLetter: "N",
        logoBg: "#0A1E52",
        logoColor: "#6A9FFF",
        bannerGradient: "linear-gradient(135deg, #030922 0%, #0A1E52 50%, #1060d8 100%)",
        founded: "2025",
        website: "nivarro.co",
        orgType: "Research Program",
        values: JSON.stringify(["Intellectual Honesty", "Original Thinking", "Rigor", "Collaboration"]),
        socialProof: "First cohort: 3 completed projects, 3 peer-reviewed outcomes, 100% review completion rate.",
        focusTags: JSON.stringify(["Research", "STEM", "Social Science", "Technology", "Data"]),
        memberCount: 3,
        headquartersLocation: "Remote",
      },
    });

    const researchProject = await prisma.orgProject.create({
      data: {
        orgId: researchOrg.id,
        title: "AI Bias in Academic Recommendation Systems",
        shortDescription: "Analyze recommendation algorithm outputs across 3 major academic platforms for demographic disparities.",
        fullDescription:
          "This project investigates whether automated recommendation systems on major academic opportunity platforms " +
          "produce statistically significant disparities across demographic groups. The cohort will collect structured " +
          "output data, design a bias measurement framework, run analysis, and write a publishable findings report. " +
          "All work is original — no existing dataset is handed to you.",
        requiredSkills: JSON.stringify(["Data Analysis", "Statistical Reasoning", "Academic Writing", "Python or R"]),
        roles: JSON.stringify(["Lead Researcher", "Data Engineer", "Communications Lead"]),
        hoursPerWeek: "8–12 hours",
        duration: "10 weeks",
        format: "Remote",
        openSpots: 3,
        progressPercent: 100,
        listingStatus: "CLOSED",
        deadline: new Date("2025-12-15T00:00:00Z"),
      },
    });

    // Reviews written by the org after project completion
    const reviewDeadline = new Date("2025-12-22T00:00:00Z");

    await prisma.orgReview.create({
      data: {
        orgId: researchOrg.id,
        orgProjectId: researchProject.id,
        profileId: priyaProfile.id,
        deadline: reviewDeadline,
        body:
          "Priya was the analytical backbone of the cohort. She designed the bias measurement framework from scratch — " +
          "we had given the team the problem statement and a blank canvas, and she produced a methodology document " +
          "within the first week that the rest of the project ran on. Her statistical judgment is exceptional for her " +
          "age. She pushed back on two of our early assumptions with data, and she was right both times. " +
          "Any team that gets her is getting someone who will find the problem in your problem.",
      },
    });

    await prisma.orgReview.create({
      data: {
        orgId: researchOrg.id,
        orgProjectId: researchProject.id,
        profileId: marcusProfile.id,
        deadline: reviewDeadline,
        body:
          "Marcus took on the communications lead role and immediately reframed it as a product question: " +
          "who is the audience for this research and what do they need to understand it? That reframe shaped " +
          "the final report structure. He ran the team's weekly syncs, kept deliverables on track, and was the " +
          "person who caught when Zoe and Priya were heading toward a scope creep moment and redirected calmly. " +
          "Strong strategic instinct. Would work with him again without hesitation.",
      },
    });

    await prisma.orgReview.create({
      data: {
        orgId: researchOrg.id,
        orgProjectId: researchProject.id,
        profileId: zoeProfile.id,
        deadline: reviewDeadline,
        body:
          "Zoe built the entire data pipeline in week two and had it running cleanly before anyone else was ready to use it. " +
          "She wrote clean, documented code — a rarity in a student cohort — and proactively added logging that caught a " +
          "data integrity issue we would have missed entirely. Her speed is real. She shipped a working scraper, a " +
          "cleaning pipeline, and a visualization layer in the same sprint. The technical foundation of this project " +
          "was entirely hers.",
      },
    });

    console.log("Research Cohort org, project, and reviews seeded.");
  } else {
    console.log("Research Cohort org already exists — skipping.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
