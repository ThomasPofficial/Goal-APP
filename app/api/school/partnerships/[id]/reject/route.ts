import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolCapability } from "@/lib/school-auth";

type Params = Promise<{ id: string }>;

// POST — school admin declines an AWAITING_APPROVAL request
export async function POST(_req: Request, { params }: { params: Params }) {
  const check = await requireSchoolCapability("partnerships:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const schoolId = check.schoolId;

  const request = await prisma.partnershipRequest.findUnique({ where: { id } });
  if (!request || request.schoolId !== schoolId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "Not ready for rejection" }, { status: 409 });
  }

  const updated = await prisma.partnershipRequest.update({
    where: { id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ request: updated });
}
