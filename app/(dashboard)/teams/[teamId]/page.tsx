import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import TeamWorkspaceClient from "./TeamWorkspaceClient";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { teamId } = await params;

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, avatarUrl: true, geniusType: true },
  });
  if (!myProfile) redirect("/onboarding");

  const membership = await prisma.teamMember.findFirst({
    where: { teamId, profileId: myProfile.id },
  });
  if (!membership) notFound();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          profile: {
            select: { id: true, userId: true, displayName: true, avatarUrl: true, geniusType: true, handle: true },
          },
        },
      },
      org: { select: { id: true, name: true } },
      conversation: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  if (!team) notFound();

  const conversationId = team.conversation[0]?.id ?? null;

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
            ? { ...m.profile, geniusType: m.profile.geniusType as GeniusTypeKey | null }
            : null,
        })),
      }}
      myProfileId={myProfile.id}
      myGeniusType={myProfile.geniusType as GeniusTypeKey | null}
      myUserId={session.user.id}
    />
  );
}
