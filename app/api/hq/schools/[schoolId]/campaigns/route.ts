import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") return { error: "Forbidden", status: 403 as const };
  return { userId: session.user.id };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const check = await getAdminSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { schoolId } = await params;

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId },
    include: {
      pledges: { select: { pledgeAmount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = campaigns.map((c) => {
    const pledgeTotal = c.pledges.reduce((sum, p) => {
      return sum + (p.pledgeAmount ? parseFloat(p.pledgeAmount.toString()) : 0);
    }, 0);
    return {
      id: c.id,
      title: c.headline,
      cause: c.cause,
      goalAmount: c.goalAmount ? parseFloat(c.goalAmount.toString()) : null,
      manualAdjustment: parseFloat(c.manualAdjustment.toString()),
      pledgeTotal,
      active: c.active,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return NextResponse.json(result);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const check = await getAdminSession();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { schoolId } = await params;
  const body = await req.json().catch(() => ({}));
  const { title, cause, goalAmount } = body as {
    title?: string;
    cause?: string;
    goalAmount?: number | string;
  };

  if (!title?.trim() || !cause?.trim()) {
    return NextResponse.json(
      { error: "Title and cause are required." },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      schoolId,
      headline: title.trim(),
      cause: cause.trim(),
      ...(goalAmount != null ? { goalAmount: Number(goalAmount) } : {}),
      body: "",
      subheadline: "",
      ctaText: "Pledge Support",
      imageParams: {},
      active: false,
    },
  });

  return NextResponse.json({ id: campaign.id }, { status: 201 });
}
