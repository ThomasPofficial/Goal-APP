import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import MessagesClient from './MessagesClient';
import { isWalledStudent } from '@/lib/accountGate';
import { isMentorUser } from '@/lib/mentorship';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ dm?: string; group?: string; open?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (await isWalledStudent(session.user.id)) redirect('/dashboard');

  const [myProfile, myOrg, isMentor, dbUser] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, displayName: true, avatarUrl: true },
    }),
    prisma.org.findFirst({
      where: { createdById: session.user.id },
      select: { id: true, name: true },
    }),
    isMentorUser(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
  ]);
  if (!myProfile && !myOrg) redirect('/onboarding');

  const params = await searchParams;

  // If ?dm=userId, find or create a DM and redirect to ?open=convId
  if (params.dm && params.dm !== session.user.id) {
    const targetUserId = params.dm;
    const allIds = [session.user.id, targetUserId];

    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: allIds.map((uid) => ({ participants: { some: { userId: uid } } })),
      },
      include: { participants: true },
    });

    const conv = existing && existing.participants.length === 2
      ? existing
      : await prisma.conversation.create({
          data: {
            type: 'DIRECT',
            participants: { create: allIds.map((userId) => ({ userId })) },
          },
          include: { participants: true },
        });

    redirect(`/messages?open=${conv.id}`);
  }

  // If ?group=convId, just set the open param
  if (params.group) {
    // Self-heal: a school admin who approved the underlying 1:1 connection
    // request should always be able to open the room it created, even if
    // older data predates the fix that adds them as a participant.
    if (dbUser?.role === "SCHOOL") {
      const alreadyIn = await prisma.conversationParticipant.findFirst({
        where: { conversationId: params.group, userId: session.user.id },
      });
      if (!alreadyIn) {
        const approvedRequest = await prisma.connectionRequest.findFirst({
          where: { roomId: params.group, schoolId: session.user.id },
        });
        if (approvedRequest) {
          await prisma.conversationParticipant.create({
            data: { conversationId: params.group, userId: session.user.id },
          });
        }
      }
    }
    redirect(`/messages?open=${params.group}`);
  }

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
        include: {
          user: {
            include: {
              profile: { select: { id: true, displayName: true, avatarUrl: true, handle: true } },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      team: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const serialized = conversations.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.communityName ?? null,
    canRename: c.type === "MENTORSHIP" && isMentor,
    teamId: c.teamId,
    teamName: c.team?.name ?? null,
    updatedAt: c.updatedAt.toISOString(),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    participants: c.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      profile: p.user.profile ?? null,
    })),
  }));

  const initialOpenId = params.open ?? serialized[0]?.id ?? null;

  const resolvedProfile = myProfile
    ? { id: myProfile.id, displayName: myProfile.displayName, avatarUrl: myProfile.avatarUrl }
    : { id: "", displayName: myOrg?.name ?? session.user.name ?? "Org", avatarUrl: null };

  return (
    <MessagesClient
      conversations={serialized}
      myUserId={session.user.id}
      myProfileId={resolvedProfile.id}
      myProfile={resolvedProfile}
      initialOpenId={initialOpenId}
      canSearchAnyone={dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN"}
    />
  );
}
