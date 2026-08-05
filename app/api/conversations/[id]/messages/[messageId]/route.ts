import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// DELETE a message — school admins only, and only within a conversation
// their own school administers (COMMUNITY/MENTORSHIP rooms, which are the
// only conversation types that carry a schoolId).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== 'SCHOOL') {
    return NextResponse.json({ error: 'Only school admins can delete messages' }, { status: 403 });
  }

  const { id: conversationId, messageId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { schoolId: true },
  });
  if (!conversation || conversation.schoolId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  await prisma.message.delete({ where: { id: messageId } });

  return NextResponse.json({ ok: true });
}
