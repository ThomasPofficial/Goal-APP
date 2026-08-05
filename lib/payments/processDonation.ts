import { prisma } from "@/lib/prisma";
import { calculateDonationFee, MIN_DONATION_CENTS } from "./donationFees";

export async function processDonation(input: {
  recipientUserId: string;
  amountCents: number;
  donorName?: string;
  donorEmail?: string;
}) {
  if (input.amountCents < MIN_DONATION_CENTS) {
    throw new Error(`Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}`);
  }
  const { feeCents, totalCents } = calculateDonationFee(input.amountCents);

  // TODO(stripe): once real payments are wired up, replace this immediate
  // MOCK_COMPLETED create with a Stripe Checkout Session create, persist
  // status "PENDING" + stripeSessionId here, and flip to "COMPLETED" from
  // a webhook handler instead of inline.
  return prisma.donation.create({
    data: {
      recipientUserId: input.recipientUserId,
      donorName: input.donorName,
      donorEmail: input.donorEmail,
      amountCents: input.amountCents,
      feeCents,
      totalCents,
      status: "MOCK_COMPLETED",
    },
  });
}
