import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

type Params = Promise<{ id: string }>;

async function getSchoolId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  // SCHOOL accounts: their own id IS the schoolId
  if (user?.role === 'SCHOOL') return userId;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolId: true },
  });
  return profile?.schoolId ?? null;
}

async function verifyRoomAccess(userId: string, roomId: string) {
  const schoolId = await getSchoolId(userId);
  if (!schoolId) return null;
  const room = await prisma.conversation.findFirst({
    where: { id: roomId, type: 'COMMUNITY', schoolId },
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
