import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      displayName: true,
      handle: true,
      avatarUrl: true,
      geniusType: true,
      secondaryGeniusType: true,
      currentFocus: true,
      traitLinks: { select: { id: true } },
      savedOpportunities: { select: { id: true } },
      teamMemberships: {
        select: {
          team: {
            select: {
              id: true,
              name: true,
              conversation: {
                select: {
                  id: true,
                  participants: { where: { userId }, select: { lastReadAt: true } },
                  messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
                },
              },
            },
          },
        },
        take: 4,
      },
    },
  });

  const spaces = (profile?.teamMemberships ?? []).map((m) => {
    const convo = m.team.conversation[0];
    const lastRead = convo?.participants[0]?.lastReadAt;
    const lastMsg = convo?.messages[0]?.createdAt;
    const hasUnread = lastMsg && (!lastRead || lastMsg > lastRead);
    return { id: m.team.id, name: m.team.name, hasUnread: !!hasUnread };
  });

  return (
    <DashboardClient
      profile={{
        displayName: profile?.displayName ?? session.user.name ?? "there",
        handle: profile?.handle ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        geniusType: (profile?.geniusType as GeniusTypeKey | null) ?? null,
        secondaryGeniusType: (profile?.secondaryGeniusType as GeniusTypeKey | null) ?? null,
        currentFocus: profile?.currentFocus ?? null,
        savedCount: profile?.savedOpportunities.length ?? 0,
      }}
      spaces={spaces}
      traitsDone={(profile?.traitLinks?.length ?? 0) > 0}
    />
  );
}
