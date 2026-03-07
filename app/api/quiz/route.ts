import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  geniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const userId = session.user.id;

  // Upsert profile with genius type (creates profile if it doesn't exist yet)
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      displayName: session.user.name ?? "New User",
      geniusType: parsed.data.geniusType,
    },
    update: {
      geniusType: parsed.data.geniusType,
    },
  });

  return NextResponse.json({ success: true });
}
