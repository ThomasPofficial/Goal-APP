export const MIN_DONATION_CENTS = 100;
export const FEE_PERCENT = 0.05;
export const FEE_FIXED_CENTS = 30;

export function calculateDonationFee(amountCents: number): { feeCents: number; totalCents: number } {
  const feeCents = Math.round(amountCents * FEE_PERCENT) + FEE_FIXED_CENTS;
  return { feeCents, totalCents: amountCents + feeCents };
}
