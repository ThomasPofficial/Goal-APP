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
  name: string | null;
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

interface UserSummary {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}

type PartnershipStatus = "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED_EMPTY";

interface InviteeStatus extends UserSummary {
  status: "PENDING" | "ACCEPTED" | "DECLINED";
}

interface PartnershipRequestRow {
  id: string;
  status: PartnershipStatus;
  createdAt: string;
  finalizedAt: string | null;
  roomId: string | null;
  message: string | null;
  fromUser: UserSummary;
  acceptedInvitees: UserSummary[];
  otherInvitees: InviteeStatus[];
}

// Still-live 1:1 ConnectionRequest model (used by the separate /alumni
// directory flow, which sends requests via POST /api/connections/request).
// /school/partnerships is now the only admin page that can approve these,
// so this queue coexists alongside the new group-partnership queue below.
interface ConnectionRequestRow {
  id: string;
  createdAt: string;
  respondedAt: string | null;
  roomId: string | null;
  message: string | null;
  fromUser: UserSummary;
  toUser: UserSummary;
}

function historyStatusLabel(status: PartnershipStatus): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Declined";
    case "EXPIRED_EMPTY":
      return "Expired — nobody eligible accepted";
    default:
      return status;
  }
}

interface Props {
  pairings: Pairing[];
  students: StudentOption[];
  mentors: MentorOption[];
  requestQueue: PartnershipRequestRow[];
  requestHistory: PartnershipRequestRow[];
  connectionRequestQueue: ConnectionRequestRow[];
  connectionRequestHistory: ConnectionRequestRow[];
  canViewMentorship: boolean;
  canEditMentorship: boolean;
  canViewPartnerships: boolean;
  canEditPartnerships: boolean;
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

export default function SchoolPartnershipsClient({
  pairings,
  students,
  mentors,
  requestQueue,
  requestHistory,
  connectionRequestQueue,
  connectionRequestHistory,
  canViewMentorship,
  canEditMentorship,
  canViewPartnerships,
  canEditPartnerships,
}: Props) {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedMentors, setSelectedMentors] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [connectionApprovingId, setConnectionApprovingId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleApproveRequest = async (id: string) => {
    setApprovingId(id);
    setRequestError(null);
    try {
      const res = await fetch(`/api/school/partnerships/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error ?? "Failed to create room.");
        return;
      }
      router.refresh();
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectRequest = async (id: string) => {
    setRejectingId(id);
    setRequestError(null);
    try {
      const res = await fetch(`/api/school/partnerships/${id}/reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error ?? "Failed to decline.");
        return;
      }
      router.refresh();
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setRejectingId(null);
    }
  };

