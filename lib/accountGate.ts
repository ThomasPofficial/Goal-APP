import { prisma } from "@/lib/prisma";

export async function isWalledStudent(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isAlumni: true,
      profile: { select: { id: true, schoolId: true } },
    },
  });
  if (dbUser?.role !== "STUDENT" || !dbUser.profile) return false;

  if (dbUser.isAlumni) {
    const linkCount = await prisma.alumniSchool.count({
      where: { profileId: dbUser.profile.id },
    });
    return linkCount > 0;
  }

  return !!dbUser.profile.schoolId;
}
