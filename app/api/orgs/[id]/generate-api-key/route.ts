import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.email !== "team.nivarro@gmail.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });
  if (!org.isPaid) return NextResponse.json({ error: "Org must be on paid tier before generating an API key" }, { status: 400 });

  const apiKey = "niv_" + randomBytes(32).toString("hex");

  await prisma.org.update({ where: { id }, data: { apiKey } });

  return NextResponse.json({
    apiKey,
    note: "Store this key securely — it will not be shown again. Call this endpoint again to rotate it.",
  });
}
