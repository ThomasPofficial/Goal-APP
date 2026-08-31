import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSchoolCapability } from "@/lib/school-auth";

const schema = z.object({
  schoolCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
});

export async function PATCH(req: Request) {
  const check = await requireSchoolCapability("community:manage");
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });

  try {
    await prisma.user.update({
      where: { id: check.schoolId },
      data: { schoolCode: parsed.data.schoolCode },
    });
    return NextResponse.json({ ok: true, schoolCode: parsed.data.schoolCode });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "That code is already taken. Try another." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
