import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const patch: { orgType?: string | null; verified?: boolean } = {};
  if ("orgType" in body) patch.orgType = body.orgType ?? null;
  if ("verified" in body) patch.verified = Boolean(body.verified);

  const org = await prisma.org.update({ where: { id }, data: patch, select: { id: true, orgType: true, verified: true } });
  return NextResponse.json({ org });
}
