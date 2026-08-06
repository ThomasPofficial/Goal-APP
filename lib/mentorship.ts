import { prisma } from "@/lib/prisma";

export async function isMentorUser(userId: string): Promise<boolean> {
  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { staffTitle: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAlumni: true } }),
  ]);
  return Boolean(profile?.staffTitle) || Boolean(user?.isAlumni);
}
