import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeEffectivePermissions, hasCapability, type Capability } from "@/lib/facultyPermissions";

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

export async function requireSchoolCapability(capability: Capability) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" as const, status: 401 as const };

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      profile: {
        select: {
          schoolId: true,
          staffPermissionOverrides: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  if (dbUser?.role === "SCHOOL" || dbUser?.role === "ADMIN") {
    return { schoolId: session.user.id };
  }

  if (dbUser?.role === "STAFF" && dbUser.profile?.schoolId) {
    const perms = computeEffectivePermissions({
      tierPermissions: dbUser.profile.staffTier?.permissions ?? null,
      overrides: dbUser.profile.staffPermissionOverrides,
    });
    if (hasCapability(perms, capability)) {
      return { schoolId: dbUser.profile.schoolId };
    }
  }

  return { error: "Forbidden" as const, status: 403 as const };
}
