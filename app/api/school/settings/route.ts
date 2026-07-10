import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSchoolSession } from "@/lib/school-auth";

export async function GET() {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const school = await prisma.user.findUnique({
    where: { id: check.schoolId },
    select: { schoolQuizEnabled: true },
  });

  return NextResponse.json({ schoolQuizEnabled: school?.schoolQuizEnabled ?? false });
}

export async function PATCH(req: Request) {
  const check = await getSchoolSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { schoolQuizEnabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.schoolQuizEnabled !== "boolean") {
    return NextResponse.json({ error: "schoolQuizEnabled must be a boolean" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: check.schoolId },
    data: { schoolQuizEnabled: body.schoolQuizEnabled },
  });

  return NextResponse.json({ ok: true });
}
