import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  traitIds: z.array(z.string()).min(1).max(5),
  strengthSummary: z.string().max(500),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { traitIds, strengthSummary } = parsed.data;

  // Get existing profile so we don't clobber displayName / other fields
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true, headline: true, bio: true },
  });

  const displayName =
    existing?.displayName ?? session.user.name ?? "New User";

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, displayName, strengthSummary },
    update: { strengthSummary },
  });

  // Replace trait links
  await prisma.profileTrait.deleteMany({ where: { profileId: profile.id } });
  await prisma.profileTrait.createMany({
    data: traitIds.map((traitId, order) => ({
      profileId: profile.id,
      traitId,
      order,
    })),
  });

  return NextResponse.json({ success: true });
}
