import { prisma } from '@/lib/prisma';

/**
 * Resolves a user's schoolId. SCHOOL-role accounts are their own schoolId;
 * everyone else's comes from their Profile.
 */
export async function getSchoolId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === 'SCHOOL') return userId;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolId: true },
  });
  return profile?.schoolId ?? null;
}

/**
 * Creates a private (isPrivateRoom: true) COMMUNITY conversation for the given
 * school with the given participants. Used for admin-created rooms and for
 * teacher-approved 1:1 connection rooms.
 */
export async function createPrivateRoom(
  schoolId: string,
  participantIds: string[],
  communityName: string
): Promise<{ id: string }> {
  const uniqueIds = [...new Set(participantIds)];
  return prisma.conversation.create({
    data: {
      type: 'COMMUNITY',
      schoolId,
      isPrivateRoom: true,
      communityName,
      participants: {
        create: uniqueIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });
}

/**
 * Finds or creates the school-wide general COMMUNITY conversation for the given
 * school, then upserts the user as a participant. Safe to call multiple times.
 */
export async function ensureSchoolGeneralRoom(
  schoolId: string,
  userId: string
): Promise<{ id: string }> {
  let conv = await prisma.conversation.findFirst({
    where: { type: 'COMMUNITY', schoolId, isPrivateRoom: false },
    select: { id: true },
  });

  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        type: 'COMMUNITY',
        schoolId,
        isPrivateRoom: false,
        communityName: 'General',
      },
      select: { id: true },
    });
  }

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId: conv.id, userId } },
    create: { conversationId: conv.id, userId },
    update: {},
  });

  return conv;
}
