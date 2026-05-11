import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

async function verifyParticipant(userId: string, conversationId: string) {
  const p = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
  });
  return p ?? null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: conversationId } = await params;
  const participant = await verifyParticipant(session.user.id, conversationId);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 50,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ messages });
}

const postSchema = z.object({ content: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: conversationId } = await params;
  const participant = await verifyParticipant(session.user.id, conversationId);
  if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const message = await prisma.message.create({
    data: { conversationId, senderId: session.user.id, content: parsed.data.content },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message });
}
