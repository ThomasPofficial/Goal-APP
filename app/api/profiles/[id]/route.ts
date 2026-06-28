import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const profile = await prisma.profile.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isAdmin = dbUser?.role === "ADMIN";

  if (profile.userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowedFields: Record<string, unknown> = {};
  if (typeof body.isAvailableToMentor === "boolean") allowedFields.isAvailableToMentor = body.isAvailableToMentor;
  if (typeof body.intendedCollege === "string") allowedFields.intendedCollege = body.intendedCollege || null;
  if (typeof body.intendedMajor === "string") allowedFields.intendedMajor = body.intendedMajor || null;
  if (typeof body.graduationYear === "number") allowedFields.graduationYear = body.graduationYear || null;
  if (typeof body.industry === "string") allowedFields.industry = body.industry || null;

  if (Object.keys(allowedFields).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const updated = await prisma.profile.update({
    where: { id },
    data: allowedFields,
    select: {
      id: true,
      isAvailableToMentor: true,
      intendedCollege: true,
      intendedMajor: true,
      graduationYear: true,
      industry: true,
    },
  });

  return NextResponse.json(updated);
}
