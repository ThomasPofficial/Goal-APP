import { prisma } from "@/lib/prisma";
import { calculateCampaignDonationFee, MIN_DONATION_CENTS } from "./campaignDonationFee";

export async function processCampaignDonation(input: {
  campaignId: string;
  amountCents: number;
  donorName: string;
  donorEmail: string;
  coverFees: boolean;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) {
    throw new Error(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`);
  }
  const { feeCents, totalCents, netCents } = calculateCampaignDonationFee(input.amountCents, input.coverFees);

  // TODO(stripe): once real payments are wired up, replace this immediate
  // MOCK_COMPLETED create with a Stripe Checkout Session create, persist
  // status "PENDING" + stripeSessionId here, and flip to "COMPLETED" from
  // a webhook handler instead of inline.
  return prisma.campaignPledge.create({
    data: {
      campaignId: input.campaignId,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      pledgeAmount: netCents / 100,
      feeCents,
      totalCents,
      status: "MOCK_COMPLETED",
    },
  });
}
