"use client";

import { useState, useMemo } from "react";
import { GraduationCap, MapPin, Users, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

type AlumnusData = {
  id: string;
  name: string | null;
  profile: {
    displayName: string | null;
    handle: string | null;
    headline: string | null;
    industry: string | null;
    graduationYear: number | null;
    intendedCollege: string | null;
    isAvailableToMentor: boolean;
  } | null;
};

interface Props {
  alumni: AlumnusData[];
  currentUserId: string;
  currentUserIsMentor: boolean;
  currentUserIsAlumni: boolean;
}

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, background: "var(--amber)", display: "flex",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontFamily: "var(--font-display)", fontSize: size * 0.35, color: "#000", borderRadius: 0,
    }}>
      {initials}
    </div>
  );
}

export default function AlumniDirectory({ alumni, currentUserId, currentUserIsMentor, currentUserIsAlumni }: Props) {
  const [industryFilter, setIndustryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [mentorOnly, setMentorOnly] = useState(false);
  const [isMentor, setIsMentor] = useState(currentUserIsMentor);
  const [toggling, setToggling] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  // Derive unique filter options from data
  const industries = useMemo(() => {
    const set = new Set<string>();
    alumni.forEach((a) => { if (a.profile?.industry) set.add(a.profile.industry); });
    return Array.from(set).sort();
  }, [alumni]);

  const years = useMemo(() => {
    const set = new Set<number>();
    alumni.forEach((a) => { if (a.profile?.graduationYear) set.add(a.profile.graduationYear); });
    return Array.from(set).sort((a, b) => b - a);
  }, [alumni]);

  const filtered = useMemo(() => {
    return alumni.filter((a) => {
      if (industryFilter !== "all" && a.profile?.industry !== industryFilter) return false;
      if (yearFilter !== "all" && String(a.profile?.graduationYear) !== yearFilter) return false;
      if (mentorOnly && !a.profile?.isAvailableToMentor) return false;
      return true;
    });
  }, [alumni, industryFilter, yearFilter, mentorOnly]);

  async function toggleMentor() {
    setToggling(true);
    const next = !isMentor;
    const res = await fetch("/api/alumni/mentor-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: next }),
    });
    if (res.ok) setIsMentor(next);
    setToggling(false);
  }

  function requestMentorship(id: string) {
    setRequestedIds((prev) => new Set([...prev, id]));
  }

  const selectStyle = {
    background: "var(--surface2)", border: "1px solid var(--border-md)", borderRadius: 0,
    padding: "8px 12px", fontSize: 13, color: "var(--text)", cursor: "pointer",
    fontFamily: "var(--font-mono)", minWidth: 160,
  };

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 36px)",
            letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 4px",
          }}>
            Alumni Network
          </h1>
          <p style={{ fontSize: 14, color: "var(--n-text2)", margin: 0 }}>
            {alumni.length} verified alumni · {alumni.filter((a) => a.profile?.isAvailableToMentor).length} available to mentor
          </p>
        </div>

        {/* Current user mentor toggle */}
        {currentUserIsAlumni && (
          <button
            onClick={toggleMentor}
            disabled={toggling}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: isMentor ? "rgba(232,137,58,0.12)" : "var(--surface)",
              border: `1px solid ${isMentor ? "var(--amber)" : "var(--border-md)"}`,
              borderRadius: 0, padding: "10px 16px", cursor: toggling ? "not-allowed" : "pointer",
              color: isMentor ? "var(--amber)" : "var(--n-text2)", transition: "all 0.15s",
            }}
          >
            {toggling ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isMentor ? (
              <ToggleRight size={20} />
            ) : (
              <ToggleLeft size={20} />
            )}
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {isMentor ? "Available to Mentor" : "Unavailable to Mentor"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--n-muted)" }}>
                {isMentor ? "Students can request mentorship" : "Toggle to open mentorship"}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Industries</option>
          {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
        </select>

        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Years</option>
          {years.map((yr) => <option key={yr} value={String(yr)}>{yr}</option>)}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={mentorOnly}
            onChange={(e) => setMentorOnly(e.target.checked)}
            style={{ accentColor: "var(--amber)", width: 14, height: 14 }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-text2)" }}>
            Mentors only
          </span>
        </label>

        {(industryFilter !== "all" || yearFilter !== "all" || mentorOnly) && (
          <button
            onClick={() => { setIndustryFilter("all"); setYearFilter("all"); setMentorOnly(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--n-muted)", padding: 0 }}
          >
            Clear
          </button>
        )}

        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-muted)", letterSpacing: "0.05em" }}>
          {filtered.length} of {alumni.length}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: "48px 24px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center", borderRadius: 0 }}>
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>No alumni match these filters.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map((alum) => {
            const isMe = alum.id === currentUserId;
            const displayName = alum.profile?.displayName ?? alum.name ?? "Alumni";
            const requested = requestedIds.has(alum.id);
            const canMentor = alum.profile?.isAvailableToMentor;

            return (
              <div
                key={alum.id}
                style={{
                  background: isMe ? "rgba(232,137,58,0.05)" : "var(--surface)",
                  border: `1px solid ${isMe ? "rgba(232,137,58,0.3)" : "var(--border)"}`,
                  borderRadius: 0, padding: 20,
                  display: "flex", flexDirection: "column", gap: 12,
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar name={displayName} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{displayName}</p>
                      {isMe && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", background: "rgba(232,137,58,0.12)", padding: "2px 6px" }}>You</span>
                      )}
                      {canMentor && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "2px 6px" }}>Mentor</span>
                      )}
                    </div>
                    {alum.profile?.headline && (
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--n-text2)", lineHeight: 1.4 }}>{alum.profile.headline}</p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {alum.profile?.graduationYear && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <GraduationCap size={12} color="var(--amber)" />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--n-text2)", letterSpacing: "0.05em" }}>
                        Class of {alum.profile.graduationYear}
                      </span>
                    </div>
                  )}
                  {alum.profile?.industry && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={12} color="var(--n-muted)" />
                      <span style={{ fontSize: 12, color: "var(--n-text2)" }}>{alum.profile.industry}</span>
                    </div>
                  )}
                  {alum.profile?.intendedCollege && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={12} color="var(--n-muted)" />
                      <span style={{ fontSize: 12, color: "var(--n-text2)" }}>{alum.profile.intendedCollege}</span>
                    </div>
                  )}
                </div>

                {/* Request mentorship */}
                {!isMe && canMentor && (
                  <button
                    onClick={() => requestMentorship(alum.id)}
                    disabled={requested}
                    style={{
                      marginTop: "auto", padding: "8px 12px", border: `1px solid ${requested ? "var(--border)" : "var(--amber)"}`,
                      background: requested ? "transparent" : "var(--amber)", color: requested ? "var(--n-muted)" : "#000",
                      borderRadius: 0, cursor: requested ? "default" : "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
                      fontWeight: 700, transition: "all 0.15s",
                    }}
                  >
                    {requested ? "Request Sent" : "Request Mentorship"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
