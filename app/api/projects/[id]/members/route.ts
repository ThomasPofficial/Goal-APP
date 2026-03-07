import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({ userId: z.string() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId } = await params;

  // Must be owner
  const ownerMembership = await prisma.projectMember.findFirst({
    where: { projectId, userId: session.user.id, role: "OWNER" },
  });
  if (!ownerMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const member = await prisma.projectMember.create({
    data: { projectId, userId: parsed.data.userId, role: "MEMBER" },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: projectId } = await params;

  const ownerMembership = await prisma.projectMember.findFirst({
    where: { projectId, userId: session.user.id, role: "OWNER" },
  });
  if (!ownerMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await req.json();
  await prisma.projectMember.deleteMany({
    where: { projectId, id: memberId },
  });

  return NextResponse.json({ success: true });
}
