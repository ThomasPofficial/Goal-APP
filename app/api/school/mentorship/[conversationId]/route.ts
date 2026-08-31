import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const check = await requireSchoolCapability("mentorship:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { conversationId } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, type: "MENTORSHIP", schoolId },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  await prisma.conversation.delete({ where: { id: conversationId } });

  return NextResponse.json({ ok: true });
}
