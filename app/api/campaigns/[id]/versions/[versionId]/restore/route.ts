import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
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
