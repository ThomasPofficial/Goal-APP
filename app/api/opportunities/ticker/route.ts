import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const opportunities = await prisma.opportunity.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    where: {
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
    select: {
      id: true,
      title: true,
      category: true,
      deadline: true,
      org: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ opportunities });
}
