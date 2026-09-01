import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireSchoolCapability } from "@/lib/school-auth";
import type { Capability } from "@/lib/facultyPermissions";
import { getOrCreateDefaultTiers } from "@/lib/facultyPermissions.server";
import PermissionsClient from "./PermissionsClient";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const check = await requireSchoolCapability("staff:manage");
  if ("error" in check) redirect("/dashboard");

  const isOwnerOrCoreAdmin = check.isOwner || check.isCoreAdmin;

  const tiers = await getOrCreateDefaultTiers(check.schoolId);

  return (
    <PermissionsClient
      currentUserId={session.user.id}
      isOwnerOrCoreAdmin={isOwnerOrCoreAdmin}
      initialGroups={tiers.map((t) => ({
        id: t.id,
        name: t.name,
        permissions: JSON.parse(t.permissions) as Capability[],
        isSystemDefault: t.isSystemDefault,
      }))}
    />
  );
}
