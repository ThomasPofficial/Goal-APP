import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (user.profile) {
    const updated = await prisma.profile.update({
      where: { userId: user.id },
      data: { onboardingComplete: true, geniusType: user.profile.geniusType ?? "DYNAMO" },
    });
    return NextResponse.json({ ok: true, action: "updated", profile: updated.id });
  }

  const handle = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  const uniqueHandle = `${handle}${Date.now().toString().slice(-4)}`;

  const created = await prisma.profile.create({
    data: {
      userId: user.id,
      displayName: user.name ?? email.split("@")[0],
      handle: uniqueHandle,
      geniusType: "DYNAMO",
      onboardingComplete: true,
    },
  });

  return NextResponse.json({ ok: true, action: "created", profile: created.id, handle: uniqueHandle });
}
