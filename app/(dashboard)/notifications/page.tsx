import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";
import WalledNotificationsClient from "./WalledNotificationsClient";
import { isWalledStudent } from "@/lib/accountGate";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const donations = await prisma.donation.findMany({
    where: { recipientUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const donationItems = donations.map((d) => ({
    id: `donation-${d.id}`,
    kind: "donation" as const,
    label: `${d.donorName?.trim() || "Someone"} donated $${(d.amountCents / 100).toFixed(2)} to you`,
    lastMessage: null,
    updatedAt: d.createdAt.toISOString(),
    unread: false,
    href: "/donate",
  }));

  if (dbUser?.role === "SCHOOL" || (await isWalledStudent(session.user.id))) {
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

    const isSchool = dbUser?.role === "SCHOOL";

    const chatItems = conversations.map((c) => {
      const lastReadAt = c.participants[0]?.lastReadAt ?? null;
      const lastMessageAt = c.messages[0]?.createdAt ?? c.updatedAt;
      const kind = (c.type === "COMMUNITY" ? "community" : "mentorship") as "community" | "mentorship";
      return {
        id: c.id,
        kind,
        label: c.type === "COMMUNITY" ? (c.communityName ?? "Community Chat") : (c.communityName ?? "Partnership"),
        lastMessage: c.messages[0]?.content ?? null,
        updatedAt: c.updatedAt.toISOString(),
        unread: !lastReadAt || lastReadAt < lastMessageAt,
        // Walled students don't have /messages access -- they use the
        // dedicated /communities and /partnerships surfaces instead. School
        // admins do have /messages, so route them straight to the thread.
        href: isSchool
          ? `/messages?group=${c.id}`
          : kind === "community"
            ? `/communities?conversation=${c.id}`
            : `/partnerships?conversation=${c.id}`,
      };
    });

    const items = [...donationItems, ...chatItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

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
      donations={donations.map((d) => ({
        id: d.id,
        type: "donation" as const,
        sortDate: d.createdAt.toISOString(),
        amountCents: d.amountCents,
        donorName: d.donorName,
      }))}
    />
  );
}
