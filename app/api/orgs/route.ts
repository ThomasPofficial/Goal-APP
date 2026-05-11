import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { OrgCategory, OrgStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const category = searchParams.get("category") as OrgCategory | null;
  const openOnly = searchParams.get("open") === "1";

  const orgs = await prisma.org.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(openOnly ? { status: "OPEN" as OrgStatus } : {}),
    },
    include: {
      opportunities: { select: { id: true }, take: 1 },
      _count: { select: { teams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = q
    ? orgs.filter((o) => o.name.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
    : orgs;

  return NextResponse.json({ orgs: filtered });
}
