import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });
  if (org.createdById !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = "nv_sk_" + randomBytes(32).toString("hex");

  await prisma.org.update({ where: { id }, data: { apiKey } });

  return NextResponse.json({
    apiKey,
    note: "Store this key securely — it will not be shown again. Call this endpoint again to rotate it.",
  });
}
