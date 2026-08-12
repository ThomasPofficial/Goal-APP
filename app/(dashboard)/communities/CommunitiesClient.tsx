"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSocket } from "@/lib/socket";
import { Send, Copy, Check, Pencil, Trash2 } from "lucide-react";

interface RoomSummary {
  id: string;
  communityName: string | null;
  isPrivateRoom: boolean;
  memberCount: number;
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
  schoolName: string | null;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { name: string | null; image: string | null };
}

interface Props {
  schoolId: string | null;
  myUserId: string;
  isAdmin: boolean;
  initialRooms: RoomSummary[];
  schoolCode: string | null;
}

// ── School Code Gate ──────────────────────────────────────────────────────────

function SchoolCodeGate({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/communities/enter-school-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Invalid code"); return; }
      onJoined();
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh", gap: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 10px" }}>
          School Community
        </p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Enter your school code
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 28px", lineHeight: 1.6 }}>
          {"Your school admin will give you a code. Once you enter it, you'll be added to your school's private community."}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. lakewood2026"
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 10, fontSize: 14,
              background: "var(--surface)", border: "1px solid var(--border-md)",
              color: "var(--text)", fontFamily: "var(--font-mono)", outline: "none",
            }}
          />
          <button
            onClick={submit}
            disabled={loading || !code.trim()}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "var(--amber)", color: "#04070F", border: "none", cursor: "pointer",
              letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-display)",
              opacity: loading || !code.trim() ? 0.5 : 1,
            }}
          >
            {loading ? "…" : "Join"}
          </button>
        </div>
        {error && <p style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Admin Code Panel ─────────────────────────────────────────────────────────

function AdminCodePanel({ initialCode }: { initialCode: string | null }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [editing, setEditing] = useState(!initialCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = async () => {
    if (!code.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/communities/school-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: code.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setEditing(false);
    } finally { setSaving(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: "8px 20px", background: "rgba(0,0,0,0.15)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", margin: 0, flexShrink: 0 }}>
        Invite code
      </p>
      {editing ? (
        <>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="e.g. westsideacademy2026"
            style={{ fontSize: 13, padding: "4px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", fontFamily: "var(--font-mono)", outline: "none", width: 200 }}
            autoFocus
          />
          <button
            onClick={save}
            disabled={!code.trim() || saving}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: "var(--amber)", color: "#04070F", border: "none", cursor: "pointer", fontWeight: 700, opacity: !code.trim() || saving ? 0.5 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {error && <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>}
        </>
      ) : (
        <>
          <code style={{ fontSize: 13, padding: "3px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", fontFamily: "var(--font-mono)" }}>
            {code}
          </code>
          <button onClick={copy} title="Copy code" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}>
            {copied ? <Check style={{ width: 14, height: 14, color: "var(--amber)" }} /> : <Copy style={{ width: 14, height: 14 }} />}
          </button>
          <button onClick={() => setEditing(true)} title="Edit code" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}>
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Share this with your students to add them</span>
        </>
      )}
    </div>
  );
}

// ── Main Chat ─────────────────────────────────────────────────────────────────

