import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DonateClient from "./DonateClient";

export default async function DonatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Every individual account (student, alumni, teacher/staff — all role
  // STUDENT under the hood) can have a donation link. Org/school logins
  // don't have personal profiles and use /campaigns for fundraising instead.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "STUDENT") redirect("/dashboard");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { handle: true, displayName: true },
  });

  if (!profile?.handle) {
    return (
      <div style={{ maxWidth: 500, padding: 32, border: "1px solid var(--border)", background: "var(--surface)" }}>
        <p style={{ color: "var(--text)", fontSize: 14, margin: 0 }}>
          Set a profile handle first (Profile → Edit) to get your donation link.
        </p>
      </div>
    );
  }

  return <DonateClient handle={profile.handle} displayName={profile.displayName} />;
}
