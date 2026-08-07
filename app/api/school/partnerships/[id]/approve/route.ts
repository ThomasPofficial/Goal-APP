import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPartnershipRoom, buildGroupName, partnerUserSummary } from "@/lib/partnerships";

type Params = Promise<{ id: string }>;

// POST — school admin approves an AWAITING_APPROVAL request, creating the group room
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
