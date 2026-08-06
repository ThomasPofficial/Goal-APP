import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPrivateRoom } from "@/lib/communities";

type Params = Promise<{ id: string }>;

// POST — school admin approves an accepted request, creating the private room
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

  const connectionRequest = await prisma.connectionRequest.findUnique({ where: { id } });
  if (!connectionRequest || connectionRequest.schoolId !== schoolId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (connectionRequest.status !== "ACCEPTED" || connectionRequest.roomId) {
    return NextResponse.json({ error: "Not ready for approval" }, { status: 409 });
  }

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: connectionRequest.fromUserId },
      select: { name: true, profile: { select: { displayName: true } } },
    }),
    prisma.user.findUnique({
      where: { id: connectionRequest.toUserId },
      select: { name: true, profile: { select: { displayName: true } } },
    }),
  ]);

  const fromName = fromUser?.profile?.displayName ?? fromUser?.name ?? "Student";
  const toName = toUser?.profile?.displayName ?? toUser?.name ?? "Mentor";

  const room = await createPrivateRoom(
    schoolId,
    [connectionRequest.fromUserId, connectionRequest.toUserId],
    `${fromName} & ${toName}`
  );

  if (connectionRequest.message) {
    await prisma.message.create({
      data: {
        conversationId: room.id,
        senderId: connectionRequest.fromUserId,
        content: connectionRequest.message,
      },
    });
  }

  const updated = await prisma.connectionRequest.update({
    where: { id },
    data: { roomId: room.id },
  });

  return NextResponse.json({ request: updated, room });
}
