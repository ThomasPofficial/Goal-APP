<<<<<<< Updated upstream
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MessagesClient from "./MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; convoId?: string }>;
}) {
=======
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import MessagesClient from './MessagesClient';
import type { GeniusTypeKey } from '@/lib/geniusTypes';

export default async function MessagesPage() {
>>>>>>> Stashed changes
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, avatarUrl: true, geniusType: true },
  });
  if (!myProfile) redirect('/onboarding');

  // Coming from a profile's Message button — create/find conversation then redirect
  if (params.userId && myId) {
    const recipientId = params.userId;
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: myId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: { participants: { select: { userId: true } } },
    });
    let convoId: string;
    if (existing && existing.participants.length === 2) {
      convoId = existing.id;
    } else {
      const convo = await prisma.conversation.create({
        data: {
          participants: { createMany: { data: [{ userId: myId }, { userId: recipientId }] } },
        },
      });
      convoId = convo.id;
    }
    redirect(`/messages?convoId=${convoId}`);
  }

  // convoId param: which conversation to open on load
  const openConvoId = params.convoId ?? null;

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
<<<<<<< Updated upstream
      initialConversations={formatted}
      currentUserId={myId}
      openConvoId={openConvoId}
=======
      conversations={serialized}
      myUserId={session.user.id}
      myProfileId={myProfile.id}
      myProfile={{
        ...myProfile,
        geniusType: myProfile.geniusType as GeniusTypeKey | null,
      }}
>>>>>>> Stashed changes
    />
  );
}
