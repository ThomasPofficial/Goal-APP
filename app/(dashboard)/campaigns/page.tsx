import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import CampaignsListClient from "./CampaignsListClient";
import type { ImageParams } from "@/components/campaigns/CampaignCanvas";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("campaigns:view");
  if ("error" in check) redirect("/dashboard");

  const campaigns = await prisma.campaign.findMany({
    where: { schoolId: check.schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { pledges: true } },
      pledges: { select: { pledgeAmount: true } },
    },
  });

  return (
    <CampaignsListClient
      campaigns={campaigns.map((c) => {
        const pledgeSum = c.pledges.reduce(
          (sum, p) => sum + (p.pledgeAmount ? parseFloat(p.pledgeAmount.toString()) : 0),
          0
        );
        return {
          id: c.id,
          slug: c.slug,
          headline: c.headline,
          subheadline: c.subheadline,
          imageParams: c.imageParams as unknown as ImageParams,
          active: c.active,
          pledgeCount: c._count.pledges,
          raised: parseFloat(c.manualAdjustment.toString()) + pledgeSum,
          goalAmount: c.goalAmount ? parseFloat(c.goalAmount.toString()) : null,
          createdAt: c.createdAt.toISOString(),
        };
      })}
    />
  );
}
