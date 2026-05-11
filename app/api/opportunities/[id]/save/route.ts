import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId }, select: { id: true } });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: opportunityId } = await params;
  const profile = await getProfile(session.user.id);
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  await prisma.savedOpportunity.upsert({
    where: { profileId_opportunityId: { profileId: profile.id, opportunityId } },
    create: { profileId: profile.id, opportunityId },
    update: {},
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: opportunityId } = await params;
  const profile = await getProfile(session.user.id);
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  await prisma.savedOpportunity.deleteMany({
    where: { profileId: profile.id, opportunityId },
  });

  return NextResponse.json({ saved: false });
}
