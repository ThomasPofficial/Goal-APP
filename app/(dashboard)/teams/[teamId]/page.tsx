import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import TeamWorkspaceClient from "./TeamWorkspaceClient";

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { teamId } = await params;

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  if (!myProfile) redirect("/onboarding");

  const membership = await prisma.teamMember.findFirst({
    where: { teamId, profileId: myProfile.id },
  });
  if (!membership) notFound();

  const [team, applications] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            profile: {
              select: { id: true, userId: true, displayName: true, avatarUrl: true, handle: true },
            },
          },
        },
        org: { select: { id: true, name: true } },
        conversation: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.teamApplication.findMany({
      where: { teamId },
      include: {
        orgProject: {
          select: {
            id: true,
            title: true,
            orgId: true,
            org: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
  ]);
  if (!team) notFound();

  const conversationId = team.conversation[0]?.id ?? null;

  // Count messages for limit display
  let msgCount = 0;
  if (conversationId) {
    msgCount = await prisma.message.count({ where: { conversationId } });
  }

  return (
    <TeamWorkspaceClient
      team={{
        id: team.id,
        name: team.name,
        description: team.description,
        status: team.status,
        org: team.org,
        conversationId,
        members: team.members.map((m) => ({
          id: m.id,
          role: m.role,
          profile: m.profile
            ? { ...m.profile }
            : null,
        })),
      }}
      applications={applications.map((a) => ({
        id: a.id,
        status: a.status,
        submittedAt: a.submittedAt.toISOString(),
        orgProject: {
          id: a.orgProject.id,
          title: a.orgProject.title,
          orgId: a.orgProject.orgId,
          org: a.orgProject.org,
        },
      }))}
      msgCount={msgCount}
      myProfileId={myProfile.id}
      myUserId={session.user.id}
    />
  );
}
