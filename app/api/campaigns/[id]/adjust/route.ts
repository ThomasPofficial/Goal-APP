import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than 0." },
      { status: 400 }
    );
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { manualAdjustment: { increment: amount } },
  });

  return NextResponse.json({
    ok: true,
    newTotal: parseFloat(updated.manualAdjustment.toString()),
  });
}
