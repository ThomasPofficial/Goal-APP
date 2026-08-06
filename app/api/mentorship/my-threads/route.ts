import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isMentorUser } from "@/lib/mentorship";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [conversations, isMentor] = await Promise.all([
    prisma.conversation.findMany({
      where: { type: "MENTORSHIP", participants: { some: { userId: session.user.id } } },
      include: {
        participants: {
          include: {
            user: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarUrl: true } } } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    isMentorUser(session.user.id),
  ]);

  return NextResponse.json({
    threads: conversations.map((c) => ({
      id: c.id,
      name: c.communityName ?? null,
      canRename: isMentor,
      otherParticipants: c.participants
        .filter((p) => p.userId !== session.user.id)
        .map((p) => ({
          id: p.userId,
          displayName: p.user.profile?.displayName ?? "Unnamed",
          handle: p.user.profile?.handle ?? null,
          avatarUrl: p.user.profile?.avatarUrl ?? null,
        })),
      lastMessage: c.messages[0]
        ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
        : null,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}
