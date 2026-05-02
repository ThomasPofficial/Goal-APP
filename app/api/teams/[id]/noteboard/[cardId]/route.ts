import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function verifyMember(userId: string, teamId: string) {
  const myProfile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!myProfile) return null;
  const m = await prisma.teamMember.findFirst({ where: { teamId, profileId: myProfile.id } });
  return m ? myProfile : null;
}

const patchSchema = z.object({ payload: z.unknown() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId, cardId } = await params;
  const profile = await verifyMember(session.user.id, teamId);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const card = await prisma.noteboardCard.updateMany({
    where: { id: cardId, teamId },
    data: { payload: JSON.stringify(parsed.data.payload) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId, cardId } = await params;
  const profile = await verifyMember(session.user.id, teamId);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.noteboardCard.deleteMany({ where: { id: cardId, teamId } });
  return NextResponse.json({ ok: true });
}
