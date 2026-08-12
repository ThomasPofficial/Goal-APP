import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getSchoolIds } from '@/lib/communities';

type Params = Promise<{ id: string }>;

async function verifyRoomAccess(userId: string, roomId: string) {
  const schoolIds = await getSchoolIds(userId);
  if (schoolIds.length === 0) return null;
  const room = await prisma.conversation.findFirst({
    where: { id: roomId, type: 'COMMUNITY', schoolId: { in: schoolIds } },
  });
  return room;
}

// GET — list members with full profile info (school-context: email, phone visible)
export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: roomId } = await params;
  const room = await verifyRoomAccess(session.user.id, roomId);
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Issue 1: For private rooms, verify the requesting user is a participant
  if (room.isPrivateRoom) {
    const membership = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: roomId, userId: session.user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId: roomId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          profile: { select: { displayName: true, avatarUrl: true, phone: true } },
        },
      },
    },
  });

  const members = participants.map((p) => ({
    userId: p.user.id,
    displayName: p.user.profile?.displayName ?? p.user.email ?? 'Unknown',
    avatarUrl: p.user.profile?.avatarUrl ?? null,
    email: p.user.email ?? null,
    phone: p.user.profile?.phone ?? null,
    role: p.user.role,
    isAlumni: p.user.isAlumni,
  }));

  return NextResponse.json({ members });
}

const addSchema = z.object({ userIds: z.array(z.string()).min(1).max(100) });

// POST — admin adds members to a private room
export async function POST(req: Request, { params }: { params: Params }) {
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

  const { id: roomId } = await params;
  const room = await verifyRoomAccess(session.user.id, roomId);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  await prisma.conversationParticipant.createMany({
    data: parsed.data.userIds.map((userId) => ({ conversationId: roomId, userId })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}
