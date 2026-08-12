import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isMentorUser } from "@/lib/mentorship";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isMentor = await isMentorUser(session.user.id);

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
        include: {
          user: {
            include: {
              profile: { select: { id: true, displayName: true, avatarUrl: true, handle: true } },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      team: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = conversations.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.communityName ?? null,
    canRename: c.type === "MENTORSHIP" && isMentor,
    teamId: c.teamId,
    teamName: c.team?.name ?? null,
    updatedAt: c.updatedAt.toISOString(),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    participants: c.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      profile: p.user.profile ?? null,
    })),
  }));

  return NextResponse.json({ conversations: serialized });
}

const schema = z.object({
  participantIds: z.array(z.string()).min(1).max(10),
  type: z.enum(["DIRECT", "GROUP"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const { participantIds, type } = parsed.data;
  const allParticipantIds = [...new Set([session.user.id, ...participantIds])];

  // Deduplicate DMs: if exactly 2 participants, find existing DIRECT conversation
  if (type === "DIRECT" && allParticipantIds.length === 2) {
    const existing = await prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        participants: { every: { userId: { in: allParticipantIds } } },
      },
      include: { participants: true },
    });
    if (existing && existing.participants.length === 2) {
      return NextResponse.json({ conversation: existing });
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      type,
      participants: {
        create: allParticipantIds.map((userId) => ({ userId })),
      },
    },
    include: { participants: true },
  });

  return NextResponse.json({ conversation });
}
