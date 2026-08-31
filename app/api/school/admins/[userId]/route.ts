import { NextRequest, NextResponse } from "next/server";
import { requireCoreAdmin } from "@/lib/school-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const check = await requireCoreAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { userId } = await params;

  // The Owner is the literal data anchor for this school (every school-scoped
  // record FKs to this exact User.id) — it can never be demoted or removed here.
  if (userId === check.schoolId) {
    return NextResponse.json({ error: "The owner account cannot be changed here" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { isCoreAdmin } = body as { isCoreAdmin?: boolean };
  if (typeof isCoreAdmin !== "boolean") {
    return NextResponse.json({ error: "isCoreAdmin (boolean) is required" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, role: "STAFF", profile: { schoolId: check.schoolId } },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Demotion intentionally does NOT touch staffTierId/staffPermissionOverrides —
  // whatever group/custom permissions this person had before promotion are still
  // there and take effect again immediately.
  await prisma.profile.update({ where: { userId }, data: { isCoreAdmin } });

  return NextResponse.json({ ok: true });
}
