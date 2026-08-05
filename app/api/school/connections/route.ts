import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function userSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  });
  return {
    id: userId,
    displayName: user?.profile?.displayName ?? user?.name ?? "Unknown",
    avatarUrl: user?.profile?.avatarUrl ?? null,
  };
}

// GET — school admin: queue of accepted requests awaiting room creation, plus history
export async function GET() {
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

  const schoolId = session.user.id;

  const [queue, history] = await Promise.all([
    prisma.connectionRequest.findMany({
      where: { schoolId, status: "ACCEPTED", roomId: null },
      orderBy: { respondedAt: "asc" },
    }),
    prisma.connectionRequest.findMany({
      where: { schoolId, roomId: { not: null } },
      orderBy: { respondedAt: "desc" },
      take: 50,
    }),
  ]);

  const withUsers = async (r: (typeof queue)[number]) => ({
    ...r,
    fromUser: await userSummary(r.fromUserId),
    toUser: await userSummary(r.toUserId),
  });

  const [queueWithUsers, historyWithUsers] = await Promise.all([
    Promise.all(queue.map(withUsers)),
    Promise.all(history.map(withUsers)),
  ]);

  return NextResponse.json({ queue: queueWithUsers, history: historyWithUsers });
}
