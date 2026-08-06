import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";
import WalledNotificationsClient from "./WalledNotificationsClient";
import { isWalledStudent } from "@/lib/accountGate";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (await isWalledStudent(session.user.id)) {
    const conversations = await prisma.conversation.findMany({
      where: {
        type: { in: ["COMMUNITY", "MENTORSHIP"] },
        participants: { some: { userId: session.user.id } },
      },
      include: {
        participants: { where: { userId: session.user.id }, select: { lastReadAt: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    const items = conversations.map((c) => {
      const lastReadAt = c.participants[0]?.lastReadAt ?? null;
      const lastMessageAt = c.messages[0]?.createdAt ?? c.updatedAt;
      return {
        id: c.id,
        kind: (c.type === "COMMUNITY" ? "community" : "mentorship") as "community" | "mentorship",
        label: c.type === "COMMUNITY" ? (c.communityName ?? "Community Chat") : (c.communityName ?? "Mentorship"),
        lastMessage: c.messages[0]?.content ?? null,
        updatedAt: c.updatedAt.toISOString(),
        unread: !lastReadAt || lastReadAt < lastMessageAt,
      };
    });

    return <WalledNotificationsClient items={items} />;
  }

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const [requests, applications] = await Promise.all([
    myProfile
      ? prisma.recruitmentRequest.findMany({
          where: { toProfileId: myProfile.id },
          include: {
            orgProject: {
              select: {
                id: true,
                title: true,
                orgId: true,
                org: { select: { id: true, name: true } },
              },
            },
            fromProfile: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                geniusType: true,
                handle: true,
              },
            },
            team: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),

    myProfile
      ? prisma.teamApplication.findMany({
          where: {
            status: { not: "PENDING" },
            team: { members: { some: { profileId: myProfile.id } } },
          },
          include: {
            team: { select: { id: true, name: true } },
            orgProject: {
              select: {
                id: true,
                title: true,
                orgId: true,
                org: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { decidedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <NotificationsClient
      requests={requests.map((r) => ({
        ...r,
        type: "recruitment" as const,
        sortDate: r.createdAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        fromProfile: {
          ...r.fromProfile,
          geniusType: r.fromProfile.geniusType as string | null,
        },
      }))}
      applications={applications.map((a) => ({
        id: a.id,
        type: "decision" as const,
        status: a.status,
        sortDate: (a.decidedAt ?? new Date()).toISOString(),
        decidedAt: a.decidedAt?.toISOString() ?? null,
        team: a.team,
        orgProject: a.orgProject,
      }))}
    />
  );
}
