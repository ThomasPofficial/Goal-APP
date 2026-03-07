import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MessagesClient from "./MessagesClient";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const session = await auth();
  const myId = session?.user?.id ?? "";
  const params = await searchParams;

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: myId } } },
    include: {
      participants: {
        include: {
          user: { include: { profile: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { id: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Format conversations for display
  const formatted = conversations.map((c) => {
    const otherParticipant = c.participants.find((p) => p.userId !== myId);
    const lastMessage = c.messages[0];
    return {
      id: c.id,
      otherUser: {
        id: otherParticipant?.userId ?? "",
        name: otherParticipant?.user.profile?.displayName ?? otherParticipant?.user.name ?? "Unknown",
        avatarUrl: otherParticipant?.user.profile?.avatarUrl ?? null,
      },
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            isMe: lastMessage.sender.id === myId,
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  return (
    <MessagesClient
      initialConversations={formatted}
      currentUserId={myId}
      openWithUserId={params.userId ?? null}
    />
  );
}
