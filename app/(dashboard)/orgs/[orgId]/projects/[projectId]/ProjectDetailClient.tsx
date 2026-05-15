"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, ArrowLeft, UserPlus, CheckCircle2, Clock } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

const GENIUS_KEYS: GeniusTypeKey[] = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"];

interface Scholar {
  id: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  handle: string | null;
  traitLinks: { trait: { slug: string; name: string } }[];
}

interface ProjectDetailClientProps {
  project: {
    id: string;
    orgId: string;
    title: string;
    description: string | null;
    openSpots: number;
    requiredSkills: string;
    deadline: string | null;
    status: string;
    createdAt: string;
    org: { id: string; name: string; accentColor: string | null };
  };
  myProfileId: string | null;
  myTeams: { id: string; name: string }[];
  existingApplication: { id: string; status: string; teamId: string } | null;
}

export default function ProjectDetailClient({
  project, myProfileId, myTeams, existingApplication,
}: ProjectDetailClientProps) {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [q, setQ] = useState("");
  const [geniusFilter, setGeniusFilter] = useState<GeniusTypeKey | "">("");
  const [loading, setLoading] = useState(false);
  const [recruitingId, setRecruitingId] = useState<string | null>(null);
  const [recruitMsg, setRecruitMsg] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(myTeams[0]?.id ?? "");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const [applyTeamId, setApplyTeamId] = useState(myTeams[0]?.id ?? "");
  const [applyMsg, setApplyMsg] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ id: string; status: string; teamId: string } | null>(existingApplication);

  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");
  const accentColor = project.org.accentColor ?? "#4a80f0";

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (geniusFilter) params.set("geniusType", geniusFilter);
    const res = await fetch(`/api/org-projects/${project.id}/scholars?${params}`);
    const data = await res.json();
    setScholars(data.scholars ?? []);
    setLoading(false);
  }, [q, geniusFilter, project.id]);

  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [search]);

  const sendRecruit = async (toProfileId: string) => {
    if (!selectedTeamId || !myProfileId) return;
    await fetch(`/api/org-projects/${project.id}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toProfileId, teamId: selectedTeamId, message: recruitMsg }),
    });
    setSentTo((prev) => new Set(prev).add(toProfileId));
    setRecruitingId(null);
    setRecruitMsg("");
  };

  const handleApply = async () => {
    if (!applyTeamId) return;
    setApplying(true);
    const res = await fetch(`/api/org-projects/${project.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: applyTeamId, whyJoin: applyMsg }),
    });
    const data = await res.json();
    setApplying(false);
    if (data.application) {
      setApplied({ id: data.application.id, status: data.application.status, teamId: applyTeamId });
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#8A8898]">
        <Link href={`/orgs/${project.orgId}`} className="flex items-center gap-1 hover:text-[#4a80f0] transition-colors">
          <ArrowLeft className="w-4 h-4" /> {project.org.name}
        </Link>
        <span>/</span>
        <span className="text-[#EAE8E0]">{project.title}</span>
      </div>

      {/* Header */}
      <div className="bg-[#0D1525] border border-[rgba(74,128,240,0.12)] rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#EAE8E0] mb-1">{project.title}</h1>
            {project.description && (
              <p className="text-sm text-[#8A8898] leading-relaxed">{project.description}</p>
            )}
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {requiredSkills.map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-[rgba(74,128,240,0.28)] text-[#4a80f0]">{s}</span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold" style={{ color: accentColor }}>{project.openSpots}</p>
            <p className="text-xs text-[#5A5570]">open spots</p>
            {project.deadline && (
              <p className="text-xs text-[#8A8898] mt-1">
                Deadline: {format(new Date(project.deadline), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scholar Search */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-[#EAE8E0] uppercase tracking-wider">Scholar Pool</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[160px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5570]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search scholars…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0D1525] border border-[rgba(74,128,240,0.12)] text-sm text-[#EAE8E0] placeholder-[#5A5570] focus:outline-none focus:border-[rgba(74,128,240,0.28)]"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {GENIUS_KEYS.map((g) => {
                const info = GENIUS_TYPES[g];
                return (
                  <button
                    key={g}
                    onClick={() => setGeniusFilter((prev) => (prev === g ? "" : g))}
                    style={geniusFilter === g ? { borderColor: info.color, color: info.color } : undefined}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      geniusFilter === g
                        ? "bg-white/5"
                        : "border-[rgba(74,128,240,0.12)] text-[#8A8898] hover:border-[rgba(74,128,240,0.28)]"
                    )}
                  >
                    {g[0] + g.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-sm text-[#5A5570]">Searching…</div>
            ) : scholars.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#5A5570]">No scholars found</div>
            ) : (
              scholars.map((scholar) => (
                <div key={scholar.id} className="bg-[#0D1525] border border-[rgba(74,128,240,0.12)] rounded-xl p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <Avatar src={scholar.avatarUrl} name={scholar.displayName} geniusType={scholar.geniusType} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/profile/${scholar.handle ?? scholar.id}`}
                        className="font-medium text-sm text-[#EAE8E0] hover:text-[#4a80f0] transition-colors"
                      >
                        {scholar.displayName}
                      </Link>
                      {scholar.geniusType && <GeniusTypeBadge type={scholar.geniusType} size="sm" />}
                    </div>
                    {scholar.headline && (
                      <p className="text-xs text-[#8A8898] truncate">{scholar.headline}</p>
                    )}
                    {scholar.traitLinks.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {scholar.traitLinks.map((tl) => (
                          <span key={tl.trait.slug} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#111C32] text-[#8A8898]">
                            {tl.trait.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {sentTo.has(scholar.id) ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                      </span>
                    ) : recruitingId === scholar.id ? (
                      <div className="space-y-1 w-48">
                        <textarea
                          value={recruitMsg}
                          onChange={(e) => setRecruitMsg(e.target.value)}
                          placeholder="Optional message…"
                          rows={2}
                          className="w-full text-xs resize-none rounded-lg border border-[rgba(74,128,240,0.28)] bg-[#111C32] text-[#EAE8E0] placeholder-[#5A5570] px-2 py-1.5 focus:outline-none"
                        />
                        {myTeams.length > 1 && (
                          <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full text-xs rounded-lg border border-[rgba(74,128,240,0.12)] bg-[#111C32] text-[#EAE8E0] px-2 py-1.5 focus:outline-none"
                          >
                            {myTeams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-1">
                          <button
                            onClick={() => setRecruitingId(null)}
                            className="flex-1 text-xs py-1 rounded-lg border border-[rgba(74,128,240,0.12)] text-[#8A8898]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => sendRecruit(scholar.id)}
                            className="flex-1 text-xs py-1 rounded-lg bg-[#4a80f0] text-[#05080F] font-semibold"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    ) : myProfileId && scholar.id !== myProfileId ? (
                      <button
                        onClick={() => setRecruitingId(scholar.id)}
                        className="flex items-center gap-1 text-xs font-medium text-[#4a80f0] hover:text-[#6a9fff] border border-[rgba(74,128,240,0.28)] px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Recruit
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Apply Panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#EAE8E0] uppercase tracking-wider">Apply</h2>
          <div className="bg-[#0D1525] border border-[rgba(74,128,240,0.12)] rounded-xl p-4 space-y-3 sticky top-6">
            {applied ? (
              <div className="text-center py-4">
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold mb-2",
                  applied.status === "ACCEPTED" ? "bg-green-950 text-green-400" :
                  applied.status === "REJECTED" ? "bg-red-950/40 text-red-400" :
                  "bg-blue-950 text-blue-400"
                )}>
                  <Clock className="w-3.5 h-3.5" />
                  {applied.status === "ACCEPTED" ? "Accepted!" :
                   applied.status === "REJECTED" ? "Not selected" : "Under review"}
                </div>
                <p className="text-xs text-[#8A8898]">
                  {applied.status === "ACCEPTED"
                    ? "Congratulations — your team has been accepted."
                    : applied.status === "REJECTED"
                    ? "This team wasn't selected for this project."
                    : "The org is reviewing your application."}
                </p>
                <Link
                  href={`/teams/${applied.teamId}`}
                  className="block text-xs text-[#4a80f0] hover:underline mt-2"
                >
                  View team workspace →
                </Link>
              </div>
            ) : myTeams.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-[#8A8898] mb-2">You need a team to apply.</p>
                <Link href="/teams" className="text-xs text-[#4a80f0] hover:underline">
                  Create or join a team →
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-[#8A8898] block mb-1">Your team</label>
                  <select
                    value={applyTeamId}
                    onChange={(e) => setApplyTeamId(e.target.value)}
                    className="w-full text-sm rounded-lg border border-[rgba(74,128,240,0.12)] bg-[#111C32] text-[#EAE8E0] px-3 py-2 focus:outline-none focus:border-[rgba(74,128,240,0.28)]"
                  >
                    {myTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#8A8898] block mb-1">
                    Why does your team fit? <span className="text-[#5A5570]">(optional)</span>
                  </label>
                  <textarea
                    value={applyMsg}
                    onChange={(e) => setApplyMsg(e.target.value)}
                    rows={4}
                    placeholder="What makes your team a strong match for this project?"
                    className="w-full resize-none text-sm rounded-lg border border-[rgba(74,128,240,0.12)] bg-[#111C32] text-[#EAE8E0] placeholder-[#5A5570] px-3 py-2 focus:outline-none focus:border-[rgba(74,128,240,0.28)]"
                  />
                </div>
                <button
                  onClick={handleApply}
                  disabled={applying || !applyTeamId}
                  className="w-full py-2.5 rounded-lg bg-[#4a80f0] hover:bg-[#6a9fff] text-[#05080F] text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  {applying ? "Submitting…" : "Submit Application"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
