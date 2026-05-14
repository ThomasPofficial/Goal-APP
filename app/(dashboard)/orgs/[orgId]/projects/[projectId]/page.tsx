import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { orgId, projectId } = await params;

  const project = await prisma.orgProject.findUnique({
    where: { id: projectId },
    include: {
      org: { select: { id: true, name: true, accentColor: true } },
    },
  });

  if (!project || project.orgId !== orgId) notFound();

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  let myTeams: { id: string; name: string }[] = [];
  if (myProfile) {
    const memberships = await prisma.teamMember.findMany({
      where: { profileId: myProfile.id },
      include: { team: { select: { id: true, name: true, status: true } } },
    });
    myTeams = memberships
      .filter((m) => m.team.status === "ACTIVE" || m.team.status === "SUBMITTED")
      .map((m) => ({ id: m.team.id, name: m.team.name }));
  }

  const existingApplication = myTeams.length
    ? await prisma.teamApplication.findFirst({
        where: { orgProjectId: projectId, teamId: { in: myTeams.map((t) => t.id) } },
        select: { id: true, status: true, teamId: true },
      })
    : null;

  return (
    <ProjectDetailClient
      project={{
        ...project,
        deadline: project.deadline?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
      }}
      myProfileId={myProfile?.id ?? null}
      myTeams={myTeams}
      existingApplication={existingApplication}
    />
  );
}
