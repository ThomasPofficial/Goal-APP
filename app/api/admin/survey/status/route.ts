import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as string | null;
  if (role !== "ADMIN" && role !== "SCHOOL")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = new Date().getFullYear();

  const [totalPool, sent, responded, recentScanEvents] = await Promise.all([
    prisma.user.count({
      where: {
        OR: [
          { isAlumni: true },
          { profile: { graduationYear: { lt: year } } },
        ],
        profile: { surveyOptOut: false },
      },
    }),
    prisma.surveyToken.count({ where: { year } }),
    prisma.surveyToken.count({ where: { year, respondedAt: { not: null } } }),
    prisma.linkedinScanEvent.findMany({
      orderBy: { scannedAt: "desc" },
      take: 50,
      select: {
        id: true,
        scannedAt: true,
        field: true,
        prevValue: true,
        newValue: true,
        user: {
          select: {
            name: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    year,
    totalPool,
    sent,
    responded,
    responseRate: sent > 0 ? Math.round((responded / sent) * 100) : 0,
    recentScanEvents,
  });
}
