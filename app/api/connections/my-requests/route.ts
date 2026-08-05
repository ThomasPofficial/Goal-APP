import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function userSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      profile: { select: { displayName: true, avatarUrl: true, handle: true } },
    },
  });
  return {
    id: userId,
    displayName: user?.profile?.displayName ?? user?.name ?? "Unknown",
    avatarUrl: user?.profile?.avatarUrl ?? null,
    handle: user?.profile?.handle ?? null,
  };
}

// GET — the current user's outgoing and incoming connection requests
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [outgoing, incoming] = await Promise.all([
    prisma.connectionRequest.findMany({
      where: { fromUserId: userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.connectionRequest.findMany({
      where: { toUserId: userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const outgoingWithUsers = await Promise.all(
    outgoing.map(async (r) => ({ ...r, otherUser: await userSummary(r.toUserId) }))
  );
  const incomingWithUsers = await Promise.all(
    incoming.map(async (r) => ({ ...r, otherUser: await userSummary(r.fromUserId) }))
  );

  return NextResponse.json({ outgoing: outgoingWithUsers, incoming: incomingWithUsers });
}
