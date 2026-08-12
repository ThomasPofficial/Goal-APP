import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { isWalledStudent } from "@/lib/accountGate";

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await isWalledStudent(session.user.id)) redirect("/dashboard");

  const myProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!myProfile) redirect("/onboarding");

  const memberships = await prisma.teamMember.findMany({
    where: { profileId: myProfile.id },
    include: {
      team: {
        include: {
          org: { select: { id: true, name: true } },
          members: {
            include: {
              profile: { select: { id: true, displayName: true, avatarUrl: true, geniusType: true } },
            },
            take: 5,
          },
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const seen = new Set<string>();
  const teams = memberships.map((m) => m.team).filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>My Teams</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          {teams.length} team{teams.length !== 1 ? "s" : ""}
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🏠</p>
          <p className="text-lg" style={{ color: "var(--text2)" }}>You&apos;re not on any teams yet.</p>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            Join an org and apply with a team to get started.
          </p>
          <Link href="/orgs" className="btn-primary mt-6 inline-block px-5 py-2.5 text-sm">
            Browse Orgs
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className={cn("block rounded-xl p-5 transition-all card", team.status === "ACCEPTED" && "team-accepted")}
              style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold truncate" style={{ color: "var(--text)" }}>{team.name}</h2>
                    <StatusBadge status={team.status} />
                  </div>
                  {team.org && (
                    <p className="text-xs mb-2" style={{ color: "var(--text2)" }}>
                      via {team.org.name}
                    </p>
                  )}
                  {team.description && (
                    <p className="text-sm line-clamp-2" style={{ color: "var(--text2)" }}>{team.description}</p>
                  )}
                </div>
                <div className="flex -space-x-2 shrink-0">
                  {team.members.slice(0, 4).map((m) => (
                    <Avatar
                      key={m.id}
                      src={m.profile?.avatarUrl}
                      displayName={m.profile?.displayName}
                      size={32}
                    />
                  ))}
                  {team._count.members > 4 && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: "var(--surface3)", color: "var(--text2)" }}>
                      +{team._count.members - 4}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    SUBMITTED: { label: "Applied", className: "bg-blue-900/30 text-blue-300" },
    ACTIVE:    { label: "Active",   className: "bg-emerald-900/30 text-emerald-300" },
    ACCEPTED:  { label: "ACCEPTED", className: "font-mono uppercase tracking-widest text-emerald-400 bg-emerald-900/20" },
    COMPLETED: { label: "Completed", className: "bg-purple-900/30 text-purple-300" },
    REJECTED:  { label: "Rejected", className: "bg-red-900/30 text-red-300" },
  };
  const s = map[status] ?? { label: status, className: "bg-[#1e1e24] text-[#9898a8]" };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.className}`}>{s.label}</span>
  );
}
