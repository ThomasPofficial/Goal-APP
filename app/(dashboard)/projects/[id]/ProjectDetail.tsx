"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SkillCard from "@/components/profile/SkillCard";
import type { TraitCategory } from "@/data/traits";
import { GENIUS_TYPE_INFO } from "@/data/traits";
import {
  ArrowLeft,
  Check,
  UserPlus,
  CheckCircle2,
  Loader2,
  X,
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
      geniusType: string | null;
      traitLinks: { trait: { name: string; category: string } }[];
    } | null;
  };
}

interface Trait {
  id: string;
  slug: string;
  name: string;
  category: string;
}

interface PeerTrait {
  traitId: string;
  name: string;
  category: string;
  count: number;
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
  peerTraitsByUser: Record<string, PeerTrait[]>;
  pendingEndorsees: string[];
  allTraits: Trait[];
}

export default function ProjectDetail({
  project,
  isOwner,
  currentUserId,
  peerTraitsByUser,
  pendingEndorsees,
  allTraits,
}: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [endorseFor, setEndorseFor] = useState<string | null>(null);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { userId: string; displayName: string; headline: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const otherMembers = project.members.filter(
    (m) => m.userId !== currentUserId
  );

  async function markComplete() {
    if (!confirm("Mark this project as complete? This will trigger the peer endorsement flow.")) return;
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

  function toggleTrait(traitId: string) {
    setSelectedTraits((prev) =>
      prev.includes(traitId)
        ? prev.filter((id) => id !== traitId)
        : prev.length < 5
        ? [...prev, traitId]
        : prev
    );
  }

  async function submitEndorsement() {
    if (!endorseFor || selectedTraits.length === 0) return;
    setSubmitting(true);
    await fetch("/api/endorsements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        endorseeId: endorseFor,
        traitIds: selectedTraits,
      }),
    });
    setSubmitting(false);
    setEndorseFor(null);
    setSelectedTraits([]);
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
                    : "bg-[#c9a84c20] text-[#c9a84c]"
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

      {/* Endorsement prompt (completed projects only) */}
      {isCompleted && pendingEndorsees.length > 0 && (
        <div className="bg-[#4ADE8010] border border-[#4ADE8030] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#4ADE80] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-[#eaeaea] mb-1">
                Project complete — endorse your teammates
              </div>
              <p className="text-xs text-[#909098]">
                Select up to 5 traits that each teammate genuinely displayed during
                this project. Your endorsements appear on their Skill Cards.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Member Skill Cards */}
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
            const peerTraits = (peerTraitsByUser[member.userId] ?? [])
              .sort((a, b) => b.count - a.count)
              .map((t) => ({
                name: t.name,
                category: t.category as TraitCategory,
                endorseCount: t.count,
              }));

            const isPending =
              isCompleted &&
              member.userId !== currentUserId &&
              pendingEndorsees.includes(member.userId);

            return (
              <div key={member.id} className="relative">
                <SkillCard
                  data={{
                    userId: member.userId,
                    displayName: profile.displayName,
                    headline: profile.headline,
                    avatarUrl: profile.avatarUrl,
                    strengthSummary: profile.strengthSummary,
                    geniusType: profile.geniusType as never,
                    selfTraits: profile.traitLinks.map((l) => ({
                      name: l.trait.name,
                      category: l.trait.category as TraitCategory,
                    })),
                    peerTraits,
                  }}
                />
                {isPending && (
                  <button
                    onClick={() => {
                      setEndorseFor(member.userId);
                      setSelectedTraits([]);
                    }}
                    className="absolute bottom-3 right-3 flex items-center gap-1 text-xs font-medium text-[#4ADE80] border border-[#4ADE8030] hover:border-[#4ADE8060] bg-[#4ADE8010] rounded-md px-2 py-1.5 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Endorse
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Endorsement modal */}
      {endorseFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-6 w-full max-w-lg shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#eaeaea]">
                Endorse traits
              </h2>
              <button onClick={() => setEndorseFor(null)}>
                <X className="w-5 h-5 text-[#58586a] hover:text-[#909098]" />
              </button>
            </div>
            <p className="text-sm text-[#909098] mb-5">
              Select up to 5 traits that this person genuinely displayed during the
              project. Be honest — these will appear on their permanent Skill Card.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-6 max-h-60 overflow-y-auto pr-1">
              {allTraits.map((trait) => {
                const isSel = selectedTraits.includes(trait.id);
                const isDisabled = !isSel && selectedTraits.length >= 5;
                return (
                  <button
                    key={trait.id}
                    disabled={isDisabled}
                    onClick={() => toggleTrait(trait.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border-l-2 transition-all ${
                      isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                    } ${isSel ? "opacity-100" : "opacity-70"}`}
                    style={{
                      borderLeftColor: "#909098",
                      backgroundColor: isSel ? "#90909825" : "#9090980C",
                      color: isSel ? "#eaeaea" : "#909098",
                    }}
                  >
                    {isSel && <Check className="w-3 h-3" />}
                    {trait.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#58586a]">
                {selectedTraits.length}/5 selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEndorseFor(null)}
                  className="text-sm text-[#909098] hover:text-[#eaeaea] px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEndorsement}
                  disabled={selectedTraits.length === 0 || submitting}
                  className="flex items-center gap-2 bg-[#4ADE80] hover:bg-[#22C55E] text-[#080809] font-semibold text-sm rounded-md px-4 py-2 transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit endorsement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
