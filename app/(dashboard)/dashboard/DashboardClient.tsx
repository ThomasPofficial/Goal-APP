"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, Save } from "lucide-react";
import TutorialWidget from "@/components/ui/TutorialWidget";
import WelcomeCard from "@/components/ui/WelcomeCard";
import PlatformUpdatesCard from "@/components/ui/PlatformUpdatesCard";
import BriefingCard from "@/components/ui/BriefingCard";
import StatusPill from "@/components/ui/StatusPill";

interface ProfileData {
  displayName: string; handle: string | null; avatarUrl: string | null;
  currentFocus: string | null; savedCount: number;
}
interface SpaceRow { id: string; name: string; hasUnread: boolean; }
interface TutorialData {
  hasTeam: boolean;
  hasApplied: boolean; hasBrowsedOrgs: boolean;
}
interface TickerItem {
  id: string; title: string; category: string; deadline: string | null;
  org: { id: string; name: string };
}
interface OppCard {
  id: string; title: string; description: string | null; category: string;
  deadline: string | null; isRemote: boolean; saved: boolean;
  org: { id: string; name: string; heroUrl: string | null; accentColor: string | null };
  gradeEligibility: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  ACCELERATOR: "#F59E0B", FELLOWSHIP: "#6366F1", INTERNSHIP: "#14B8A6",
  COMPETITION: "#F97316", BOOTCAMP: "#8B5CF6", RESEARCH: "#06B6D4", CLUB: "#10B981",
};

const MOCK_COMMUNITIES = [
  { id: "c1", name: "Nivarro Design Guild",  members: 234, category: "Design",          color: "#6366F1" },
  { id: "c2", name: "The Builder's Circle",  members: 412, category: "Engineering",     color: "#14B8A6" },
  { id: "c3", name: "Founders Under 20",     members: 189, category: "Entrepreneurship",color: "#F59E0B" },
  { id: "c4", name: "Social Impact Network", members: 156, category: "Impact",          color: "#10B981" },
  { id: "c5", name: "Pre-Med Pipeline",      members: 298, category: "Healthcare",      color: "#06B6D4" },
  { id: "c6", name: "Code & Coffee",         members: 521, category: "Community",       color: "#F97316" },
];

/* ── Section header — spy tag + big display title ───── */
function SectionHeader({ tag, title, href, linkLabel }: { tag: string; title: string; href: string; linkLabel: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <span style={{
        display: "block", marginBottom: 8,
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em",
        textTransform: "uppercase", color: "var(--amber)",
      }}>
        ▸ {tag}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(28px, 3.5vw, 42px)",
          fontWeight: 400, color: "var(--cream)", margin: 0,
          textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95,
        }}>
          {title}
        </h2>
        <Link href={href} style={{
          fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: "700",
          color: "var(--ink-mute)", textDecoration: "none", letterSpacing: "0.12em",
          textTransform: "uppercase", transition: "color 120ms",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-mute)")}
        >
          {linkLabel} →
        </Link>
      </div>
    </div>
  );
}

