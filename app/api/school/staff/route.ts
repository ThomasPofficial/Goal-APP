import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSchoolCapability } from "@/lib/school-auth";
import { createStaffInvite } from "@/lib/staffInvite";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

export async function GET() {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const profiles = await prisma.profile.findMany({
    where: {
      schoolId: check.schoolId,
      user: { role: { in: ["STAFF", "STUDENT"] } },
      OR: [{ user: { role: "STAFF" } }, { staffInvited: true }],
    },
    include: { user: { select: { id: true, email: true, role: true } }, staffTier: { select: { id: true, name: true } } },
    orderBy: { displayName: "asc" },
  });

  const toRow = (p: (typeof profiles)[number]) => ({
    userId: p.user.id,
    email: p.user.email,
    displayName: p.displayName,
    staffTitle: p.staffTitle,
    tierId: p.staffTierId,
    tierName: p.staffTierId ? p.staffTier?.name ?? null : "Custom",
    isCustom: !p.staffTierId,
    isCoreAdmin: p.isCoreAdmin,
    overrides: JSON.parse(p.staffPermissionOverrides || "[]") as Capability[],
    revocations: JSON.parse(p.staffPermissionRevocations || "[]") as Capability[],
  });

  return NextResponse.json({
    staff: profiles.filter((p) => p.user.role === "STAFF").map(toRow),
    pendingInvites: profiles.filter((p) => p.user.role === "STUDENT").map(toRow),
  });
}

export async function POST(req: NextRequest) {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => ({}));
  const { email, tierId, customPermissions, staffTitle, name, makeCoreAdmin } = body as {
    email?: string;
    tierId?: string | null;
    customPermissions?: string[];
    staffTitle?: string;
    name?: string;
    makeCoreAdmin?: boolean;
  };

  if (!email?.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (tierId) {
    const tier = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
    if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const validCustomPermissions = (customPermissions ?? []).filter((p): p is Capability =>
    (CAPABILITIES as readonly string[]).includes(p)
  );
  // A tier assignment discards the custom list entirely, so only the custom path
  // can smuggle in a capability.
  const effectiveCustomPermissions: Capability[] = tierId ? [] : validCustomPermissions;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isOwnerOrCoreAdmin = check.isOwner || check.isCoreAdmin;
  if (!isOwnerOrCoreAdmin && effectiveCustomPermissions.includes("staff:manage")) {
    return NextResponse.json(
      { error: "Only the school account can grant staff management access" },
      { status: 403 }
    );
  }
  // Inviting your own already-staff email lands in createStaffInvite's "already-staff"
  // branch, which rewrites that profile's tier/overrides — i.e. the same self-edit the
  // PATCH route refuses. Close it here too. (A SCHOOL owner's own email can't reach the
  // invite path at all: createStaffInvite rejects non-STUDENT/STAFF account types.)
  if (
    !isOwnerOrCoreAdmin &&
    session.user.email &&
    session.user.email.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    return NextResponse.json({ error: "You cannot change your own staff access" }, { status: 403 });
  }

  try {
    const result = await createStaffInvite({
      email: email.trim(),
      schoolId: check.schoolId,
      tierId: tierId ?? null,
      customPermissions: effectiveCustomPermissions,
      staffTitle,
      displayName: name,
      isCoreAdmin: isOwnerOrCoreAdmin ? !!makeCoreAdmin : false,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
