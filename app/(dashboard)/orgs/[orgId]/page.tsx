import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import OrgDetailClient from "./OrgDetailClient";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth();
  const { orgId } = await params;

  const [org, projects, myProfile] = await Promise.all([
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
    prisma.orgProject.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        openSpots: true,
        requiredSkills: true,
        deadline: true,
        status: true,
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

  const isAdmin = org.createdById === session?.user?.id;

  const applications = isAdmin
    ? await prisma.teamApplication.findMany({
        where: { orgProject: { orgId } },
        orderBy: { submittedAt: "desc" },
        include: {
          orgProject: { select: { id: true, title: true } },
          team: {
            include: {
              members: {
                include: {
                  profile: {
                    select: { id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true },
                  },
                },
              },
            },
          },
        },
      })
    : [];

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
      projects={projects.map((p) => ({
        ...p,
        deadline: p.deadline?.toISOString() ?? null,
      }))}
      myProfileId={myProfile?.id ?? null}
      myTeamId={myOrgTeam?.id ?? null}
      isAdmin={isAdmin}
      applications={applications.map((a) => ({
        id: a.id,
        status: a.status,
        submittedAt: a.submittedAt.toISOString(),
        orgProject: a.orgProject,
        team: {
          id: a.team.id,
          name: a.team.name,
          members: a.team.members.map((m) => ({
            id: m.id,
            role: m.role,
            profile: m.profile
              ? { ...m.profile, geniusType: m.profile.geniusType as GeniusTypeKey | null }
              : null,
          })),
        },
      }))}
    />
  );
}
