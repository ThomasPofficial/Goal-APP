import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SurveyClient from "./SurveyClient";

export default async function SurveyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "STUDENT") redirect("/dashboard");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      brochureData: {
        select: { college: true, jobTitle: true, employer: true, internshipTitle: true, internshipOrg: true },
      },
    },
  });

  return (
    <SurveyClient
      initial={{
        college:         profile?.brochureData?.college ?? "",
        jobTitle:        profile?.brochureData?.jobTitle ?? "",
        employer:        profile?.brochureData?.employer ?? "",
        internshipTitle: profile?.brochureData?.internshipTitle ?? "",
        internshipOrg:   profile?.brochureData?.internshipOrg ?? "",
      }}
    />
  );
}
