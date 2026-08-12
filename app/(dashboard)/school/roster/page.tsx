import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RosterClient from "./RosterClient";
import { getSchoolRosterMembers } from "@/lib/school-roster";

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (dbUser?.role !== "SCHOOL") redirect("/dashboard");

  const members = await getSchoolRosterMembers(session.user.id);

  return <RosterClient members={members} />;
}
