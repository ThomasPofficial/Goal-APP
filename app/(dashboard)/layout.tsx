import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SidebarShell from "@/components/layout/SidebarShell";
import type { GeniusType } from "@/data/traits";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = session.user.role ?? "STUDENT";
  const isOrg = role === "ORG" || role === "ADMIN";
  const isNivarroAdmin = role === "ADMIN";

  const [profile, myOrg] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { displayName: true, geniusType: true },
    }),
    isOrg
      ? isNivarroAdmin
        // ADMIN: look up the platform org by structural identity — works for any
        // admin email (team.nivarro@gmail.com, team@nivarro.dev, etc.)
        ? prisma.org.findFirst({
            where: { isPaid: true, verified: true, category: "FELLOWSHIP" },
            select: { id: true, name: true },
          })
        : prisma.org.findFirst({
            where: { createdById: session.user.id },
            select: { id: true, name: true },
          })
      : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
        myOrgId={myOrg?.id ?? null}
        myOrgName={myOrg?.name ?? null}
        isOrg={isOrg}
        isNivarroAdmin={isNivarroAdmin}
      />
      <main className="dashboard-main min-h-screen pt-14 pb-[60px] md:pt-0 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
