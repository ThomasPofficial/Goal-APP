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
              profile: true,
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

  return (
    <ProjectDetail
      project={project}
      isOwner={isOwner}
      currentUserId={userId}
    />
  );
}
