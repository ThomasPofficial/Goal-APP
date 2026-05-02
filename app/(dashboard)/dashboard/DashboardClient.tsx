"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, ChevronRight, Save, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
  secondaryGeniusType: GeniusTypeKey | null;
  currentFocus: string | null;
  savedCount: number;
}

interface SpaceRow {
  id: string;
  name: string;
  hasUnread: boolean;
}

interface TickerItem {
  id: string;
  title: string;
  category: string;
  deadline: string | null;
  org: { id: string; name: string };
}

interface OpportunityCard {
  id: string;
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
  isRemote: boolean;
  saved: boolean;
  org: { id: string; name: string; heroUrl: string | null; accentColor: string | null };
  gradeEligibility: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B",
  FELLOWSHIP: "#6366F1",
  INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316",
  BOOTCAMP: "#8B5CF6",
  RESEARCH: "#06B6D4",
  CLUB: "#10B981",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardClient({ profile, spaces, traitsDone }: { profile: ProfileData; spaces: SpaceRow[]; traitsDone: boolean }) {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const typeInfo = profile.geniusType ? GENIUS_TYPES[profile.geniusType] : null;

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch("/api/opportunities/ticker");
      const data = await res.json();
      setTicker(data.opportunities ?? []);
    } catch {}
  }, []);

  const fetchFeed = useCallback(async (p: number, filter: string, replace = false) => {
    if (p === 1) setFeedLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter !== "ALL") params.set("category", filter);
      const res = await fetch(`/api/opportunities/recommended?${params}`);
      const data = await res.json();
      setOpportunities((prev) => replace ? data.opportunities : [...prev, ...data.opportunities]);
      setHasMore(p < data.pages);
    } catch {} finally {
      setFeedLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchTicker(); }, [fetchTicker]);
  useEffect(() => {
    setPage(1);
    fetchFeed(1, activeFilter, true);
  }, [activeFilter, fetchFeed]);

  // Re-fetch ticker every 10 min
  useEffect(() => {
    const id = setInterval(fetchTicker, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchTicker]);

  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: feedback }),
    });
    setFeedback("");
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const toggleSave = async (id: string, currentlySaved: boolean) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, saved: !currentlySaved } : o))
    );
    try {
      if (currentlySaved) {
        await fetch(`/api/opportunities/${id}/save`, { method: "DELETE" });
      } else {
        await fetch(`/api/opportunities/${id}/save`, { method: "POST" });
      }
    } catch {
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, saved: currentlySaved } : o))
      );
    }
  };

  const FILTERS = ["ALL", "INTERNSHIP", "FELLOWSHIP", "COMPETITION", "ACCELERATOR", "BOOTCAMP", "RESEARCH"];

  return (
    <div className="flex gap-6 min-h-0">
      {/* ── Left column ─────────────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 space-y-4">

<<<<<<< Updated upstream
      <div className="space-y-6">
        {/* Page heading */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#eaeaea]">
              Welcome back, {firstName}
            </h1>
            {genius && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-[#909098]">
                  {genius.icon}{" "}
                  <span style={{ color: genius.color }}>{genius.label}</span>
                </span>
              </div>
            )}
          </div>

          {/* Quick-access buttons (tucked away but visible) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotes(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md px-3 py-2 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Quick Notes
            </button>
            <Link
              href="/messages"
              className="relative flex items-center gap-1.5 text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md px-3 py-2 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Messages
              {unreadConvoCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c9a84c] text-[#080809] text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadConvoCount}
                </span>
=======
        {/* Identity panel */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName}
              geniusType={profile.geniusType}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#e8e8ec] truncate">{profile.displayName}</p>
              {profile.handle && (
                <p className="text-xs text-[#9898a8]">@{profile.handle}</p>
>>>>>>> Stashed changes
              )}
              {profile.geniusType && (
                <GeniusTypeBadge type={profile.geniusType} size="sm" className="mt-1" />
              )}
            </div>
          </div>

          {profile.currentFocus && typeInfo && (
            <div
              className="border-l-4 pl-3 py-1 mb-3 text-xs text-[#9898a8] italic leading-relaxed"
              style={{ borderColor: typeInfo.color }}
            >
              {profile.currentFocus}
            </div>
          )}

          <div className="flex gap-4 text-center mb-4">
            <div>
              <p className="text-sm font-semibold text-[#e8e8ec]">{profile.savedCount}</p>
              <p className="text-[11px] text-[#5a5a6a]">Saved</p>
            </div>
          </div>

          <Link
            href="/profile/me"
            className="block w-full text-center text-xs font-medium py-2 rounded-lg border border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
          >
            Edit profile
          </Link>
        </div>

<<<<<<< Updated upstream
        {/* Onboarding checklist — disappears when all 3 complete */}
        {!onboardingChecklist.complete && (
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider mb-3">
              Get Started
            </h2>
            <div className="space-y-2.5">
              <ChecklistItem
                done={onboardingChecklist.hasProfile}
                label="Complete your profile"
                description="Set your display name, headline, and select your 5 traits"
                href="/profile"
                action="Set up profile"
              />
              <ChecklistItem
                done={onboardingChecklist.hasQuiz}
                label="Discover your Genius Type"
                description="8 questions to find your archetype: Dynamo, Blaze, Tempo, or Steel"
                href="/quiz"
                action="Take the quiz"
              />
              <ChecklistItem
                done={onboardingChecklist.hasProject}
                label="Create your first project"
                description="Define a project goal and handpick collaborators from the community"
                href="/projects/new"
                action="Create project"
              />
            </div>
          </div>
        )}

        {/* Hero: Active project + member Skill Cards */}
        {activeProject ? (
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl overflow-hidden">
            {/* Project header */}
            <div className="px-5 py-4 border-b border-[#1c1c20] flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <FolderOpen className="w-4 h-4 text-[#c9a84c] flex-shrink-0" />
                  <Link
                    href={`/projects/${activeProject.id}`}
                    className="font-semibold text-[#eaeaea] hover:text-[#c9a84c] transition-colors truncate"
                  >
                    {activeProject.name}
                  </Link>
                  <span className="text-xs text-[#c9a84c] bg-[#c9a84c15] px-1.5 py-0.5 rounded flex-shrink-0">
                    Active
                  </span>
                </div>
                {activeProject.goal && (
                  <p className="text-sm text-[#909098] ml-6">
                    <span className="text-[#58586a]">Goal: </span>
                    {activeProject.goal}
                  </p>
                )}
              </div>
              <Link
                href={`/projects/${activeProject.id}`}
                className="text-xs text-[#909098] hover:text-[#c9a84c] flex-shrink-0 flex items-center gap-1 transition-colors"
              >
                Open <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Member Skill Cards */}
            {projectMembers.length > 0 ? (
              <div className="px-5 py-4">
                <div className="text-xs text-[#58586a] uppercase tracking-wider mb-3 font-medium">
                  Team · {projectMembers.length} member{projectMembers.length !== 1 ? "s" : ""}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectMembers.map((m) => {
                    if (!m.profile) return null;
                    return (
                      <SkillCard
                        key={m.memberId}
                        compact
                        data={{
                          userId: m.userId,
                          displayName: m.profile.displayName,
                          headline: m.profile.headline,
                          avatarUrl: m.profile.avatarUrl,
                          strengthSummary: m.profile.strengthSummary,
                          geniusType: m.profile.geniusType,
                          selfTraits: m.profile.selfTraits,
                          peerTraits: m.profile.peerTraits,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-center">
                <p className="text-sm text-[#58586a] mb-3">
                  No team members yet.
                </p>
                <Link
                  href={`/projects/${activeProject.id}`}
                  className="text-xs text-[#c9a84c] hover:text-[#e3c06a]"
                >
                  Add team members →
                </Link>
              </div>
            )}
          </div>
        ) : (
          // No active project CTA
          <div className="bg-[#0d0d0e] border border-dashed border-[#1c1c20] rounded-xl p-8 text-center">
            <FolderOpen className="w-8 h-8 text-[#58586a] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#eaeaea] mb-1">
              No active project
            </h3>
            <p className="text-xs text-[#909098] mb-4 max-w-xs mx-auto">
              Create a project and handpick collaborators. Their Skill Cards will
              appear here on your dashboard.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] rounded-md px-4 py-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Link>
          </div>
        )}

        {/* My Traits */}
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
              My Traits
            </h2>
            <Link
              href="/profile"
              className="text-xs text-[#909098] hover:text-[#c9a84c] transition-colors"
            >
              Edit
            </Link>
          </div>

          {myTraits.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {myTraits.map((t) => (
                  <TraitBadge
                    key={t.name}
                    name={t.name}
                    category={t.category}
                    size="md"
                  />
                ))}
              </div>
              {strengthSummary && (
                <p className="text-xs text-[#909098] mt-3 leading-relaxed border-t border-[#1c1c20] pt-3">
                  {strengthSummary}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-[#58586a] mb-2">
                Select your 5 traits to complete your Skill Card.
              </p>
              <Link
                href="/profile"
                className="text-xs text-[#c9a84c] hover:text-[#e3c06a]"
              >
                Select traits →
              </Link>
=======
        {/* Spaces pulse */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a33]">
            <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">Spaces</p>
            <Link href="/teams" className="text-xs text-[#5a5a6a] hover:text-[#c9a84c] transition-colors">
              View all
            </Link>
          </div>
          {spaces.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-[#5a5a6a] mb-2">No active spaces yet.</p>
              <Link href="/teams" className="text-xs text-[#c9a84c]">Join or create a team →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a33]">
              {spaces.map((s) => (
                <Link
                  key={s.id}
                  href={`/teams/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#1e1e2480] transition-colors"
                >
                  <span className="text-sm text-[#e8e8ec] truncate">{s.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.hasUnread && (
                      <span className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-[#5a5a6a]" />
                  </div>
                </Link>
              ))}
>>>>>>> Stashed changes
            </div>
          )}
        </div>

<<<<<<< Updated upstream
        {/* Recent Notes (collapsed / summary view) */}
        {recentNotes.length > 0 && (
          <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
                Recent Notes
              </h2>
              <button
                onClick={() => setShowNotes(true)}
                className="text-xs text-[#909098] hover:text-[#c9a84c] transition-colors"
=======
        {/* Feedback */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider mb-2">
            Platform feedback
          </p>
          {feedbackSent ? (
            <p className="text-xs text-green-600 dark:text-green-400">Thanks — got it.</p>
          ) : (
            <div className="flex gap-2">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendFeedback()}
                placeholder="Something broken or missing?"
                className="flex-1 text-xs rounded-lg border border-[#2a2a33] bg-transparent px-3 py-2 text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none focus:border-[#c9a84c]"
              />
              <button
                onClick={sendFeedback}
                className="text-xs px-3 py-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] rounded-lg font-medium transition-colors"
>>>>>>> Stashed changes
              >
                Send
              </button>
            </div>
<<<<<<< Updated upstream
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recentNotes.slice(0, 4).map((note) => (
                <button
                  key={note.id}
                  onClick={() => setShowNotes(true)}
                  className="text-left bg-[#131315] border border-[#1c1c20] rounded-lg p-3 hover:border-[#28282e] transition-colors"
                >
                  {note.title && (
                    <div className="text-xs font-medium text-[#eaeaea] truncate mb-1">
                      {note.pinned && <span className="text-[#c9a84c] mr-1">·</span>}
                      {note.title}
                    </div>
                  )}
                  <p className="text-xs text-[#909098] font-mono line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                  <div className="text-[10px] text-[#58586a] mt-1.5">
                    {formatRelativeDate(note.updatedAt)}
                  </div>
                </button>
              ))}
=======
          )}
        </div>
      </div>

      {/* ── Right column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Traits nudge banner */}
        {!traitsDone && (
          <Link
            href="/quiz?tab=traits"
            className="flex items-center justify-between gap-3 bg-[#c9a84c10] border border-[#c9a84c30] hover:border-[#c9a84c60] rounded-xl px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">✦</span>
              <div>
                <p className="text-sm font-semibold text-[#e8e8ec]">Complete your Skill Card</p>
                <p className="text-xs text-[#9898a8]">Take the Traits Quiz to identify your 5 core strengths</p>
              </div>
            </div>
            <span className="text-xs text-[#c9a84c] font-medium group-hover:translate-x-0.5 transition-transform">Start →</span>
          </Link>
        )}

        {/* Ticker */}
        {ticker.length > 0 && (
          <div className="bg-[#0f0f11] rounded-xl overflow-hidden h-10 flex items-center">
            <div className="ticker-wrapper overflow-hidden flex-1">
              <div className="ticker-track flex gap-12 whitespace-nowrap hover:[animation-play-state:paused]"
                style={{ animation: "ticker-scroll 40s linear infinite" }}
              >
                {[...ticker, ...ticker].map((item, i) => (
                  <Link
                    key={`${item.id}-${i}`}
                    href={`/orgs/${item.org.id}`}
                    className="inline-flex items-center gap-3 text-xs text-[#9898a8] hover:text-[#e8e8ec] transition-colors flex-shrink-0"
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: CATEGORY_COLORS[item.category] ?? "#9898a8", background: `${CATEGORY_COLORS[item.category] ?? "#9898a8"}20` }}
                    >
                      {item.category}
                    </span>
                    <span className="text-[#9898a8]">{item.org.name}</span>
                    <span className="text-white">{item.title}</span>
                    {item.deadline && (
                      <span className="text-[#5a5a6a]">· {format(new Date(item.deadline), "MMM d")}</span>
                    )}
                  </Link>
                ))}
              </div>
>>>>>>> Stashed changes
            </div>
          </div>
        )}

<<<<<<< Updated upstream
function ChecklistItem({
  done,
  label,
  description,
  href,
  action,
}: {
  done: boolean;
  label: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
        done ? "opacity-50" : "bg-[#131315]"
      }`}
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-[#4ADE80] flex-shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-4 h-4 text-[#58586a] flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#eaeaea]">{label}</div>
        <div className="text-xs text-[#909098] mt-0.5">{description}</div>
=======
        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                activeFilter === f
                  ? "bg-[#c9a84c] border-[#c9a84c] text-[#0f0f11]"
                  : "border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c]"
              )}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Feed header */}
        <h2 className="text-sm font-semibold text-[#e8e8ec]">Opportunities for you</h2>

        {/* Feed */}
        {feedLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-[#16161a] animate-pulse" />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#9898a8] mb-2">No opportunities found.</p>
            <button onClick={() => setActiveFilter("ALL")} className="text-xs text-[#c9a84c]">Clear filter</button>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                onSaveToggle={() => toggleSave(opp.id, opp.saved)}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  fetchFeed(next, activeFilter);
                }}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-[#9898a8] hover:text-[#c9a84c] transition-colors disabled:opacity-40"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function OpportunityCard({ opp, onSaveToggle }: { opp: OpportunityCard; onSaveToggle: () => void }) {
  const accentColor = opp.org.accentColor ?? CATEGORY_COLORS[opp.category] ?? "#c9a84c";

  return (
    <div className="relative bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden flex">
      <div className="w-1 flex-shrink-0" style={{ background: accentColor }} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ color: accentColor, background: `${accentColor}20` }}
              >
                {opp.category}
              </span>
              <span className="text-xs text-[#5a5a6a]">{opp.org.name}</span>
            </div>
            <p className="font-medium text-[#e8e8ec] text-sm truncate">{opp.title}</p>
            {opp.description && (
              <p className="text-xs text-[#9898a8] mt-1 line-clamp-2 leading-relaxed">
                {opp.description}
              </p>
            )}
          </div>
          <button
            onClick={onSaveToggle}
            className={cn(
              "flex-shrink-0 p-1.5 rounded-lg transition-colors",
              opp.saved
                ? "text-[#c9a84c]"
                : "text-[#5a5a6a] hover:text-[#c9a84c]"
            )}
            title={opp.saved ? "Unsave" : "Save"}
          >
            <Save className="w-4 h-4" fill={opp.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {opp.deadline && (
            <span className="text-[11px] text-[#5a5a6a]">
              Due {format(new Date(opp.deadline), "MMM d, yyyy")}
            </span>
          )}
          {opp.isRemote && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e24] text-[#9898a8]">
              Remote
            </span>
          )}
          <Link
            href={`/orgs/${opp.org.id}`}
            className="ml-auto text-[11px] text-[#c9a84c] hover:text-[#e3c06a] flex items-center gap-1 transition-colors"
          >
            View org <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
>>>>>>> Stashed changes
      </div>
    </div>
  );
}
