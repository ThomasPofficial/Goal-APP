import { prisma } from "@/lib/prisma";

export async function isWalledStudent(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { schoolId: true } } },
  });
  return dbUser?.role === "STUDENT" && !!dbUser.profile?.schoolId;
}
