import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function verifyParticipant(userId: string, conversationId: string) {
  return prisma.conversationParticipant.findFirst({ where: { conversationId, userId } });
}

export async function GET(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const participant = await verifyParticipant(session.user.id, conversationId);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ideas = await prisma.ideaNote.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, profile: { select: { displayName: true } } } } },
  });

  return NextResponse.json({
    ideas: ideas.map((n) => ({
      id: n.id,
      content: n.content,
      colorIndex: n.colorIndex,
      createdAt: n.createdAt.toISOString(),
      author: { id: n.author.id, displayName: n.author.profile?.displayName ?? "Unnamed" },
    })),
  });
}

const postSchema = z.object({ content: z.string().min(1).max(280) });

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const participant = await verifyParticipant(session.user.id, conversationId);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const count = await prisma.ideaNote.count({ where: { conversationId } });

  const idea = await prisma.ideaNote.create({
    data: {
      conversationId,
      authorId: session.user.id,
      content: parsed.data.content,
      colorIndex: count % 5,
    },
    include: { author: { select: { id: true, profile: { select: { displayName: true } } } } },
  });

  return NextResponse.json({
    idea: {
      id: idea.id,
      content: idea.content,
      colorIndex: idea.colorIndex,
      createdAt: idea.createdAt.toISOString(),
      author: { id: idea.author.id, displayName: idea.author.profile?.displayName ?? "Unnamed" },
    },
  });
}
