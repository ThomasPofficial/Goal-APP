import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { getSchoolSession } from "@/lib/school-auth";
import { createAccountInvite } from "@/lib/account-invite";

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

  const sharedFields = {
    displayName: displayName.trim(),
    phone: phone?.trim() || null,
    schoolId,
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
  } else if (role === "ALUMNI") {
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
  let activateUrl: string | undefined;

  if (existingUser) {
    userId = existingUser.id;

    if (existingUser.profile) {
      await prisma.profile.update({
        where: { userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: profileData as any,
      });
    } else {
      await prisma.profile.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { userId, ...profileData } as any,
      });
    }

    if (role === "ALUMNI" && !existingUser.isAlumni) {
      await prisma.user.update({
        where: { id: userId },
        data: { isAlumni: true },
      });
    }
  } else {
    const newUser = await prisma.user.create({
      data: {
        name: displayName.trim(),
        email: email.trim(),
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "STUDENT",
        isAlumni: role === "ALUMNI",
        profile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: profileData as any,
        },
      },
    });
    userId = newUser.id;

    const invite = await createAccountInvite({
      email: email.trim(),
      name: displayName.trim(),
    });
    activateUrl = invite.activateUrl;
  }

  return NextResponse.json({ id: userId, activateUrl });
}
