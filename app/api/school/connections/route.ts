import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolCapability } from "@/lib/school-auth";

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
  const check = await requireSchoolCapability("partnerships:view");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const schoolId = check.schoolId;

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
