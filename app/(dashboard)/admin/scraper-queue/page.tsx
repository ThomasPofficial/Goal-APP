import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ScraperQueueClient from "./ScraperQueueClient";

export default async function ScraperQueuePage() {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") redirect("/dashboard");

  const listings = await prisma.scrapedListing.findMany({
    orderBy: [{ status: "asc" }, { scrapedAt: "desc" }],
  });

  return (
    <ScraperQueueClient
      listings={listings.map((l) => ({
        ...l,
        scrapedAt: l.scrapedAt.toISOString(),
        reviewedAt: l.reviewedAt?.toISOString() ?? null,
      }))}
    />
  );
}
