import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import { processCampaignDonation } from "@/lib/payments/processCampaignDonation";
import { MIN_DONATION_CENTS } from "@/lib/payments/donationFees";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { campaignId, donorName, donorEmail, amountCents, schoolId, coverFees } = body;

  if (!donorName?.trim() || !donorEmail?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  if (typeof campaignId !== "string" || !campaignId) {
    return NextResponse.json({ error: "Missing campaign." }, { status: 400 });
  }
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || amountCents < MIN_DONATION_CENTS) {
    return NextResponse.json({ error: `Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}.` }, { status: 400 });
  }

  const pledge = await processCampaignDonation({
    campaignId,
    donorName: donorName.trim(),
    donorEmail: donorEmail.trim(),
    amountCents,
    coverFees: Boolean(coverFees),
  });

  const from = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const amountText = `$${(amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalText = pledge.totalCents != null
    ? `$${(pledge.totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : amountText;

  try {
    await getResendClient().emails.send({
      from,
      to: donorEmail.trim(),
      subject: "Your donation has been recorded — thank you!",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
          <h2 style="color:#4a80f0;margin-bottom:8px">Thank you, ${escapeHtml(donorName)}!</h2>
          <p style="color:#58586a;line-height:1.6;margin:0 0 16px">
            This is a demo — you were not actually charged ${totalText}. Real payments launch soon.
          </p>
          <p style="color:#909098;font-size:13px;margin:0">
            — The Nivarro community
          </p>
        </div>
      `,
    });
  } catch {
    // Non-fatal — donation is already recorded
  }

  if (schoolId && typeof schoolId === "string") {
    try {
      const schoolProfile = await prisma.profile.findFirst({
        where: { userId: schoolId },
        select: { advancementEmail: true },
      });
      if (schoolProfile?.advancementEmail) {
        await getResendClient().emails.send({
          from,
          to: schoolProfile.advancementEmail,
          subject: `New Online Donation (Demo) — ${donorName}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
              <h2 style="color:#4a80f0;margin-bottom:8px">New Online Donation (Demo)</h2>
              <p style="color:#58586a;line-height:1.6;margin:0 0 12px">
                <strong>${escapeHtml(donorName)}</strong> donated <strong>${amountText}</strong> online.
                This is a mock transaction — no money moved. Real Stripe payments launch soon.
              </p>
              <p style="color:#909098;font-size:13px;margin:0">— Nivarro Platform</p>
            </div>
          `,
        });
      }
    } catch {
      // Non-fatal — donation is already recorded
    }
  }

  return NextResponse.json({ pledge: { id: pledge.id, totalCents: pledge.totalCents } });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
