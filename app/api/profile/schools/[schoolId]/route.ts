import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { schoolId } = await params;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAlumni: true, profile: { select: { id: true } } },
  });
  if (!dbUser?.isAlumni || !dbUser.profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.alumniSchool.deleteMany({
    where: { profileId: dbUser.profile.id, schoolId },
  });

  return NextResponse.json({ ok: true });
}
