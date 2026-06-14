import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const session = await auth();
  const isAdmin = session?.user?.email === "team.nivarro@gmail.com";
  const hasSecret = secret === "niv-reset-2026";
  if (!isAdmin && !hasSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = "ridgepoint@nivarro.demo";
  const password = "ridgepoint2026";

  // Create or find the demo user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({
      data: { name: "Ridgepoint Policy Fellows", email, passwordHash },
    });
  }

  // Idempotent — find or create the org
  let org = await prisma.org.findFirst({ where: { createdById: user.id } });
  let alreadySeeded = false;

  if (!org) {
    org = await prisma.org.create({
      data: {
        name: "Ridgepoint Policy Fellows",
        tagline: "Putting the next generation of policy thinkers inside the rooms that matter.",
        description:
          "Bridgepoint places high school and college students inside government offices, think tanks, and advocacy organizations as embedded research fellows. You are not there to observe. You are there to contribute. Fellows produce real policy memos, legislative briefs, and public-facing reports that staff actually use. Past fellows have been cited in congressional testimony and published in national outlets.",
        whatWeSeek:
          "Writers and analysts who understand that good policy is really just good argument backed by evidence. Strong research skills required. Interest in economics, law, or public affairs preferred.",
        whatInternsBuild:
          "Policy memos, legislative briefs, and public-facing research reports that host organizations actually use. Past fellows have been cited in congressional testimony and published in national outlets.",
        category: "RESEARCH",
        status: "OPEN",
        accentColor: "#1B4F8A",
        logoBg: "#1B4F8A",
        logoColor: "#FFFFFF",
        logoLetter: "R",
        minTeamSize: 1,
        maxTeamSize: 2,
        format: "Remote",
        stipend: "$500 research stipend",
        founded: "2019",
        memberCount: 22,
        orgType: "Policy Research Fellowship",
        values: JSON.stringify(["Rigor", "Clarity", "Civic Responsibility", "Impact"]),
        focusTags: JSON.stringify(["Public Policy", "Law", "Economics", "Government", "Research"]),
        createdById: user.id,
      },
    });

    await prisma.orgProject.create({
      data: {
        orgId: org.id,
        title: "2026 Research Fellows — Policy & Legislative Analysis",
        shortDescription:
          "Embedded research fellowship inside a government office, think tank, or advocacy org. You write real memos. Real people read them.",
        description:
          "Selected fellows are placed inside partner organizations for an 8-week research fellowship. You will be assigned a policy area, given a supervisor, and expected to produce at minimum: two internal research memos, one legislative brief, and a final public-facing report. Work product is reviewed and used by staff — not filed away. This is not a shadowing program.",
        requiredSkills: JSON.stringify([
          "Research",
          "Writing",
          "Policy Analysis",
          "Critical Thinking",
          "Citation & Sourcing",
        ]),
        preferredGeniusTypes: JSON.stringify(["STEEL", "BLAZE"]),
        openSpots: 4,
        hoursPerWeek: "10–15 hrs/week",
        duration: "8 weeks",
        format: "Remote with optional DC cohort events",
        listingStatus: "OPEN",
      },
    });
  } else {
    alreadySeeded = true;
  }

  // ── Seed the closed past project ──────────────────────────────────────────
  const PAST_PROJECT_TITLE = "2025 Economic Mobility Research Fellowship";
  let pastProject = await prisma.orgProject.findFirst({
    where: { orgId: org.id, title: PAST_PROJECT_TITLE },
  });
  if (!pastProject) {
    pastProject = await prisma.orgProject.create({
      data: {
        orgId: org.id,
        title: PAST_PROJECT_TITLE,
        shortDescription:
          "Fellows researched barriers to economic mobility for first-generation college students. Work cited in state legislative hearing.",
        listingStatus: "CLOSED",
        closedAt: new Date("2025-08-15"),
        outcomeNote:
          "Fellows produced three policy briefs cited in the Massachusetts Joint Committee on Education hearing on college affordability.",
        openSpots: 3,
        duration: "10 weeks",
        hoursPerWeek: "12-15 hrs/week",
      },
    });
  }

  // ── Seed 5 policy scholars ────────────────────────────────────────────────
  const scholars = [
    {
      email: "elena@nivarro.demo",
      name: "Elena Vasquez",
      displayName: "Elena Vasquez",
      handle: "elenavasquez",
      headline: "Policy Researcher & Legislative Analyst",
      bio: "I track how bills become law and what gets lost in translation. Two years writing policy memos for my state senator's office taught me that good research means nothing if you can't explain it to a staffer in 90 seconds.",
      strengthSummary:
        "Exceptional at translating dense regulatory material into clear, action-oriented briefs. Has a rare instinct for the political dimension of policy questions — not just the technical.",
      geniusType: "STEEL" as const,
      secondaryGeniusType: null,
      grade: 12,
      schoolName: "Phillips Academy Andover",
      interests: ["Public Policy", "Legislative Research", "Economics", "Law", "Government"],
    },
    {
      email: "james@nivarro.demo",
      name: "James Okafor",
      displayName: "James Okafor",
      handle: "jamesokafor",
      headline: "Economist & Quantitative Policy Analyst",
      bio: "I build economic models that actually hold up when tested against real data. Spent last summer modeling labor market impacts of proposed minimum wage legislation for a DC think tank. The model held.",
      strengthSummary:
        "Strong quantitative chops paired with genuine policy intuition. Rare combination — most economists at his level can run the model but can't write the policy brief. He does both.",
      geniusType: "STEEL" as const,
      secondaryGeniusType: "BLAZE" as const,
      grade: 11,
      schoolName: "Thomas Jefferson High School for Science and Technology",
      interests: ["Economics", "Data Analysis", "Labor Policy", "Quantitative Research", "Public Finance"],
    },
    {
      email: "amara@nivarro.demo",
      name: "Amara Singh",
      displayName: "Amara Singh",
      handle: "amarasingh",
      headline: "Civic Advocate & Communications Strategist",
      bio: "I run a youth civic engagement program that's moved 400 first-time voters in two election cycles. I know how to get people to care about things they think don't affect them.",
      strengthSummary:
        "Outstanding communicator with genuine field experience. Brings an organizer's instinct to policy work — she thinks about implementation and uptake, not just the research.",
      geniusType: "BLAZE" as const,
      secondaryGeniusType: null,
      grade: 12,
      schoolName: "Mission San Jose High School",
      interests: ["Civic Engagement", "Public Policy", "Communications", "Advocacy", "Government Reform"],
    },
    {
      email: "noah@nivarro.demo",
      name: "Noah Chen",
      displayName: "Noah Chen",
      handle: "noahchen",
      headline: "Legal Researcher & Constitutional Scholar",
      bio: "I read primary legal sources. Not summaries — sources. Currently working through the administrative law decisions that shape how federal agencies actually operate, because that's where most policy actually gets made.",
      strengthSummary:
        "Unusually rigorous legal researcher for a high school student. Thinks in precedent and statutory interpretation. Best suited for projects that require deep primary source work.",
      geniusType: "STEEL" as const,
      secondaryGeniusType: null,
      grade: 11,
      schoolName: "Stuyvesant High School",
      interests: ["Constitutional Law", "Administrative Law", "Legal Research", "Government", "Policy Analysis"],
    },
    {
      email: "maya@nivarro.demo",
      name: "Maya Thompson",
      displayName: "Maya Thompson",
      handle: "mayathompson",
      headline: "Social Impact Researcher & Writer",
      bio: "I write about systems — how they fail, who they fail, and what rigorous research says about fixing them. Three published op-eds in regional outlets. I understand that writing is just argument with better packaging.",
      strengthSummary:
        "Excellent writer with strong research fundamentals. Her work connects evidence to narrative without losing either. Particularly good at framing complex findings for general audiences.",
      geniusType: "BLAZE" as const,
      secondaryGeniusType: "STEEL" as const,
      grade: 12,
      schoolName: "Westlake High School",
      interests: ["Social Policy", "Research Writing", "Journalism", "Education Policy", "Inequality"],
    },
  ];

  const scholarProfiles: { email: string; profileId: string }[] = [];

  for (const s of scholars) {
    const scholarPasswordHash = await bcrypt.hash("scholar2026", 10);
    const scholarUser = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name },
      create: { name: s.name, email: s.email, passwordHash: scholarPasswordHash },
    });

    const profile = await prisma.profile.upsert({
      where: { userId: scholarUser.id },
      update: {
        displayName: s.displayName,
        handle: s.handle,
        headline: s.headline,
        bio: s.bio,
        strengthSummary: s.strengthSummary,
        geniusType: s.geniusType,
        secondaryGeniusType: s.secondaryGeniusType ?? undefined,
        grade: s.grade,
        schoolName: s.schoolName,
        interests: JSON.stringify(s.interests),
      },
      create: {
        userId: scholarUser.id,
        displayName: s.displayName,
        handle: s.handle,
        headline: s.headline,
        bio: s.bio,
        strengthSummary: s.strengthSummary,
        geniusType: s.geniusType,
        secondaryGeniusType: s.secondaryGeniusType ?? undefined,
        grade: s.grade,
        schoolName: s.schoolName,
        interests: JSON.stringify(s.interests),
      },
    });

    scholarProfiles.push({ email: s.email, profileId: profile.id });
  }

  // ── Write OrgReview records for Elena, James, Amara ──────────────────────
  const reviewData = [
    {
      email: "elena@nivarro.demo",
      body: "Elena was our lead writer for the economic mobility brief. She came in with a structured outline on day one and never lost the thread. The brief she produced — on transfer student credential loss — was cited verbatim in the committee hearing. What distinguished her work wasn't just the quality of the writing; it was that she understood the committee's actual decision-making context and wrote toward it. She knew the brief needed to give staffers a quotable line and a two-sentence summary, and she delivered both without being asked. First-choice fellow for any project that requires final deliverables with real audiences.",
    },
    {
      email: "james@nivarro.demo",
      body: "James built the quantitative backbone of the project. He developed a methodology for measuring economic mobility barriers that held up to scrutiny from our partner think tank's senior economists — that is not a low bar. More importantly, he could explain every design decision in plain English, which meant the qualitative researchers could actually use his output. He is not the kind of analyst who disappears into the numbers and comes back with a black box. His work shaped the final findings materially. He's also fast — he turned around a revised model in 36 hours when we got new data mid-project. High-value collaborator.",
    },
    {
      email: "amara@nivarro.demo",
      body: "Amara led our community engagement component, which we honestly underestimated when we designed the fellowship. She turned what we thought would be a background research task — gathering lived-experience narratives to ground the quantitative findings — into the most-cited section of the final brief. The committee chair specifically referenced the first-person accounts she collected. She also ran our final presentation rehearsals and reframed two of the slides when she felt the argument wasn't landing. She operates as a collaborator, not just an executor. Would invite her back for any project with a public-facing component.",
    },
  ];

  for (const r of reviewData) {
    const sp = scholarProfiles.find((p) => p.email === r.email);
    if (!sp) continue;

    await prisma.orgReview.upsert({
      where: {
        orgProjectId_profileId: {
          orgProjectId: pastProject.id,
          profileId: sp.profileId,
        },
      },
      update: {
        body: r.body,
        deadline: new Date("2025-08-22"),
      },
      create: {
        orgId: org.id,
        orgProjectId: pastProject.id,
        profileId: sp.profileId,
        body: r.body,
        deadline: new Date("2025-08-22"),
      },
    });
  }

  return NextResponse.json(
    {
      message: alreadySeeded ? "Org already existed — scholars and reviews seeded" : "Fully seeded",
      orgId: org.id,
      pastProjectId: pastProject.id,
      scholarsSeeded: scholarProfiles.map((p) => p.email),
      email,
      password,
    },
    { status: 201 }
  );
}
