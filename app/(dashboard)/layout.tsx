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

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true, geniusType: true },
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <SidebarShell
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
      />
      <main className="md:pl-[220px] min-h-screen pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
