import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AlumniGate from "./AlumniGate";
import AlumniDirectory from "./AlumniDirectory";

export default async function AlumniPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAlumni: true, role: true },
  });

  const isSchoolOrAdmin = dbUser?.role === "SCHOOL" || dbUser?.role === "ADMIN";
  const isAlumni = dbUser?.isAlumni || isSchoolOrAdmin;

  if (!isAlumni) {
    return <AlumniGate />;
  }

  const [alumniRaw, currentProfile] = await Promise.all([
    prisma.user.findMany({
      where: { isAlumni: true },
      select: {
        id: true,
        name: true,
        profile: {
          select: {
            displayName: true,
            handle: true,
            headline: true,
            industry: true,
            graduationYear: true,
            intendedCollege: true,
            isAvailableToMentor: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { isAvailableToMentor: true },
    }),
  ]);

  return (
    <AlumniDirectory
      alumni={alumniRaw}
      currentUserId={session.user.id}
      currentUserIsMentor={currentProfile?.isAvailableToMentor ?? false}
      currentUserIsAlumni={!!dbUser?.isAlumni}
    />
  );
}
