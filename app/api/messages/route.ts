import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET: list conversations for current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: {
        include: {
          user: {
            include: { profile: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(conversations);
}

// POST: start or get a conversation with a user, then optionally send a first message
const startSchema = z.object({
  recipientId: z.string(),
  message: z.string().min(1).max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const { recipientId, message } = parsed.data;
  const myId = session.user.id;

  // Find existing conversation between the two
  const existing = await prisma.conversation.findFirst({
    where: {
      participants: {
        every: { userId: { in: [myId, recipientId] } },
      },
    },
    include: { participants: true },
  });

  let conversationId: string;

  if (existing && existing.participants.length === 2) {
    conversationId = existing.id;
  } else {
    const convo = await prisma.conversation.create({
      data: {
        participants: {
          createMany: {
            data: [{ userId: myId }, { userId: recipientId }],
          },
        },
      },
    });
    conversationId = convo.id;
  }

  if (message) {
    await prisma.message.create({
      data: { conversationId, senderId: myId, content: message },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  return NextResponse.json({ conversationId });
}
