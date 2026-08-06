"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, Send, Check, X } from "lucide-react";

interface Person {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
}

interface IncomingRequest {
  id: string;
  message: string | null;
  createdAt: string;
  fromUser: Person;
}

interface Thread {
  id: string;
  otherParticipants: Person[];
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string | null };
}

function threadLabel(thread: Thread): string {
  if (thread.otherParticipants.length === 0) return "Mentorship";
  return thread.otherParticipants.map((p) => p.displayName).join(", ");
}

export default function MentorshipClient({ myUserId, incomingRequests = [] }: { myUserId: string; incomingRequests?: IncomingRequest[] }) {
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("conversation");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<IncomingRequest[]>(incomingRequests);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function respond(id: string, action: "accept" | "decline") {
    setRespondingId(id);
    const res = await fetch(`/api/connections/${id}/respond`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setRespondingId(null);
  }

  useEffect(() => {
    fetch("/api/mentorship/my-threads")
      .then((r) => r.json())
      .then((data) => {
        const loadedThreads: Thread[] = data.threads ?? [];
        setThreads(loadedThreads);
        const wanted = requestedThreadId && loadedThreads.some((t) => t.id === requestedThreadId)
          ? requestedThreadId
          : loadedThreads[0]?.id ?? null;
        setActiveId(wanted);
        setLoading(false);
      });
  }, [requestedThreadId]);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/conversations/${activeId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
  }, [activeId]);

  async function send() {
    if (!activeId || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (res.ok) setMessages((prev) => [...prev, data.message]);
  }

  const requestsPanel = requests.length > 0 && (
    <div style={{ maxWidth: 900, marginBottom: 20, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <p style={{ margin: 0, padding: "12px 16px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)" }}>
        Incoming Requests
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {requests.map((r) => (
          <div
            key={r.id}
            style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{r.fromUser.displayName}</p>
              {r.message && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--n-text2)", lineHeight: 1.5 }}>{r.message}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => respond(r.id, "accept")}
                disabled={respondingId === r.id}
                title="Accept"
                style={{ width: 30, height: 30, border: "1px solid var(--amber)", background: "var(--amber)", color: "#000", cursor: respondingId === r.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => respond(r.id, "decline")}
                disabled={respondingId === r.id}
                title="Decline"
                style={{ width: 30, height: 30, border: "1px solid var(--border-md)", background: "transparent", color: "var(--n-text2)", cursor: respondingId === r.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div>
        {requestsPanel}
        <p style={{ color: "var(--n-text2)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div>
        {requestsPanel}
        <div style={{ maxWidth: 600, padding: "40px 32px", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
          <HeartHandshake size={28} style={{ color: "var(--n-text2)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
            You haven&apos;t been paired with a mentor yet. Your school admin sets up mentorship groups.
          </p>
        </div>
      </div>
    );
  }

  const active = threads.find((t) => t.id === activeId);

  return (
    <div>
      {requestsPanel}
      <div style={{ display: "flex", gap: 16, maxWidth: 900, height: "70vh" }}>
      <div style={{ width: 220, flexShrink: 0, border: "1px solid var(--border)", background: "var(--surface)", overflowY: "auto" }}>
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
              background: t.id === activeId ? "rgba(232,137,58,0.12)" : "transparent",
              border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
              color: "var(--text)", fontSize: 13,
            }}
          >
            {threadLabel(t)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
          {active ? threadLabel(active) : "Mentorship"}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender.id === myUserId ? "flex-end" : "flex-start",
                maxWidth: "70%", padding: "8px 12px",
                background: m.sender.id === myUserId ? "var(--amber)" : "var(--bg)",
                color: m.sender.id === myUserId ? "#000" : "var(--text)",
                fontSize: 13, border: "1px solid var(--border)",
              }}
            >
              {m.content}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message…"
            style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <button onClick={send} style={{ padding: "8px 14px", background: "var(--amber)", border: "none", color: "#000", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Send size={14} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
