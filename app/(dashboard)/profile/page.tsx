import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileEditor from "./ProfileEditor";
import AlumniProfileEditor from "./AlumniProfileEditor";
import { isWalledStudent } from "@/lib/accountGate";
import { getLinkedSchools } from "@/lib/communities";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id;

  const [dbUser, walled] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isAlumni: true },
    }),
    isWalledStudent(userId),
  ]);

  if (walled && dbUser?.isAlumni) {
    const [alumniProfile, schools] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: {
          linkedinUrl: true,
          employer: true,
          jobTitle: true,
          confirmedCollege: true,
          confirmedMajor: true,
          isAvailableToMentor: true,
        },
      }),
      getLinkedSchools(userId),
    ]);

    return (
      <AlumniProfileEditor
        initialProfile={{
          linkedinUrl: alumniProfile?.linkedinUrl ?? "",
          employer: alumniProfile?.employer ?? "",
          jobTitle: alumniProfile?.jobTitle ?? "",
          confirmedCollege: alumniProfile?.confirmedCollege ?? "",
          confirmedMajor: alumniProfile?.confirmedMajor ?? "",
          isAvailableToMentor: alumniProfile?.isAvailableToMentor ?? false,
        }}
        initialSchools={schools}
      />
    );
  }

  const [profile, allTraits] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      include: {
        traitLinks: {
          orderBy: { order: "asc" },
          include: { trait: true },
        },
      },
    }),
    prisma.trait.findMany({ orderBy: { category: "asc" } }),
  ]);

  return (
    <ProfileEditor
      userId={userId}
      locked={walled}
      initialProfile={
        profile
          ? {
              displayName: profile.displayName,
              headline: profile.headline ?? "",
              bio: profile.bio ?? "",
              strengthSummary: profile.strengthSummary ?? "",
              traitIds: profile.traitLinks.map((l) => l.traitId),
              dateOfBirth: profile.dateOfBirth
                ? profile.dateOfBirth.toISOString().split("T")[0]
                : "",
            }
          : null
      }
      allTraits={allTraits}
    />
  );
}
