import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, computeEffectivePermissions, hasCapability, type Capability } from "@/lib/facultyPermissions";

type AuthError = { error: "Unauthorized"; status: 401 } | { error: "Forbidden"; status: 403 };

// Single source of truth for "what can this caller do at their school right now."
// SCHOOL/ADMIN implicitly have every capability. A Core Admin STAFF also has every
// capability (bypasses the tier system entirely). A plain STAFF gets the tier +
// override - revocation computation.
export async function getSchoolCapabilities(): Promise<
  { schoolId: string; isOwner: boolean; isCoreAdmin: boolean; capabilities: Capability[] } | AuthError
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      profile: {
        select: {
          schoolId: true,
          isCoreAdmin: true,
          staffPermissionOverrides: true,
          staffPermissionRevocations: true,
          staffTier: { select: { permissions: true } },
        },
      },
    },
  });

  if (dbUser?.role === "SCHOOL" || dbUser?.role === "ADMIN") {
    return { schoolId: session.user.id, isOwner: true, isCoreAdmin: false, capabilities: [...CAPABILITIES] };
  }

  if (dbUser?.role === "STAFF" && dbUser.profile?.schoolId) {
    if (dbUser.profile.isCoreAdmin) {
      return { schoolId: dbUser.profile.schoolId, isOwner: false, isCoreAdmin: true, capabilities: [...CAPABILITIES] };
    }
    const capabilities = computeEffectivePermissions({
      tierPermissions: dbUser.profile.staffTier?.permissions ?? null,
      overrides: dbUser.profile.staffPermissionOverrides,
      revocations: dbUser.profile.staffPermissionRevocations,
    });
    return { schoolId: dbUser.profile.schoolId, isOwner: false, isCoreAdmin: false, capabilities };
  }

  return { error: "Forbidden", status: 403 };
}

export async function requireSchoolCapability(
  capability: Capability
): Promise<{ schoolId: string; isOwner: boolean; isCoreAdmin: boolean } | AuthError> {
  const check = await getSchoolCapabilities();
  if ("error" in check) return check;
  if (!hasCapability(check.capabilities, capability)) return { error: "Forbidden", status: 403 };
  return { schoolId: check.schoolId, isOwner: check.isOwner, isCoreAdmin: check.isCoreAdmin };
}

// For the three actions capped at Owner/Core-Admin regardless of any tier:
// creating/editing FacultyTier definitions, promoting/demoting Core Admins,
// and granting/revoking the staff:manage capability itself.
export async function requireCoreAdmin(): Promise<
  { schoolId: string; isOwner: boolean; isCoreAdmin: boolean } | AuthError
> {
  const check = await getSchoolCapabilities();
  if ("error" in check) return check;
  if (!check.isOwner && !check.isCoreAdmin) return { error: "Forbidden", status: 403 };
  return { schoolId: check.schoolId, isOwner: check.isOwner, isCoreAdmin: check.isCoreAdmin };
}
