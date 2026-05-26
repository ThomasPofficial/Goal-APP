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

  // Idempotent — don't create twice
  const existing = await prisma.org.findFirst({ where: { createdById: user.id } });
  if (existing) {
    return NextResponse.json({ message: "Already seeded", orgId: existing.id, email, password });
  }

  const org = await prisma.org.create({
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

  const project = await prisma.orgProject.create({
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
      status: "OPEN",
    },
  });

  return NextResponse.json(
    { message: "Seeded", orgId: org.id, projectId: project.id, email, password },
    { status: 201 }
  );
}
