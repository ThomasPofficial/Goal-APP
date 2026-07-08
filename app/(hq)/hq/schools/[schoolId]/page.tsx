import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import SchoolDetailClient from "./SchoolDetailClient";

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

  const { schoolId } = await params;

  // Fetch school
  const schoolUser = await prisma.user.findUnique({
    where: { id: schoolId, role: "SCHOOL" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: {
        select: {
          displayName: true,
          headline: true,
          advancementEmail: true,
        },
      },
    },
  });

  if (!schoolUser) {
    return (
      <div>
        <p
          style={{
            color: "var(--muted)",
            fontSize: 15,
            marginBottom: 16,
          }}
        >
          School not found.
        </p>
        <Link
          href="/hq"
          style={{
            color: "var(--amber)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          &larr; Back to Schools
        </Link>
      </div>
    );
  }

  // Fetch all members linked to this school
  const memberProfiles = await prisma.profile.findMany({
    where: { schoolId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAlumni: true,
          createdAt: true,
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
    role: p.user.role as "STUDENT" | "ORG" | "ADMIN" | "SCHOOL",
    isAlumni: p.user.isAlumni,
    staffTitle: p.staffTitle ?? null,
    graduationYear: p.graduationYear ?? null,
    industry: p.industry ?? null,
    intendedCollege: p.intendedCollege ?? null,
    intendedMajor: p.intendedMajor ?? null,
    isAvailableToMentor: p.isAvailableToMentor,
    createdAt: p.user.createdAt.toISOString(),
  }));

  const school = {
    id: schoolUser.id,
    email: schoolUser.email ?? null,
    createdAt: schoolUser.createdAt.toISOString(),
    profile: schoolUser.profile,
  };

  return <SchoolDetailClient school={school} members={members} />;
}
