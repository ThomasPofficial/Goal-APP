import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ teams: [] });

  const teams = await prisma.team.findMany({
    where: { members: { some: { profileId: myProfile.id } } },
    include: {
      members: {
        include: { profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } } },
      },
      org: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ teams });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  orgId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      orgId: parsed.data.orgId,
      createdById: session.user.id,
      members: { create: { profileId: myProfile.id, role: "ADMIN" } },
      conversation: { create: { type: "TEAM" } },
    },
    include: { members: true, conversation: true },
  });

  return NextResponse.json({ team });
}
