import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  displayName: z.string().min(1).max(100),
  headline: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  strengthSummary: z.string().max(500).optional(),
  traitIds: z.array(z.string()).max(5),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { displayName, headline, bio, strengthSummary, traitIds } =
    parsed.data;

  // Upsert profile
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      displayName,
      headline,
      bio,
      strengthSummary,
    },
    update: {
      displayName,
      headline,
      bio,
      strengthSummary,
    },
  });

  // Replace trait links
  await prisma.profileTrait.deleteMany({ where: { profileId: profile.id } });

  if (traitIds.length > 0) {
    await prisma.profileTrait.createMany({
      data: traitIds.map((traitId, order) => ({
        profileId: profile.id,
        traitId,
        order,
      })),
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
    },
  });

  return NextResponse.json(profile);
}
