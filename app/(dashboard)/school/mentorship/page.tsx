import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MentorshipClient from "./MentorshipClient";

export default async function MentorshipPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const schoolId = session.user.id;

  const userSummary = async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profile: { select: { displayName: true, avatarUrl: true } } },
    });
    return {
      userId,
      displayName: user?.profile?.displayName ?? user?.name ?? "Unknown",
      avatarUrl: user?.profile?.avatarUrl ?? null,
    };
  };

  const [pairings, students, mentors, requestQueue, requestHistory] = await Promise.all([
    prisma.conversation.findMany({
      where: { type: "MENTORSHIP", schoolId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true, staffTitle: true } },
              },
            },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: null, user: { isAlumni: false } },
      select: { userId: true, displayName: true, graduationYear: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.profile.findMany({
      where: {
        schoolId,
        OR: [{ staffTitle: { not: null } }, { user: { isAlumni: true } }],
      },
      select: { userId: true, displayName: true, staffTitle: true, industry: true, user: { select: { isAlumni: true } } },
      orderBy: { displayName: "asc" },
    }),
    prisma.connectionRequest.findMany({
      where: { schoolId, status: "ACCEPTED", roomId: null },
      orderBy: { respondedAt: "asc" },
    }),
    prisma.connectionRequest.findMany({
      where: { schoolId, roomId: { not: null } },
      orderBy: { respondedAt: "desc" },
      take: 50,
    }),
  ]);

  const formatRequestRow = async (r: (typeof requestQueue)[number]) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    roomId: r.roomId,
    message: r.message,
    fromUser: await userSummary(r.fromUserId),
    toUser: await userSummary(r.toUserId),
  });

  const [formattedQueue, formattedHistory] = await Promise.all([
    Promise.all(requestQueue.map(formatRequestRow)),
    Promise.all(requestHistory.map(formatRequestRow)),
  ]);

  const formattedPairings = pairings.map((c) => ({
    id: c.id,
    name: c.communityName,
    createdAt: c.createdAt.toISOString(),
    participants: c.participants
      .filter((p) => p.userId !== schoolId)
      .map((p) => ({
        userId: p.userId,
        displayName: p.user.profile?.displayName ?? "Unknown",
        avatarUrl: p.user.profile?.avatarUrl ?? null,
        isStaff: !!p.user.profile?.staffTitle,
      })),
    lastMessage: c.messages[0]
      ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
      : null,
  }));

  const formattedMentors = mentors.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    kind: m.user.isAlumni ? ("ALUMNI" as const) : ("STAFF" as const),
    subtitle: m.staffTitle ?? m.industry ?? null,
  }));

  return (
    <MentorshipClient
      pairings={formattedPairings}
      students={students}
      mentors={formattedMentors}
      requestQueue={formattedQueue}
      requestHistory={formattedHistory}
    />
  );
}
