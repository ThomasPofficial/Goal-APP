"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Row {
  id: string;
  createdAt: string;
  respondedAt: string | null;
  roomId: string | null;
  fromUser: UserSummary;
  toUser: UserSummary;
}

interface Props {
  queue: Row[];
  history: Row[];
}

export default function ConnectionsClient({ queue, history }: Props) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/school/connections/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create room.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
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
          Connections
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          Students and alumni requested a private chat with a mentor or staff member — approve to create the room.
        </p>
      </div>

      {error && (
        <p style={{ color: "#e05", fontSize: 13, margin: "0 0 12px", fontFamily: "var(--font-mono)" }}>
          {error}
        </p>
      )}

      {/* Approval queue */}
      {queue.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "48px 32px",
            textAlign: "center",
            borderRadius: 0,
            marginBottom: 32,
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            No connection requests waiting on approval right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {queue.map((r) => (
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
              <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>
                <strong>{r.fromUser.displayName}</strong> wants to connect with{" "}
                <strong>{r.toUser.displayName}</strong>
              </p>
              <button
                onClick={() => handleApprove(r.id)}
                disabled={approvingId === r.id}
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
          ))}
        </div>
      )}

      {/* History */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--amber)",
          margin: "0 0 14px",
        }}
      >
        History
      </p>
      {history.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>No approved connections yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((r) => (
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
                  Open Room
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
