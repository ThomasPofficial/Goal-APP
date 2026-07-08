import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CampaignPublicClient from "./CampaignPublicClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: {
      id: true,
      headline: true,
      subheadline: true,
      body: true,
      ctaText: true,
      imageParams: true,
      videoUrl: true,
      active: true,
    },
  });

  if (!campaign || !campaign.active) notFound();

  return (
    <CampaignPublicClient
      campaign={{ ...campaign, imageParams: campaign.imageParams as unknown as ImageParams }}
    />
  );
}
