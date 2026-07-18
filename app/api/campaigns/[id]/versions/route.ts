import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cause: true,
      headline: true,
      imageParams: true,
      source: true,
      note: true,
      restoredFrom: true,
      createdAt: true,
    },
  });

  return NextResponse.json(versions);
}
