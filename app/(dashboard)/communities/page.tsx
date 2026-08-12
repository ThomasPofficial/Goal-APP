import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import CommunitiesClient from "./CommunitiesClient";
import { ensureSchoolGeneralRoom, getSchoolIds } from "@/lib/communities";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, schoolCode: true },
  });
  const isAdmin = user?.role === "SCHOOL";
  const schoolIds = await getSchoolIds(session.user.id);

  // Ensure the General Room exists and the current user is a participant, for
  // every linked school — admins (their own school) and any school-affiliated
  // student/alum, who has no self-serve code-entry path into their room(s).
  await Promise.all(schoolIds.map((id) => ensureSchoolGeneralRoom(id, session.user.id)));

  if (schoolIds.length === 0) {
    return (
      <CommunitiesClient
        schoolId={null}
        myUserId={session.user.id}
        isAdmin={false}
        initialRooms={[]}
        schoolCode={null}
      />
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      type: "COMMUNITY",
      schoolId: { in: schoolIds },
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
      schoolId={schoolIds[0]}
      myUserId={session.user.id}
      isAdmin={isAdmin}
      initialRooms={initialRooms}
      schoolCode={isAdmin ? (user?.schoolCode ?? null) : null}
    />
  );
}