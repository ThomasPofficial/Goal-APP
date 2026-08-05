import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DonationWidget from "@/components/donations/DonationWidget";

export default async function PublicGivePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const profile = await prisma.profile.findUnique({
    where: { handle },
    select: { displayName: true },
  });

  if (!profile) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <DonationWidget recipientHandle={handle} recipientName={profile.displayName} />
      </div>
    </div>
  );
}
