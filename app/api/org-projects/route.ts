import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const projects = await prisma.orgProject.findMany({
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
      _count: { select: { teamApplications: { where: { status: "ACCEPTED" } } } },
    },
  });

  return NextResponse.json({ projects });
}

const createSchema = z.object({
  orgId: z.string(),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  openSpots: z.number().int().min(1).max(50).default(1),
  requiredSkills: z.array(z.string()).default([]),
  deadline: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { orgId, title, description, openSpots, requiredSkills, deadline } = parsed.data;

  const project = await prisma.orgProject.create({
    data: {
      orgId,
      title,
      description,
      openSpots,
      requiredSkills: JSON.stringify(requiredSkills),
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
