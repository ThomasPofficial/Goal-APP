import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import CampaignEditClient from "./CampaignEditClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const campaign = await prisma.campaign.findFirst({
    where: { id, schoolId: session.user.id },
  });
  if (!campaign) notFound();

  const versions = await prisma.campaignVersion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, cause: true, headline: true, imageParams: true, source: true, note: true, restoredFrom: true, createdAt: true },
  });

  return (
    <CampaignEditClient
      campaign={{
        id: campaign.id,
        slug: campaign.slug,
        cause: campaign.cause,
        headline: campaign.headline,
        subheadline: campaign.subheadline,
        body: campaign.body,
        ctaText: campaign.ctaText,
        imageParams: campaign.imageParams as unknown as ImageParams,
        videoUrl: campaign.videoUrl,
        active: campaign.active,
      }}
      versions={versions.map((v) => ({
        id: v.id,
        cause: v.cause,
        headline: v.headline,
        imageParams: v.imageParams as unknown as ImageParams,
        source: v.source,
        note: v.note,
        restoredFrom: v.restoredFrom,
        createdAt: v.createdAt.toISOString(),
      }))}
    />
  );
}
