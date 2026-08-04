import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ScraperQueueClient from "./ScraperQueueClient";

export const dynamic = "force-dynamic";

export default async function ScraperQueuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Read role from DB — never from the session JWT, which can be stale
  // relative to the current DB role (see app/(dashboard)/layout.tsx).
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

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
