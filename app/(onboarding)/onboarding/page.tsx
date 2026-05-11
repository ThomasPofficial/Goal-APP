import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingClient from "./OnboardingClient";
import type { GeniusTypeKey } from "@/lib/geniusTypes";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { geniusType: true, onboardingComplete: true },
  });

  if (profile?.onboardingComplete) redirect("/dashboard");
  if (!profile?.geniusType) redirect("/quiz");

  return <OnboardingClient geniusType={profile.geniusType as GeniusTypeKey} />;
}
