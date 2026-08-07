import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isWalledStudent } from "@/lib/accountGate";
import { getSchoolId } from "@/lib/communities";
import { finalizeExpiredPartnershipRequests, partnerUserSummary } from "@/lib/partnerships";
import PartnershipsClient from "./PartnershipsClient";

export default async function PartnershipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [walled, schoolId] = await Promise.all([
    isWalledStudent(session.user.id),
    getSchoolId(session.user.id),
  ]);

  if (schoolId) {
    await finalizeExpiredPartnershipRequests(schoolId);
  }

  const [pendingInvites, myRequests] = await Promise.all([
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
  ]);

  // Anyone who isn't a walled student still gets in if a request touches them.
  if (!walled && pendingInvites.length === 0 && myRequests.length === 0) redirect("/dashboard");

  const incoming = await Promise.all(
    pendingInvites.map(async (invite) => {
      const otherInvites = await Promise.all(
        invite.request.invites
          .filter((i) => i.userId !== session.user.id)
          .map(async (i) => ({ ...(await partnerUserSummary(i.userId)), status: i.status }))
      );
      return {
        inviteId: invite.id,
        message: invite.request.message,
        createdAt: invite.request.createdAt.toISOString(),
        fromUser: await partnerUserSummary(invite.request.fromUserId),
        otherInvites,
      };
    })
  );

  const sent = await Promise.all(
    myRequests.map(async (r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      roomId: r.roomId,
      invites: await Promise.all(
        r.invites.map(async (i) => ({ ...(await partnerUserSummary(i.userId)), status: i.status }))
      ),
    }))
  );

  return <PartnershipsClient myUserId={session.user.id} incomingRequests={incoming} sentRequests={sent} />;
}
