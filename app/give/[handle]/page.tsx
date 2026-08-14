import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DonationWidget from "@/components/donations/DonationWidget";
import { canReceiveDonations } from "@/lib/donationEligibility";

export default async function PublicGivePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const profile = await prisma.profile.findUnique({
    where: { handle },
    select: {
      displayName: true,
      staffTitle: true,
      user: { select: { role: true, isAlumni: true } },
    },
  });

  if (!profile) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {canReceiveDonations(profile.user, profile) ? (
          <DonationWidget recipientHandle={handle} recipientName={profile.displayName} />
        ) : (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
            <p>This page isn&apos;t available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
