import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolPartnershipsClient from "./SchoolPartnershipsClient";
import { finalizeExpiredPartnershipRequests, partnerUserSummaries } from "@/lib/partnerships";

export default async function SchoolPartnershipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const schoolId = session.user.id;

  await finalizeExpiredPartnershipRequests(schoolId);

  const [pairings, students, mentors, requestQueue, requestHistory, connectionQueue, connectionHistory] = await Promise.all([
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
        OR: [
          { schoolId, staffTitle: { not: null } },
          { alumniSchools: { some: { schoolId } } },
        ],
      },
      select: { userId: true, displayName: true, staffTitle: true, industry: true, user: { select: { isAlumni: true } } },
      orderBy: { displayName: "asc" },
    }),
    prisma.partnershipRequest.findMany({
      where: { schoolId, status: "AWAITING_APPROVAL" },
      include: { invites: true },
      orderBy: { finalizedAt: "asc" },
    }),
    prisma.partnershipRequest.findMany({
      where: { schoolId, status: { in: ["APPROVED", "REJECTED", "EXPIRED_EMPTY"] } },
      include: { invites: true },
      orderBy: { finalizedAt: "desc" },
      take: 50,
    }),
    // Still-live 1:1 ConnectionRequest model (used by the separate /alumni
    // directory flow) -- surfaced here since /school/partnerships is now the
    // only admin page that can approve these.
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

  // Collect every user id we'll need a summary for across the whole result
  // set up front, then fetch them in a single batched query instead of
  // fanning out per-person prisma.user.findUnique calls (up to 3x per row --
  // fromUser + accepted + other invitees -- across a queue plus a take: 50
  // history list, with no cap on group size).
  const summaryIds: string[] = [];
  for (const r of [...requestQueue, ...requestHistory]) {
    summaryIds.push(r.fromUserId);
    for (const i of r.invites) summaryIds.push(i.userId);
  }
  for (const r of [...connectionQueue, ...connectionHistory]) {
    summaryIds.push(r.fromUserId, r.toUserId);
  }
  const summaries = await partnerUserSummaries(summaryIds);
  const getSummary = (id: string) => summaries.get(id)!;

  const formatRequestRow = (r: (typeof requestQueue)[number]) => ({
    id: r.id,
    status: r.status as "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED_EMPTY",
    createdAt: r.createdAt.toISOString(),
    finalizedAt: r.finalizedAt?.toISOString() ?? null,
    roomId: r.roomId,
    message: r.message,
    fromUser: getSummary(r.fromUserId),
    acceptedInvitees: r.invites.filter((i) => i.status === "ACCEPTED").map((i) => getSummary(i.userId)),
    otherInvitees: r.invites
      .filter((i) => i.status !== "ACCEPTED")
      .map((i) => ({ ...getSummary(i.userId), status: i.status })),
  });

  const formattedQueue = requestQueue.map(formatRequestRow);
  const formattedHistory = requestHistory.map(formatRequestRow);

  const formatConnectionRow = (r: (typeof connectionQueue)[number]) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    roomId: r.roomId,
    message: r.message,
    fromUser: getSummary(r.fromUserId),
    toUser: getSummary(r.toUserId),
  });

  const formattedConnectionQueue = connectionQueue.map(formatConnectionRow);
  const formattedConnectionHistory = connectionHistory.map(formatConnectionRow);

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
    <SchoolPartnershipsClient
      pairings={formattedPairings}
      students={students}
      mentors={formattedMentors}
      requestQueue={formattedQueue}
      requestHistory={formattedHistory}
      connectionRequestQueue={formattedConnectionQueue}
      connectionRequestHistory={formattedConnectionHistory}
    />
  );
}
