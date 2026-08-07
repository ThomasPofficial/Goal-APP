import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

// POST — school admin declines an AWAITING_APPROVAL request
export async function POST(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "SCHOOL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const schoolId = session.user.id;

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
