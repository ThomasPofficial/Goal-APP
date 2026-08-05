import { prisma } from "@/lib/prisma";
import { processDonation } from "@/lib/payments/processDonation";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  recipientHandle: z.string().min(1),
  amountCents: z.number().int().positive(),
  donorName: z.string().max(120).optional(),
  donorEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const profile = await prisma.profile.findUnique({
    where: { handle: parsed.data.recipientHandle },
    select: { userId: true },
  });
  if (!profile) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  try {
    const donation = await processDonation({
      recipientUserId: profile.userId,
      amountCents: parsed.data.amountCents,
      donorName: parsed.data.donorName,
      donorEmail: parsed.data.donorEmail,
    });
    return NextResponse.json(
      { donation: { id: donation.id, amountCents: donation.amountCents, feeCents: donation.feeCents, totalCents: donation.totalCents, status: donation.status } },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
