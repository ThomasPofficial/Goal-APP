"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, ArrowLeft, UserPlus, CheckCircle2, Clock, Zap, BookOpen, Lock } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import ApplyModal from "@/components/ui/ApplyModal";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

const GENIUS_KEYS: GeniusTypeKey[] = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"];

interface Review {
  id: string;
  body: string;
  createdAt: string;
  org: { name: string; logoLetter: string | null; logoBg: string | null; logoColor: string | null };
  orgProject: { title: string };
}

interface Scholar {
  id: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  handle: string | null;
  traitLinks: { trait: { slug: string; name: string } }[];
  orgReviews?: Review[];
}

interface QuotaInfo {
  dailyCap: number;
  usedCount: number;
  remaining: number;
  resetsAt: string;
}

interface ProjectDetailClientProps {
  project: {
    id: string;
    orgId: string;
    title: string;
    description: string | null;
    shortDescription: string | null;
    fullDescription: string | null;
    openSpots: number;
    requiredSkills: string;
    preferredGeniusTypes: string;
    hoursPerWeek: string | null;
    duration: string | null;
    deadline: string | null;
    status: string;
    createdAt: string;
    org: { id: string; name: string; accentColor: string | null; maxTeamSize: number };
  };
  myProfileId: string | null;
  existingApplication: { id: string; status: string; teamId: string } | null;
  activeWorkflowStep: number | null;
}

