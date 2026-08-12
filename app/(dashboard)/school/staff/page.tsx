import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import { getOrCreateDefaultTiers, type Capability } from "@/lib/facultyPermissions";
import StaffClient from "./StaffClient";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) redirect("/dashboard");

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const isSchool = dbUser?.role === "SCHOOL";

  const tiers = await getOrCreateDefaultTiers(check.schoolId);

  return (
    <StaffClient
      isSchool={isSchool}
      initialTiers={tiers.map((t) => ({
        id: t.id,
        name: t.name,
        permissions: JSON.parse(t.permissions) as Capability[],
        isSystemDefault: t.isSystemDefault,
      }))}
    />
  );
}
