import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { causeText, donorName, donorEmail, donorPhone, pledgeAmount, campaignId } = body;

  if (!donorName?.trim() || !donorEmail?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const pledge = await prisma.campaignPledge.create({
    data: {
      causeText: causeText ?? null,
      donorName: donorName.trim(),
      donorEmail: donorEmail.trim(),
      donorPhone: donorPhone?.trim() ?? null,
      pledgeAmount: pledgeAmount ? pledgeAmount : null,
      campaignId: typeof campaignId === "string" ? campaignId : null,
    },
  });

  const from = process.env.FROM_EMAIL ?? "noreply@nivarro.co";
  const amountText = pledgeAmount ? `$${Number(pledgeAmount).toLocaleString()}` : "an amount";

  try {
    await getResendClient().emails.send({
      from,
      to: donorEmail.trim(),
      subject: "Your pledge has been recorded — thank you!",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1f">
          <h2 style="color:#4a80f0;margin-bottom:8px">Thank you, ${escapeHtml(donorName)}!</h2>
          <p style="color:#58586a;line-height:1.6;margin:0 0 16px">
            We've recorded your pledge of <strong>${amountText}</strong>.
            ${causeText ? `<br/><br/>Your support for: <em>"${escapeHtml(causeText)}"</em> means the world to us.` : ""}
          </p>
          <p style="color:#909098;font-size:13px;margin:0">
            — The Nivarro community
          </p>
        </div>
      `,
    });
  } catch {
    // Non-fatal — pledge is already recorded
  }

  return NextResponse.json({ id: pledge.id });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
