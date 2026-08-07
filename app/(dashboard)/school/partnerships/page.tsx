import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SchoolPartnershipsClient from "./SchoolPartnershipsClient";
import { finalizeExpiredPartnershipRequests, partnerUserSummary } from "@/lib/partnerships";

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
  ]);

  const formatRequestRow = async (r: (typeof requestQueue)[number]) => ({
    id: r.id,
    status: r.status as "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED_EMPTY",
    createdAt: r.createdAt.toISOString(),
    finalizedAt: r.finalizedAt?.toISOString() ?? null,
    roomId: r.roomId,
    message: r.message,
    fromUser: await partnerUserSummary(r.fromUserId),
    acceptedInvitees: await Promise.all(
      r.invites.filter((i) => i.status === "ACCEPTED").map((i) => partnerUserSummary(i.userId))
    ),
    otherInvitees: await Promise.all(
      r.invites
        .filter((i) => i.status !== "ACCEPTED")
        .map(async (i) => ({ ...(await partnerUserSummary(i.userId)), status: i.status }))
    ),
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
    <SchoolPartnershipsClient
      pairings={formattedPairings}
      students={students}
      mentors={formattedMentors}
      requestQueue={formattedQueue}
      requestHistory={formattedHistory}
    />
  );
}
