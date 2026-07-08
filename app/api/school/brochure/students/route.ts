import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function scoreStudent(d: { college: string | null; jobTitle: string | null; employer: string | null; internshipTitle: string | null; internshipOrg: string | null } | null): number {
  if (!d) return 0;
  let s = 0;
  if (d.college) s += 1;
  if (d.jobTitle && d.employer) s += 2;
  if (d.internshipTitle && d.internshipOrg) s += 1;
  return s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const schoolId = dbUser.role === "SCHOOL" ? session.user.id : searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const [profiles, settings] = await Promise.all([
    prisma.profile.findMany({
      where: { schoolId },
      select: {
        id: true,
        displayName: true,
        brochureData: {
          select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.schoolBrochureSettings.findUnique({ where: { schoolId }, select: { excludedIds: true } }),
  ]);

  const excluded = new Set<string>(settings ? JSON.parse(settings.excludedIds) : []);

  const students = profiles.map((p) => ({
    profileId:       p.id,
    name:            p.displayName,
    college:         p.brochureData?.college ?? null,
    jobTitle:        p.brochureData?.jobTitle ?? null,
    employer:        p.brochureData?.employer ?? null,
    internshipTitle: p.brochureData?.internshipTitle ?? null,
    internshipOrg:   p.brochureData?.internshipOrg ?? null,
    score:           scoreStudent(p.brochureData ?? null),
    excluded:        excluded.has(p.id),
  }));

  return NextResponse.json({ students });
}
