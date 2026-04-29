import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SmartSearch from "../people/SmartSearch";

export default async function PeersPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const allTraits = await prisma.trait.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return <SmartSearch allTraits={allTraits} />;
}
