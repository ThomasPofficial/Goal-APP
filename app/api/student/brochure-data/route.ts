import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const surveySchema = z.object({
  college:         z.string().max(200).optional().nullable(),
  jobTitle:        z.string().max(200).optional().nullable(),
  employer:        z.string().max(200).optional().nullable(),
  internshipTitle: z.string().max(200).optional().nullable(),
  internshipOrg:   z.string().max(200).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ data: null });

  const data = await prisma.studentBrochureData.findUnique({
    where: { profileId: profile.id },
    select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true, updatedAt: true },
  });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json();
  const parsed = surveySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const data = await prisma.studentBrochureData.upsert({
    where: { profileId: profile.id },
    create: { profileId: profile.id, ...parsed.data },
    update: { ...parsed.data },
  });
  return NextResponse.json({ data });
}
