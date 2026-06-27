import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Communities — Nivarro" };

const COMMUNITIES = [
  {
    id: "c1", name: "Nivarro Design Guild",
    desc: "UI/UX designers shaping the next generation of products. Weekly crits, portfolio reviews, live feedback.",
    members: 234, category: "Design", color: "#6366F1",
    tags: ["UI/UX", "Product", "Branding"],
  },
  {
    id: "c2", name: "The Builder's Circle",
    desc: "Engineers and founders building in public. Ship fast, share openly, learn constantly.",
    members: 412, category: "Engineering", color: "#14B8A6",
    tags: ["Dev", "Startups", "Open Source"],
  },
  {
    id: "c3", name: "Founders Under 20",
    desc: "Young entrepreneurs launching their first ventures — from idea to first dollar and beyond.",
    members: 189, category: "Entrepreneurship", color: "#F59E0B",
    tags: ["Startups", "Fundraising", "MVP"],
  },
  {
    id: "c4", name: "Social Impact Network",
    desc: "Changemakers connecting social good with real capital and organizational leverage.",
    members: 156, category: "Impact", color: "#10B981",
    tags: ["Nonprofit", "Policy", "Community"],
  },
  {
    id: "c5", name: "Pre-Med Pipeline",
    desc: "Pre-med students navigating research, clinical exposure, and MCAT prep together.",
    members: 298, category: "Healthcare", color: "#06B6D4",
    tags: ["Medicine", "Research", "MCAT"],
  },
  {
    id: "c6", name: "Code & Coffee",
    desc: "Weekly meetups for developers at all levels. Show-and-tell, debugging sessions, peer learning.",
    members: 521, category: "Community", color: "#F97316",
    tags: ["Coding", "Peer Learning", "Weekly"],
  },
  {
    id: "c7", name: "Finance Forward",
    desc: "Students breaking into investment banking, PE, and hedge funds. Deal analysis and cold-outreach strategies.",
    members: 187, category: "Finance", color: "#84CC16",
    tags: ["IB", "PE", "Markets"],
  },
  {
    id: "c8", name: "Creative Collective",
    desc: "Writers, filmmakers, photographers, and musicians building creative careers with a business edge.",
    members: 143, category: "Creative", color: "#EC4899",
    tags: ["Art", "Film", "Writing"],
  },
  {
    id: "c9", name: "Policy Lab",
    desc: "Students exploring government, law, and public policy. Mock hearings, case studies, DC network access.",
    members: 99, category: "Policy", color: "#A78BFA",
    tags: ["Law", "Government", "Advocacy"],
  },
];

export default function CommunitiesPage() {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <span style={{
          display: "block", marginBottom: 8,
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "var(--amber)",
        }}>
          ▸ Intelligence Network
        </span>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(48px, 6vw, 80px)", fontWeight: 400,
          color: "var(--gold)", margin: "0 0 14px", textTransform: "uppercase",
          letterSpacing: "-0.01em", lineHeight: 0.9,
        }}>
          Communities
        </h1>
        <p style={{ fontSize: 17, color: "#D4E6F8", fontFamily: "var(--font-body)", lineHeight: 1.65, maxWidth: 560, margin: 0 }}>
          Find your people. Every community is a network, a study group, and a launchpad.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMMUNITIES.map((c) => (
          <div key={c.id} className="spy-card bracket-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ height: 4, background: c.color, flexShrink: 0 }} />
            <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>

              {/* Category row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: c.color, fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
                  {c.category}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                  {c.members.toLocaleString()} mbrs
                </span>
              </div>

              {/* Name */}
              <p style={{ fontSize: 21, fontWeight: "bold", color: "var(--cream)", lineHeight: 1.2, fontFamily: "var(--font-body)", margin: 0 }}>
                {c.name}
              </p>

              {/* Description */}
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, fontFamily: "var(--font-body)", flex: 1, margin: 0 }}>
                {c.desc}
              </p>

              {/* Tags */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.tags.map((t) => (
                  <span key={t} style={{
                    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "3px 8px", background: c.color, color: "#FFFFFF",
                    fontFamily: "var(--font-mono)", fontWeight: "bold",
                  }}>
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                <button style={{
                  fontSize: 12, fontWeight: "700", color: "var(--amber)",
                  fontFamily: "var(--font-mono)", background: "none", border: "none",
                  cursor: "pointer", padding: 0, letterSpacing: "0.14em", textTransform: "uppercase",
                }}>
                  Join →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 48, textAlign: "center", fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-body)" }}>
        More communities launching soon — suggest one via platform feedback.
      </p>
    </div>
  );
}
