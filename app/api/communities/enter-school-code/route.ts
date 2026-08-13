import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureSchoolGeneralRoom } from '@/lib/communities';
import { z } from 'zod';

const schema = z.object({ schoolCode: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  }

  // Find the school by its code
  const school = await prisma.user.findFirst({
    where: { schoolCode: parsed.data.schoolCode, role: 'SCHOOL' },
    select: { id: true },
  });
  if (!school) {
    return NextResponse.json({ error: 'School code not found' }, { status: 404 });
  }

  // Link the user's profile to the school
  const [profile, dbUser] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAlumni: true },
    }),
  ]);
  if (!profile) {
    return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 });
  }

  if (dbUser?.isAlumni) {
    // Alumni are linked to schools exclusively via AlumniSchool rows;
    // Profile.schoolId is not consulted for them (see getSchoolIds in lib/communities.ts).
    await prisma.alumniSchool.upsert({
      where: { profileId_schoolId: { profileId: profile.id, schoolId: school.id } },
      create: { profileId: profile.id, schoolId: school.id },
      update: {},
    });
  } else {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { schoolId: school.id },
    });
  }

  // Auto-join the school's general community room
  await ensureSchoolGeneralRoom(school.id, session.user.id);

  return NextResponse.json({ ok: true });
}
