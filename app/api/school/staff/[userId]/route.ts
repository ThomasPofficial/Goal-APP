import { NextRequest, NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { userId } = await params;

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
    await prisma.profile.update({
      where: { userId },
      data: { staffTierId: null, staffPermissionOverrides: JSON.stringify(validPermissions) },
    });
  } else {
    return NextResponse.json({ error: "tierId or customPermissions required" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