  const handleApproveConnectionRequest = async (id: string) => {
    setConnectionApprovingId(id);
    setConnectionError(null);
    try {
      const res = await fetch(`/api/school/connections/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setConnectionError(data.error ?? "Failed to create room.");
        return;
      }
      router.refresh();
    } catch {
      setConnectionError("Network error. Please try again.");
    } finally {
      setConnectionApprovingId(null);
    }
  };

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
      {/* Header — shown regardless of which of mentorship/partnerships this viewer has,
          since the page itself is only reachable with at least one of the two. */}
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
            Partnerships
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
            Pair students with mentors yourself into a dedicated group chat,
            or approve partnership requests students sent on their own below.
          </p>
        </div>
        {canEditMentorship && (
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
        )}
      </div>

      {canViewMentorship && (
      <>
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
              {p.name && (
                <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{p.name}</p>
              )}
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
      </>
      )}

      {canViewPartnerships && (
      <>
      {/* 1:1 Mentorship Requests */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--amber)",
          margin: "32px 0 14px",
        }}
      >
        1:1 Mentorship Requests
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
        A student or alum asked to chat 1:1 with a specific mentor or staff member — approve to create the room.
      </p>

      {connectionError && (
        <p style={{ color: "#e05", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
          {connectionError}
        </p>
      )}

      {connectionRequestQueue.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "24px 18px",
            textAlign: "center",
            borderRadius: 0,
            marginBottom: 24,
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            No 1:1 connection requests waiting on approval right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {connectionRequestQueue.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "16px 18px",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                  <strong>{r.fromUser.displayName}</strong> wants to connect with{" "}
                  <strong>{r.toUser.displayName}</strong>
                </p>
                {r.message && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
                    &ldquo;{r.message}&rdquo;
                  </p>
                )}
              </div>
              {canEditPartnerships && (
              <button
                onClick={() => handleApproveConnectionRequest(r.id)}
                disabled={connectionApprovingId === r.id}
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
                  cursor: connectionApprovingId === r.id ? "not-allowed" : "pointer",
                  opacity: connectionApprovingId === r.id ? 0.6 : 1,
                  borderRadius: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {connectionApprovingId === r.id ? "Creating…" : "Create Room"}
              </button>
              )}
            </div>
          ))}
        </div>
      )}

      {connectionRequestHistory.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {connectionRequestHistory.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "12px 16px",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                {r.fromUser.displayName} &harr; {r.toUser.displayName}
              </p>
              {r.roomId && (
                <Link
                  href={`/messages?group=${r.roomId}`}
                  style={{
                    padding: "5px 12px",
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* Partnership Requests */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--amber)",
          margin: "32px 0 14px",
        }}
      >
        Partnership Requests
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
        A student requested a group partnership and at least one eligible alumni/staff member accepted — approve to create the group chat.
      </p>

      {requestError && (
        <p style={{ color: "#e05", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
          {requestError}
        </p>
      )}

      {requestQueue.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "24px 18px",
            textAlign: "center",
            borderRadius: 0,
            marginBottom: 24,
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            No partnership requests waiting on approval right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {requestQueue.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "16px 18px",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                  <strong>{r.fromUser.displayName}</strong> wants to partner with{" "}
                  <strong>{r.acceptedInvitees.map((u) => u.displayName).join(", ")}</strong>
                </p>
                {r.otherInvitees.length > 0 && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    Also invited (not joining): {r.otherInvitees.map((u) => `${u.displayName} (${u.status.toLowerCase()})`).join(", ")}
                  </p>
                )}
                {r.message && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
                    &ldquo;{r.message}&rdquo;
                  </p>
                )}
              </div>
              {canEditPartnerships && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleRejectRequest(r.id)}
                  disabled={approvingId === r.id || rejectingId === r.id}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#ef4444",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: rejectingId === r.id ? "not-allowed" : "pointer",
                    opacity: rejectingId === r.id ? 0.6 : 1,
                    borderRadius: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {rejectingId === r.id ? "Declining…" : "Decline"}
                </button>
                <button
                  onClick={() => handleApproveRequest(r.id)}
                  disabled={approvingId === r.id || rejectingId === r.id}
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
                    cursor: approvingId === r.id ? "not-allowed" : "pointer",
                    opacity: approvingId === r.id ? 0.6 : 1,
                    borderRadius: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {approvingId === r.id ? "Creating…" : "Create Room"}
                </button>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {requestHistory.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requestHistory.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "12px 16px",
                borderRadius: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text)" }}>
                  {r.fromUser.displayName} &harr; {r.acceptedInvitees.map((u) => u.displayName).join(", ") || "(nobody)"}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{historyStatusLabel(r.status)}</p>
              </div>
              {r.roomId && (
                <Link
                  href={`/messages?group=${r.roomId}`}
                  style={{
                    padding: "5px 12px",
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
              )}
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* New Pairing Modal */}
      {canEditMentorship && showNewModal && (
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
              New Direct Pairing
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
                {selectedStudents.size > 0 && ` · ${selectedStudents.size} selected`}
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
                {selectedMentors.size > 0 && ` · ${selectedMentors.size} selected`}
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
