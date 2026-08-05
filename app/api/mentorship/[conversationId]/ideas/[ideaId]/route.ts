import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: Promise<{ conversationId: string; ideaId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ideaId } = await params;
  const idea = await prisma.ideaNote.findUnique({ where: { id: ideaId } });
  if (!idea || idea.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.ideaNote.delete({ where: { id: ideaId } });
  return NextResponse.json({ success: true });
}
