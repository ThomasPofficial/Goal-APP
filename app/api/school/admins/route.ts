import { NextResponse } from "next/server";
import { requireCoreAdmin } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const check = await requireCoreAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const [owner, coreAdmins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: schoolId },
      select: { id: true, email: true, name: true, profile: { select: { displayName: true } } },
    }),
    prisma.profile.findMany({
      where: { schoolId, isCoreAdmin: true },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return NextResponse.json({
    owner: owner
      ? { userId: owner.id, email: owner.email, displayName: owner.profile?.displayName ?? owner.name ?? "Owner" }
      : null,
    coreAdmins: coreAdmins.map((p) => ({ userId: p.userId, email: p.user.email, displayName: p.displayName })),
  });
}
