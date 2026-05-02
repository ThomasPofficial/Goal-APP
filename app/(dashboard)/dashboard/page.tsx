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

<<<<<<< Updated upstream
  const hasProfile = !!(profile?.displayName && profile.traitLinks.length > 0);
  const hasQuiz = !!profile?.geniusType;
  const hasProject = !!activeProject;
  const onboardingComplete = hasProfile && hasQuiz && hasProject;

  let peerTraitsByUser: Record<
    string,
    { name: string; category: string; count: number }[]
  > = {};

  if (activeProject) {
    const endorsements = await prisma.peerEndorsement.findMany({
      where: { projectId: activeProject.id, completedAt: { not: null } },
      include: { traits: { include: { trait: true } } },
    });
    for (const e of endorsements) {
      if (!peerTraitsByUser[e.endorseeId]) peerTraitsByUser[e.endorseeId] = [];
      for (const t of e.traits) {
        const ex = peerTraitsByUser[e.endorseeId].find(
          (x) => x.name === t.trait.name
        );
        if (ex) ex.count++;
        else
          peerTraitsByUser[e.endorseeId].push({
            name: t.trait.name,
            category: t.trait.category,
            count: 1,
          });
      }
    }
  }

  const projectMembers = activeProject
    ? activeProject.members.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        role: m.role,
        profile: m.user.profile
          ? {
              displayName: m.user.profile.displayName,
              headline: m.user.profile.headline,
              avatarUrl: m.user.profile.avatarUrl,
              strengthSummary: m.user.profile.strengthSummary,
              geniusType: m.user.profile.geniusType as GeniusType | null,
              selfTraits: m.user.profile.traitLinks.map((l) => ({
                name: l.trait.name,
                category: l.trait.category as TraitCategory,
              })),
              peerTraits: (peerTraitsByUser[m.userId] ?? [])
                .sort((a, b) => b.count - a.count)
                .map((t) => ({
                  name: t.name,
                  category: t.category as TraitCategory,
                  endorseCount: t.count,
                })),
            }
          : null,
      }))
    : [];
=======
  const spaces = (profile?.teamMemberships ?? []).map((m) => {
    const convo = m.team.conversation[0];
    const lastRead = convo?.participants[0]?.lastReadAt;
    const lastMsg = convo?.messages[0]?.createdAt;
    const hasUnread = lastMsg && (!lastRead || lastMsg > lastRead);
    return { id: m.team.id, name: m.team.name, hasUnread: !!hasUnread };
  });
>>>>>>> Stashed changes

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
