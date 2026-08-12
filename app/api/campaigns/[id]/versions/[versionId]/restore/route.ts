import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireSchoolCapability } from "@/lib/school-auth";

// Restoring a previous version mutates the live campaign — a write.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const check = await requireSchoolCapability("campaigns:edit");
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: check.schoolId },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const version = await prisma.campaignVersion.findFirst({
    where: { id: versionId, campaignId: id },
  });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const imageParams = version.imageParams as Prisma.InputJsonValue;

  const [updated] = await prisma.$transaction([
    prisma.campaign.update({
      where: { id },
      data: {
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams,
      },
    }),
    prisma.campaignVersion.create({
      data: {
        campaignId: id,
        cause: version.cause,
        headline: version.headline,
        subheadline: version.subheadline,
        body: version.body,
        ctaText: version.ctaText,
        imageParams,
        source: "restore",
        restoredFrom: version.id,
      },
    }),
  ]);

  return NextResponse.json({
    campaignId: updated.id,
    headline: updated.headline,
    subheadline: updated.subheadline,
    body: updated.body,
    ctaText: updated.ctaText,
    imageParams: updated.imageParams,
    cause: updated.cause,
  });
}
