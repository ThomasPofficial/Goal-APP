import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolCapability } from "@/lib/school-auth";

// Read-only: listing a campaign's version history is a view operation.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const check = await requireSchoolCapability("campaigns:view");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: check.schoolId },
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