export default function CommunitiesClient({ schoolId, myUserId, isAdmin, initialRooms, schoolCode }: Props) {
  const socket = useSocket();
  const searchParams = useSearchParams();
  const requestedRoomId = searchParams.get("conversation");
  const generalRooms = initialRooms.filter((r) => !r.isPrivateRoom);
  const generalRoom = generalRooms[0] ?? null;
  const activeRoom =
    (requestedRoomId && initialRooms.find((r) => r.id === requestedRoomId)) || generalRoom;
  const roomId = activeRoom?.id ?? null;
  // Gate on the SET of general rooms (a property independent of which room
  // happens to be active), not on otherGeneralRooms.length — the active room
  // can be a private/group room (e.g. reached via a notification link into a
  // private room), in which case it matches none of the general rooms and
  // otherGeneralRooms would wrongly include ALL of them, even for
  // single-school users.
  const showSwitcher = generalRooms.length > 1;
  const otherGeneralRooms = generalRooms.filter((r) => r.id !== roomId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(isAdmin || !!schoolId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (id: string) => {
    setLoading(true);
    try {
      // Walk backward page-by-page (50 at a time) so the full history loads,
      // not just the most recent 50 — capped so a huge room can't hang the UI.
      let all: Message[] = [];
      let cursor: string | null = null;
      const MAX_PAGES = 20;
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = cursor
          ? `/api/conversations/${id}/messages?cursor=${cursor}`
          : `/api/conversations/${id}/messages`;
        const res = await fetch(url);
        if (!res.ok) break;
        const data = await res.json();
        const batch: Message[] = data.messages ?? [];
        all = [...batch, ...all];
        if (batch.length < 50) break;
        cursor = batch[0].id;
      }
      setMessages(all);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (roomId) loadMessages(roomId); }, [roomId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit("join_conversation", roomId);
    const handler = (msg: Message) => {
      if (msg.senderId === myUserId) return;
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("conversation_message", handler);
    return () => { socket.off("conversation_message", handler); socket.emit("leave_conversation", roomId); };
  }, [socket, roomId, myUserId]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteMessage = async (messageId: string) => {
    if (!roomId || !window.confirm("Delete this message for everyone?")) return;
    setDeletingId(messageId);
    try {
      const res = await fetch(`/api/conversations/${roomId}/messages/${messageId}`, { method: "DELETE" });
      if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } finally {
      setDeletingId(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !roomId || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } finally { setSending(false); }
  };

  if (!joined) {
    return <SchoolCodeGate onJoined={() => { setJoined(true); window.location.reload(); }} />;
  }

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Setting up your school community…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl" style={{ height: "calc(100vh - 4rem)", border: "1px solid var(--border-md)" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 shrink-0" style={{ height: 56, background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", flexShrink: 0 }} />
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.3px" }}>
          {activeRoom?.communityName ?? "General"}
          {showSwitcher && activeRoom?.schoolName && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
              — {activeRoom.schoolName}
            </span>
          )}
        </p>
        {activeRoom?.memberCount != null && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
            {activeRoom.memberCount} {activeRoom.memberCount === 1 ? "member" : "members"}
          </p>
        )}
      </div>

      {/* School switcher — only surfaces when the user has more than one school's general room */}
      {showSwitcher && (
        <div style={{ padding: "8px 20px", background: "rgba(0,0,0,0.15)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, flexShrink: 0 }}>Also at:</p>
          {otherGeneralRooms.map((r) => (
            <a
              key={r.id}
              href={`?conversation=${r.id}`}
              style={{ fontSize: 12, color: "var(--amber)", textDecoration: "underline" }}
            >
              {r.schoolName ?? r.communityName ?? "General"}
            </a>
          ))}
        </div>
      )}

      {/* Admin invite code bar */}
      {isAdmin && <AdminCodePanel initialCode={schoolCode} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ background: "var(--bg)" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p style={{ fontSize: 28 }}>👋</p>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>Be the first to say something</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {messages.map((msg, i) => {
              const isMe = msg.senderId === myUserId;
              const grouped = messages[i - 1]?.senderId === msg.senderId;
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginTop: grouped ? 2 : 12 }}>
                  {!grouped && !isMe ? (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface3)", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
                      {msg.sender?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  ) : (
                    <div style={{ width: 28, flexShrink: 0 }} />
                  )}
                  <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    {!grouped && !isMe && (
                      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3, paddingLeft: 4 }}>
                        {msg.sender?.name ?? "Unknown"}
                      </p>
                    )}
                    <div style={isMe ? {
                      background: "linear-gradient(135deg, var(--amber), #d97706)",
                      color: "#04070F",
                      borderRadius: "13px 13px 3px 13px",
                      padding: "9px 14px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontWeight: 500,
                    } : {
                      background: "var(--surface2)",
                      color: "var(--text)",
                      borderRadius: "13px 13px 13px 3px",
                      border: "1px solid var(--border-md)",
                      padding: "9px 14px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontWeight: 500,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      disabled={deletingId === msg.id}
                      title="Delete message"
                      style={{
                        alignSelf: "center",
                        background: "none",
                        border: "none",
                        cursor: deletingId === msg.id ? "not-allowed" : "pointer",
                        color: "var(--muted)",
                        opacity: deletingId === msg.id ? 0.4 : 0.6,
                        padding: 4,
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 12, background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            rows={1}
            placeholder="Message the group…"
            style={{
              flex: 1, resize: "none", borderRadius: 12, fontSize: 14, maxHeight: 120,
              background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)",
              padding: "10px 16px", outline: "none", fontFamily: "inherit", overflowY: "auto",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-md)"; }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              padding: 10, borderRadius: 12, background: "var(--amber)", color: "#04070F",
              border: "none", cursor: "pointer", flexShrink: 0,
              opacity: !input.trim() || sending ? 0.4 : 1,
            }}
          >
            <Send style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, paddingLeft: 4 }}>Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
