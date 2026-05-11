import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
