import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProjectDetail from "./ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id;

  const project = await prisma.project.findUnique({
    where: { id },
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
  });

  if (!project) notFound();

  const isMember = project.members.some((m) => m.userId === userId);
  if (!isMember) notFound();

  const isOwner = project.members.some(
    (m) => m.userId === userId && m.role === "OWNER"
  );

  // Get peer endorsements for this project to show on skill cards
  const endorsements = await prisma.peerEndorsement.findMany({
    where: { projectId: id, completedAt: { not: null } },
    include: { traits: { include: { trait: true } } },
  });

  // Build a map: endorseeId -> trait counts
  const peerTraitsByUser: Record<
    string,
    { traitId: string; name: string; category: string; count: number }[]
  > = {};
  for (const e of endorsements) {
    if (!peerTraitsByUser[e.endorseeId]) peerTraitsByUser[e.endorseeId] = [];
    for (const t of e.traits) {
      const existing = peerTraitsByUser[e.endorseeId].find(
        (x) => x.traitId === t.traitId
      );
      if (existing) {
        existing.count++;
      } else {
        peerTraitsByUser[e.endorseeId].push({
          traitId: t.traitId,
          name: t.trait.name,
          category: t.trait.category,
          count: 1,
        });
      }
    }
  }

  // My endorsement completion status
  const myEndorsements = await prisma.peerEndorsement.findMany({
    where: { projectId: id, endorserId: userId },
  });
  const endorsedUserIds = new Set(
    myEndorsements
      .filter((e) => e.completedAt)
      .map((e) => e.endorseeId)
  );
  const pendingEndorsees = project.members
    .filter((m) => m.userId !== userId && !endorsedUserIds.has(m.userId))
    .map((m) => m.userId);

  const allTraits = await prisma.trait.findMany({ orderBy: { category: "asc" } });

  return (
    <ProjectDetail
      project={project}
      isOwner={isOwner}
      currentUserId={userId}
      peerTraitsByUser={peerTraitsByUser}
      pendingEndorsees={pendingEndorsees}
      allTraits={allTraits}
    />
  );
}
