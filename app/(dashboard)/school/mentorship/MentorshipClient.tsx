"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Participant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isStaff: boolean;
}

interface Pairing {
  id: string;
  createdAt: string;
  participants: Participant[];
  lastMessage: { body: string; createdAt: string } | null;
}

interface StudentOption {
  userId: string;
  displayName: string;
  graduationYear: number | null;
}

interface MentorOption {
  userId: string;
  displayName: string;
  kind: "ALUMNI" | "STAFF";
  subtitle: string | null;
}

interface Props {
  pairings: Pairing[];
  students: StudentOption[];
  mentors: MentorOption[];
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  marginBottom: 6,
  textTransform: "uppercase",
};

const filterInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  marginBottom: 8,
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 0,
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
};

const countCaptionStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  marginBottom: 6,
  display: "block",
};

export default function MentorshipClient({ pairings, students, mentors }: Props) {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedMentors, setSelectedMentors] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");

  const resetModal = () => {
    setSelectedStudents(new Set());
    setSelectedMentors(new Set());
    setStudentFilter("");
    setMentorFilter("");
    setCreateError(null);
    setCreating(false);
  };

  const filteredStudents = students.filter((s) =>
    s.displayName.toLowerCase().includes(studentFilter.trim().toLowerCase())
  );
  const filteredMentors = mentors.filter((m) =>
    m.displayName.toLowerCase().includes(mentorFilter.trim().toLowerCase())
  );

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleCreate = async () => {
    if (selectedStudents.size === 0 || selectedMentors.size === 0) {
      setCreateError("Select at least one student and one mentor.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/school/mentorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [...selectedStudents],
          mentorIds: [...selectedMentors],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create pairing.");
        setCreating(false);
        return;
      }
      setShowNewModal(false);
      resetModal();
      router.refresh();
    } catch {
      setCreateError("Network error. Please try again.");
      setCreating(false);
    }
  };

  const handleEnd = async (id: string) => {
    const confirmed = window.confirm("End this mentorship pairing? The chat will be deleted.");
    if (!confirmed) return;
    setEndingId(id);
    try {
      const res = await fetch(`/api/school/mentorship/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setEndingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "0.01em",
            }}
          >
            Mentorship
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
            Pair students with teacher or alumni mentors in a dedicated group chat, yourself.
            Looking for 1:1 requests students sent on their own?{" "}
            <Link href="/school/connections" style={{ color: "var(--amber)" }}>Chat Requests</Link>.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          disabled={students.length === 0 || mentors.length === 0}
          title={students.length === 0 || mentors.length === 0 ? "Add students and mentors via Roster first" : undefined}
          style={{
            padding: "8px 16px",
            background: "var(--amber)",
            border: "1px solid var(--amber)",
            color: "#000",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: students.length === 0 || mentors.length === 0 ? "not-allowed" : "pointer",
            opacity: students.length === 0 || mentors.length === 0 ? 0.5 : 1,
            borderRadius: 0,
            whiteSpace: "nowrap",
          }}
        >
          + New Pairing
        </button>
      </div>

      {/* Empty state */}
      {pairings.length === 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "48px 32px",
            textAlign: "center",
            borderRadius: 0,
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            No mentorship pairings yet. Create one with the button above.
          </p>
        </div>
      )}

      {/* Pairing list */}
      {pairings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pairings.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "16px 18px",
                borderRadius: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.participants.map((participant) => (
                    <span
                      key={participant.userId}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text)",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        padding: "3px 10px",
                      }}
                    >
                      {participant.displayName}
                      {participant.isStaff && (
                        <span style={{ color: "var(--amber)", marginLeft: 4, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                          STAFF
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Link
                    href={`/messages?group=${p.id}`}
                    style={{
                      padding: "6px 14px",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open Chat
                  </Link>
                  <button
                    onClick={() => handleEnd(p.id)}
                    disabled={endingId === p.id}
                    style={{
                      padding: "6px 14px",
                      background: "transparent",
                      border: `1px solid ${endingId === p.id ? "var(--border)" : "rgba(239,68,68,0.4)"}`,
                      color: endingId === p.id ? "var(--muted)" : "#ef4444",
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: endingId === p.id ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {endingId === p.id ? "Ending…" : "End"}
                  </button>
                </div>
              </div>
              {p.lastMessage ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.lastMessage.body}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>No messages yet.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Pairing Modal */}
      {showNewModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewModal(false);
              resetModal();
            }
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              padding: 28,
              width: "100%",
              maxWidth: 560,
              position: "relative",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => { setShowNewModal(false); resetModal(); }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 22,
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>

            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 700,
                margin: "0 0 20px",
                color: "var(--text)",
              }}
            >
              New Mentorship Pairing
            </h2>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Students</label>
              <input
                type="text"
                placeholder="Filter students…"
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                style={filterInputStyle}
              />
              <span style={countCaptionStyle}>
                {studentFilter.trim()
                  ? `${filteredStudents.length} of ${students.length} students`
                  : `${students.length} student${students.length === 1 ? "" : "s"}`}
              </span>
              <div style={{ border: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
                {filteredStudents.length === 0 && (
                  <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                    No students match &quot;{studentFilter}&quot;.
                  </p>
                )}
                {filteredStudents.map((s) => (
                  <label
                    key={s.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--text)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.has(s.userId)}
                      onChange={() => toggle(selectedStudents, setSelectedStudents, s.userId)}
                      style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                    />
                    {s.displayName}
                    {s.graduationYear && (
                      <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: "auto" }}>
                        Class of {s.graduationYear}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Mentors</label>
              <input
                type="text"
                placeholder="Filter mentors…"
                value={mentorFilter}
                onChange={(e) => setMentorFilter(e.target.value)}
                style={filterInputStyle}
              />
              <span style={countCaptionStyle}>
                {mentorFilter.trim()
                  ? `${filteredMentors.length} of ${mentors.length} mentors`
                  : `${mentors.length} mentor${mentors.length === 1 ? "" : "s"}`}
              </span>
              <div style={{ border: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
                {filteredMentors.length === 0 && (
                  <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                    No mentors match &quot;{mentorFilter}&quot;.
                  </p>
                )}
                {filteredMentors.map((m) => (
                  <label
                    key={m.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--text)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMentors.has(m.userId)}
                      onChange={() => toggle(selectedMentors, setSelectedMentors, m.userId)}
                      style={{ accentColor: "var(--amber)", cursor: "pointer" }}
                    />
                    {m.displayName}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--amber)",
                        marginLeft: "auto",
                      }}
                    >
                      {m.kind}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {createError && (
              <p style={{ color: "#e05", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
                {createError}
              </p>
            )}

            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                width: "100%",
                padding: "10px 0",
                background: "var(--amber)",
                border: "1px solid var(--amber)",
                color: "#000",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: creating ? "not-allowed" : "pointer",
                borderRadius: 0,
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? "Creating…" : "Create Pairing"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
