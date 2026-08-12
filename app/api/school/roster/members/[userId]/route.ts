import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
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

  // Security: find profile only if it belongs to this school — either
  // directly (non-alumni) or via an AlumniSchool link.
  const profile = await prisma.profile.findFirst({
    where: {
      userId,
      OR: [{ schoolId }, { alumniSchools: { some: { schoolId } } }],
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // isAlumni cannot be flipped here: doing so would change User.isAlumni without
  // creating/deleting the corresponding AlumniSchool row, silently un-walling (or
  // incorrectly walling) the member. Neither RosterClient nor SchoolDetailClient
  // ever sends this field, so rejecting it outright costs nothing in practice.
  if (body.isAlumni !== undefined) {
    return NextResponse.json(
      { error: "isAlumni cannot be changed here; re-add the member with the correct role" },
      { status: 400 }
    );
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;
  const { userId } = await params;

  // Security: find profile only if it belongs to this school — either
  // directly (non-alumni) or via an AlumniSchool link.
  const profile = await prisma.profile.findFirst({
    where: {
      userId,
      OR: [{ schoolId }, { alumniSchools: { some: { schoolId } } }],
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Unlink from this specific school — do NOT delete the user, and do NOT
  // touch any of their other AlumniSchool links.
  await Promise.all([
    prisma.profile.updateMany({
      where: { id: profile.id, schoolId },
      data: { schoolId: null },
    }),
    prisma.alumniSchool.deleteMany({
      where: { profileId: profile.id, schoolId },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
