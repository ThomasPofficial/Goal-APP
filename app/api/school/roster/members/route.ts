import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getSchoolSession } from "@/lib/school-auth";

export async function POST(req: Request) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  let body: {
    displayName: string;
    email: string;
    phone?: string;
    role: "STUDENT" | "ALUMNI" | "STAFF";
    graduationYear?: number;
    intendedCollege?: string;
    intendedMajor?: string;
    industry?: string;
    isAvailableToMentor?: boolean;
    jobTitle?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    displayName,
    email,
    phone,
    role,
    graduationYear,
    intendedCollege,
    intendedMajor,
    industry,
    isAvailableToMentor,
    jobTitle,
  } = body;

  if (!displayName?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: "displayName and email are required" },
      { status: 400 }
    );
  }

  if (!["STUDENT", "ALUMNI", "STAFF"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const graduationYearNum = graduationYear ? Number(graduationYear) : undefined;

  const isAlumniRole = role === "ALUMNI";

  const sharedFields = {
    displayName: displayName.trim(),
    phone: phone?.trim() || null,
    ...(isAlumniRole ? { schoolId: null } : { schoolId }),
    onboardingComplete: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let roleFields: Record<string, any> = {};
  if (role === "STUDENT") {
    roleFields = {
      ...(graduationYearNum !== undefined && { graduationYear: graduationYearNum }),
      ...(intendedCollege?.trim() && { intendedCollege: intendedCollege.trim() }),
      ...(intendedMajor?.trim() && { intendedMajor: intendedMajor.trim() }),
    };
  } else if (isAlumniRole) {
    roleFields = {
      ...(graduationYearNum !== undefined && { graduationYear: graduationYearNum }),
      ...(industry?.trim() && { industry: industry.trim() }),
      ...(intendedCollege?.trim() && { intendedCollege: intendedCollege.trim() }),
      isAvailableToMentor: Boolean(isAvailableToMentor),
    };
  } else if (role === "STAFF") {
    roleFields = {
      staffTitle: jobTitle?.trim() || null,
    };
  }

  const profileData = { ...sharedFields, ...roleFields };

  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim() },
    include: { profile: true },
  });

  let userId: string;
  let profileId: string;

  if (existingUser) {
    userId = existingUser.id;

    if (existingUser.profile) {
      profileId = existingUser.profile.id;
      await prisma.profile.update({
        where: { userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: profileData as any,
      });
    } else {
      const created = await prisma.profile.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { userId, ...profileData } as any,
      });
      profileId = created.id;
    }

    if (isAlumniRole && !existingUser.isAlumni) {
      await prisma.user.update({
        where: { id: userId },
        data: { isAlumni: true },
      });
    } else if (!isAlumniRole && existingUser.isAlumni) {
      // Demoted away from alumni for this school — drop the stale
      // AlumniSchool link, and only flip User.isAlumni back to false if
      // they have no remaining alumni links at any other school.
      await prisma.alumniSchool.deleteMany({ where: { profileId, schoolId } });
      const remainingLinks = await prisma.alumniSchool.count({ where: { profileId } });
      if (remainingLinks === 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { isAlumni: false },
        });
      }
    }
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: displayName.trim(),
        email: email.trim(),
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "STUDENT",
        isAlumni: isAlumniRole,
        profile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: profileData as any,
        },
      },
      include: { profile: true },
    });
    userId = newUser.id;
    profileId = newUser.profile!.id;
  }

  if (isAlumniRole) {
    await prisma.alumniSchool.upsert({
      where: { profileId_schoolId: { profileId, schoolId } },
      create: { profileId, schoolId },
      update: {},
    });
  }

  return NextResponse.json({ id: userId });
}
