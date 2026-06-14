import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// Sets known passwords for all demo accounts + creates blank org + blank student
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
  const DEMO_PASSWORD = "demo2026";
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Fix all existing @nivarro.demo and @nivarro.io accounts
  const demoEmails = [
    "priya@nivarro.io",
    "marcus@nivarro.io",
    "zoe@nivarro.io",
    "elena@nivarro.demo",
    "james@nivarro.demo",
    "amara@nivarro.demo",
    "noah@nivarro.demo",
    "maya@nivarro.demo",
    "ridgepoint@nivarro.demo",
    "sunsetpines@nivarro.demo",
  ];
  for (const email of demoEmails) {
    await prisma.user.updateMany({ where: { email }, data: { passwordHash: hash } });
  }

  // Keep ridgepoint password as ridgepoint2026
  const ridgepointHash = await bcrypt.hash("ridgepoint2026", 10);
  await prisma.user.updateMany({
    where: { email: "ridgepoint@nivarro.demo" },
    data: { passwordHash: ridgepointHash },
  });

  // ── Blank org account ──────────────────────────────────────────────────────
  const blankOrgEmail = "org@nivarro.demo";
  let blankOrgUser = await prisma.user.findUnique({ where: { email: blankOrgEmail } });
  if (!blankOrgUser) {
    blankOrgUser = await prisma.user.create({
      data: { name: "Demo Org", email: blankOrgEmail, passwordHash: hash },
    });
  } else {
    await prisma.user.update({ where: { email: blankOrgEmail }, data: { passwordHash: hash } });
  }

  // ── Blank student account ──────────────────────────────────────────────────
  const blankStudentEmail = "student@nivarro.demo";
  let blankStudentUser = await prisma.user.findUnique({ where: { email: blankStudentEmail } });
  if (!blankStudentUser) {
    blankStudentUser = await prisma.user.create({
      data: { name: "Demo Student", email: blankStudentEmail, passwordHash: hash },
    });
  } else {
    await prisma.user.update({ where: { email: blankStudentEmail }, data: { passwordHash: hash } });
  }

  // ── Marcus profile + review (idempotent) ──────────────────────────────────
  const marcusUser = await prisma.user.findUnique({ where: { email: "marcus@nivarro.io" } });
  if (marcusUser) {
    const existingProfile = await prisma.profile.findUnique({ where: { userId: marcusUser.id } });
    if (!existingProfile) {
      const marcusProfile = await prisma.profile.create({
        data: {
          userId: marcusUser.id,
          displayName: "Marcus Webb",
          handle: "marcuswebb",
          headline: "Entrepreneur & Impact Strategist",
          bio: "I think in systems and move in sprints. Most interested in projects where the output creates something that wasn't there before.",
          strengthSummary: "Natural leader with strong vision-to-execution instincts. Energizes teams and keeps momentum without losing strategic clarity.",
          geniusType: "BLAZE",
          grade: 12,
          schoolName: "BASIS Scottsdale",
          onboardingComplete: true,
          interests: JSON.stringify(["Entrepreneurship", "Social Impact", "Venture Capital", "Philosophy"]),
        },
      });

      // Attach review from Research Cohort if that project exists on this DB
      const researchProject = await prisma.orgProject.findFirst({
        where: { title: "AI Bias in Academic Recommendation Systems" },
        select: { id: true, orgId: true },
      });
      if (researchProject) {
        const reviewDeadline = new Date();
        reviewDeadline.setFullYear(reviewDeadline.getFullYear() + 1);
        await prisma.orgReview.upsert({
          where: { orgProjectId_profileId: { orgProjectId: researchProject.id, profileId: marcusProfile.id } },
          create: {
            orgId: researchProject.orgId,
            orgProjectId: researchProject.id,
            profileId: marcusProfile.id,
            deadline: reviewDeadline,
            body: "Marcus took on the communications lead role and immediately reframed it as a product question: who is the audience for this research and what do they need to understand it? That reframe shaped the final report structure. He ran the team's weekly syncs, kept deliverables on track, and was the person who caught when Zoe and Priya were heading toward a scope creep moment and redirected calmly. Strong strategic instinct. Would work with him again without hesitation.",
          },
          update: {},
        });
      }
    }
  }

  // ── Sunset Pines canonical listing ──────────────────────────────────────
  let sunsetOrg = await prisma.org.findFirst({ where: { name: "Sunset Pines Senior Living" } });
  if (!sunsetOrg) {
    const sunsetUser = await prisma.user.upsert({
      where: { email: "sunsetpines@nivarro.demo" },
      update: {},
      create: { name: "Sunset Pines Admin", email: "sunsetpines@nivarro.demo", passwordHash: hash },
    });
    sunsetOrg = await prisma.org.create({
      data: {
        name: "Sunset Pines Senior Living",
        tagline: "Where veterans find connection through play.",
        description: "A senior living community serving 18 Vietnam-era veterans in Sacramento.",
        createdById: sunsetUser.id,
        verified: false,
        category: "RESEARCH",
      },
    });
  }

  const sunsetProject = await prisma.orgProject.findFirst({
    where: { orgId: sunsetOrg.id, title: "Veterans Game Studio" },
  });

  if (!sunsetProject) {
    await prisma.orgProject.create({
      data: {
        orgId: sunsetOrg.id,
        title: "Veterans Game Studio",
        description: "Build a multiplayer game for 18 Vietnam-era veterans at Sunset Pines Senior Living.",
        shortDescription: "Build a co-op game that 18 veterans at Sunset Pines will play together every afternoon.",
        impactStatement: "18 Vietnam-era veterans at Sunset Pines will play together every afternoon.",
        storyBody: `Margaret Chen wrote us a letter.\n\n"I'm the Activities Director at Sunset Pines Senior Living in Sacramento. We have 18 residents who served in Vietnam — men between 74 and 82 who grew up playing cards, dominoes, and checkers together. Since COVID, most of them stay in their rooms. I think they're lonely. I don't know how to fix that, but I thought maybe games could help."\n\nShe didn't have a budget line. She didn't know what Unity was. She just knew her residents were fading — and she thought students might care.\n\nThis is that project.`,
        locationCity: "Sacramento, CA",
        locationRequired: "REQUIRED",
        locationRadius: 15,
        budgetTotal: 15000,
        budgetNotes: "Split however the team decides. Submit receipts for tooling.",
        toolingStipend: true,
        gradeEligibility: JSON.stringify(["11", "12"]),
        advisorRequired: "REQUIRED",
        applicationMode: "TEAM",
        appMaterials: JSON.stringify(["cover_letter", "why_us"]),
        requiredSkills: JSON.stringify(["Game development", "Multiplayer networking", "UI/UX accessibility", "Communication"]),
        preferredGeniusTypes: JSON.stringify(["DYNAMO", "BLAZE"]),
        openSpots: 5,
        hoursPerWeek: "10-15",
        duration: "June 15 – August 30 (11 weeks)",
        format: "In-person",
        contactName: "Margaret Chen",
        contactRole: "Activities Director, Sunset Pines Senior Living",
        studentOutcomes: JSON.stringify(["PAID", "PORTFOLIO", "REC_LETTER", "MENTORSHIP"]),
        dayInLife: JSON.stringify([
          "Visit Sunset Pines to hear veterans' stories — design the game with them, not for them",
          "Build in Unity/Godot/web — procedurally varied missions, co-op for 6-8 simultaneous players",
          "Weekly playtests with residents — sit with an 80-year-old and watch him play",
          "Submit tooling receipts; manage your own budget split as a team",
          "Ship a real product by August 30 — it will be played every afternoon",
        ]),
        listingStatus: "OPEN",
        publishedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    accounts: {
      orgs: [
        { email: "ridgepoint@nivarro.demo", password: "ridgepoint2026", note: "Ridgepoint Policy Fellows — full admin dashboard + mock scholars" },
        { email: "org@nivarro.demo", password: "demo2026", note: "Blank org account — create your own org via /orgs/new" },
        { email: "sunsetpines@nivarro.demo", password: "demo2026", note: "Sunset Pines Senior Living — Veterans Game Studio listing (canonical demo)" },
      ],
      scholars: [
        { email: "student@nivarro.demo", password: "demo2026", note: "Blank student account — no profile yet" },
        { email: "priya@nivarro.io", password: "demo2026", note: "Priya Nair — STEEL, grade 11, data researcher, has org review" },
        { email: "marcus@nivarro.io", password: "demo2026", note: "Marcus Webb — BLAZE, grade 12, entrepreneur, has org review" },
        { email: "zoe@nivarro.io", password: "demo2026", note: "Zoe Kim — DYNAMO, grade 11, full-stack developer, has org review" },
        { email: "elena@nivarro.demo", password: "demo2026", note: "Elena Vasquez — STEEL, grade 12, policy researcher, Ridgepoint review" },
        { email: "james@nivarro.demo", password: "demo2026", note: "James Okafor — STEEL/BLAZE, grade 11, economist, Ridgepoint review" },
        { email: "amara@nivarro.demo", password: "demo2026", note: "Amara Singh — BLAZE, grade 12, civic advocate, Ridgepoint review" },
        { email: "noah@nivarro.demo", password: "demo2026", note: "Noah Chen — STEEL, grade 11, legal researcher, no review" },
        { email: "maya@nivarro.demo", password: "demo2026", note: "Maya Thompson — BLAZE/STEEL, grade 12, policy writer, no review" },
      ],
    },
  });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}
