import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  schoolId:      z.string(),
  body:          z.string().min(1).max(600),
  sourceName:    z.string().min(1).max(100),
  sourceContext: z.string().max(100).optional().nullable(),
  sourceType:    z.enum(["STUDENT", "ALUMNI", "PARENT", "ORG"]).default("STUDENT"),
});

async function guard(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 } as const;
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return { error: "Forbidden", status: 403 } as const;
  return { session, role: dbUser.role };
}

export async function GET(req: Request) {
  const check = await guard(req);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const { searchParams } = new URL(req.url);
  const schoolId = check.role === "SCHOOL" ? check.session.user.id : searchParams.get("schoolId");
  if (!schoolId) return NextResponse.json({ error: "schoolId required" }, { status: 400 });

  const testimonials = await prisma.brochureTestimonial.findMany({
    where: { schoolId },
    orderBy: { displayOrder: "asc" },
    select: { id: true, body: true, sourceName: true, sourceContext: true, sourceType: true, approved: true, displayOrder: true },
  });
  return NextResponse.json({ testimonials });
}

export async function POST(req: Request) {
  const check = await guard(req);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (check.role === "SCHOOL" && parsed.data.schoolId !== check.session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const count = await prisma.brochureTestimonial.count({ where: { schoolId: parsed.data.schoolId } });
  const testimonial = await prisma.brochureTestimonial.create({
    data: { ...parsed.data, displayOrder: count },
  });
  return NextResponse.json({ testimonial }, { status: 201 });
}
