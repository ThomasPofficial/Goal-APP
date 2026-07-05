import { prisma } from '@/lib/prisma';

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
