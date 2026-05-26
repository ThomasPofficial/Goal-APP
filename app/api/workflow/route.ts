import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET — current user's active workflow session
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      geniusType: true,
      _count: { select: { traitLinks: true } },
    },
  });
  if (!profile) return NextResponse.json({ session: null });

  const workflowSession = await prisma.workflowSession.findUnique({
    where: { profileId: profile.id },
    include: {
      orgProject: {
        include: {
          org: { select: { id: true, name: true, accentColor: true, logoLetter: true, logoBg: true, logoColor: true } },
        },
      },
      team: {
        include: {
          members: {
            include: {
              profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true, handle: true } },
            },
          },
        },
      },
    },
  });

  const hasGeniusType = !!profile.geniusType;
  const traitsDone = (profile._count?.traitLinks ?? 0) > 0;

  return NextResponse.json({ session: workflowSession, hasGeniusType, traitsDone });
}

// POST — start a new workflow on a project (one at a time enforced by DB unique constraint)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { orgProjectId } = await req.json();
  if (!orgProjectId) return NextResponse.json({ error: "orgProjectId required" }, { status: 400 });

  const project = await prisma.orgProject.findUnique({ where: { id: orgProjectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.status !== "OPEN") return NextResponse.json({ error: "Project is not open" }, { status: 409 });

  const existing = await prisma.workflowSession.findUnique({ where: { profileId: profile.id } });
  if (existing) {
    return NextResponse.json(
      { error: "Active workflow exists", existingProjectId: existing.orgProjectId },
      { status: 409 }
    );
  }

  const workflowSession = await prisma.workflowSession.create({
    data: { profileId: profile.id, orgProjectId, step: 1 },
  });

  return NextResponse.json({ session: workflowSession }, { status: 201 });
}

// PATCH — advance step or lock roster
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json();
  const { action, teamId } = body as { action: "advance" | "lockRoster" | "attachTeam"; teamId?: string };

  const workflowSession = await prisma.workflowSession.findUnique({ where: { profileId: profile.id } });
  if (!workflowSession) return NextResponse.json({ error: "No active workflow" }, { status: 404 });

  if (action === "advance") {
    if (workflowSession.step >= 5) {
      return NextResponse.json({ error: "Already at final step" }, { status: 400 });
    }
    const updated = await prisma.workflowSession.update({
      where: { profileId: profile.id },
      data: { step: workflowSession.step + 1 },
    });
    return NextResponse.json({ session: updated });
  }

  if (action === "lockRoster") {
    const updated = await prisma.workflowSession.update({
      where: { profileId: profile.id },
      data: { rosterLocked: true },
    });
    return NextResponse.json({ session: updated });
  }

  if (action === "attachTeam") {
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    const updated = await prisma.workflowSession.update({
      where: { profileId: profile.id },
      data: { teamId },
    });
    return NextResponse.json({ session: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// DELETE — abandon active workflow
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const workflowSession = await prisma.workflowSession.findUnique({ where: { profileId: profile.id } });
  if (!workflowSession) return NextResponse.json({ error: "No active workflow" }, { status: 404 });

  await prisma.workflowSession.delete({ where: { profileId: profile.id } });
  return NextResponse.json({ deleted: true });
}
