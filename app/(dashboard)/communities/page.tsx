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
    desc: "Students breaking into investment banking, PE, and hedge funds. Deal analysis and cold-outreach.",
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
      {/* HUD header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: 10 }}>▸</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: "bold", letterSpacing: "0.22em", color: "var(--text)", textTransform: "uppercase" }}>
          [ Communities ]
        </span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(59,130,246,0.4), transparent)" }} />
      </div>
      <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 32, fontFamily: "var(--font-body)", lineHeight: 1.6 }}>
        Find your people. Every community is a network, a study group, and a launchpad.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMMUNITIES.map((c) => (
          <div
            key={c.id}
            className="spy-card bracket-card"
            style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div style={{ height: 2, background: c.color, flexShrink: 0 }} />
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>

              {/* Category row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, letterSpacing: "0.2em", color: c.color, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                  {c.category}
                </span>
                <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  {c.members.toLocaleString()} members
                </span>
              </div>

              {/* Name */}
              <p style={{ fontSize: 17, fontWeight: "bold", color: "var(--text)", lineHeight: 1.25, fontFamily: "var(--font-body)" }}>
                {c.name}
              </p>

              {/* Description */}
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, flex: 1, fontFamily: "var(--font-body)" }}>
                {c.desc}
              </p>

              {/* Tags */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.tags.map((t) => (
                  <span
                    key={t}
                    style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", padding: "2px 7px", background: `${c.color}18`, color: c.color, fontFamily: "var(--font-mono)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <button
                  style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--blue)", fontFamily: "var(--font-mono)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Join Community ›
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
        MORE COMMUNITIES LAUNCHING SOON — SUGGEST ONE VIA PLATFORM FEEDBACK
      </p>
    </div>
  );
}
