"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInitials } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    profile: {
      displayName: string;
      headline: string | null;
      avatarUrl: string | null;
      strengthSummary: string | null;
    } | null;
  };
}

interface Props {
  project: {
    id: string;
    name: string;
    goal: string | null;
    description: string | null;
    status: string;
    members: Member[];
  };
  isOwner: boolean;
  currentUserId: string;
}

export default function ProjectDetail({
  project,
  isOwner,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { userId: string; displayName: string; headline: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const otherMembers = project.members.filter(
    (m) => m.userId !== currentUserId
  );

  async function markComplete() {
    if (!confirm("Mark this project as complete?")) return;
    setCompleting(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setCompleting(false);
    router.refresh();
  }

  async function searchPeople(q: string) {
    setAddMemberQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/people?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearching(false);
    // Filter out existing members
    const existingIds = new Set(project.members.map((m) => m.userId));
    setSearchResults(
      (data.profiles ?? []).filter(
        (p: { userId: string }) => !existingIds.has(p.userId)
      )
    );
  }

  async function addMember(userId: string) {
    await fetch(`/api/projects/${project.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setAddMemberQuery("");
    setSearchResults([]);
    router.refresh();
  }

  const isCompleted = project.status === "COMPLETED";

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#909098] hover:text-[#eaeaea] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Dashboard
      </Link>

      {/* Project header */}
      <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-[#eaeaea] truncate">
                {project.name}
              </h1>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  isCompleted
                    ? "bg-[#4ADE8020] text-[#4ADE80]"
                    : "bg-[#4a80f020] text-[#4a80f0]"
                }`}
              >
                {isCompleted ? "Completed" : "Active"}
              </span>
            </div>
            {project.goal && (
              <p className="text-sm text-[#909098]">
                <span className="text-[#58586a]">Goal: </span>
                {project.goal}
              </p>
            )}
            {project.description && (
              <p className="text-xs text-[#58586a] mt-2">{project.description}</p>
            )}
          </div>

          {isOwner && !isCompleted && (
            <button
              onClick={markComplete}
              disabled={completing}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4ADE80] border border-[#4ADE8030] hover:border-[#4ADE8060] hover:bg-[#4ADE8010] rounded-md px-3 py-2 transition-colors flex-shrink-0"
            >
              {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* Member cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#eaeaea] uppercase tracking-wider">
            Team Members ({otherMembers.length + 1})
          </h2>
          {isOwner && !isCompleted && (
            <div className="relative">
              <input
                value={addMemberQuery}
                onChange={(e) => searchPeople(e.target.value)}
                placeholder="Add member..."
                className="text-sm py-1.5 px-3 pr-8 w-48"
              />
              {searching && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#58586a] animate-spin" />
              )}
              {searchResults.length > 0 && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-[#131315] border border-[#1c1c20] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-20 py-1">
                  {searchResults.map((p) => (
                    <button
                      key={p.userId}
                      onClick={() => addMember(p.userId)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#1c1c20] transition-colors"
                    >
                      <div className="text-sm text-[#eaeaea]">{p.displayName}</div>
                      {p.headline && (
                        <div className="text-xs text-[#58586a] truncate">
                          {p.headline}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.members.map((member) => {
            const profile = member.user.profile;
            if (!profile) return null;

            return (
              <div
                key={member.id}
                className="bg-[#0d0d0e] border border-[#1c1c20] rounded-[10px] p-5 flex flex-col gap-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatarUrl}
                        alt={profile.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                        style={{ boxShadow: "0 0 0 1px rgba(74,128,240,0.19)" }}
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                          background: "rgba(74,128,240,0.13)",
                          color: "var(--accent)",
                          boxShadow: "0 0 0 1px rgba(74,128,240,0.19)",
                        }}
                      >
                        {getInitials(profile.displayName)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[#eaeaea] text-sm truncate">
                      {profile.displayName}
                    </h3>
                    {profile.headline && (
                      <p className="text-xs text-[#909098] truncate mt-0.5">
                        {profile.headline}
                      </p>
                    )}
                  </div>
                </div>

                {profile.strengthSummary && (
                  <p className="text-xs text-[#909098] leading-relaxed line-clamp-3 border-t border-[#1c1c20] pt-3">
                    {profile.strengthSummary}
                  </p>
                )}

                <Link
                  href={`/people/${member.userId}`}
                  className="text-center text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md py-1.5 transition-colors mt-auto"
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
