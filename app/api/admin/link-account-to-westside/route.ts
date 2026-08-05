import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureSchoolGeneralRoom } from "@/lib/communities";

// Links an existing real account to Westside Academy (sets Profile.schoolId,
// creating the profile if it doesn't have one yet) and joins it to the
// General community room. Only touches schoolId — no other profile fields.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = body.email;
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "No user with that email" }, { status: 404 });

  const schoolUser = await prisma.user.findUnique({ where: { email: "school@nivarro.demo" } });
  if (!schoolUser) return NextResponse.json({ error: "Westside Academy not seeded yet" }, { status: 404 });
  const schoolId = schoolUser.id;

  const existingProfile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (existingProfile) {
    await prisma.profile.update({ where: { id: existingProfile.id }, data: { schoolId } });
  } else {
    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: user.name ?? email,
        schoolId,
        onboardingComplete: true,
      },
    });
  }

  const room = await ensureSchoolGeneralRoom(schoolId, user.id);

  return NextResponse.json({ ok: true, email, schoolId, generalRoomId: room.id });
}
