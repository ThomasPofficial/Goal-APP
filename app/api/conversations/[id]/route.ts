import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const renameSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, type: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (conversation.type !== "MENTORSHIP") {
    return NextResponse.json({ error: "Only mentorship chats can be renamed" }, { status: 403 });
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: session.user.id },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id }, select: { staffTitle: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { isAlumni: true } }),
  ]);
  const isMentor = Boolean(profile?.staffTitle) || Boolean(user?.isAlumni);
  if (!isMentor) {
    return NextResponse.json({ error: "Only mentors can rename this chat" }, { status: 403 });
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { communityName: parsed.data.name },
  });

  return NextResponse.json({ name: parsed.data.name });
}
