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

  // Issue 3: Verify the room belongs to this admin's school (SCHOOL user's schoolId = their own id)
  const adminSchoolId = session.user.id;
  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: { schoolId: true, isPrivateRoom: true },
  });
  if (!room || room.schoolId !== adminSchoolId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Issue 2: Prevent removing members from the General Room
  if (!room.isPrivateRoom) {
    return NextResponse.json({ error: 'Cannot remove members from the General Room' }, { status: 400 });
  }

  await prisma.conversationParticipant.deleteMany({
    where: { conversationId: roomId, userId },
  });

  return NextResponse.json({ ok: true });
}
