import { prisma } from '@/lib/prisma';

/**
 * Resolves the set of schools a user belongs to. SCHOOL-role accounts are
 * their own school. Non-alumni Students have 0-or-1 (their Profile.schoolId).
 * Alumni have 0-to-many, resolved through AlumniSchool.
 */
export async function getSchoolIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isAlumni: true },
  });
  if (user?.role === 'SCHOOL') return [userId];

  if (user?.isAlumni) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return [];
    const links = await prisma.alumniSchool.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
      select: { schoolId: true },
    });
    return links.map((l) => l.schoolId);
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { schoolId: true },
  });
  return profile?.schoolId ? [profile.schoolId] : [];
}

/**
 * Same resolution as getSchoolIds, but returns each school's display name —
 * for UI lists (dashboard greeting, /my-school switcher, profile editor).
 */
export async function getLinkedSchools(userId: string): Promise<{ id: string; name: string }[]> {
  const schoolIds = await getSchoolIds(userId);
  if (schoolIds.length === 0) return [];
  const schools = await prisma.user.findMany({
    where: { id: { in: schoolIds } },
    select: { id: true, name: true, profile: { select: { displayName: true } } },
  });
  const byId = new Map(schools.map((s) => [s.id, s]));
  return schoolIds
    .map((id) => byId.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({ id: s.id, name: s.profile?.displayName ?? s.name ?? 'School' }));
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
