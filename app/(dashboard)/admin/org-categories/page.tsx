import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrgCategoriesClient from "./OrgCategoriesClient";

export default async function OrgCategoriesPage() {
  const session = await auth();
  if (session?.user?.email !== "team@nivarro.co") redirect("/dashboard");

  const orgs = await prisma.org.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      orgType: true,
      verified: true,
      createdAt: true,
      _count: { select: { projects: true, teams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <OrgCategoriesClient orgs={orgs} />;
}
