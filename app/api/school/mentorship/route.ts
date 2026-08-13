import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";

export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  const [pairings, students, mentors] = await Promise.all([
    prisma.conversation.findMany({
      where: { type: "MENTORSHIP", schoolId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true, staffTitle: true } },
              },
            },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profile.findMany({
      where: { schoolId, staffTitle: null, user: { isAlumni: false } },
      select: { userId: true, displayName: true, graduationYear: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.profile.findMany({
      where: {
        OR: [
          { schoolId, staffTitle: { not: null } },
          { alumniSchools: { some: { schoolId } } },
        ],
      },
      select: { userId: true, displayName: true, staffTitle: true, industry: true, user: { select: { isAlumni: true } } },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return NextResponse.json({
    pairings: pairings.map((c) => ({
      id: c.id,
      name: c.communityName,
      createdAt: c.createdAt.toISOString(),
      participants: c.participants.map((p) => ({
        userId: p.userId,
        displayName: p.user.profile?.displayName ?? "Unknown",
        avatarUrl: p.user.profile?.avatarUrl ?? null,
        isStaff: !!p.user.profile?.staffTitle,
      })),
      lastMessage: c.messages[0]
        ? { body: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
        : null,
    })),
    students,
    mentors: mentors.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      kind: m.user.isAlumni ? ("ALUMNI" as const) : ("STAFF" as const),
      subtitle: m.staffTitle ?? m.industry ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { schoolId } = check;

  let body: { studentIds?: string[]; mentorIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const studentIds = body.studentIds ?? [];
  const mentorIds = body.mentorIds ?? [];

  if (studentIds.length === 0 || mentorIds.length === 0) {
    return NextResponse.json(
      { error: "At least one student and one mentor are required" },
      { status: 400 }
    );
  }

  // Verify every selected student belongs to this school and isn't alumni/staff
  const validStudents = await prisma.profile.findMany({
    where: { userId: { in: studentIds }, schoolId, staffTitle: null, user: { isAlumni: false } },
    select: { userId: true },
  });
  if (validStudents.length !== studentIds.length) {
    return NextResponse.json({ error: "One or more students are invalid" }, { status: 400 });
  }

  // Verify every selected mentor belongs to this school and is staff or alumni
  const validMentors = await prisma.profile.findMany({
    where: {
      userId: { in: mentorIds },
      OR: [
        { schoolId, staffTitle: { not: null } },
        { alumniSchools: { some: { schoolId } } },
      ],
    },
    select: { userId: true },
  });
  if (validMentors.length !== mentorIds.length) {
    return NextResponse.json({ error: "One or more mentors are invalid" }, { status: 400 });
  }

  const participantIds = [...new Set([schoolId, ...studentIds, ...mentorIds])];

  const conversation = await prisma.conversation.create({
    data: {
      type: "MENTORSHIP",
      schoolId,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
  });

  return NextResponse.json({ id: conversation.id });
}
