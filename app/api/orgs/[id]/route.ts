import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory } from "@prisma/client";

// Platform admin (team.nivarro@gmail.com): transfer org ownership by email or userId.
// Org owner (org.createdById === session.user.id): edit their own org's profile fields.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (session.user.email === "team.nivarro@gmail.com" && ("createdById" in body || "email" in body)) {
    const { createdById, email } = body as { createdById?: string; email?: string };

    let targetUserId = createdById;

    if (!targetUserId && email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 });
      targetUserId = user.id;
    }

    if (!targetUserId) return NextResponse.json({ error: "createdById or email required" }, { status: 400 });

    const updated = await prisma.org.update({ where: { id }, data: { createdById: targetUserId } });
    return NextResponse.json({ org: updated, newOwner: targetUserId });
  }

  if (org.createdById === session.user.id) {
    const {
      name, category, website, founded, headquartersLocation,
      tagline, logoLetter, logoBg, logoColor, accentColor,
      description, whatWeSeek, whatInternsBuild, contactEmail, values,
    } = body;

    if (!name?.trim() || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }

    const updated = await prisma.org.update({
      where: { id },
      data: {
        name: name.trim(),
        category: category as OrgCategory,
        website, founded, headquartersLocation,
        tagline, logoLetter, logoBg, logoColor, accentColor,
        description, whatWeSeek, whatInternsBuild, contactEmail,
        values: JSON.stringify(values ?? []),
      },
    });
    return NextResponse.json({ org: updated });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.org.findUnique({
    where: { id },
    include: {
      opportunities: { orderBy: { createdAt: "desc" } },
      teams: {
        include: {
          members: { include: { profile: { select: { userId: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ org });
}
