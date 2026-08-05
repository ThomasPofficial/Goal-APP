import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ensureSchoolGeneralRoom } from "@/lib/communities";

// Seeds ~185 Westside Academy accounts (students, teachers, mentors) and joins
// them all to the school's General community room — used to stress-test chat
// at realistic school size. Idempotent: safe to re-run (upserts by email).
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const DEMO_PASSWORD = "demo2026";
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // ── Ensure the Westside Academy school account exists ─────────────────
    let schoolUser = await prisma.user.findUnique({ where: { email: "school@nivarro.demo" } });
    if (!schoolUser) {
      schoolUser = await prisma.user.create({
        data: {
          name: "Westside Academy",
          email: "school@nivarro.demo",
          passwordHash: hash,
          role: "SCHOOL",
        },
      });
    }
    const schoolId = schoolUser.id;

    const existingSchoolProfile = await prisma.profile.findUnique({ where: { userId: schoolId } });
    if (!existingSchoolProfile) {
      await prisma.profile.create({
        data: {
          userId: schoolId,
          displayName: "Westside Academy",
          headline: "Empowering the next generation of leaders",
          onboardingComplete: true,
        },
      });
    }

    // ── Name pools ──────────────────────────────────────────────────────────
    const FIRST_NAMES = [
      "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason",
      "Isabella", "Lucas", "Mia", "Elijah", "Amelia", "James", "Harper",
      "Benjamin", "Evelyn", "Henry", "Abigail", "Alexander", "Ella", "Michael",
      "Scarlett", "Daniel", "Grace", "Jackson", "Chloe", "Sebastian", "Lily",
      "Aiden", "Zoey", "Matthew", "Hannah", "Samuel", "Layla", "David",
      "Nora", "Joseph", "Aria", "Carter", "Riley", "Wyatt", "Zara", "Julian",
      "Maya", "Levi", "Naomi", "Isaac", "Priya", "Owen", "Fatima", "Gabriel",
      "Elena", "Anthony", "Ines", "Dylan", "Camila", "Christian", "Willow",
      "Hunter", "Jasmine", "Xavier", "Sofia", "Caleb", "Aaliyah", "Ryan",
      "Valentina",
    ];
    const LAST_NAMES = [
      "Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis", "Rodriguez",
      "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
      "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez",
      "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis",
      "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott",
      "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson",
      "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
      "Patel", "Kim", "Chen", "Diaz", "Reed", "Cook", "Bell", "Murphy",
      "Bailey", "Cooper", "Richardson", "Cox", "Howard", "Ward", "Peterson",
      "Gray", "Ramos", "James", "Watson", "Brooks",
    ];
    const TEACHER_SUBJECTS = [
      "AP Biology", "English Literature", "World History", "Chemistry",
      "AP Calculus", "Spanish", "Physics", "Journalism & Media",
      "Studio Art", "Economics",
    ];
    const MENTOR_FIELDS: Array<{ industry: string; jobTitle: string; employer: string }> = [
      { industry: "Technology", jobTitle: "Software Engineer", employer: "Stripe" },
      { industry: "Finance", jobTitle: "Investment Analyst", employer: "Goldman Sachs" },
      { industry: "Medicine", jobTitle: "Resident Physician", employer: "UCSF Medical Center" },
      { industry: "Law", jobTitle: "Associate Attorney", employer: "Latham & Watkins" },
      { industry: "Design", jobTitle: "Product Designer", employer: "Figma" },
      { industry: "Public Policy", jobTitle: "Policy Analyst", employer: "Brookings Institution" },
      { industry: "Media", jobTitle: "Video Producer", employer: "Vox" },
      { industry: "Engineering", jobTitle: "Mechanical Engineer", employer: "SpaceX" },
      { industry: "Nonprofit", jobTitle: "Program Manager", employer: "Teach For America" },
      { industry: "Venture & Startups", jobTitle: "Founder", employer: "Self-employed" },
    ];

    // Shuffle a copy of an array (Fisher-Yates)
    function shuffled<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // Build a large unique-name pool: shuffled first x last combos
    const firsts = shuffled(FIRST_NAMES);
    const lasts = shuffled(LAST_NAMES);
    const namePairs: Array<{ first: string; last: string }> = [];
    outer: for (const f of firsts) {
      for (const l of lasts) {
        namePairs.push({ first: f, last: l });
        if (namePairs.length >= 200) break outer;
      }
    }

    const STUDENT_COUNT = 165;
    const TEACHER_COUNT = TEACHER_SUBJECTS.length; // 10
    const MENTOR_COUNT = MENTOR_FIELDS.length; // 10

    type SeedPerson = {
      email: string;
      name: string;
      handle: string;
      profileData: { displayName: string; [key: string]: unknown };
    };

    const usedEmails = new Set<string>();
    function emailFor(first: string, last: string, domain: string): string {
      const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
      let candidate = `${base}@${domain}`;
      let n = 2;
      while (usedEmails.has(candidate)) {
        candidate = `${base}${n}@${domain}`;
        n++;
      }
      usedEmails.add(candidate);
      return candidate;
    }
    function handleFor(first: string, last: string): string {
      return `${first}${last}`.toLowerCase().replace(/[^a-z]/g, "");
    }

    const people: SeedPerson[] = [];
    let cursor = 0;

    // Students — grades 9-12, round-robin
    for (let i = 0; i < STUDENT_COUNT; i++) {
      const { first, last } = namePairs[cursor++];
      const grade = 9 + (i % 4);
      people.push({
        email: emailFor(first, last, "westside.demo"),
        name: `${first} ${last}`,
        handle: handleFor(first, last),
        profileData: {
          displayName: `${first} ${last}`,
          grade,
          schoolId,
          onboardingComplete: true,
          bio: `${grade}th grader at Westside Academy.`,
        },
      });
    }

    // Teachers — role STUDENT with staffTitle (matches existing seed-school-mock convention)
    for (let i = 0; i < TEACHER_COUNT; i++) {
      const { first, last } = namePairs[cursor++];
      const subject = TEACHER_SUBJECTS[i];
      people.push({
        email: emailFor(first, last, "westside.demo"),
        name: `${first} ${last}`,
        handle: handleFor(first, last),
        profileData: {
          displayName: `${first} ${last}`,
          staffTitle: subject,
          schoolId,
          onboardingComplete: true,
          bio: `Teaches ${subject} at Westside Academy.`,
        },
      });
    }

    // Mentors — alumni, available to mentor, working professionals
    for (let i = 0; i < MENTOR_COUNT; i++) {
      const { first, last } = namePairs[cursor++];
      const field = MENTOR_FIELDS[i];
      people.push({
        email: emailFor(first, last, "westside-alumni.demo"),
        name: `${first} ${last}`,
        handle: handleFor(first, last),
        profileData: {
          displayName: `${first} ${last}`,
          schoolId,
          onboardingComplete: true,
          isAvailableToMentor: true,
          industry: field.industry,
          jobTitle: field.jobTitle,
          employer: field.employer,
          graduationYear: 2018 + (i % 6),
          bio: `${field.jobTitle} at ${field.employer}. Westside Academy alum, happy to mentor current students.`,
        },
      });
    }

    // ── Create/upsert users + profiles in bounded-concurrency batches ─────
    const BATCH_SIZE = 20;
    const createdUserIds: string[] = [];

    for (let i = 0; i < people.length; i += BATCH_SIZE) {
      const batch = people.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (person) => {
          const user = await prisma.user.upsert({
            where: { email: person.email },
            update: { passwordHash: hash },
            create: {
              name: person.name,
              email: person.email,
              passwordHash: hash,
              role: "STUDENT",
              isAlumni: !!person.profileData.isAvailableToMentor,
            },
          });

          const existing = await prisma.profile.findUnique({ where: { userId: user.id } });
          if (existing) {
            await prisma.profile.update({
              where: { id: existing.id },
              data: { ...person.profileData, handle: existing.handle ?? person.handle },
            });
          } else {
            await prisma.profile.create({
              data: { userId: user.id, handle: person.handle, ...person.profileData },
            });
          }

          createdUserIds.push(user.id);
        })
      );
    }

    // ── Join everyone to the school's General community room ───────────────
    const generalRoom = await ensureSchoolGeneralRoom(schoolId, schoolId);
    await prisma.conversationParticipant.createMany({
      data: createdUserIds.map((userId) => ({ conversationId: generalRoom.id, userId })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      ok: true,
      message: "Westside Academy stress-test roster seeded",
      schoolAccount: "school@nivarro.demo / demo2026",
      totalSeeded: people.length,
      students: STUDENT_COUNT,
      teachers: TEACHER_COUNT,
      mentors: MENTOR_COUNT,
      generalRoomId: generalRoom.id,
      password: DEMO_PASSWORD,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}

// GET — read back the latest messages in Westside's General room, so the
// seeding/testing script can confirm live messages sent from the real app.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "niv-reset-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const take = Math.min(Number(searchParams.get("take") ?? 30), 100);

  const schoolUser = await prisma.user.findUnique({ where: { email: "school@nivarro.demo" } });
  if (!schoolUser) return NextResponse.json({ error: "Westside Academy not seeded yet" }, { status: 404 });

  const room = await prisma.conversation.findFirst({
    where: { type: "COMMUNITY", schoolId: schoolUser.id, isPrivateRoom: false },
    select: { id: true, _count: { select: { participants: true } } },
  });
  if (!room) return NextResponse.json({ error: "General room does not exist yet" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: room.id },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    roomId: room.id,
    participantCount: room._count.participants,
    messages: messages.map((m) => ({
      sender: m.sender.name,
      email: m.sender.email,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
