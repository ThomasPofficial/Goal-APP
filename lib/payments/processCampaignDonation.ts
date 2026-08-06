import { prisma } from "@/lib/prisma";
import { calculateDonationFee, MIN_DONATION_CENTS } from "./donationFees";

export async function processCampaignDonation(input: {
  campaignId: string;
  amountCents: number;
  donorName: string;
  donorEmail: string;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) {
    throw new Error(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`);
  }
  const { feeCents, totalCents } = calculateDonationFee(input.amountCents);

  // TODO(stripe): once real payments are wired up, replace this immediate
  // MOCK_COMPLETED create with a Stripe Checkout Session create, persist
  // status "PENDING" + stripeSessionId here, and flip to "COMPLETED" from
  // a webhook handler instead of inline.
  return prisma.campaignPledge.create({
    data: {
      campaignId: input.campaignId,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      pledgeAmount: input.amountCents / 100,
      feeCents,
      totalCents,
      status: "MOCK_COMPLETED",
    },
  });
}
