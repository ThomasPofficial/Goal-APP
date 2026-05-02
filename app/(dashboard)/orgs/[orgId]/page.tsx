import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import OrgDetailClient from "./OrgDetailClient";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth();
  const { orgId } = await params;

  const [org, myProfile] = await Promise.all([
    prisma.org.findUnique({
      where: { id: orgId },
      include: {
        opportunities: { orderBy: { createdAt: "desc" } },
        teams: {
          include: {
            members: {
              include: {
                profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true, userId: true } },
              },
            },
          },
        },
      },
    }),
    session?.user?.id
      ? prisma.profile.findUnique({
          where: { userId: session.user.id },
          select: {
            id: true,
            teamMemberships: { select: { teamId: true, role: true } },
          },
        })
      : null,
  ]);

  if (!org) notFound();

  const myTeamIds = new Set(myProfile?.teamMemberships.map((m) => m.teamId) ?? []);
  const myOrgTeam = org.teams.find((t) => myTeamIds.has(t.id));

  return (
    <OrgDetailClient
      org={{
        ...org,
        deadline: org.deadline?.toISOString() ?? null,
        opportunities: org.opportunities.map((o) => ({
          ...o,
          deadline: o.deadline?.toISOString() ?? null,
        })),
        teams: org.teams.map((t) => ({
          ...t,
          members: t.members.map((m) => ({
            ...m,
            joinedAt: m.joinedAt.toISOString(),
            profile: m.profile
              ? { ...m.profile, geniusType: m.profile.geniusType as GeniusTypeKey | null }
              : null,
          })),
        })),
      }}
      myProfileId={myProfile?.id ?? null}
      myTeamId={myOrgTeam?.id ?? null}
    />
  );
}
