import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// GET — list all community rooms the current user is in (for their school)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  let effectiveSchoolId: string | null = null;
  if (userRecord?.role === 'SCHOOL') {
    effectiveSchoolId = session.user.id;
  } else {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { schoolId: true },
    });
    effectiveSchoolId = profile?.schoolId ?? null;
  }

  if (!effectiveSchoolId) {
    return NextResponse.json({ rooms: [] });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'COMMUNITY',
      schoolId: effectiveSchoolId,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { participants: true } },
    },
    orderBy: [{ isPrivateRoom: 'asc' }, { updatedAt: 'desc' }],
  });

  const rooms = conversations.map((c) => ({
    id: c.id,
    communityName: c.communityName,
    isPrivateRoom: c.isPrivateRoom,
    memberCount: c._count.participants,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return NextResponse.json({ rooms });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  participantIds: z.array(z.string()).min(1).max(200),
});

// POST — admin creates a private room
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only school admin accounts can create rooms
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== 'SCHOOL') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  // schoolId for a SCHOOL user is their own id
  const schoolId = session.user.id;
  const allIds = [...new Set([session.user.id, ...parsed.data.participantIds])];

  const room = await prisma.conversation.create({
    data: {
      type: 'COMMUNITY',
      schoolId,
      isPrivateRoom: true,
      communityName: parsed.data.name,
      participants: {
        create: allIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ room });
}
