import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import MessagesClient from './MessagesClient';
import type { GeniusTypeKey } from '@/lib/geniusTypes';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ dm?: string; group?: string; open?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, avatarUrl: true, geniusType: true },
  });
  if (!myProfile) redirect('/onboarding');

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
    redirect(`/messages?open=${params.group}`);
  }

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

  const initialOpenId = params.open ?? serialized[0]?.id ?? null;

  return (
    <MessagesClient
      conversations={serialized}
      myUserId={session.user.id}
      myProfileId={myProfile.id}
      myProfile={{
        ...myProfile,
        geniusType: myProfile.geniusType as GeniusTypeKey | null,
      }}
      initialOpenId={initialOpenId}
    />
  );
}
