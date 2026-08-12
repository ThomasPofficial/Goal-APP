import { prisma } from "@/lib/prisma";
import { DEFAULT_TIERS } from "@/lib/facultyPermissions";

export async function getOrCreateDefaultTiers(schoolId: string) {
  const existing = await prisma.facultyTier.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
  if (existing.length > 0) return existing;

  await prisma.facultyTier.createMany({
    data: DEFAULT_TIERS.map((t) => ({
      schoolId,
      name: t.name,
      permissions: JSON.stringify(t.permissions),
      isSystemDefault: true,
    })),
  });

  return prisma.facultyTier.findMany({
    where: { schoolId },
    orderBy: { createdAt: "asc" },
  });
}
