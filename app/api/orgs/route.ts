import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory, OrgStatus } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.email !== "team.nivarro@gmail.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name, tagline, description, whatWeSeek, category, status,
    heroUrl, accentColor, minTeamSize, maxTeamSize, gradeEligibility,
    deadline, format, location, stipend, autoAccept,
    logoLetter, logoBg, logoColor, bannerGradient, founded, website,
    orgType, values, socialProof, focusTags, memberCount, headquartersLocation,
  } = body;

  if (!name || !category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  const org = await prisma.org.create({
    data: {
      name,
      tagline,
      description,
      whatWeSeek,
      category: category as OrgCategory,
      status: (status ?? "OPEN") as OrgStatus,
      heroUrl,
      accentColor,
      minTeamSize: minTeamSize ?? 1,
      maxTeamSize: maxTeamSize ?? 5,
      gradeEligibility,
      deadline: deadline ? new Date(deadline) : null,
      format,
      location,
      stipend,
      autoAccept: autoAccept ?? false,
      createdById: session.user.id,
      logoLetter,
      logoBg,
      logoColor,
      bannerGradient,
      founded,
      website,
      orgType,
      values: values ? JSON.stringify(values) : "[]",
      socialProof,
      focusTags: focusTags ? JSON.stringify(focusTags) : "[]",
      memberCount,
      headquartersLocation,
    },
  });

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
    include: {
      opportunities: { select: { id: true }, take: 1 },
      _count: { select: { teams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = q
    ? orgs.filter((o) => o.name.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
    : orgs;

  return NextResponse.json({ orgs: filtered });
}
