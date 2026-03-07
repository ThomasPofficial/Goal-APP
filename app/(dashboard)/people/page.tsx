import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PeopleSearch from "./PeopleSearch";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trait?: string; category?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const params = await searchParams;
  const query = params.q ?? "";
  const traitSlug = params.trait ?? "";
  const category = params.category ?? "";

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { not: userId },
      AND: [
        query
          ? {
              OR: [
                { displayName: { contains: query } },
                { headline: { contains: query } },
                { bio: { contains: query } },
                { strengthSummary: { contains: query } },
              ],
            }
          : {},
        traitSlug
          ? {
              traitLinks: {
                some: {
                  trait: { slug: traitSlug },
                },
              },
            }
          : {},
        category
          ? {
              traitLinks: {
                some: {
                  trait: { category: category as never },
                },
              },
            }
          : {},
      ],
    },
    include: {
      traitLinks: {
        orderBy: { order: "asc" },
        include: { trait: true },
      },
      user: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const allTraits = await prisma.trait.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const formattedProfiles = profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    headline: p.headline,
    avatarUrl: p.avatarUrl,
    strengthSummary: p.strengthSummary,
    traits: p.traitLinks.map((l) => ({
      name: l.trait.name,
      category: l.trait.category,
    })),
  }));

  return (
    <PeopleSearch
      initialProfiles={formattedProfiles}
      allTraits={allTraits}
      initialQuery={query}
      currentUserId={userId}
    />
  );
}