export default function DashboardClient({ profile, spaces, tutorialDismissed, tutorial }: {
  profile: ProfileData; spaces: SpaceRow[];
  tutorialDismissed?: boolean; tutorial: TutorialData;
}) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [opportunities, setOpportunities] = useState<OppCard[]>([]);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTicker = useCallback(async () => {
    try { const res = await fetch("/api/opportunities/ticker"); const data = await res.json(); setTicker(data.opportunities ?? []); } catch {}
  }, []);

  const fetchFeed = useCallback(async (p: number, filter: string, replace = false) => {
    if (p === 1) setFeedLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filter !== "ALL") params.set("category", filter);
      const res = await fetch(`/api/opportunities/recommended?${params}`);
      const data = await res.json();
      setOpportunities((prev) => replace ? data.opportunities : [...prev, ...data.opportunities]);
      setHasMore(p < data.pages);
    } catch {} finally { setFeedLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchTicker(); }, [fetchTicker]);
  useEffect(() => { setPage(1); fetchFeed(1, activeFilter, true); }, [activeFilter, fetchFeed]);
  useEffect(() => { const id = setInterval(fetchTicker, 60000); return () => clearInterval(id); }, [fetchTicker]);

  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: feedback }) });
    setFeedback(""); setFeedbackSent(true); setTimeout(() => setFeedbackSent(false), 3000);
  };

  const toggleSave = async (id: string, saved: boolean) => {
    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, saved: !saved } : o));
    try { await fetch(`/api/opportunities/${id}/save`, { method: saved ? "DELETE" : "POST" }); }
    catch { setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, saved } : o)); }
  };

  const FILTERS = ["ALL", "INTERNSHIP", "FELLOWSHIP", "COMPETITION", "ACCELERATOR", "BOOTCAMP", "RESEARCH"];

  return (
    <>
      {/* Ops-room wallpaper — fixed behind all content; sidebar covers the left portion */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <img
          src="/ops-room.png"
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: 0.52,
            display: "block",
            userSelect: "none",
          }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 48 }}>

      {/* ── Briefing hero ─────────────────────────── */}
      <BriefingCard />

      {/* ── Intel widgets ─────────────────────────── */}
      <div>
        <WelcomeCard />
        <PlatformUpdatesCard />
        <TutorialWidget {...tutorial} serverDismissed={tutorialDismissed} />
      </div>

      {/* ── Projects ──────────────────────────────── */}
      <section>
        <SectionHeader tag="Field Operations" title="Projects" href="/teams" linkLabel="View all" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {spaces.map((s) => <ProjectCard key={s.id} space={s} />)}
          <NewProjectButton />
        </div>
        {spaces.length === 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-body)" }}>
            No active projects yet — join a team to get started.
          </p>
        )}
      </section>

      {/* ── Communities ───────────────────────────── */}
      <section>
        <SectionHeader tag="Intelligence Network" title="Communities" href="/communities" linkLabel="View all" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {MOCK_COMMUNITIES.map((c) => <CommunityCard key={c.id} community={c} />)}
        </div>
      </section>

      {/* ── Live ticker ───────────────────────────── */}
      {ticker.length > 0 && (
        <div style={{ overflow: "hidden", display: "flex", alignItems: "center", height: 40, background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 16px", borderRight: "1px solid var(--border)", height: "100%" }}>
            <StatusPill label="Live" active />
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="ticker-track">
              {[...ticker, ...ticker].map((item, i) => (
                <Link key={`${item.id}-${i}`} href={`/orgs/${item.org.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 13, flexShrink: 0, color: "var(--text2)", textDecoration: "none" }}>
                  <span style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 7px", color: "#fff", background: CATEGORY_COLORS[item.category] ?? "#555" }}>{item.category}</span>
                  <span style={{ color: "var(--muted)" }}>{item.org.name}</span>
                  <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{item.title}</span>
                  {item.deadline && <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>· {format(new Date(item.deadline), "MMM d")}</span>}
                  <span style={{ color: "rgba(232,137,58,0.35)" }}>·</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Opportunities ─────────────────────────── */}
      <section>
        <SectionHeader tag="Dossier" title="Opportunities" href="/orgs" linkLabel="Browse all" />

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              padding: "7px 18px", fontSize: 14,
              fontFamily: "var(--font-body)", fontWeight: activeFilter === f ? "bold" : "normal",
              letterSpacing: "0.02em",
              background: activeFilter === f ? "var(--amber)" : "transparent",
              border: `1px solid ${activeFilter === f ? "var(--amber)" : "rgba(232,137,58,0.2)"}`,
              color: activeFilter === f ? "#000" : "var(--ink-mute)",
              cursor: "pointer", transition: "all 120ms",
            }}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {feedLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ height: 128, background: "var(--surface)", border: "1px solid var(--border)", animation: "pulse 1.5s infinite" }} />)}
          </div>
        ) : opportunities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <p style={{ fontSize: 16, color: "var(--text2)", fontFamily: "var(--font-body)", marginBottom: 16 }}>No opportunities found.</p>
            <button onClick={() => setActiveFilter("ALL")} style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono)", background: "none", border: "none", cursor: "pointer", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Clear filter →
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {opportunities.map((opp) => <OppCardComp key={opp.id} opp={opp} onSaveToggle={() => toggleSave(opp.id, opp.saved)} />)}
            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                <button onClick={() => { const next = page + 1; setPage(next); fetchFeed(next, activeFilter); }} disabled={loadingMore} className="spy-card bracket-card" style={{
                  padding: "10px 28px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: "700",
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "var(--ink-mute)", background: "var(--surface)", border: "1px solid rgba(232,137,58,0.18)",
                  cursor: "pointer", opacity: loadingMore ? 0.5 : 1,
                }}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Feedback ──────────────────────────────── */}
      <div className="bracket-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "24px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--amber)", marginBottom: 12 }}>
          ▸ Platform Feedback
        </p>
        {feedbackSent ? (
          <p style={{ fontSize: 15, color: "#4ade80", fontFamily: "var(--font-body)" }}>Transmission received.</p>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFeedback()} placeholder="Report anomaly or missing asset…" style={{
              flex: 1, fontSize: 14, padding: "10px 14px",
              background: "var(--surface2)", border: "1px solid var(--border-md)",
              color: "#FFFFFF", fontFamily: "var(--font-body)", outline: "none",
            }} />
            <button onClick={sendFeedback} style={{
              padding: "10px 20px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: "700",
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: "var(--amber)", color: "#000", border: "none", cursor: "pointer",
            }}>
              Send
            </button>
          </div>
        )}
      </div>

    </div>
    </>
  );
}

/* ── Project card ─────────────────────────────────────────── */
function ProjectCard({ space }: { space: SpaceRow }) {
  return (
    <Link href={`/teams/${space.id}`} className="spy-card bracket-card" style={{
      padding: "22px", display: "flex", flexDirection: "column", gap: 14,
      textDecoration: "none", minHeight: 160,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={space.hasUnread ? "spy-pulse" : undefined} style={{
          display: "inline-block", width: 7, height: 7, borderRadius: "50%",
          background: space.hasUnread ? "var(--amber)" : "var(--ink-mute)", flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: space.hasUnread ? "var(--amber)" : "var(--ink-mute)", fontFamily: "var(--font-mono)" }}>
          {space.hasUnread ? "Active" : "Standby"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-mute)", fontFamily: "var(--font-mono)" }}>OP</span>
      </div>

      <p style={{ fontSize: 22, fontWeight: "bold", color: "var(--cream)", lineHeight: 1.2, fontFamily: "var(--font-body)", flex: 1, margin: 0 }}>
        {space.name}
      </p>

      <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
        <span style={{ fontSize: 12, fontWeight: "700", color: "var(--amber)", fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Resume →
        </span>
      </div>
    </Link>
  );
}

function NewProjectButton() {
  return (
    <Link href="/teams" style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 10, minHeight: 160, textDecoration: "none",
      border: "1px dashed rgba(232,137,58,0.18)", background: "transparent",
      transition: "border-color 150ms",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(232,137,58,0.5)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(232,137,58,0.18)")}
    >
      <span style={{ fontSize: 28, color: "var(--ink-mute)", lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 13, color: "var(--ink-mute)", fontFamily: "var(--font-body)", fontWeight: "600" }}>New project</span>
    </Link>
  );
}

/* ── Community card ───────────────────────────────────────── */
function CommunityCard({ community }: { community: typeof MOCK_COMMUNITIES[0] }) {
  return (
    <Link href="/communities" className="spy-card bracket-card" style={{
      display: "flex", flexDirection: "column", textDecoration: "none",
      overflow: "hidden", minHeight: 160,
    }}>
      <div style={{ height: 3, background: community.color, flexShrink: 0 }} />
      <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: community.color, fontFamily: "var(--font-mono)", fontWeight: "700" }}>
            {community.category}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            {community.members.toLocaleString()} mbrs
          </span>
        </div>

        <p style={{ fontSize: 21, fontWeight: "bold", color: "var(--cream)", lineHeight: 1.25, fontFamily: "var(--font-body)", flex: 1, margin: 0 }}>
          {community.name}
        </p>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: "700", color: "var(--amber)", fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Join →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ── Opportunity card ─────────────────────────────────────── */
function OppCardComp({ opp, onSaveToggle }: { opp: OppCard; onSaveToggle: () => void }) {
  const accent = opp.org.accentColor ?? CATEGORY_COLORS[opp.category] ?? "#3B82F6";
  return (
    <div className="spy-card bracket-card" style={{ display: "flex", minHeight: 128 }}>
      <div style={{ width: 3, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 8px", color: "#FFFFFF", background: accent, fontFamily: "var(--font-mono)" }}>
                {opp.category}
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)" }}>
                {opp.org.name}
              </span>
            </div>
            <p style={{ fontSize: 19, fontWeight: "bold", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-body)", margin: 0 }}>
              {opp.title}
            </p>
            <p style={{ fontSize: 14, color: "var(--n-text2)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 5, fontFamily: "var(--font-body)" }}>
              {opp.description ?? ""}
            </p>
          </div>
          <button onClick={onSaveToggle} style={{ flexShrink: 0, padding: 6, color: opp.saved ? "var(--amber)" : "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", transition: "color 80ms" }}>
            <Save size={16} fill={opp.saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {opp.deadline && <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-body)" }}>Due {format(new Date(opp.deadline), "MMM d, yyyy")}</span>}
          {opp.isRemote && <span style={{ fontSize: 12, padding: "1px 8px", background: "var(--surface2)", color: "var(--text2)", fontFamily: "var(--font-body)" }}>Remote</span>}
          <Link href={`/orgs/${opp.org.id}`} style={{ marginLeft: "auto", fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--amber)", textDecoration: "none", fontWeight: "700", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            View org <ExternalLink size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
