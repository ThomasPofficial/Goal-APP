import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") return { error: "Forbidden", status: 403 };
  return { userId: session.user.id };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const check = await getAdminSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { schoolId } = await params;

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
  }

  return NextResponse.json({ id: userId });
}
