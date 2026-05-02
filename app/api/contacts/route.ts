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
  if (!myProfile) return NextResponse.json({ contacts: [] });

  const contacts = await prisma.contact.findMany({
    where: { ownerId: myProfile.id },
    include: {
      target: {
        select: {
          id: true,
          displayName: true,
          handle: true,
          avatarUrl: true,
          geniusType: true,
          schoolName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contacts });
}

const postSchema = z.object({ targetProfileId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const contact = await prisma.contact.upsert({
    where: { ownerId_targetId: { ownerId: myProfile.id, targetId: parsed.data.targetProfileId } },
    create: { ownerId: myProfile.id, targetId: parsed.data.targetProfileId },
    update: {},
  });

  return NextResponse.json({ contact });
}
