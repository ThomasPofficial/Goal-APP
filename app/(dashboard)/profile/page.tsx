import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileEditor from "./ProfileEditor";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id;

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
      initialProfile={
        profile
          ? {
              displayName: profile.displayName,
              headline: profile.headline ?? "",
              bio: profile.bio ?? "",
              strengthSummary: profile.strengthSummary ?? "",
              traitIds: profile.traitLinks.map((l) => l.traitId),
            }
          : null
      }
      allTraits={allTraits}
    />
  );
}
