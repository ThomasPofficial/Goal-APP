import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, outcomeNote } = body as { status?: string; outcomeNote?: string };

  const project = await prisma.orgProject.findUnique({
    where: { id },
    include: { org: { select: { createdById: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.org.createdById !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data: Record<string, unknown> = {};
  if (status === "CLOSED") { data.status = "CLOSED"; data.closedAt = new Date(); }
  if (outcomeNote !== undefined) data.outcomeNote = outcomeNote;

  const updated = await prisma.orgProject.update({ where: { id }, data });
  return NextResponse.json({ project: updated });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const project = await prisma.orgProject.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true, accentColor: true } },
      teamApplications: {
        include: {
          team: {
            include: {
              members: {
                include: {
                  profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ project });
}
