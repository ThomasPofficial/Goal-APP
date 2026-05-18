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
      org: { select: { id: true, name: true, accentColor: true, maxTeamSize: true } },
    },
    // Select new fields explicitly
  });

  if (!project || project.orgId !== orgId) notFound();

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const [existingApplication, workflowSession] = await Promise.all([
    myProfile
      ? prisma.teamApplication.findFirst({
          where: {
            orgProjectId: projectId,
            team: { members: { some: { profileId: myProfile.id } } },
          },
          select: { id: true, status: true, teamId: true },
        })
      : null,
    myProfile
      ? prisma.workflowSession.findUnique({
          where: { profileId: myProfile.id },
          select: { step: true, orgProjectId: true, rosterLocked: true },
        })
      : null,
  ]);

  const activeWorkflowStep =
    workflowSession?.orgProjectId === projectId ? workflowSession.step : null;

  return (
    <ProjectDetailClient
      project={{
        ...project,
        shortDescription: project.shortDescription ?? null,
        fullDescription: project.fullDescription ?? null,
        preferredGeniusTypes: project.preferredGeniusTypes ?? "[]",
        hoursPerWeek: project.hoursPerWeek ?? null,
        duration: project.duration ?? null,
        deadline: project.deadline?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
      }}
      myProfileId={myProfile?.id ?? null}
      existingApplication={existingApplication}
      activeWorkflowStep={activeWorkflowStep}
    />
  );
}
