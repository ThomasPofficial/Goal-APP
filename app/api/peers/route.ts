import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const geniusTypes = searchParams.getAll("geniusType");
  const grades = searchParams.getAll("grade").map(Number).filter(Boolean);
  const interests = searchParams.getAll("interest");

  const profiles = await prisma.profile.findMany({
    take: 500,
    where: {
      NOT: { userId: session.user.id },
      ...(geniusTypes.length > 0 ? { geniusType: { in: geniusTypes as never[] } } : {}),
      ...(grades.length > 0 ? { grade: { in: grades } } : {}),
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      handle: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      currentFocus: true,
      interests: true,
      grade: true,
      schoolName: true,
    },
  });

  let results = profiles.map((p) => ({
    ...p,
    interests: (() => { try { return JSON.parse(p.interests) as string[]; } catch { return []; } })(),
  }));

  if (q) {
    results = results.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.handle?.toLowerCase().includes(q) ||
        p.schoolName?.toLowerCase().includes(q)
    );
  }

  if (interests.length > 0) {
    results = results.filter((p) =>
      interests.some((tag) => p.interests.includes(tag))
    );
  }

  return NextResponse.json({ peers: results });
}
