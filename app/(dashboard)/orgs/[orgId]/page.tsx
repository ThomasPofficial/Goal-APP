import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import OrgDetailClient from "./OrgDetailClient";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const session = await auth();
  const { orgId } = await params;

  const [org, projects, myProfile] = await Promise.all([
    prisma.org.findUnique({
      where: { id: orgId },
      include: {
        teams: {
          include: {
            members: {
              include: {
                profile: { select: { id: true, displayName: true, avatarUrl: true, userId: true } },
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
        shortDescription: true,
        openSpots: true,
        requiredSkills: true,
        hoursPerWeek: true,
        duration: true,
        deadline: true,
        listingStatus: true,
        closedAt: true,
        outcomeNote: true,
        _count: { select: { teamApplications: true } },
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

  const initialSaved = myProfile
    ? !!(await prisma.savedOrg.findUnique({
        where: { profileId_orgId: { profileId: myProfile.id, orgId } },
      }))
    : false;

  const [applications, adminStats] = await Promise.all([
    isAdmin
      ? prisma.teamApplication.findMany({
          where: { orgProject: { orgId } },
          orderBy: { submittedAt: "desc" },
          include: {
            orgProject: { select: { id: true, title: true } },
            team: {
              include: {
                members: {
                  include: {
                    profile: {
                      select: {
                        id: true, displayName: true, avatarUrl: true, handle: true,
                        headline: true, bio: true, strengthSummary: true,
                        orgReviews: {
                          select: {
                            id: true, body: true,
                            org: { select: { name: true } },
                            orgProject: { select: { title: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [],
    isAdmin
      ? prisma.$transaction([
          prisma.teamApplication.count({ where: { orgProject: { orgId }, status: "PENDING" } }),
          prisma.teamApplication.count({ where: { orgProject: { orgId }, status: "ACCEPTED" } }),
          prisma.teamApplication.count({ where: { orgProject: { orgId } } }),
          prisma.orgReview.count({ where: { orgId } }),
        ])
      : [0, 0, 0, 0],
  ]);

  const [pendingCount, acceptedCount, totalApps, reviewCount] = adminStats as [number, number, number, number];
  const activeProjects = projects.filter((p) => p.listingStatus === "OPEN").length;

  const myTeamIds = new Set(myProfile?.teamMemberships.map((m) => m.teamId) ?? []);
  const myOrgTeam = org.teams.find((t) => myTeamIds.has(t.id));

  return (
    <OrgDetailClient
      org={{
        ...org,
        deadline: org.deadline?.toISOString() ?? null,
        whatInternsBuild: org.whatInternsBuild ?? null,
        contactEmail: org.contactEmail ?? null,
        isPaid: org.isPaid,
        teams: org.teams.map((t) => ({
          ...t,
          members: t.members.map((m) => ({
            ...m,
            joinedAt: m.joinedAt.toISOString(),
            profile: m.profile ? { ...m.profile } : null,
          })),
        })),
      }}
      projects={projects.map((p) => ({
        ...p,
        shortDescription: p.shortDescription ?? null,
        hoursPerWeek: p.hoursPerWeek ?? null,
        duration: p.duration ?? null,
        deadline: p.deadline?.toISOString() ?? null,
        closedAt: p.closedAt?.toISOString() ?? null,
        outcomeNote: p.outcomeNote ?? null,
        applicationCount: p._count.teamApplications,
      }))}
      myProfileId={myProfile?.id ?? null}
      myTeamId={myOrgTeam?.id ?? null}
      isAdmin={isAdmin}
      applications={applications.map((a) => ({
        id: a.id,
        status: a.status,
        whyJoin: a.whyJoin ?? null,
        submittedAt: a.submittedAt.toISOString(),
        orgProject: a.orgProject,
        team: {
          id: a.team.id,
          name: a.team.name,
          members: a.team.members.map((m) => ({
            id: m.id,
            role: m.role,
            profile: m.profile ? { ...m.profile } : null,
          })),
        },
      }))}
      adminStats={isAdmin ? { activeProjects, totalApps, pendingCount, acceptedCount } : null}
      apiKey={isAdmin ? (org.apiKey ?? null) : null}
      reviewCount={reviewCount}
      whatInternsBuild={org.whatInternsBuild ?? null}
      initialSaved={initialSaved}
    />
  );
}
