import { FEE_PERCENT, FEE_FIXED_CENTS, MIN_DONATION_CENTS } from "./donationFees";

export { MIN_DONATION_CENTS };

export function calculateCampaignDonationFee(amountCents: number, coverFees: boolean) {
  const feeCents = Math.round(amountCents * FEE_PERCENT) + FEE_FIXED_CENTS;
  if (coverFees) {
    // Donor pays extra on top; the campaign receives the full entered amount.
    return { feeCents, totalCents: amountCents + feeCents, netCents: amountCents };
  }
  // Fee comes out of the entered amount; the campaign receives the remainder.
  return { feeCents, totalCents: amountCents, netCents: amountCents - feeCents };
}
