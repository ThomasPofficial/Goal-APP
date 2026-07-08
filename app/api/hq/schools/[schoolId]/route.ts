import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") return { error: "Forbidden", status: 403 };
  return { userId: session.user.id };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const check = await getAdminSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { schoolId } = await params;

  // Fetch the school user + profile
  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolId, role: "SCHOOL" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          headline: true,
          advancementEmail: true,
        },
      },
    },
  });

  if (!schoolUser) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  // Fetch all members linked to this school
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

  return NextResponse.json({
    school: {
      id: schoolUser.id,
      email: schoolUser.email,
      createdAt: schoolUser.createdAt.toISOString(),
      profile: schoolUser.profile,
    },
    members,
  });
}
