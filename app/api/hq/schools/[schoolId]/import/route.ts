import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { ensureSchoolGeneralRoom } from "@/lib/communities";

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

interface ImportRow {
  displayName: string;
  email: string;
  phone?: string;
  role: string;
  graduationYear?: string;
  college?: string;
  major?: string;
  industry?: string;
  isMentor?: string | boolean;
  jobTitle?: string;
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

  let body: { rows: ImportRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rows } = body;

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      if (!row.email?.trim()) {
        skipped++;
        continue;
      }

      const email = row.email.trim();
      const displayName = row.displayName?.trim() || email;
      const role = (row.role || "STUDENT").toUpperCase();
      const isAlumni = role === "ALUMNI";
      const graduationYearNum = row.graduationYear
        ? Number(row.graduationYear)
        : undefined;
      const isMentorBool = row.isMentor === "true" || row.isMentor === true;

      const sharedFields = {
        displayName,
        phone: row.phone?.trim() || null,
        schoolId,
        onboardingComplete: true,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let roleFields: Record<string, any> = {};
      if (role === "STUDENT") {
        roleFields = {
          ...(graduationYearNum !== undefined &&
            !isNaN(graduationYearNum) && { graduationYear: graduationYearNum }),
          ...(row.college?.trim() && { intendedCollege: row.college.trim() }),
          ...(row.major?.trim() && { intendedMajor: row.major.trim() }),
        };
      } else if (role === "ALUMNI") {
        roleFields = {
          ...(graduationYearNum !== undefined &&
            !isNaN(graduationYearNum) && { graduationYear: graduationYearNum }),
          ...(row.industry?.trim() && { industry: row.industry.trim() }),
          ...(row.college?.trim() && { intendedCollege: row.college.trim() }),
          isAvailableToMentor: isMentorBool,
        };
      } else if (role === "STAFF") {
        roleFields = {
          staffTitle: row.jobTitle?.trim() || null,
        };
      }

      const profileData = { ...sharedFields, ...roleFields };

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        if (existingUser.profile) {
          await prisma.profile.update({
            where: { userId: existingUser.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: profileData as any,
          });
        } else {
          await prisma.profile.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { userId: existingUser.id, ...profileData } as any,
          });
        }
        if (isAlumni && !existingUser.isAlumni) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { isAlumni: true },
          });
        }
      } else {
        const newUser = await prisma.user.create({
          data: {
            name: displayName,
            email,
            passwordHash: await bcrypt.hash(randomUUID(), 10),
            role: "STUDENT",
            isAlumni,
            profile: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: profileData as any,
            },
          },
        });
        userId = newUser.id;
      }

      await ensureSchoolGeneralRoom(schoolId, userId);

      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Row (${row.email ?? "?"}): ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
