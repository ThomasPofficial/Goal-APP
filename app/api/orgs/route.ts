import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory, OrgStatus } from "@prisma/client"; // OrgStatus used in GET

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (existingProfile) {
    return NextResponse.json({ error: "Student accounts cannot create organizations" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name, category, website, founded, headquartersLocation,
    tagline, description, whatWeSeek, whatInternsBuild, contactEmail,
    values, logoLetter, logoBg, logoColor, accentColor,
    // project listing
    projectTitle, projectDescription, openSpots, hoursPerWeek, duration,
    format, requiredSkills, preferredGeniusTypes, gradeEligibility,
    applicationMode, appMaterials, autoAccept, stipend, impactStatement,
  } = body;

  if (!name || !category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  const org = await prisma.org.create({
    data: {
      name,
      category: category as OrgCategory,
      website,
      founded,
      headquartersLocation,
      tagline,
      description,
      whatWeSeek,
      whatInternsBuild,
      contactEmail,
      logoLetter,
      logoBg,
      logoColor,
      accentColor,
      values: values ?? "[]",
      focusTags: "[]",
      maxTeamSize: 4,
      minTeamSize: 1,
      stipend,
      autoAccept: autoAccept ?? false,
      createdById: session.user.id,
    },
  });

  // Create first project listing if project title provided
  if (projectTitle?.trim()) {
    await prisma.orgProject.create({
      data: {
        orgId: org.id,
        title: projectTitle.trim(),
        description: projectDescription?.trim(),
        impactStatement: impactStatement?.trim(),
        openSpots: openSpots ?? 1,
        hoursPerWeek,
        duration,
        format,
        requiredSkills: requiredSkills ?? "[]",
        preferredGeniusTypes: preferredGeniusTypes ?? "[]",
        gradeEligibility: gradeEligibility ?? "[]",
        applicationMode: applicationMode ?? "TEAM",
        appMaterials: appMaterials ?? "[]",
        listingStatus: "OPEN",
      },
    });
  }

  return NextResponse.json({ org }, { status: 201 });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const category = searchParams.get("category") as OrgCategory | null;
  const openOnly = searchParams.get("open") === "1";

  const orgs = await prisma.org.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(openOnly ? { status: "OPEN" as OrgStatus } : {}),
    },
    select: {
      id: true, name: true, tagline: true, description: true, category: true,
      status: true, heroUrl: true, accentColor: true, minTeamSize: true,
      maxTeamSize: true, gradeEligibility: true, deadline: true,
      logoLetter: true, logoBg: true, logoColor: true, bannerGradient: true,
      focusTags: true, verified: true,
      _count: { select: { teams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = q
    ? orgs.filter((o) => o.name.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
    : orgs;

  return NextResponse.json({ orgs: filtered });
}
