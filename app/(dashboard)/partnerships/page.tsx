import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isWalledStudent } from "@/lib/accountGate";
import { getSchoolIds } from "@/lib/communities";
import { finalizeExpiredPartnershipRequests, partnerUserSummaries } from "@/lib/partnerships";
import PartnershipsClient from "./PartnershipsClient";

export default async function PartnershipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [walled, schoolIds] = await Promise.all([
    isWalledStudent(session.user.id),
    getSchoolIds(session.user.id),
  ]);

  await Promise.all(schoolIds.map((id) => finalizeExpiredPartnershipRequests(id)));

  const [pendingInvites, myRequests, pendingConnectionRequests] = await Promise.all([
    prisma.partnershipInvite.findMany({
      where: { userId: session.user.id, status: "PENDING", request: { status: "PENDING" } },
      include: { request: { include: { invites: true } } },
      orderBy: { request: { createdAt: "desc" } },
    }),
    prisma.partnershipRequest.findMany({
      where: { fromUserId: session.user.id },
      include: { invites: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // Still-live 1:1 ConnectionRequest model (used by the separate /alumni
    // directory flow) -- surfaced here since /partnerships is now the only
    // student-facing page that can display/accept these.
    prisma.connectionRequest.findMany({
      where: { toUserId: session.user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Anyone who isn't a walled student still gets in if a request touches them.
  if (!walled && pendingInvites.length === 0 && myRequests.length === 0 && pendingConnectionRequests.length === 0) {
    redirect("/dashboard");
  }

  // Collect every user id we'll need a summary for across the whole result
  // set up front, then fetch them in a single batched query instead of
  // fanning out one prisma.user.findUnique per person (which, with no cap
  // on group size, could mean hundreds of round-trips per page load).
  const summaryIds: string[] = [];
  for (const invite of pendingInvites) {
    summaryIds.push(invite.request.fromUserId);
    for (const i of invite.request.invites) {
      if (i.userId !== session.user.id) summaryIds.push(i.userId);
    }
  }
  for (const r of myRequests) {
    for (const i of r.invites) summaryIds.push(i.userId);
  }
  for (const r of pendingConnectionRequests) {
    summaryIds.push(r.fromUserId);
  }
  const summaries = await partnerUserSummaries(summaryIds);
  const getSummary = (id: string) => summaries.get(id)!;

  const incoming = pendingInvites.map((invite) => ({
    inviteId: invite.id,
    message: invite.request.message,
    createdAt: invite.request.createdAt.toISOString(),
    fromUser: getSummary(invite.request.fromUserId),
    otherInvites: invite.request.invites
      .filter((i) => i.userId !== session.user.id)
      .map((i) => ({ ...getSummary(i.userId), status: i.status })),
  }));

  const sent = myRequests.map((r) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    roomId: r.roomId,
    invites: r.invites.map((i) => ({ ...getSummary(i.userId), status: i.status })),
  }));

  const incomingConnectionRequests = pendingConnectionRequests.map((r) => ({
    id: r.id,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    fromUser: getSummary(r.fromUserId),
  }));

  return (
    <PartnershipsClient
      myUserId={session.user.id}
      incomingRequests={incoming}
      sentRequests={sent}
      incomingConnectionRequests={incomingConnectionRequests}
    />
  );
}
