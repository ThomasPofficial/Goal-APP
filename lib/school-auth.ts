import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSchoolSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, status: 401 as const };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") return { error: "Forbidden" as const, status: 403 as const };
  return { schoolId: session.user.id };
}
