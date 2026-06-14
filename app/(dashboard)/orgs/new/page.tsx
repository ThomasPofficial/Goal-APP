import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OrgNewClient from "./OrgNewClient";

export default async function OrgNewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (profile) redirect("/dashboard");

  return <OrgNewClient />;
}
