import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string; userId: string }>;

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminCheck = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (adminCheck?.role !== 'SCHOOL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: roomId, userId } = await params;

  await prisma.conversationParticipant.deleteMany({
    where: { conversationId: roomId, userId },
  });

  return NextResponse.json({ ok: true });
}
