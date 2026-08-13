import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import RosterClient from "./RosterClient";
import { getSchoolRosterMembers } from "@/lib/school-roster";

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("roster:view");
  if ("error" in check) redirect("/dashboard");

  const members = await getSchoolRosterMembers(check.schoolId);

  return <RosterClient members={members} />;
}