export default function ProjectDetailClient({
  project,
  myProfileId,
  existingApplication,
  activeWorkflowStep,
}: ProjectDetailClientProps) {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [algorithmCandidates, setAlgorithmCandidates] = useState<Scholar[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [q, setQ] = useState("");
  const [geniusFilter, setGeniusFilter] = useState<GeniusTypeKey | "">("");
  const [loading, setLoading] = useState(false);
  const [algorithmLoading, setAlgorithmLoading] = useState(false);
  const [recruitingId, setRecruitingId] = useState<string | null>(null);
  const [recruitMsg, setRecruitMsg] = useState("");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applied, setApplied] = useState<{ id: string; status: string; teamId: string } | null>(existingApplication);
  const [startingWorkflow, setStartingWorkflow] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<number | null>(activeWorkflowStep);
  const [searchMode, setSearchMode] = useState<"algorithm" | "regular">("algorithm");

  const requiredSkills: string[] = JSON.parse(project.requiredSkills || "[]");
  const preferredTypes: string[] = JSON.parse(project.preferredGeniusTypes || "[]");
  const accentColor = project.org.accentColor ?? "#1060d8";

  const isInTeamStep = workflowStep !== null && workflowStep >= 3;

  const search = useCallback(async () => {
    if (searchMode !== "regular") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (geniusFilter) params.set("geniusType", geniusFilter);
    const res = await fetch(`/api/org-projects/${project.id}/scholars?${params}`);
    const data = await res.json();
    setScholars(data.scholars ?? []);
    setLoading(false);
  }, [q, geniusFilter, project.id, searchMode]);

  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadAlgorithmCandidates = useCallback(async () => {
    if (!isInTeamStep) return;
    setAlgorithmLoading(true);
    const res = await fetch("/api/workflow/candidates");
    if (!res.ok) { setAlgorithmLoading(false); return; }
    const data = await res.json();
    setAlgorithmCandidates(data.candidates ?? []);
    setQuota(data.quota ?? null);
    setQuotaExhausted(data.exhausted ?? false);
    setAlgorithmLoading(false);
  }, [isInTeamStep]);

  useEffect(() => {
    if (searchMode === "algorithm" && isInTeamStep) {
      loadAlgorithmCandidates();
    } else if (searchMode === "regular") {
      search();
    }
  }, [searchMode, isInTeamStep, loadAlgorithmCandidates, search]);

  const startWorkflow = async () => {
    setStartingWorkflow(true);
    const res = await fetch("/api/workflow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgProjectId: project.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setWorkflowStep(data.session.step);
      // Advance to step 2 (project detail is where step 2 happens)
      await fetch("/api/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance" }),
      });
      setWorkflowStep(2);
    } else if (res.status === 409) {
      alert(data.error ?? "You already have an active workflow on another project.");
    }
    setStartingWorkflow(false);
  };

  const advanceToTeamStep = async () => {
    const res = await fetch("/api/workflow", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    if (res.ok) {
      const data = await res.json();
      setWorkflowStep(data.session.step);
    }
  };

  const sendRecruit = async (toProfileId: string) => {
    if (!myProfileId) return;
    await fetch(`/api/org-projects/${project.id}/recruit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toProfileId, message: recruitMsg }),
    });
    setSentTo((prev) => new Set(prev).add(toProfileId));
    setRecruitingId(null);
    setRecruitMsg("");
  };

  const displayedCandidates = searchMode === "algorithm" ? algorithmCandidates : scholars;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "#5a7898" }}>
        <Link href={`/orgs/${project.orgId}`} className="flex items-center gap-1 hover:text-[#4a80f0] transition-colors">
          <ArrowLeft className="w-4 h-4" /> {project.org.name}
        </Link>
        <span>/</span>
        <span style={{ color: "#d8eeff" }}>{project.title}</span>
      </div>

      {/* Header */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl font-semibold mb-1"
              style={{ color: "#f0f8ff", fontFamily: "'Cormorant Garamond', serif" }}
            >
              {project.title}
            </h1>
            {(project.fullDescription ?? project.shortDescription ?? project.description) && (
              <p className="text-sm leading-relaxed" style={{ color: "#8ab0d8" }}>
                {project.fullDescription ?? project.shortDescription ?? project.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: "#5a7898" }}>
              {project.hoursPerWeek && <span>⏱ {project.hoursPerWeek}</span>}
              {project.duration && <span>📅 {project.duration}</span>}
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {requiredSkills.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      border: "1px solid rgba(16,96,216,0.28)",
                      color: "#4a80f0",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {preferredTypes.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px]" style={{ color: "#5a7898" }}>Preferred:</span>
                {preferredTypes.map((t) => (
                  <GeniusTypeBadge key={t} type={t as GeniusTypeKey} size="sm" />
                ))}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold" style={{ color: accentColor }}>{project.openSpots}</p>
            <p className="text-xs" style={{ color: "#5a7898" }}>open spots</p>
            {project.deadline && (
              <p className="text-xs mt-1" style={{ color: "#8ab0d8" }}>
                Deadline: {format(new Date(project.deadline), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>

        {/* Workflow CTA */}
        {myProfileId && !workflowStep && project.status === "OPEN" && !applied && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={startWorkflow}
              disabled={startingWorkflow}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, #0a3ea0, #1060d8)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(16,96,216,0.4)",
                opacity: startingWorkflow ? 0.7 : 1,
              }}
            >
              {startingWorkflow ? "Starting…" : "Pursue this project →"}
            </button>
            <p className="text-xs mt-1.5" style={{ color: "#5a7898" }}>
              Starts your team-building workflow for this project
            </p>
          </div>
        )}
        {workflowStep === 2 && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={advanceToTeamStep}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, #0a3ea0, #1060d8)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(16,96,216,0.4)",
              }}
            >
              Build your team →
            </button>
            <p className="text-xs mt-1.5" style={{ color: "#5a7898" }}>
              Step 3 — find teammates with the algorithm or search
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scholar Search / Algorithm */}
        <div className="lg:col-span-2 space-y-4">
          {isInTeamStep ? (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#d8eeff" }}>
                  Find Teammates
                </h2>
                <div
                  className="flex rounded-lg overflow-hidden text-xs font-medium"
                  style={{ border: "1px solid var(--border-md)" }}
                >
                  <button
                    onClick={() => setSearchMode("algorithm")}
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
                    style={{
                      background: searchMode === "algorithm" ? "rgba(16,96,216,0.2)" : "transparent",
                      color: searchMode === "algorithm" ? "#6A9FFF" : "#5a7898",
                    }}
                  >
                    <Zap className="w-3 h-3" /> Algorithm
                  </button>
                  <button
                    onClick={() => setSearchMode("regular")}
                    className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
                    style={{
                      background: searchMode === "regular" ? "rgba(16,96,216,0.1)" : "transparent",
                      color: searchMode === "regular" ? "#8ab0d8" : "#5a7898",
                    }}
                  >
                    <Search className="w-3 h-3" /> Search
                  </button>
                </div>
              </div>

              {searchMode === "algorithm" && quota && (
                <div
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                  style={{
                    background: "rgba(16,96,216,0.08)",
                    border: "1px solid rgba(16,96,216,0.2)",
                    color: "#8ab0d8",
                  }}
                >
                  <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4a80f0" }} />
                  <span>
                    {quota.remaining} of {quota.dailyCap} recommendations remaining today.
                    {quotaExhausted && ` Resets ${format(new Date(quota.resetsAt), "h:mm a")} UTC.`}
                  </span>
                  {searchMode === "algorithm" && (
                    <span className="ml-auto flex items-center gap-1" style={{ color: "#4a80f0" }}>
                      <BookOpen className="w-3 h-3" /> Reviews visible
                    </span>
                  )}
                </div>
              )}

              {searchMode === "regular" && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    color: "#5a7898",
                  }}
                >
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Reviews are hidden in regular search. Switch to Algorithm to see them.</span>
                </div>
              )}
            </>
          ) : (
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#d8eeff" }}>
              Scholar Pool
            </h2>
          )}

          {/* Search filters (regular mode or no workflow) */}
          {(!isInTeamStep || searchMode === "regular") && (
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[160px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5a7898" }} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search scholars…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-md)",
                    color: "#d8eeff",
                  }}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {GENIUS_KEYS.map((g) => {
                  const info = GENIUS_TYPES[g];
                  return (
                    <button
                      key={g}
                      onClick={() => setGeniusFilter((prev) => (prev === g ? "" : g))}
                      style={
                        geniusFilter === g
                          ? { borderColor: info.color, color: info.color, background: "rgba(0,0,0,0.2)" }
                          : undefined
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        geniusFilter === g ? "" : "border-[rgba(74,128,240,0.12)] text-[#8A8898] hover:border-[rgba(74,128,240,0.28)]"
                      )}
                    >
                      {g[0] + g.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Candidate list */}
          <div className="space-y-2">
            {(searchMode === "algorithm" ? algorithmLoading : loading) ? (
              <div className="text-center py-8 text-sm" style={{ color: "#5a7898" }}>
                {searchMode === "algorithm" ? "Running algorithm…" : "Searching…"}
              </div>
            ) : quotaExhausted && searchMode === "algorithm" ? (
              <div
                className="text-center py-10 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <Zap className="w-8 h-8 mx-auto mb-2" style={{ color: "#1e3a68" }} />
                <p className="text-sm font-semibold" style={{ color: "#d8eeff" }}>
                  Algorithm quota exhausted for today
                </p>
                <p className="text-xs mt-1" style={{ color: "#5a7898" }}>
                  {quota && `Resets at ${format(new Date(quota.resetsAt), "h:mm a")} UTC`}
                </p>
                <p className="text-xs mt-2" style={{ color: "#5a7898" }}>
                  Use regular search in the meantime — reviews won&apos;t be visible
                </p>
              </div>
            ) : displayedCandidates.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: "#5a7898" }}>
                {searchMode === "algorithm" && isInTeamStep
                  ? "No recommendations yet — try regular search"
                  : "No scholars found"}
              </div>
            ) : (
              displayedCandidates.map((scholar) => (
                <ScholarCard
                  key={scholar.id}
                  scholar={scholar}
                  showReviews={searchMode === "algorithm" && isInTeamStep}
                  myProfileId={myProfileId}
                  sentTo={sentTo}
                  recruitingId={recruitingId}
                  recruitMsg={recruitMsg}
                  setRecruitingId={setRecruitingId}
                  setRecruitMsg={setRecruitMsg}
                  sendRecruit={sendRecruit}
                />
              ))
            )}
          </div>
        </div>

        {/* Apply Panel */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#d8eeff" }}>Apply</h2>
          <div
            className="rounded-xl p-4 sticky top-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
          >
            {applied ? (
              <div className="text-center py-4">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold mb-2",
                    applied.status === "ACCEPTED"
                      ? "bg-green-950 text-green-400"
                      : applied.status === "REJECTED"
                      ? "bg-red-950/40 text-red-400"
                      : "bg-blue-950 text-blue-400"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {applied.status === "ACCEPTED" ? "Accepted!" : applied.status === "REJECTED" ? "Not selected" : "Under review"}
                </div>
                <p className="text-xs" style={{ color: "#8ab0d8" }}>
                  {applied.status === "ACCEPTED"
                    ? "Congratulations — your team has been accepted."
                    : applied.status === "REJECTED"
                    ? "This team wasn't selected for this project."
                    : "The org is reviewing your application."}
                </p>
                <Link href={`/teams/${applied.teamId}`} className="block text-xs hover:underline mt-2" style={{ color: "#4a80f0" }}>
                  View team workspace →
                </Link>
              </div>
            ) : project.status !== "OPEN" ? (
              <p className="text-center text-xs py-4" style={{ color: "#8ab0d8" }}>Applications are closed.</p>
            ) : !myProfileId ? (
              <p className="text-center text-xs py-4" style={{ color: "#8ab0d8" }}>Sign in to apply.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed" style={{ color: "#8ab0d8" }}>
                  Apply solo or bring teammates — you pick who joins your team during the application.
                </p>
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    background: "linear-gradient(135deg, #0a3ea0, #1060d8)",
                    color: "#fff",
                    boxShadow: "0 4px 16px rgba(16,96,216,0.3)",
                  }}
                >
                  Apply with your team
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showApplyModal && (
        <ApplyModal
          orgProjectId={project.id}
          projectTitle={project.title}
          orgName={project.org.name}
          maxTeamSize={project.org.maxTeamSize}
          onSuccess={(result) => {
            setApplied({ id: "new", status: result.status, teamId: result.teamId });
            setShowApplyModal(false);
          }}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </div>
  );
}

// ── Scholar Card ───────────────────────────────────────────────────────────────

interface ScholarCardProps {
  scholar: Scholar;
  showReviews: boolean;
  myProfileId: string | null;
  sentTo: Set<string>;
  recruitingId: string | null;
  recruitMsg: string;
  setRecruitingId: (id: string | null) => void;
  setRecruitMsg: (msg: string) => void;
  sendRecruit: (id: string) => Promise<void>;
}

function ScholarCard({
  scholar, showReviews, myProfileId, sentTo,
  recruitingId, recruitMsg, setRecruitingId, setRecruitMsg, sendRecruit,
}: ScholarCardProps) {
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const reviews = scholar.orgReviews ?? [];

  return (
    <div
      className="rounded-xl p-3 space-y-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
    >
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <Avatar src={scholar.avatarUrl} name={scholar.displayName} geniusType={scholar.geniusType} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${scholar.handle ?? scholar.id}`}
              className="font-medium text-sm hover:text-[#4a80f0] transition-colors"
              style={{ color: "#d8eeff" }}
            >
              {scholar.displayName}
            </Link>
            {scholar.geniusType && <GeniusTypeBadge type={scholar.geniusType} size="sm" />}
            {showReviews && reviews.length > 0 && (
              <button
                onClick={() => setReviewsOpen((o) => !o)}
                className="ml-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-colors"
                style={{
                  background: reviewsOpen ? "rgba(16,96,216,0.2)" : "rgba(16,96,216,0.1)",
                  border: "1px solid rgba(16,96,216,0.3)",
                  color: "#6A9FFF",
                }}
              >
                <BookOpen className="w-2.5 h-2.5" /> {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </button>
            )}
          </div>
          {scholar.headline && <p className="text-xs truncate" style={{ color: "#8ab0d8" }}>{scholar.headline}</p>}
          {scholar.traitLinks.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {scholar.traitLinks.map((tl) => (
                <span key={tl.trait.slug} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#0c1a2e", color: "#8ab0d8" }}>
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
                className="w-full text-xs resize-none rounded-lg px-2 py-1.5 focus:outline-none"
                style={{ border: "1px solid rgba(16,96,216,0.28)", background: "#0c1a2e", color: "#d8eeff" }}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setRecruitingId(null)}
                  className="flex-1 text-xs py-1 rounded-lg"
                  style={{ border: "1px solid var(--border)", color: "#8ab0d8" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendRecruit(scholar.id)}
                  className="flex-1 text-xs py-1 rounded-lg font-semibold"
                  style={{ background: "#1060d8", color: "#fff" }}
                >
                  Send
                </button>
              </div>
            </div>
          ) : myProfileId && scholar.id !== myProfileId ? (
            <button
              onClick={() => setRecruitingId(scholar.id)}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                color: "#4a80f0",
                border: "1px solid rgba(16,96,216,0.28)",
              }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Recruit
            </button>
          ) : null}
        </div>
      </div>

      {/* Reviews panel */}
      {showReviews && reviewsOpen && reviews.length > 0 && (
        <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg p-3" style={{ background: "#030922", border: "1px solid rgba(16,96,216,0.15)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                {r.org.logoLetter && (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: r.org.logoBg ?? "#0A1E52", color: r.org.logoColor ?? "#6A9FFF" }}
                  >
                    {r.org.logoLetter}
                  </div>
                )}
                <span className="text-[11px] font-semibold" style={{ color: "#8ab0d8" }}>{r.org.name}</span>
                <span className="text-[10px]" style={{ color: "#5a7898" }}>on {r.orgProject.title}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#c8ddf0" }}>{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
