import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireSchoolCapability } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

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
  // requireSchoolCapability returns the caller's own id as schoolId only for
  // SCHOOL/ADMIN; a delegated STAFF caller gets the school-owner's (different) id.
  const isSchoolOwner = check.schoolId === session.user.id;

  // Nobody edits their own staff record here — this is the self-escalation path
  // a delegated staff:manage holder would otherwise use to widen their own access.
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You cannot change your own staff access" }, { status: 403 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, role: "STAFF", profile: { schoolId: check.schoolId } },
    include: { profile: true },
  });
  if (!target?.profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { tierId, customPermissions } = body as { tierId?: string | null; customPermissions?: string[] };

  if (tierId !== undefined) {
    if (tierId) {
      const tier = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
      if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }
    await prisma.profile.update({
      where: { userId },
      data: { staffTierId: tierId, staffPermissionOverrides: "[]" },
    });
  } else if (customPermissions !== undefined) {
    const validPermissions = customPermissions.filter((p): p is Capability =>
      (CAPABILITIES as readonly string[]).includes(p)
    );
    // Delegation rule: a STAFF user with staff:manage may assign existing tiers,
    // but may never hand out staff:manage itself. Only the school owner can.
    if (!isSchoolOwner && validPermissions.includes("staff:manage")) {
      return NextResponse.json(
        { error: "Only the school account can grant staff management access" },
        { status: 403 }
      );
    }
    await prisma.profile.update({
      where: { userId },
      data: { staffTierId: null, staffPermissionOverrides: JSON.stringify(validPermissions) },
    });
  } else {
    return NextResponse.json({ error: "tierId or customPermissions required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
