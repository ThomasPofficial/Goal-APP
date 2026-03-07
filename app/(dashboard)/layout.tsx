import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import type { GeniusType } from "@/data/traits";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Fetch genius type so the sidebar account menu can show it
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true, geniusType: true },
  });

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      <Sidebar
        userName={profile?.displayName ?? session.user.name}
        userEmail={session.user.email}
        geniusType={(profile?.geniusType as GeniusType | null) ?? null}
      />
      <main className="pl-[240px] min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
