import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";

export async function GET() {
  const check = await requireSchoolCapability("roster:view");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const memberProfiles = await prisma.profile.findMany({
    where: { schoolId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          createdAt: true,
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const members = memberProfiles.map((p) => ({
    profileId: p.id,
    userId: p.userId,
    displayName: p.displayName,
    email: p.user.email ?? null,
    phone: p.phone ?? null,
    role: p.user.role,
    isAlumni: p.user.isAlumni,
    staffTitle: p.staffTitle ?? null,
    graduationYear: p.graduationYear ?? null,
    industry: p.industry ?? null,
    intendedCollege: p.intendedCollege ?? null,
    intendedMajor: p.intendedMajor ?? null,
    isAvailableToMentor: p.isAvailableToMentor,
    createdAt: p.user.createdAt.toISOString(),
  }));

  return NextResponse.json({ members });
}
