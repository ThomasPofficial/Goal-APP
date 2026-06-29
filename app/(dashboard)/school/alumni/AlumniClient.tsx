"use client";

import { useState } from "react";
import { GraduationCap, Briefcase, BookOpen, MessageCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

interface Alumnus {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  industry: string | null;
  graduationYear: number | null;
  isAvailableToMentor: boolean;
  intendedCollege: string | null;
  orgs: string[];
}

interface Props {
  alumni: Alumnus[];
  currentUserId: string;
}

export default function AlumniClient({ alumni }: Props) {
  const [filter, setFilter] = useState<"all" | "mentors">("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  const industries = [...new Set(alumni.map((a) => a.industry).filter(Boolean))] as string[];

  const visible = alumni.filter((a) => {
    if (filter === "mentors" && !a.isAvailableToMentor) return false;
    if (industryFilter !== "all" && a.industry !== industryFilter) return false;
    return true;
  });

  const handleMentorRequest = async (alumniId: string) => {
    setRequestedIds((prev) => new Set(prev).add(alumniId));
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
          Alumni Network
        </h1>
        <p style={{ fontSize: 14, color: "var(--n-text2)", marginTop: 4, marginBottom: 0 }}>
          {alumni.length} Nivarro alumni — connect, learn, and get mentored.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "mentors"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 0,
              border: filter === f ? "1px solid var(--amber)" : "1px solid var(--border)",
              background: filter === f ? "var(--amber)" : "transparent",
              color: filter === f ? "#000" : "var(--n-text2)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {f === "all" ? "All Alumni" : "Open to Mentor"}
          </button>
        ))}

        {industries.length > 0 && (
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 0,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--n-text2)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            <option value="all">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 && (
        <div style={{ padding: "40px 24px", background: "var(--surface)", borderRadius: 0, border: "1px solid var(--border)", textAlign: "center" }}>
          <GraduationCap size={32} style={{ color: "var(--n-text2)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
            {filter === "mentors" ? "No alumni have opened mentorship yet." : "No alumni found."}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {visible.map((a) => (
          <div
            key={a.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {a.avatarUrl ? (
                <img src={a.avatarUrl} alt={a.displayName} width={44} height={44} style={{ borderRadius: 0, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 0, background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#000", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{a.displayName[0]?.toUpperCase()}</span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.handle ? (
                    <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link>
                  ) : a.displayName}
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  {a.graduationYear && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 3 }}>
                      <GraduationCap size={11} /> {`'${String(a.graduationYear).slice(-2)}`}
                    </span>
                  )}
                  {a.industry && (
                    <span style={{ fontSize: 11, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 3 }}>
                      <Briefcase size={11} /> {a.industry}
                    </span>
                  )}
                </div>
              </div>
              {a.isAvailableToMentor && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "2px 7px", borderRadius: 0, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                  MENTOR
                </span>
              )}
            </div>

            {/* College */}
            {a.intendedCollege && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <BookOpen size={12} style={{ color: "var(--n-text2)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--n-text2)" }}>{a.intendedCollege}</span>
              </div>
            )}

            {/* Orgs */}
            {a.orgs.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {a.orgs.map((org) => (
                  <span
                    key={org}
                    style={{ fontSize: 11, padding: "2px 8px", background: "rgba(232,137,58,0.1)", color: "var(--amber)", borderRadius: 0, fontWeight: 500 }}
                  >
                    {org}
                  </span>
                ))}
              </div>
            )}

            {/* Bio */}
            {a.bio && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--n-text2)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.bio}
              </p>
            )}

            {/* Actions */}
            {a.isAvailableToMentor && (
              <button
                onClick={() => handleMentorRequest(a.id)}
                disabled={requestedIds.has(a.id)}
                style={{
                  marginTop: "auto",
                  padding: "8px 0",
                  borderRadius: 0,
                  border: requestedIds.has(a.id) ? "1px solid rgba(232,137,58,0.4)" : "1px solid var(--amber)",
                  background: requestedIds.has(a.id) ? "rgba(232,137,58,0.1)" : "var(--amber)",
                  color: requestedIds.has(a.id) ? "var(--amber)" : "#000",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: requestedIds.has(a.id) ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                {requestedIds.has(a.id) ? (
                  <><CheckCircle size={14} /> Request Sent</>
                ) : (
                  <><MessageCircle size={14} /> Request Mentorship</>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
