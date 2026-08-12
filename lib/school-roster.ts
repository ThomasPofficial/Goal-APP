import { prisma } from "@/lib/prisma";

/**
 * Returns all members (students, staff, and alumni) belonging to a school.
 *
 * Alumni are NOT reliably found via Profile.schoolId — post multi-school-support
 * migration, alumni are linked via the AlumniSchool join table and their
 * Profile.schoolId is null. This unions direct members (schoolId) with
 * alumni-linked members (AlumniSchool) so callers never regress to the
 * pre-migration single-school query.
 *
 * Shared by app/api/school/roster/route.ts (GET) and
 * app/(dashboard)/school/roster/page.tsx (SSR) so both surfaces always
 * return the same members for the same school.
 */
export async function getSchoolRosterMembers(schoolId: string) {
  const [directMembers, alumniLinks] = await Promise.all([
    prisma.profile.findMany({
      where: { schoolId },
      include: {
        user: {
          select: { id: true, email: true, role: true, isAlumni: true, createdAt: true },
        },
      },
    }),
    prisma.alumniSchool.findMany({
      where: { schoolId },
      select: {
        profile: {
          include: {
            user: {
              select: { id: true, email: true, role: true, isAlumni: true, createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  const memberProfiles = [...directMembers, ...alumniLinks.map((l) => l.profile)];

  return memberProfiles
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((p) => ({
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
}
