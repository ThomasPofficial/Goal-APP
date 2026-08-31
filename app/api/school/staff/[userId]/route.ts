import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSchoolCapability } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, computeEffectivePermissions, type Capability } from "@/lib/facultyPermissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { userId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Nobody edits their own staff record here — this is the self-escalation path
  // a delegated staff:manage holder would otherwise use to widen their own access.
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot change your own staff access" }, { status: 403 });
  }

  // Matches STAFF (already active) and pending invites (still STUDENT, staffInvited
  // true) — the People tab's edit form works on both.
  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      profile: { schoolId: check.schoolId },
      OR: [{ role: "STAFF" }, { role: "STUDENT", profile: { staffInvited: true } }],
    },
    include: { profile: { include: { staffTier: { select: { permissions: true } } } } },
  });
  if (!target?.profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, email, staffTitle, tierId, overrides, revocations } = body as {
    name?: string;
    email?: string;
    staffTitle?: string;
    tierId?: string | null;
    overrides?: string[];
    revocations?: string[];
  };

  const isOwnerOrCoreAdmin = check.isOwner || check.isCoreAdmin;

  if (email !== undefined && email.trim() && email.trim().toLowerCase() !== target.email?.toLowerCase()) {
    try {
      await prisma.user.update({ where: { id: userId }, data: { email: email.trim().toLowerCase() } });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
      }
      throw err;
    }
  }

  const identityData: { displayName?: string; staffTitle?: string | null } = {};
  if (name !== undefined && name.trim()) identityData.displayName = name.trim();
  if (staffTitle !== undefined) identityData.staffTitle = staffTitle.trim() || null;

  let permissionData: { staffTierId?: string | null; staffPermissionOverrides?: string; staffPermissionRevocations?: string } = {};

  if (tierId !== undefined) {
    let newTierPermissionsJson: string | null = null;
    if (tierId) {
      const tier = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
      if (!tier) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      newTierPermissionsJson = tier.permissions;
    }

    const validOverrides = (overrides ?? []).filter((p): p is Capability => (CAPABILITIES as readonly string[]).includes(p));
    const validRevocations = (revocations ?? []).filter((p): p is Capability => (CAPABILITIES as readonly string[]).includes(p));

    const oldEffective = computeEffectivePermissions({
      tierPermissions: target.profile.staffTier?.permissions ?? null,
      overrides: target.profile.staffPermissionOverrides,
      revocations: target.profile.staffPermissionRevocations,
    });
    const newEffective = computeEffectivePermissions({
      tierPermissions: newTierPermissionsJson,
      overrides: JSON.stringify(validOverrides),
      revocations: JSON.stringify(validRevocations),
    });

    // Delegation rule: a plain staff:manage holder may reassign groups and tune
    // any other capability, but never grants or revokes staff:manage itself —
    // only comparing old vs. new means resubmitting an unrelated field on
    // someone whose group already includes staff:manage isn't blocked.
    if (oldEffective.includes("staff:manage") !== newEffective.includes("staff:manage") && !isOwnerOrCoreAdmin) {
      return NextResponse.json({ error: "Only an owner or core admin can change staff management access" }, { status: 403 });
    }

    permissionData = tierId
      ? { staffTierId: tierId, staffPermissionOverrides: JSON.stringify(validOverrides), staffPermissionRevocations: JSON.stringify(validRevocations) }
      : { staffTierId: null, staffPermissionOverrides: JSON.stringify(validOverrides), staffPermissionRevocations: "[]" };
  }

  await prisma.profile.update({
    where: { userId },
    data: { ...identityData, ...permissionData },
  });

  return NextResponse.json({ ok: true });
}
