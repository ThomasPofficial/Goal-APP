import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import CampaignsNewClient from "./CampaignsNewClient";

export default async function CampaignsNewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("campaigns:edit");
  if ("error" in check) redirect("/dashboard");

  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
    select: { schoolId: true },
  });

  return <CampaignsNewClient schoolId={profile?.schoolId ?? undefined} />;
}
