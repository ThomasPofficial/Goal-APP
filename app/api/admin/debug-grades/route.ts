import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Temporary diagnostic for the /peers grade-filter bug report. Remove after use.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await prisma.profile.findMany({
    select: { id: true, displayName: true, grade: true, geniusType: true, isDemo: true },
  });

  const byGrade: Record<string, number> = {};
  const byGeniusType: Record<string, number> = {};
  for (const p of all) {
    const g = String(p.grade);
    byGrade[g] = (byGrade[g] ?? 0) + 1;
    const gt = String(p.geniusType);
    byGeniusType[gt] = (byGeniusType[gt] ?? 0) + 1;
  }

  return NextResponse.json({ totalProfiles: all.length, byGrade, byGeniusType, sample: all.slice(0, 30) });
}
