import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import UnsaveButton from "./UnsaveButton";

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const savedOrgs = profile
    ? await prisma.savedOrg.findMany({
        where: { profileId: profile.id },
        include: {
          org: {
            select: {
              id: true,
              name: true,
              tagline: true,
              projects: {
                where: { listingStatus: "OPEN" },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>Saved</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {savedOrgs.length} saved org{savedOrgs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {savedOrgs.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--muted)" }}>
          <p className="text-sm">No saved orgs yet.</p>
          <Link href="/orgs" className="text-sm mt-2 inline-block" style={{ color: "var(--blue)" }}>
            Browse orgs →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {savedOrgs.map(({ org }) => (
            <div
              key={org.id}
              className="flex items-center justify-between p-4 border"
              style={{ background: "var(--surface)", borderColor: "var(--border-md)" }}
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/orgs/${org.id}`}
                  className="font-medium text-sm hover:underline"
                  style={{ color: "var(--text)" }}
                >
                  {org.name}
                </Link>
                {org.tagline && (
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text2)" }}>{org.tagline}</p>
                )}
                <p className="text-xs font-mono mt-1" style={{ color: "var(--muted)" }}>
                  {org.projects.length} open listing{org.projects.length !== 1 ? "s" : ""}
                </p>
              </div>
              <UnsaveButton orgId={org.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
