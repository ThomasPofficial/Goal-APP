import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

async function resolveSchoolId(sessionUserId: string, role: string, qsSchoolId: string | null): Promise<string | null> {
  if (role === "SCHOOL") return sessionUserId;
  if (role === "ADMIN" && qsSchoolId) return qsSchoolId;
  return null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const schoolId = await resolveSchoolId(session.user.id, dbUser.role, searchParams.get("schoolId"));
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const settings = await prisma.schoolBrochureSettings.upsert({
    where: { schoolId },
    create: { schoolId, visibility: "ADMIN_ONLY", excludedIds: "[]" },
    update: {},
    select: { id: true, schoolId: true, visibility: true, maxStudents: true, excludedIds: true },
  });

  return NextResponse.json({ settings: { ...settings, excludedIds: JSON.parse(settings.excludedIds) as string[] } });
}

const patchSchema = z.object({
  schoolId:    z.string(),
  visibility:  z.enum(["ADMIN_ONLY", "STUDENTS"]).optional(),
  maxStudents: z.number().int().min(1).nullable().optional(),
  excludedIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { schoolId, visibility, maxStudents, excludedIds } = parsed.data;

  if (dbUser.role === "SCHOOL" && schoolId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.schoolBrochureSettings.upsert({
    where: { schoolId },
    create: {
      schoolId,
      visibility: visibility ?? "ADMIN_ONLY",
      maxStudents: maxStudents ?? null,
      excludedIds: excludedIds ? JSON.stringify(excludedIds) : "[]",
    },
    update: {
      ...(visibility !== undefined && { visibility }),
      ...(maxStudents !== undefined && { maxStudents }),
      ...(excludedIds !== undefined && { excludedIds: JSON.stringify(excludedIds) }),
    },
    select: { id: true, schoolId: true, visibility: true, maxStudents: true, excludedIds: true },
  });

  return NextResponse.json({ settings: { ...updated, excludedIds: JSON.parse(updated.excludedIds) as string[] } });
}
