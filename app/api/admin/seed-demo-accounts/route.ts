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

  // ── Nivarro platform org (team@nivarro.dev) ───────────────────────────────
  const nivDevEmail = "team@nivarro.dev";
  const nivDevHash = await bcrypt.hash("nivarro2026", 10);
  let nivDevUser = await prisma.user.findUnique({ where: { email: nivDevEmail } });
  if (!nivDevUser) {
    nivDevUser = await prisma.user.create({
      data: { name: "Nivarro Team", email: nivDevEmail, passwordHash: nivDevHash, role: "ADMIN" },
    });
  } else {
    await prisma.user.update({ where: { email: nivDevEmail }, data: { passwordHash: nivDevHash, role: "ADMIN" } });
  }
  // ── Real Nivarro admin account (team.nivarro@gmail.com) ──────────────────
  const realAdminHash = await bcrypt.hash("nivarro2026", 10);
  const realAdminEmail = "team.nivarro@gmail.com";
  const existingRealAdmin = await prisma.user.findUnique({ where: { email: realAdminEmail } });
  if (!existingRealAdmin) {
    await prisma.user.create({
      data: { name: "Nivarro Team", email: realAdminEmail, passwordHash: realAdminHash, role: "ADMIN" },
    });
  } else {
    await prisma.user.update({
      where: { email: realAdminEmail },
      data: { passwordHash: realAdminHash, role: "ADMIN" },
    });
  }

  // ── Set roles for all known org accounts ─────────────────────────────────
  const orgEmails = [
    "ridgepoint@nivarro.demo",
    "sunsetpines@nivarro.demo",
    "org@nivarro.demo",
  ];
  for (const email of orgEmails) {
    await prisma.user.updateMany({ where: { email }, data: { role: "ORG" } });
  }
  // Ensure Thomas and all student demo accounts are explicitly STUDENT
  const studentEmails = [
    "thomas@piacentine.dev",
    "student@nivarro.demo",
    "priya@nivarro.io",
    "marcus@nivarro.io",
    "zoe@nivarro.io",
    "elena@nivarro.demo",
    "james@nivarro.demo",
    "amara@nivarro.demo",
    "noah@nivarro.demo",
    "maya@nivarro.demo",
    "diego.ramirez@nivarro.demo",
    "aiko.tanaka@nivarro.demo",
    "jordan.hayes@nivarro.demo",
  ];
  for (const email of studentEmails) {
    await prisma.user.updateMany({ where: { email }, data: { role: "STUDENT" } });
  }

  // Look up Nivarro org: by current ownership, then by unique structural combo (paid+verified+FELLOWSHIP)
  let nivarroOrg =
    (await prisma.org.findFirst({ where: { createdById: nivDevUser.id } })) ??
    (await prisma.org.findFirst({ where: { isPaid: true, verified: true, category: "FELLOWSHIP" } }));
  if (!nivarroOrg) {
    nivarroOrg = await prisma.org.create({
      data: {
        name: "Nivarro Team",
        tagline: "Where exceptional students find their first real work.",
        description:
          "Nivarro is the platform connecting high-potential students with orgs that are serious about the next generation. We run our own fellowship for students who demonstrate exceptional initiative across the platform.",
        whatWeSeek:
          "Students who ship things. We're not interested in resumes — we want builders, researchers, and makers who've already done something real.",
        category: "FELLOWSHIP",
        createdById: nivDevUser.id,
        verified: true,
        isPaid: true,
        logoLetter: "N",
        logoBg: "#050505",
        logoColor: "#3B82F6",
        bannerGradient: "linear-gradient(135deg, #050505 0%, #0F172A 60%, #1E3A5F 100%)",
        website: "https://nivarro.com",
        founded: "2026",
        orgType: "Platform",
        values: JSON.stringify(["Excellence", "Equity", "Real Work"]),
        focusTags: JSON.stringify(["Fellowships", "Student Talent", "Impact Projects"]),
        headquartersLocation: "San Francisco, CA",
        contactEmail: "team@nivarro.co",
        socialProof: "5,000+ students. 200+ partner orgs. Built for the next generation of builders.",
        memberCount: 12,
        whatInternsBuild:
          "Nivarro fellows work directly with our engineering and design team. Past fellows shipped features that are live on the platform today.",
      },
    });
  } else {
    // Always re-link the org to the current user — guards against stale createdById after user recreation
    await prisma.org.update({ where: { id: nivarroOrg.id }, data: { createdById: nivDevUser.id } });
  }

  // ── Nuclear cleanup: force the Nivarro platform org to the correct owner ──
  // Uses the unique combination isPaid+verified+FELLOWSHIP — only the Nivarro
  // platform org in this DB has all three. Immune to name changes, missing
  // website/contactEmail fields, and stale createdById values.
  await prisma.org.updateMany({
    where: { isPaid: true, verified: true, category: "FELLOWSHIP" },
    data: { createdById: nivDevUser.id },
  });

  // ── Re-fetch veterans project so it's always defined below ───────────────
  const veteransProject =
    sunsetProject ??
    (await prisma.orgProject.findFirst({
      where: { orgId: sunsetOrg.id, title: "Veterans Game Studio" },
    }));

  // ── Thomas Piacentine student account ─────────────────────────────────────
  const thomasEmail = "thomas@piacentine.dev";
  let thomasUser = await prisma.user.findUnique({ where: { email: thomasEmail } });
  if (!thomasUser) {
    thomasUser = await prisma.user.create({
      data: { name: "Thomas Piacentine", email: thomasEmail, passwordHash: hash },
    });
  } else {
    await prisma.user.update({ where: { email: thomasEmail }, data: { passwordHash: hash } });
  }
  let thomasProfile = await prisma.profile.findUnique({ where: { userId: thomasUser.id } });
  if (!thomasProfile) {
    thomasProfile = await prisma.profile.create({
      data: {
        userId: thomasUser.id,
        displayName: "Thomas Piacentine",
        handle: "thomaspiacentine",
        headline: "Builder & Team Lead",
        bio: "I care about projects where the output is real. Not a pitch deck — something that gets used. Spent 11 weeks this summer building a co-op game for 18 Vietnam-era veterans in Sacramento. That's the bar I'm holding everything else to.",
        strengthSummary:
          "Strong team lead with an unusually high tolerance for ambiguity. Thomas doesn't wait to be told what to do — he identifies the void and fills it. His stamina on complex, multi-month projects is the defining trait that separates him from peers.",
        grade: 12,
        schoolName: "Palo Alto High School",
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["shark", "lion"]),
        archetypeAnalysis:
          "Thomas leads like a Lion — he walks into rooms and gravity shifts without him trying. But what makes him rare is the Shark underneath: while the team sleeps, he's running another thread. Margaret Chen at Sunset Pines noted he was still fixing audio sync bugs at midnight before the final playtest. That's not grind culture — that's someone who physically cannot stop until the thing is right.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["Game Development", "Product Design", "Social Impact", "Venture"]),
        isDemo: true,
      },
    });
  }

  // ── Ensure Thomas has no org ownership (transfer any accidental orgs to Nivarro team) ─
  if (thomasUser && nivDevUser) {
    await prisma.org.updateMany({
      where: { createdById: thomasUser.id },
      data: { createdById: nivDevUser.id },
    });
  }

  // ── Thomas Piacentine mock review (from Sunset Pines / Veterans Game Studio) ─
  if (thomasProfile && veteransProject && sunsetOrg) {
    const thomasReviewDeadline = new Date();
    thomasReviewDeadline.setFullYear(thomasReviewDeadline.getFullYear() + 1);
    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: veteransProject.id, profileId: thomasProfile.id } },
      create: {
        orgId: sunsetOrg.id,
        orgProjectId: veteransProject.id,
        profileId: thomasProfile.id,
        deadline: thomasReviewDeadline,
        body: `Thomas served as team lead for Studio 18 across the full eleven-week engagement at Sunset Pines, and I want to be specific about what that meant in practice, because "team lead" undersells it considerably.

We started the project with four students who had never shipped a game and eighteen veterans who were skeptical that anything real would come of it. Thomas walked into that situation and immediately understood that the first job was trust, not code. He spent the opening two weeks doing what he called "listening sessions" — sitting with the veterans one-on-one, asking what they remembered about the war, what they were proud of, what still hurt. That research shaped every design decision his team made afterward. The game mechanics, the narrative framing, the audio cues — all of it came from those conversations.

On the technical side, Thomas didn't try to do everything himself. He scoped the work carefully, delegated the prototype build to Diego, took on the audio integration himself when no one else had bandwidth, and kept the team in daily sync without making anyone feel micromanaged. When a major playtest at week seven revealed that veterans were losing the thread of the co-op objectives, Thomas called an emergency redesign session that night, had a revised build running by morning, and never once made the team feel like it was a setback.

What I observed in Thomas over eleven weeks is rarer than most people his age realize: he carries genuine accountability without needing to be told to. The last night before the final playtest, our activities director mentioned in passing that the audio was still a bit off. Thomas was in the AV room until midnight fixing it — nobody asked him to, nobody was watching. That's not work ethic in the resume sense. That's someone who physically cannot leave something broken.

I would not hesitate to bring Thomas back for a future project, and I would not hesitate to tell any organization he applies to that he is the real thing.`,
      },
      update: {},
    });
  }

  // ── Diego Ramirez student account ─────────────────────────────────────────
  const diegoEmail = "diego.ramirez@nivarro.demo";
  let diegoUser = await prisma.user.findUnique({ where: { email: diegoEmail } });
  if (!diegoUser) {
    diegoUser = await prisma.user.create({
      data: { name: "Diego Ramirez", email: diegoEmail, passwordHash: hash },
    });
  } else {
    await prisma.user.update({ where: { email: diegoEmail }, data: { passwordHash: hash } });
  }
  let diegoProfile = await prisma.profile.findUnique({ where: { userId: diegoUser.id } });
  if (!diegoProfile) {
    diegoProfile = await prisma.profile.create({
      data: {
        userId: diegoUser.id,
        displayName: "Diego Ramirez",
        handle: "diegoramirez",
        headline: "Full-Stack Developer & Prototyper",
        bio: "I build things fast. The first working prototype of the Sunset Pines co-op game was mine — I had it running in a browser in 48 hours so we could actually show the veterans something real. Speed is a strategy.",
        strengthSummary:
          "Diego ships prototypes faster than most people write specs. His velocity is real — not careless, but genuinely rapid. He's the person you want in week one of any project.",
        grade: 11,
        schoolName: "Downtown Magnets High School",
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["cheetah", "wolf"]),
        archetypeAnalysis:
          "Diego is a Cheetah in the purest sense — the first working build of the game was his, shipped before the team had finished planning. But what makes him more than a sprinter is the Wolf: he consistently brought the team along, made sure no one was left debugging alone, and his Friday updates kept morale high through the weeks where nothing was working.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["Full-Stack Development", "Game Development", "UX Engineering", "Open Source"]),
        isDemo: true,
      },
    });
  }

  // ── Aiko Tanaka student account ────────────────────────────────────────────
  const aikoEmail = "aiko.tanaka@nivarro.demo";
  let aikoUser = await prisma.user.findUnique({ where: { email: aikoEmail } });
  if (!aikoUser) {
    aikoUser = await prisma.user.create({
      data: { name: "Aiko Tanaka", email: aikoEmail, passwordHash: hash },
    });
  } else {
    await prisma.user.update({ where: { email: aikoEmail }, data: { passwordHash: hash } });
  }
  let aikoProfile = await prisma.profile.findUnique({ where: { userId: aikoUser.id } });
  if (!aikoProfile) {
    aikoProfile = await prisma.profile.create({
      data: {
        userId: aikoUser.id,
        displayName: "Aiko Tanaka",
        handle: "aikotanaka",
        headline: "UX Designer & Accessibility Researcher",
        bio: "I spent the first three weeks of the project just sitting with the veterans. Watching how they held a controller. Where their eyes went on a screen. Everything I designed came from those sessions.",
        strengthSummary:
          "Aiko's design decisions are grounded in observation, not assumption. She delayed the UI build by two weeks to do user research — a call that turned out to be exactly right. Her accessibility work made the game playable for veterans with arthritis and limited vision.",
        grade: 12,
        schoolName: "Lowell High School",
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["owl", "tiger"]),
        archetypeAnalysis:
          "Aiko is the Owl on every team she joins — slow to act, devastating in output. She spent three weeks observing the veterans before touching a design tool. That's the Tiger too: patience that looked like inertia until week four, when she shipped a UI system nobody could have built without that foundation.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["UX Design", "Accessibility", "User Research", "Human-Computer Interaction"]),
        isDemo: true,
      },
    });
  }

  // ── Jordan Hayes student account ───────────────────────────────────────────
  const jordanEmail = "jordan.hayes@nivarro.demo";
  let jordanUser = await prisma.user.findUnique({ where: { email: jordanEmail } });
  if (!jordanUser) {
    jordanUser = await prisma.user.create({
      data: { name: "Jordan Hayes", email: jordanEmail, passwordHash: hash },
    });
  } else {
    await prisma.user.update({ where: { email: jordanEmail }, data: { passwordHash: hash } });
  }
  let jordanProfile = await prisma.profile.findUnique({ where: { userId: jordanUser.id } });
  if (!jordanProfile) {
    jordanProfile = await prisma.profile.create({
      data: {
        userId: jordanUser.id,
        displayName: "Jordan Hayes",
        handle: "jordanhayes",
        headline: "Systems Engineer & Game Developer",
        bio: "The networking stack for our co-op game was mine. Six simultaneous players, sub-50ms latency, running on a $7/month server. No one told me it was hard — I just built it.",
        strengthSummary:
          "Jordan disappears into hard problems and emerges with working systems. He built the multiplayer networking layer alone over 10 days and never asked for help — not because he's anti-collaborative, but because he knew exactly what he needed to do.",
        grade: 11,
        schoolName: "Sacramento New Technology High School",
        onboardingComplete: true,
        animalArchetypes: JSON.stringify(["gorilla", "cheetah"]),
        archetypeAnalysis:
          "Jordan is textbook Gorilla — he took the hardest piece of the project (real-time multiplayer for 6+ concurrent players) and didn't surface for 10 days. What came out was complete, tested, and faster than anything the team expected. The Cheetah shows in his velocity once scope is clear: he understands the brief, then disappears and ships.",
        archetypeUpdatedAt: new Date("2026-08-31T00:00:00Z"),
        interests: JSON.stringify(["Systems Engineering", "Game Development", "Networking", "Low-Level Programming"]),
        isDemo: true,
      },
    });
  }

  // ── Studio 18 team — Veterans Game Studio (COMPLETED) ─────────────────────
  if (veteransProject && thomasProfile && diegoProfile && aikoProfile && jordanProfile) {
    let studio18 = await prisma.team.findFirst({ where: { name: "Studio 18" } });
    if (!studio18) {
      studio18 = await prisma.team.create({
        data: {
          name: "Studio 18",
          description:
            "Four students who built a multiplayer co-op game for 18 Vietnam-era veterans at Sunset Pines Senior Living, Sacramento. June 15 – August 30, 2026.",
          status: "COMPLETED",
          orgId: sunsetOrg.id,
          createdById: thomasUser.id,
          members: {
            create: [
              { profileId: thomasProfile.id, role: "ADMIN" },
              { profileId: diegoProfile.id, role: "MEMBER" },
              { profileId: aikoProfile.id, role: "MEMBER" },
              { profileId: jordanProfile.id, role: "MEMBER" },
            ],
          },
        },
      });
    }

    await prisma.teamApplication.upsert({
      where: { teamId_orgProjectId: { teamId: studio18.id, orgProjectId: veteransProject.id } },
      create: {
        teamId: studio18.id,
        orgProjectId: veteransProject.id,
        whyJoin:
          "We've built games before. But we've never built something that will be played every afternoon by people who've spent 50 years looking for connection. We want to build this specifically — not a demo, not a prototype, not a pitch. The real thing.",
        status: "ACCEPTED",
        submittedAt: new Date("2026-06-10T00:00:00Z"),
        decidedAt: new Date("2026-06-15T00:00:00Z"),
      },
      update: {},
    });

    const reviewDeadline = new Date("2027-08-31T00:00:00Z");

    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: veteransProject.id, profileId: thomasProfile.id } },
      create: {
        orgId: sunsetOrg.id,
        orgProjectId: veteransProject.id,
        profileId: thomasProfile.id,
        deadline: reviewDeadline,
        body: `Thomas Piacentine led this project the way you hope a team lead will — not by delegating from a distance, but by being the first in the room and the last to leave. When we brought the team to meet our residents for the first time, it was Thomas who sat with Harold, our 79-year-old resident who had never touched a game controller, and spent 40 minutes just listening to him describe how he and his unit used to play cards in the barracks. That conversation became the design brief for the game's tutorial.\n\nOver eleven weeks, Thomas kept the team aligned through two major technical setbacks — a networking failure in week five that forced a rebuild, and a scope creep moment in week eight when the team started adding features that weren't in the original plan. Both times, he redirected with clarity and without blame. He ran weekly check-ins with me every Friday to share progress and gather feedback from residents. He showed up to three playtests even on weeks when I didn't expect him.\n\nThe product they shipped — a turn-based co-op strategy game that six veterans can play simultaneously from their individual rooms — is live. Our residents played it the afternoon of August 30th. Harold won the first match. Thomas was there.\n\nI would recommend Thomas to any organization that needs someone who can lead a complex, multi-month project with real stakeholders and real stakes. He is not a student playing at work. He is a builder who happens to still be in high school.`,
        aiInsight:
          "Thomas demonstrates a rare combination of stakeholder empathy and execution discipline. The detail about Harold's card-playing story becoming the design brief is evidence of listening as a design practice — something most students perform but few internalize. His management of the week-five networking rebuild under pressure is the signal worth amplifying to future organizations.",
      },
      update: {},
    });

    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: veteransProject.id, profileId: diegoProfile.id } },
      create: {
        orgId: sunsetOrg.id,
        orgProjectId: veteransProject.id,
        profileId: diegoProfile.id,
        deadline: reviewDeadline,
        body: `Diego Ramirez was the first person on the team to put something in front of our residents. Two weeks into the project, before anyone else had shipped anything, he showed up with a browser prototype — crude, but playable. He sat down with three of our veterans and just handed them the keyboard. I watched an 81-year-old man laugh for the first time in months because he managed to click a button and something moved on screen.\n\nThat moment mattered. It mattered for morale, for the team, and for me. Diego understood something the rest of the team was still theorizing about: our residents needed to see that this was real. An abstract promise is worthless to someone who has been promised things that didn't happen. Diego made it real in week two.\n\nHe kept that pace throughout the project. When Aiko's accessibility research changed the UI requirements in week four, Diego rebuilt the interface in three days without complaint. When Jordan's networking layer hit a bug in week eight that caused game state to desync across players, Diego was the first one debugging alongside him at 11pm.\n\nWhat I found most impressive about Diego is that his speed never came at the cost of his teammates. He shipped fast and then turned around and helped whoever was behind. I've worked with volunteers and professionals over 14 years in this role. Diego is one of the most effective collaborators I've encountered, at any age.\n\nHe is welcome back at Sunset Pines any time he wants to visit Harold.`,
        aiInsight:
          "Diego's early prototype delivery is the defining signal here — not just speed, but the strategic choice to make the work tangible for a population who needed to see before they could believe. His behavior during the UI rebuild and the night-session networking debug shows the Wolf dimension: he doesn't disappear when teammates need him.",
      },
      update: {},
    });

    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: veteransProject.id, profileId: aikoProfile.id } },
      create: {
        orgId: sunsetOrg.id,
        orgProjectId: veteransProject.id,
        profileId: aikoProfile.id,
        deadline: reviewDeadline,
        body: `I want to say something about Aiko Tanaka that I think is easy to miss if you only look at her output. She spent the first three weeks of this project almost entirely with our residents — not building, not designing, just watching. Watching how Robert grips a controller with hands stiffened by decades of arthritis. Watching where Frank's eyes go when there are too many elements on screen. Watching which resident loses interest first and why.\n\nI've worked with designers before who did user research. None of them did what Aiko did. She was not checking a box. She was building a complete picture, and she refused to touch the design tool until she had it.\n\nWhat came out of those three weeks was a design system for our game that I genuinely believe no professional studio would have produced without this level of observation. Large target areas sized for arthritic hands. A color palette built around macular degeneration and reduced contrast sensitivity. Font sizes tested against Robert's actual reading distance from a 24-inch monitor. Tutorial flow validated against Frank's specific cognitive pace.\n\nSome of our residents have moderate dementia. Aiko designed the onboarding so that a resident who forgets what the buttons do can recover from any state in two clicks. She didn't tell anyone she was doing this. I only found out when I tested it myself.\n\nAiko is the reason this product works for the people it was built for. Not the people the team imagined. The actual people sitting in front of it.`,
        aiInsight:
          "The dementia recovery flow detail is the strongest signal in this review — design empathy that goes beyond brief requirements, executed quietly without announcement. That's the Owl marker: depth others don't see until they use the product. The Tiger patience is evident in the three-week observation period before building.",
      },
      update: {},
    });

    await prisma.orgReview.upsert({
      where: { orgProjectId_profileId: { orgProjectId: veteransProject.id, profileId: jordanProfile.id } },
      create: {
        orgId: sunsetOrg.id,
        orgProjectId: veteransProject.id,
        profileId: jordanProfile.id,
        deadline: reviewDeadline,
        body: `I'm not a technical person. I'm an activities director who writes letters to strangers on the internet asking if they'd like to build games for veterans. Jordan Hayes built something that I genuinely cannot explain, except that it works.\n\nSix of our residents can now play a game together at the same time, from their individual rooms, on the TVs they already have. Jordan built the system that makes that possible — the networking, the synchronization, the part that ensures that when Harold makes a move in room 12, Eugene sees it immediately in room 7. For eleven weeks it has worked without interruption. Our IT coordinator, who manages our building's infrastructure, told me it was "astonishingly clean for a student project."\n\nIn week five, something in the system stopped working and the team had a week where nothing was playable. Jordan was the one who fixed it. I don't know what the technical problem was — he tried to explain it to me and I understood maybe 30% — but I know he worked on it alone for six days and when he came back he had both the fix and a written explanation of what had gone wrong and how he had prevented it from happening again.\n\nJordan also came to three out of four playtests when only one was required. He sat with Eugene for 45 minutes during the second playtest, just watching. He didn't say much. But at the following build, the controls Eugene had struggled with had been quietly redesigned.\n\nJordan is the kind of person who notices things and then fixes them without being asked. That's rare.`,
        aiInsight:
          "The week-five solo rebuild followed by a written post-mortem is the clearest Gorilla marker here — isolated execution on a hard problem, delivered complete. The unprompted playtest attendance and Eugene's control redesign reveal something beyond technical depth: Jordan observes and acts outside his formal scope.",
      },
      update: {},
    });
  }

  // ── School mock seed (Westside Academy) ──────────────────────────────────
  const schoolUser = await prisma.user.upsert({
    where: { email: "school@nivarro.demo" },
    update: { role: "SCHOOL", passwordHash: hash },
    create: {
      name: "Westside Academy",
      email: "school@nivarro.demo",
      passwordHash: hash,
      role: "SCHOOL",
    },
  });
  const existingSchoolProfile = await prisma.profile.findUnique({ where: { userId: schoolUser.id } });
  if (existingSchoolProfile) {
    await prisma.profile.update({
      where: { id: existingSchoolProfile.id },
      data: { displayName: "Westside Academy", headline: "Empowering the next generation of leaders" },
    });
  } else {
    await prisma.profile.create({
      data: {
        userId: schoolUser.id,
        displayName: "Westside Academy",
        headline: "Empowering the next generation of leaders",
        bio: "A private community for Westside Academy students, alumni, and staff.",
        onboardingComplete: true,
      },
    });
  }
  const schoolId = schoolUser.id;

  const staffMembers = [
    { email: "dean@westside.demo",      name: "Dr. Patricia Webb", staffTitle: "Dean of Students",                  bio: "20 years in education. Every student has a path worth building. Here to help you find yours.", handle: "drwebb" },
    { email: "counselor@westside.demo", name: "Marcus Rivera",     staffTitle: "College Counselor",                 bio: "Former admissions officer at Georgetown. I know what schools look for — and how to help you show it.", handle: "mrrivera" },
    { email: "teacher@westside.demo",   name: "Dr. Aisha Patel",   staffTitle: "AP Computer Science & Robotics",   bio: "MIT alum, Google engineer turned teacher. I love when students build things that matter.", handle: "drpatel" },
  ];
  for (const staff of staffMembers) {
    const staffUser = await prisma.user.upsert({
      where: { email: staff.email },
      update: { passwordHash: hash },
      create: { name: staff.name, email: staff.email, passwordHash: hash, role: "STUDENT" },
    });
    const ep = await prisma.profile.findUnique({ where: { userId: staffUser.id } });
    if (ep) {
      await prisma.profile.update({ where: { id: ep.id }, data: { displayName: staff.name, handle: staff.handle, bio: staff.bio, staffTitle: staff.staffTitle, schoolId, onboardingComplete: true } });
    } else {
      await prisma.profile.create({ data: { userId: staffUser.id, displayName: staff.name, handle: staff.handle, bio: staff.bio, staffTitle: staff.staffTitle, schoolId, onboardingComplete: true } });
    }
  }

  // Mark priya, marcus, zoe as alumni
  for (const email of ["priya@nivarro.io", "marcus@nivarro.io", "zoe@nivarro.io"]) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) await prisma.user.update({ where: { id: u.id }, data: { isAlumni: true } });
  }
  // Update alumni mentor availability
  const alumniUpdates = [
    { email: "priya@nivarro.io",  college: "Stanford University",          major: "Computer Science",           year: 2025, mentor: true,  industry: "Technology" },
    { email: "marcus@nivarro.io", college: "University of Pennsylvania",   major: "Economics & Entrepreneurship", year: 2025, mentor: true,  industry: "Venture & Startups" },
    { email: "zoe@nivarro.io",    college: "Carnegie Mellon University",   major: "Computer Science",           year: 2025, mentor: false, industry: "Engineering" },
  ];
  for (const a of alumniUpdates) {
    const u = await prisma.user.findUnique({ where: { email: a.email } });
    if (!u) continue;
    const p = await prisma.profile.findUnique({ where: { userId: u.id } });
    if (p) await prisma.profile.update({ where: { id: p.id }, data: { intendedCollege: a.college, intendedMajor: a.major, graduationYear: a.year, isAvailableToMentor: a.mentor, industry: a.industry } });
  }

  // Link all demo students + alumni to Westside Academy
  const schoolLinkedEmails = [
    "thomas@piacentine.dev", "diego.ramirez@nivarro.demo", "aiko.tanaka@nivarro.demo",
    "jordan.hayes@nivarro.demo", "elena@nivarro.demo", "james@nivarro.demo",
    "amara@nivarro.demo", "noah@nivarro.demo", "maya@nivarro.demo",
    "priya@nivarro.io", "marcus@nivarro.io", "zoe@nivarro.io",
  ];
  for (const email of schoolLinkedEmails) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) continue;
    const p = await prisma.profile.findUnique({ where: { userId: u.id } });
    if (p) await prisma.profile.update({ where: { id: p.id }, data: { schoolId } });
  }

  // Student college destinations
  const destinations = [
    { email: "thomas@piacentine.dev",       college: "Stanford University",        major: "Computer Science",           year: 2027 },
    { email: "diego.ramirez@nivarro.demo",  college: "UC Berkeley",                major: "EECS",                       year: 2028 },
    { email: "aiko.tanaka@nivarro.demo",    college: "Carnegie Mellon University", major: "Human-Computer Interaction", year: 2027 },
    { email: "jordan.hayes@nivarro.demo",   college: "MIT",                        major: "Computer Science",           year: 2028 },
    { email: "elena@nivarro.demo",          college: "Yale University",            major: "Political Science",          year: 2027 },
    { email: "james@nivarro.demo",          college: "University of Chicago",      major: "Economics",                  year: 2028 },
    { email: "amara@nivarro.demo",          college: "Georgetown University",      major: "Government & Public Policy", year: 2027 },
    { email: "noah@nivarro.demo",           college: "Harvard University",         major: "Government",                 year: 2028 },
    { email: "maya@nivarro.demo",           college: "Columbia University",        major: "Political Science",          year: 2027 },
  ];
  for (const d of destinations) {
    const u = await prisma.user.findUnique({ where: { email: d.email } });
    if (!u) continue;
    const p = await prisma.profile.findUnique({ where: { userId: u.id } });
    if (p) await prisma.profile.update({ where: { id: p.id }, data: { intendedCollege: d.college, intendedMajor: d.major, graduationYear: d.year } });
  }

  return NextResponse.json({
    ok: true,
    accounts: {
      orgs: [
        { email: "school@nivarro.demo", password: "demo2026", note: "Westside Academy — SCHOOL role, /campaigns + /school/alumni sidebar" },
        { email: "team@nivarro.dev", password: "nivarro2026", note: "Nivarro platform org — verified, paid, full visual identity" },
        { email: "ridgepoint@nivarro.demo", password: "ridgepoint2026", note: "Ridgepoint Policy Fellows — full admin dashboard + mock scholars" },
        { email: "org@nivarro.demo", password: "demo2026", note: "Blank org account — create your own org via /orgs/new" },
        { email: "sunsetpines@nivarro.demo", password: "demo2026", note: "Sunset Pines Senior Living — Veterans Game Studio listing (canonical demo)" },
      ],
      scholars: [
        { email: "thomas@piacentine.dev", password: "demo2026", note: "Thomas Piacentine — BLAZE, grade 12, Palo Alto HS, team lead — Studio 18 (Sunset Pines), archetypes: shark + lion" },
        { email: "diego.ramirez@nivarro.demo", password: "demo2026", note: "Diego Ramirez — DYNAMO, grade 11, prototyper — Studio 18 (Sunset Pines), archetypes: cheetah + wolf" },
        { email: "aiko.tanaka@nivarro.demo", password: "demo2026", note: "Aiko Tanaka — STEEL, grade 12, UX/accessibility — Studio 18 (Sunset Pines), archetypes: owl + tiger" },
        { email: "jordan.hayes@nivarro.demo", password: "demo2026", note: "Jordan Hayes — BLAZE/STEEL, grade 11, systems/networking — Studio 18 (Sunset Pines), archetypes: gorilla + cheetah" },
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
