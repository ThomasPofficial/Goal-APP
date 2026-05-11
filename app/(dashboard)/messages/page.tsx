import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import MessagesClient from './MessagesClient';
import type { GeniusTypeKey } from '@/lib/geniusTypes';

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, avatarUrl: true, geniusType: true },
  });
  if (!myProfile) redirect('/onboarding');

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
        include: {
          user: {
            include: {
              profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true } },
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
    name: null as string | null,
    teamId: c.teamId,
    teamName: c.team?.name ?? null,
    updatedAt: c.updatedAt.toISOString(),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    participants: c.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      profile: p.user.profile
        ? { ...p.user.profile, geniusType: p.user.profile.geniusType as GeniusTypeKey | null }
        : null,
    })),
  }));

  return (
    <MessagesClient
      conversations={serialized}
      myUserId={session.user.id}
      myProfileId={myProfile.id}
      myProfile={{
        ...myProfile,
        geniusType: myProfile.geniusType as GeniusTypeKey | null,
      }}
    />
  );
}
