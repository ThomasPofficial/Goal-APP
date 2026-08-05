"use client";

import { useState } from "react";
import { GraduationCap, Briefcase, BookOpen, MessageCircle, CheckCircle, User } from "lucide-react";
import Link from "next/link";

interface StaffMember {
  userId: string;
  displayName: string;
  staffTitle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  handle: string | null;
  industry: string | null;
}

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
  schoolName: string;
  schoolTagline: string;
  staff: StaffMember[];
  alumni: Alumnus[];
  mentors: Alumnus[];
  currentUserId: string;
  initialRequestedIds: string[];
}

function Avatar({ name, avatarUrl, handle, size = 44 }: { name: string; avatarUrl: string | null; handle?: string | null; size?: number }) {
  const content = avatarUrl ? (
    <img src={avatarUrl} alt={name} width={size} height={size} style={{ borderRadius: 0, objectFit: "cover", flexShrink: 0, display: "block" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 0, background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ color: "#000", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.4 }}>{name[0]?.toUpperCase()}</span>
    </div>
  );
  return handle ? (
    <Link href={`/profile/${handle}`} style={{ flexShrink: 0, lineHeight: 0 }} title={`View ${name}'s profile`}>
      {content}
    </Link>
  ) : content;
}

export default function SchoolHubClient({ schoolName, schoolTagline, staff, alumni, mentors, currentUserId: _, initialRequestedIds }: Props) {
  const [alumniFilter, setAlumniFilter] = useState<"all" | "mentors">("all");
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set(initialRequestedIds));
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const visibleAlumni = alumniFilter === "mentors" ? alumni.filter((a) => a.isAvailableToMentor) : alumni;

  async function requestConnection(toUserId: string) {
    setErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(toUserId);
      return next;
    });
    const res = await fetch("/api/connections/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId }),
    });
    if (res.ok || res.status === 409) {
      // 409 = a request already exists between this pair — treat as sent.
      setRequestedIds((prev) => new Set(prev).add(toUserId));
    } else {
      setErrorIds((prev) => new Set(prev).add(toUserId));
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>

      {/* School banner */}
      <div style={{ padding: "32px 36px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, marginBottom: 24 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 8px" }}>
          Private Community
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 46px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px", lineHeight: 1.05 }}>
          {schoolName}
        </h1>
        <p style={{ fontSize: 16, color: "var(--n-text2)", margin: 0 }}>{schoolTagline}</p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "Alumni", value: alumni.length },
          { label: "Mentors", value: mentors.length },
          { label: "Staff", value: staff.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: "1 1 100px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "12px 18px" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 36, color: "var(--amber)", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
            <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--n-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Staff */}
      {staff.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            School Staff
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {staff.map((s) => (
              <div key={s.userId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar name={s.displayName} avatarUrl={s.avatarUrl} handle={s.handle} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--text)" }}>
                    {s.handle ? (
                      <Link href={`/profile/${s.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{s.displayName}</Link>
                    ) : s.displayName}
                  </p>
                  {s.staffTitle && (
                    <p style={{ margin: "3px 0 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber)" }}>
                      {s.staffTitle}
                    </p>
                  )}
                  {s.bio && (
                    <p style={{ margin: "7px 0 0", fontSize: 13, color: "var(--n-text2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.bio}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => requestConnection(s.userId)}
                  disabled={requestedIds.has(s.userId)}
                  title={requestedIds.has(s.userId) ? "Request sent" : "Message privately"}
                  style={{
                    width: 28, height: 28, borderRadius: 0, border: "1px solid var(--amber)",
                    background: requestedIds.has(s.userId) ? "rgba(232,137,58,0.1)" : "var(--amber)",
                    color: requestedIds.has(s.userId) ? "var(--amber)" : "#000",
                    cursor: requestedIds.has(s.userId) ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {requestedIds.has(s.userId) ? <CheckCircle size={12} /> : <MessageCircle size={12} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mentors spotlight */}
      {mentors.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 14px" }}>
            Mentor Spotlight
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {mentors.map((m) => (
              <MentorCard key={m.id} alumnus={m} requestedIds={requestedIds} errorIds={errorIds} onRequest={requestConnection} />
            ))}
          </div>
        </section>
      )}

      {/* Alumni network */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
            Alumni Network
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "mentors"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAlumniFilter(f)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 0,
                  border: alumniFilter === f ? "1px solid var(--amber)" : "1px solid var(--border)",
                  background: alumniFilter === f ? "var(--amber)" : "transparent",
                  color: alumniFilter === f ? "#000" : "var(--n-text2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "All" : "Mentors"}
              </button>
            ))}
          </div>
        </div>

        {visibleAlumni.length === 0 ? (
          <div style={{ padding: "32px 24px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 0, textAlign: "center" }}>
            <GraduationCap size={28} style={{ color: "var(--n-text2)", margin: "0 auto 10px" }} />
            <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
              {alumniFilter === "mentors" ? "No alumni have opened mentorship yet." : "No alumni yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {visibleAlumni.map((a) => (
              <AlumnusCard key={a.id} alumnus={a} requestedIds={requestedIds} onRequest={requestConnection} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MentorCard({ alumnus: a, requestedIds, errorIds, onRequest }: { alumnus: Alumnus; requestedIds: Set<string>; errorIds: Set<string>; onRequest: (id: string) => void }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Avatar name={a.displayName} avatarUrl={a.avatarUrl} handle={a.handle} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: "var(--text)" }}>
            {a.handle ? <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link> : a.displayName}
          </p>
          <div style={{ display: "flex", gap: 7, marginTop: 3, flexWrap: "wrap" }}>
            {a.graduationYear && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
                <GraduationCap size={10} /> {`'${String(a.graduationYear).slice(-2)}`}
              </span>
            )}
            {a.industry && (
              <span style={{ fontSize: 12, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 2 }}>
                <Briefcase size={10} /> {a.industry}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "2px 6px", borderRadius: 0, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
          MENTOR
        </span>
      </div>
      {a.bio && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--n-text2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {a.bio}
        </p>
      )}
      <button
        onClick={() => onRequest(a.id)}
        disabled={requestedIds.has(a.id)}
        style={{
          padding: "8px 0",
          borderRadius: 0,
          border: requestedIds.has(a.id) ? "1px solid rgba(232,137,58,0.4)" : "1px solid var(--amber)",
          background: requestedIds.has(a.id) ? "rgba(232,137,58,0.1)" : "var(--amber)",
          color: requestedIds.has(a.id) ? "var(--amber)" : "#000",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: requestedIds.has(a.id) ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          transition: "all 0.15s",
          marginTop: "auto",
        }}
      >
        {requestedIds.has(a.id) ? <><CheckCircle size={13} /> Sent</> : <><MessageCircle size={13} /> Request Mentorship</>}
      </button>
      {errorIds.has(a.id) && (
        <p style={{ margin: 0, fontSize: 11, color: "#f87171" }}>Couldn&apos;t send that request. Try again.</p>
      )}
    </div>
  );
}

function AlumnusCard({ alumnus: a, requestedIds, onRequest }: { alumnus: Alumnus; requestedIds: Set<string>; onRequest: (id: string) => void }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, padding: "15px 17px", display: "flex", gap: 11, alignItems: "flex-start" }}>
      <Avatar name={a.displayName} avatarUrl={a.avatarUrl} handle={a.handle} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.handle ? <Link href={`/profile/${a.handle}`} style={{ color: "inherit", textDecoration: "none" }}>{a.displayName}</Link> : a.displayName}
        </p>
        <div style={{ display: "flex", gap: 9, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
          {a.graduationYear && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
              <GraduationCap size={10} /> {`'${String(a.graduationYear).slice(-2)}`}
            </span>
          )}
          {a.industry && (
            <span style={{ fontSize: 12, color: "var(--n-text2)" }}>{a.industry}</span>
          )}
          {a.intendedCollege && (
            <span style={{ fontSize: 12, color: "var(--n-text2)", display: "flex", alignItems: "center", gap: 2 }}>
              <BookOpen size={10} /> {a.intendedCollege.split(" ").slice(0, 2).join(" ")}
            </span>
          )}
          {a.isAvailableToMentor && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", background: "rgba(232,137,58,0.15)", padding: "1px 5px", letterSpacing: "0.08em" }}>
              MENTOR
            </span>
          )}
        </div>
      </div>
      {a.isAvailableToMentor && (
        <button
          onClick={() => onRequest(a.id)}
          disabled={requestedIds.has(a.id)}
          title={requestedIds.has(a.id) ? "Request sent" : "Message privately"}
          style={{
            width: 28, height: 28, borderRadius: 0, border: "1px solid var(--amber)",
            background: requestedIds.has(a.id) ? "rgba(232,137,58,0.1)" : "var(--amber)",
            color: requestedIds.has(a.id) ? "var(--amber)" : "#000",
            cursor: requestedIds.has(a.id) ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {requestedIds.has(a.id) ? <CheckCircle size={12} /> : <MessageCircle size={12} />}
        </button>
      )}
    </div>
  );
}
