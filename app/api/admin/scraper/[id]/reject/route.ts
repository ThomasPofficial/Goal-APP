import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const updated = await prisma.scrapedListing.update({
    where: { id },
    data: { status: "REJECTED", reviewedBy: session.user.email, reviewedAt: new Date() },
  });
  return NextResponse.json(updated);
}
