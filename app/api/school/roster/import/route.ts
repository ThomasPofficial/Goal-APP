import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { requireSchoolCapability } from "@/lib/school-auth";
import { createAccountInvite } from "@/lib/account-invite";

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

export async function POST(req: Request) {
  const check = await requireSchoolCapability("roster:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

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
  const invites: { email: string; name: string; activateUrl: string }[] = [];

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
        ...(isAlumni ? { schoolId: null } : { schoolId }),
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

      let profileId: string;

      if (existingUser) {
        if (existingUser.profile) {
          profileId = existingUser.profile.id;
          await prisma.profile.update({
            where: { userId: existingUser.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: profileData as any,
          });
        } else {
          const created = await prisma.profile.create({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { userId: existingUser.id, ...profileData } as any,
          });
          profileId = created.id;
        }
        if (isAlumni && !existingUser.isAlumni) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { isAlumni: true },
          });
        } else if (!isAlumni && existingUser.isAlumni) {
          // Demoted away from alumni for this school — drop the stale
          // AlumniSchool link, and only flip User.isAlumni back to false if
          // they have no remaining alumni links at any other school.
          await prisma.alumniSchool.deleteMany({ where: { profileId, schoolId } });
          const remainingLinks = await prisma.alumniSchool.count({ where: { profileId } });
          if (remainingLinks === 0) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { isAlumni: false },
            });
          }
        }
      } else {
        const created = await prisma.user.create({
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
          include: { profile: true },
        });
        profileId = created.profile!.id;
      }

      if (isAlumni) {
        await prisma.alumniSchool.upsert({
          where: { profileId_schoolId: { profileId, schoolId } },
          create: { profileId, schoolId },
          update: {},
        });

        try {
          const invite = await createAccountInvite({ email, name: displayName });
          invites.push({ email, name: displayName, activateUrl: invite.activateUrl });
        } catch (inviteErr) {
          console.error(`Failed to create account invite for ${email}:`, inviteErr);
          errors.push(
            `Row (${email}): account created but invite link failed — use "Copy Invite Link" from the roster list`
          );
        }
      }

      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Row (${row.email ?? "?"}): ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, errors, invites });
}
