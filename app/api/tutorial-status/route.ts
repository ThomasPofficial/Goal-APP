import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      traitLinks: { select: { id: true }, take: 1 },
      teamMemberships: { select: { id: true }, take: 1 },
    },
  });

  const traitsDone = (profile?.traitLinks?.length ?? 0) > 0;
  const hasTeam = (profile?.teamMemberships?.length ?? 0) > 0;

  const hasApplied = hasTeam && profile?.id
    ? (await prisma.teamApplication.count({
        where: { team: { members: { some: { profileId: profile.id } } } },
      })) > 0
    : false;

  return NextResponse.json({
    traitsDone,
    hasTeam,
    hasApplied,
    hasBrowsedOrgs: hasTeam || hasApplied,
  });
}
