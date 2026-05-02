import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  // Verify membership
  const myProfile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });
  const membership = await prisma.teamMember.findFirst({ where: { teamId, profileId: myProfile.id } });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find or create team conversation
  let convo = await prisma.conversation.findFirst({ where: { teamId, type: "TEAM" } });
  if (!convo) {
    convo = await prisma.conversation.create({ data: { type: "TEAM", teamId } });
  }

  const message = await prisma.message.create({
    data: { conversationId: convo.id, senderId: session.user.id, content: parsed.data.body },
    include: { sender: { select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true, geniusType: true } } } } },
  });

  return NextResponse.json({ message });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const myProfile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });
  const membership = await prisma.teamMember.findFirst({ where: { teamId, profileId: myProfile.id } });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 50;

  const convo = await prisma.conversation.findFirst({ where: { teamId, type: "TEAM" } });
  if (!convo) return NextResponse.json({ messages: [] });

  const messages = await prisma.message.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: {
        select: { id: true, name: true, profile: { select: { displayName: true, avatarUrl: true, geniusType: true } } },
      },
    },
  });

  return NextResponse.json({ messages: messages.reverse(), conversationId: convo.id });
}
