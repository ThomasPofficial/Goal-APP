import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RosterClient from "./RosterClient";

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const memberProfiles = await prisma.profile.findMany({
    where: { schoolId: session.user.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          createdAt: true,
          emailVerified: true,
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const members = memberProfiles.map((p) => ({
    profileId: p.id,
    userId: p.userId,
    displayName: p.displayName,
    email: p.user.email ?? null,
    phone: p.phone ?? null,
    role: p.user.role,
    isAlumni: p.user.isAlumni,
    staffTitle: p.staffTitle ?? null,
    graduationYear: p.graduationYear ?? null,
    industry: p.industry ?? null,
    intendedCollege: p.intendedCollege ?? null,
    intendedMajor: p.intendedMajor ?? null,
    isAvailableToMentor: p.isAvailableToMentor,
    createdAt: p.user.createdAt.toISOString(),
    emailVerified: p.user.emailVerified ? p.user.emailVerified.toISOString() : null,
  }));

  return <RosterClient members={members} />;
}
