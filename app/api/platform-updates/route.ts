import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ADMIN_EMAIL = "team@nivarro.co";

export async function GET() {
  const updates = await prisma.platformUpdate.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, body: true, emoji: true, createdAt: true },
  });
  return NextResponse.json({ updates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, body: text, emoji } = body ?? {};

  if (!title?.trim() || !text?.trim()) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const update = await prisma.platformUpdate.create({
    data: { title: title.trim(), body: text.trim(), emoji: emoji?.trim() || null },
  });

  return NextResponse.json({ update }, { status: 201 });
}
