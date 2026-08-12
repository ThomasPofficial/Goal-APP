import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireSchoolCapability } from "@/lib/school-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await requireSchoolCapability("roster:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  let body: {
    displayName?: string;
    phone?: string;
    graduationYear?: number;
    intendedCollege?: string;
    intendedMajor?: string;
    industry?: string;
    isAvailableToMentor?: boolean;
    jobTitle?: string;
    isAlumni?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Security: find profile only if it belongs to this school
  const profile = await prisma.profile.findFirst({
    where: { userId, schoolId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Build partial update — only include fields present in body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileUpdate: Record<string, any> = {};
  if (body.displayName !== undefined) profileUpdate.displayName = body.displayName.trim();
  if (body.phone !== undefined) profileUpdate.phone = body.phone.trim() || null;
  if (body.graduationYear !== undefined) profileUpdate.graduationYear = body.graduationYear ? Number(body.graduationYear) : null;
  if (body.intendedCollege !== undefined) profileUpdate.intendedCollege = body.intendedCollege.trim() || null;
  if (body.intendedMajor !== undefined) profileUpdate.intendedMajor = body.intendedMajor.trim() || null;
  if (body.industry !== undefined) profileUpdate.industry = body.industry.trim() || null;
  if (body.isAvailableToMentor !== undefined) profileUpdate.isAvailableToMentor = Boolean(body.isAvailableToMentor);
  if (body.jobTitle !== undefined) profileUpdate.staffTitle = body.jobTitle.trim() || null;

  if (Object.keys(profileUpdate).length > 0) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: profileUpdate,
    });
  }

  // If isAlumni provided, update User record too
  if (body.isAlumni !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: { isAlumni: Boolean(body.isAlumni) },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await requireSchoolCapability("roster:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  // Security: find profile only if it belongs to this school
  const profile = await prisma.profile.findFirst({
    where: { userId, schoolId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Unlink from school — do NOT delete the user
  await prisma.profile.update({
    where: { id: profile.id },
    data: { schoolId: null },
  });

  return NextResponse.json({ ok: true });
}
