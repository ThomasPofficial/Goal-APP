import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isWalledStudent } from "@/lib/accountGate";
import { prisma } from "@/lib/prisma";
import DonateClient from "./DonateClient";

export default async function DonatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!(await isWalledStudent(session.user.id))) redirect("/dashboard");

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
