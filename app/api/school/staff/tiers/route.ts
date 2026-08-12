import { NextRequest, NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, getOrCreateDefaultTiers, type Capability } from "@/lib/facultyPermissions";

export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const tiers = await getOrCreateDefaultTiers(check.schoolId);

  return NextResponse.json({
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name,
      permissions: JSON.parse(t.permissions) as Capability[],
      isSystemDefault: t.isSystemDefault,
    })),
  });
}

export async function POST(req: NextRequest) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => ({}));
  const { name, permissions } = body as { name?: string; permissions?: string[] };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const validPermissions = (permissions ?? []).filter((p): p is Capability =>
    (CAPABILITIES as readonly string[]).includes(p)
  );

  const tier = await prisma.facultyTier.create({
    data: {
      schoolId: check.schoolId,
      name: name.trim(),
      permissions: JSON.stringify(validPermissions),
      isSystemDefault: false,
    },
  });

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name, permissions: validPermissions, isSystemDefault: false },
  });
}
