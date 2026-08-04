import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrgCategoriesClient from "./OrgCategoriesClient";

export const dynamic = "force-dynamic";

export default async function OrgCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Read role from DB — never from the session JWT, which can be stale
  // relative to the current DB role (see app/(dashboard)/layout.tsx).
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "ADMIN") redirect("/dashboard");

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
