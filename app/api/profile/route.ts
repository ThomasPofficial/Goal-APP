import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  currentFocus: z.string().max(120).optional(),
  interests: z.array(z.string()).max(10).optional(),
  grade: z.number().int().min(1).max(20).nullable().optional(),
  schoolName: z.string().max(200).optional(),
  isFirstGen: z.boolean().optional(),
  isHomeschooled: z.boolean().optional(),
  isInternational: z.boolean().optional(),
  handle: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  onboardingComplete: z.boolean().optional(),
  geniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]).nullable().optional(),
  secondaryGeniusType: z.enum(["DYNAMO", "BLAZE", "TEMPO", "STEEL"]).nullable().optional(),
});

async function generateHandle(displayName: string, userId: string): Promise<string> {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${base}${suffix}`;
    const existing = await prisma.profile.findFirst({
      where: { handle: candidate, NOT: { userId } },
    });
    if (!existing) return candidate;
  }
  return `${base}${Date.now().toString().slice(-6)}`;
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.handle) {
    const conflict = await prisma.profile.findFirst({
      where: { handle: data.handle, NOT: { userId: session.user.id } },
    });
    if (conflict) {
      return NextResponse.json({ error: "Handle taken" }, { status: 409 });
    }
  }

  const current = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, handle: true },
  });
  if (!current) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  let handle = data.handle;
  if (data.onboardingComplete && !current.handle && !handle) {
    handle = await generateHandle(data.displayName ?? current.displayName, session.user.id);
  }

  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.currentFocus !== undefined) updateData.currentFocus = data.currentFocus;
  if (data.interests !== undefined) updateData.interests = JSON.stringify(data.interests);
  if (data.grade !== undefined) updateData.grade = data.grade;
  if (data.schoolName !== undefined) updateData.schoolName = data.schoolName;
  if (data.isFirstGen !== undefined) updateData.isFirstGen = data.isFirstGen;
  if (data.isHomeschooled !== undefined) updateData.isHomeschooled = data.isHomeschooled;
  if (data.isInternational !== undefined) updateData.isInternational = data.isInternational;
  if (handle) updateData.handle = handle;
  if (data.onboardingComplete !== undefined) updateData.onboardingComplete = data.onboardingComplete;
  if (data.geniusType !== undefined) updateData.geniusType = data.geniusType;
  if (data.secondaryGeniusType !== undefined) updateData.secondaryGeniusType = data.secondaryGeniusType;

  const profile = await prisma.profile.update({
    where: { userId: session.user.id },
    data: updateData,
  });

  return NextResponse.json({ profile });
}

const profileSchema = z.object({
  displayName: z.string().min(1).max(100),
  headline: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  strengthSummary: z.string().max(500).optional(),
  traitIds: z.array(z.string()).max(5),
  dateOfBirth: z.string().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { displayName, headline, bio, strengthSummary, traitIds, dateOfBirth } =
    parsed.data;

  const dob = dateOfBirth ? new Date(dateOfBirth) : undefined;

  // Upsert profile
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      displayName,
      headline,
      bio,
      strengthSummary,
      dateOfBirth: dob,
    },
    update: {
      displayName,
      headline,
      bio,
      strengthSummary,
      dateOfBirth: dob,
    },
  });

  // Replace trait links
  await prisma.profileTrait.deleteMany({ where: { profileId: profile.id } });

  if (traitIds.length > 0) {
    await prisma.profileTrait.createMany({
      data: traitIds.map((traitId, order) => ({
        profileId: profile.id,
        traitId,
        order,
      })),
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
    },
  });

  return NextResponse.json(profile);
}
