import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const year = parseInt(body.graduationYear);
  const currentYear = new Date().getFullYear();

  if (!year || year < 1950 || year > currentYear) {
    return NextResponse.json({ error: "Enter a valid graduation year (1950–" + currentYear + ")" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { isAlumni: true },
  });

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (profile) {
    await prisma.profile.update({ where: { id: profile.id }, data: { graduationYear: year } });
  } else {
    await prisma.profile.create({
      data: { userId: session.user.id, graduationYear: year, onboardingComplete: false },
    });
  }

  return NextResponse.json({ ok: true });
}
