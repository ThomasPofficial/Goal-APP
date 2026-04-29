import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FolderOpen, Plus, Check } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true, role: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  const active = projects.filter((p) => p.status === "ACTIVE");
  const completed = projects.filter((p) => p.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#eaeaea]">Projects</h1>
          <p className="text-sm text-[#909098] mt-1">
            Handpick collaborators for each project.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] rounded-md px-4 py-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#1c1c20] rounded-xl">
          <FolderOpen className="w-8 h-8 text-[#58586a] mx-auto mb-3" />
          <p className="text-sm text-[#58586a] mb-4">
            No projects yet. Create one to start building your team.
          </p>
          <Link
            href="/projects/new"
            className="text-sm text-[#c9a84c] hover:text-[#e3c06a]"
          >
            Create your first project →
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-[#58586a] uppercase tracking-wider mb-3">
                Active
              </h2>
              <div className="space-y-2">
                {active.map((p) => (
                  <ProjectRow key={p.id} project={p} userId={userId} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-[#58586a] uppercase tracking-wider mb-3">
                Completed
              </h2>
              <div className="space-y-2">
                {completed.map((p) => (
                  <ProjectRow key={p.id} project={p} userId={userId} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  userId,
}: {
  project: {
    id: string;
    name: string;
    goal: string | null;
    status: string;
    createdAt: Date;
    members: { userId: string; role: string }[];
  };
  userId: string;
}) {
  const isOwner = project.members.some(
    (m) => m.userId === userId && m.role === "OWNER"
  );
  const isCompleted = project.status === "COMPLETED";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex items-center gap-4 bg-[#0d0d0e] border border-[#1c1c20] rounded-xl px-5 py-4 hover:border-[#28282e] transition-colors group"
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCompleted ? "bg-[#4ADE8015]" : "bg-[#c9a84c15]"
        }`}
      >
        {isCompleted ? (
          <Check className="w-4 h-4 text-[#4ADE80]" />
        ) : (
          <FolderOpen className="w-4 h-4 text-[#c9a84c]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#eaeaea] truncate group-hover:text-[#c9a84c] transition-colors">
          {project.name}
          {isOwner && (
            <span className="ml-2 text-[10px] text-[#58586a] font-normal">
              Owner
            </span>
          )}
        </div>
        {project.goal && (
          <div className="text-xs text-[#909098] truncate mt-0.5">
            {project.goal}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-[#58586a]">
          {project.members.length} member{project.members.length !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-[#58586a]">
          {formatDate(project.createdAt)}
        </span>
      </div>
    </Link>
  );
}
