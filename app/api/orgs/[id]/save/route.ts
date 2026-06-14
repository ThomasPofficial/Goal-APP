import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orgId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  const existing = await prisma.savedOrg.findUnique({
    where: { profileId_orgId: { profileId: profile.id, orgId } },
  });

  if (existing) {
    await prisma.savedOrg.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedOrg.create({ data: { profileId: profile.id, orgId } });
  return NextResponse.json({ saved: true });
}
