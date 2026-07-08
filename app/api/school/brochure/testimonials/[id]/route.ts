import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  body:          z.string().min(1).max(600).optional(),
  sourceName:    z.string().min(1).max(100).optional(),
  sourceContext: z.string().max(100).nullable().optional(),
  sourceType:    z.enum(["STUDENT", "ALUMNI", "PARENT", "ORG"]).optional(),
  approved:      z.boolean().optional(),
  displayOrder:  z.number().int().optional(),
});

async function guardItem(id: string, userId: string, role: string) {
  const item = await prisma.brochureTestimonial.findUnique({ where: { id }, select: { schoolId: true } });
  if (!item) return { error: "Not found", status: 404 } as const;
  if (role === "SCHOOL" && item.schoolId !== userId) return { error: "Forbidden", status: 403 } as const;
  return { item };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const check = await guardItem(id, session.user.id, dbUser.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const updated = await prisma.brochureTestimonial.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ testimonial: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (dbUser?.role !== "SCHOOL" && dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const check = await guardItem(id, session.user.id, dbUser.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  await prisma.brochureTestimonial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
