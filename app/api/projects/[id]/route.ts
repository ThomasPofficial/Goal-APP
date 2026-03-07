import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional(),
  goal: z.string().max(300).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            include: {
              profile: {
                include: {
                  traitLinks: {
                    orderBy: { order: "asc" },
                    include: { trait: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember = project.members.some((m) => m.userId === session.user!.id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Must be owner
  const membership = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: session.user.id, role: "OWNER" },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const project = await prisma.project.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(project);
}
