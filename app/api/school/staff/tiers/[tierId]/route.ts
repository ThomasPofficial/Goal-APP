import { NextRequest, NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, type Capability } from "@/lib/facultyPermissions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { tierId } = await params;

  const existing = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, permissions } = body as { name?: string; permissions?: string[] };

  const data: { name?: string; permissions?: string } = {};
  if (name?.trim()) data.name = name.trim();
  if (permissions) {
    const validPermissions = permissions.filter((p): p is Capability =>
      (CAPABILITIES as readonly string[]).includes(p)
    );
    data.permissions = JSON.stringify(validPermissions);
  }

  const tier = await prisma.facultyTier.update({ where: { id: tierId }, data });

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name, permissions: JSON.parse(tier.permissions), isSystemDefault: tier.isSystemDefault },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { tierId } = await params;

  const existing = await prisma.facultyTier.findFirst({ where: { id: tierId, schoolId: check.schoolId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Staff on this tier fall back to no-permissions rather than a dangling reference.
  await prisma.profile.updateMany({ where: { staffTierId: tierId }, data: { staffTierId: null } });
  await prisma.facultyTier.delete({ where: { id: tierId } });

  return NextResponse.json({ ok: true });
}
