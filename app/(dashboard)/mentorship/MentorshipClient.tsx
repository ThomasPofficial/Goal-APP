"use client";

import { useEffect, useState } from "react";
import { HeartHandshake, Send } from "lucide-react";

interface Person {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
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

interface Idea {
  id: string;
  content: string;
  colorIndex: number;
  createdAt: string;
  author: { id: string; displayName: string };
}

const NOTE_COLORS = ["#f5d76e", "#f4a259", "#e8895a", "#8ecae6", "#b8e0d2"];

function noteRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return (hash % 7) - 3; // -3deg..3deg
}

export default function MentorshipClient({ myUserId }: { myUserId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"chat" | "ideas">("chat");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaDraft, setIdeaDraft] = useState("");
  const [postingIdea, setPostingIdea] = useState(false);

  useEffect(() => {
    fetch("/api/mentorship/my-threads")
      .then((r) => r.json())
      .then((data) => {
        setThreads(data.threads ?? []);
        setActiveId(data.threads?.[0]?.id ?? null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/conversations/${activeId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []));
  }, [activeId]);

  useEffect(() => {
    if (!activeId || tab !== "ideas") return;
    fetch(`/api/mentorship/${activeId}/ideas`)
      .then((r) => r.json())
      .then((data) => setIdeas(data.ideas ?? []));
  }, [activeId, tab]);

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

  async function postIdea() {
    if (!activeId || !ideaDraft.trim()) return;
    setPostingIdea(true);
    const res = await fetch(`/api/mentorship/${activeId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: ideaDraft.trim() }),
    });
    const data = await res.json();
    setPostingIdea(false);
    if (res.ok) {
      setIdeas((prev) => [...prev, data.idea]);
      setIdeaDraft("");
    }
  }

  async function deleteIdea(id: string) {
    if (!activeId) return;
    const res = await fetch(`/api/mentorship/${activeId}/ideas/${id}`, { method: "DELETE" });
    if (res.ok) setIdeas((prev) => prev.filter((n) => n.id !== id));
  }

  if (loading) {
    return <p style={{ color: "var(--n-text2)", fontSize: 14 }}>Loading…</p>;
  }

  if (threads.length === 0) {
    return (
      <div style={{ maxWidth: 600, padding: "40px 32px", border: "1px solid var(--border)", background: "var(--surface)", textAlign: "center" }}>
        <HeartHandshake size={28} style={{ color: "var(--n-text2)", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--n-text2)", fontSize: 14, margin: 0 }}>
          You haven&apos;t been paired with a mentor yet. Your school admin sets up mentorship groups.
        </p>
      </div>
    );
  }

  const active = threads.find((t) => t.id === activeId);

  return (
    <div style={{ display: "flex", gap: 16, maxWidth: 900, height: "70vh" }}>
      <div style={{ width: 220, flexShrink: 0, border: "1px solid var(--border)", background: "var(--surface)", overflowY: "auto" }}>
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveId(t.id);
              setTab("chat");
            }}
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
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {active ? threadLabel(active) : "Mentorship"}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {(["chat", "ideas"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "4px 10px", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase",
                  letterSpacing: "0.06em", border: "1px solid var(--border)", cursor: "pointer",
                  background: tab === t ? "var(--amber)" : "transparent",
                  color: tab === t ? "#000" : "var(--text)",
                }}
              >
                {t === "chat" ? "Chat" : "Idea Board"}
              </button>
            ))}
          </div>
        </div>

        {tab === "chat" && (
          <>
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
          </>
        )}

        {tab === "ideas" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={ideaDraft}
                onChange={(e) => setIdeaDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postIdea()}
                placeholder="Pin an idea…"
                maxLength={280}
                style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
              <button
                onClick={postIdea}
                disabled={postingIdea || !ideaDraft.trim()}
                style={{ padding: "8px 14px", background: "var(--amber)", border: "none", color: "#000", cursor: postingIdea ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}
              >
                Pin idea
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {ideas.map((n) => (
                <div
                  key={n.id}
                  className="idea-note-pop"
                  style={{
                    width: 180, minHeight: 140, padding: 14, background: NOTE_COLORS[n.colorIndex % NOTE_COLORS.length],
                    color: "#1a1500", boxShadow: "2px 3px 8px rgba(0,0,0,0.25)", position: "relative",
                    transform: `rotate(${noteRotation(n.id)}deg)`, fontSize: 13, display: "flex", flexDirection: "column", gap: 8,
                    ["--note-rot" as string]: `${noteRotation(n.id)}deg`,
                  } as React.CSSProperties}
                >
                  <p style={{ margin: 0, flex: 1, wordBreak: "break-word" }}>{n.content}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, opacity: 0.75 }}>
                    <span>{n.author.displayName}</span>
                    {n.author.id === myUserId && (
                      <button
                        onClick={() => deleteIdea(n.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#1a1500", fontSize: 10, padding: 0 }}
                      >
                        remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {ideas.length === 0 && (
                <p style={{ color: "var(--n-text2)", fontSize: 13 }}>No ideas pinned yet — add the first one above.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
