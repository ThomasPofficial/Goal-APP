import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") return { error: "Forbidden", status: 403 };
  return { userId: session.user.id };
}

export async function GET() {
  const check = await getAdminSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const schools = await prisma.user.findMany({
    where: { role: "SCHOOL" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          headline: true,
          advancementEmail: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(schools);
}

export async function POST(req: Request) {
  const check = await getAdminSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json();
  const { name, email, schoolCode, tagline, advancementEmail } = body as {
    name?: string;
    email?: string;
    schoolCode?: string;
    tagline?: string;
    advancementEmail?: string;
  };

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "A school with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(randomUUID(), 10);

  const schoolUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "SCHOOL",
      schoolCode: schoolCode?.trim() || null,
    },
  });

  await prisma.profile.create({
    data: {
      userId: schoolUser.id,
      displayName: name,
      headline: tagline?.trim() || null,
      advancementEmail: advancementEmail?.trim() || null,
      onboardingComplete: true,
    },
  });

  return NextResponse.json({ id: schoolUser.id }, { status: 201 });
}
