import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Admin-only: transfer org ownership by email or userId
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== "team.nivarro@gmail.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { createdById, email } = body as { createdById?: string; email?: string };

  let targetUserId = createdById;

  if (!targetUserId && email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 });
    targetUserId = user.id;
  }

  if (!targetUserId) return NextResponse.json({ error: "createdById or email required" }, { status: 400 });

  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.org.update({ where: { id }, data: { createdById: targetUserId } });
  return NextResponse.json({ org: updated, newOwner: targetUserId });
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
