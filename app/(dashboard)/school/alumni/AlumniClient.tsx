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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.03em" }}>
          Alumni Network
        </h1>
        <p style={{ fontSize: 14, color: "var(--text2)", marginTop: 4, marginBottom: 0 }}>
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
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: filter === f ? "var(--blue)" : "transparent",
              color: filter === f ? "#fff" : "var(--text2)",
              fontSize: 13,
              fontWeight: 600,
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
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: "var(--n-bg2)",
              color: "var(--text2)",
              fontSize: 13,
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
        <div style={{ padding: "40px 24px", background: "var(--n-bg2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "center" }}>
          <GraduationCap size={32} style={{ color: "var(--text2)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text2)", fontSize: 14, margin: 0 }}>
            {filter === "mentors" ? "No alumni have opened mentorship yet." : "No alumni found."}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {visible.map((a) => (
          <div
            key={a.id}
            style={{
              background: "var(--n-bg2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {a.avatarUrl ? (
                <img src={a.avatarUrl} alt={a.displayName} width={44} height={44} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{a.displayName[0]?.toUpperCase()}</span>
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
                    <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                      <GraduationCap size={11} /> {`'${String(a.graduationYear).slice(-2)}`}
                    </span>
                  )}
                  {a.industry && (
                    <span style={{ fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center", gap: 3 }}>
                      <Briefcase size={11} /> {a.industry}
                    </span>
                  )}
                </div>
              </div>
              {a.isAvailableToMentor && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                  MENTOR
                </span>
              )}
            </div>

            {/* College */}
            {a.intendedCollege && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <BookOpen size={12} style={{ color: "var(--text2)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text2)" }}>{a.intendedCollege}</span>
              </div>
            )}

            {/* Orgs */}
            {a.orgs.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {a.orgs.map((org) => (
                  <span
                    key={org}
                    style={{ fontSize: 11, padding: "2px 8px", background: "rgba(74,128,240,0.1)", color: "var(--blue)", borderRadius: 8, fontWeight: 500 }}
                  >
                    {org}
                  </span>
                ))}
              </div>
            )}

            {/* Bio */}
            {a.bio && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text2)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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
                  borderRadius: 8,
                  border: requestedIds.has(a.id) ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--blue)",
                  background: requestedIds.has(a.id) ? "rgba(34,197,94,0.1)" : "var(--blue)",
                  color: requestedIds.has(a.id) ? "#22c55e" : "#fff",
                  fontSize: 13,
                  fontWeight: 600,
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
