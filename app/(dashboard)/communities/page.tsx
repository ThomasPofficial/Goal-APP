import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CommunitiesClient from "./CommunitiesClient";
import { ensureSchoolGeneralRoom } from "@/lib/communities";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // School admin accounts (role=SCHOOL) use their own id as schoolId
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { schoolId: true, displayName: true },
    }),
  ]);

  const isAdmin = user?.role === "SCHOOL";
  const schoolId = isAdmin ? session.user.id : (profile?.schoolId ?? null);

  // Ensure the General Room exists for school admins (handles existing accounts
  // that were created before this feature was added)
  if (isAdmin) {
    await ensureSchoolGeneralRoom(session.user.id, session.user.id);
  }

  if (!schoolId) {
    return (
      <CommunitiesClient
        schoolId={null}
        myUserId={session.user.id}
        isAdmin={false}
        initialRooms={[]}
      />
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: "COMMUNITY",
      schoolId,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { participants: true } },
    },
    orderBy: [{ isPrivateRoom: "asc" }, { updatedAt: "desc" }],
  });

  const initialRooms = conversations.map((c) => ({
    id: c.id,
    communityName: c.communityName,
    isPrivateRoom: c.isPrivateRoom,
    memberCount: c._count.participants,
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <CommunitiesClient
      schoolId={schoolId}
      myUserId={session.user.id}
      isAdmin={isAdmin}
      initialRooms={initialRooms}
    />
  );
}