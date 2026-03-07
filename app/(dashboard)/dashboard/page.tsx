import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import type { TraitCategory, GeniusType } from "@/data/traits";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [profile, activeProject, recentNotes, unreadConvoCount] =
    await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        include: {
          traitLinks: {
            orderBy: { order: "asc" },
            include: { trait: true },
          },
        },
      }),
      prisma.project.findFirst({
        where: {
          status: "ACTIVE",
          members: { some: { userId } },
        },
        include: {
          members: {
            include: {
              user: {
                include: {
                  profile: {
                    include: {
                      traitLinks: {
                        orderBy: { order: "asc" },
                        include: { trait: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.note.findMany({
        where: { authorId: userId },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: 6,
      }),
      prisma.conversationParticipant.count({ where: { userId } }),
    ]);

  const hasProfile = !!(profile?.displayName && profile.displayName !== session?.user?.name);
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

  return (
    <DashboardClient
      userName={profile?.displayName ?? session?.user?.name ?? ""}
      geniusType={(profile?.geniusType as GeniusType | null) ?? null}
      myTraits={
        profile?.traitLinks.map((l) => ({
          name: l.trait.name,
          category: l.trait.category as TraitCategory,
        })) ?? []
      }
      strengthSummary={profile?.strengthSummary ?? null}
      onboardingChecklist={{
        hasProfile,
        hasQuiz,
        hasProject,
        complete: onboardingComplete,
      }}
      activeProject={
        activeProject
          ? {
              id: activeProject.id,
              name: activeProject.name,
              goal: activeProject.goal,
              status: activeProject.status,
              memberCount: activeProject.members.length,
            }
          : null
      }
      projectMembers={projectMembers}
      recentNotes={recentNotes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        updatedAt: n.updatedAt.toISOString(),
      }))}
      unreadConvoCount={unreadConvoCount}
    />
  );
}
