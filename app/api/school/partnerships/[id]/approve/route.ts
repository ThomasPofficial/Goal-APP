import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolCapability } from "@/lib/school-auth";
import { createPartnershipRoom, buildGroupName, partnerUserSummary } from "@/lib/partnerships";

type Params = Promise<{ id: string }>;

// POST — school admin approves an AWAITING_APPROVAL request, creating the group room
export async function POST(_req: Request, { params }: { params: Params }) {
  const check = await requireSchoolCapability("partnerships:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const schoolId = check.schoolId;

  const request = await prisma.partnershipRequest.findUnique({
    where: { id },
    include: { invites: true },
  });
  if (!request || request.schoolId !== schoolId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "AWAITING_APPROVAL") {
    return NextResponse.json({ error: "Not ready for approval" }, { status: 409 });
  }

  const acceptedIds = request.invites.filter((i) => i.status === "ACCEPTED").map((i) => i.userId);
  const participantSummaries = await Promise.all([request.fromUserId, ...acceptedIds].map(partnerUserSummary));
  const groupName = buildGroupName(participantSummaries.map((p) => p.displayName));

  const room = await createPartnershipRoom(schoolId, [request.fromUserId, ...acceptedIds, schoolId], groupName);

  if (request.message) {
    await prisma.message.create({
      data: { conversationId: room.id, senderId: request.fromUserId, content: request.message },
    });
  }

  const updated = await prisma.partnershipRequest.update({
    where: { id },
    data: { status: "APPROVED", roomId: room.id },
  });

  return NextResponse.json({ request: updated, room });
}
