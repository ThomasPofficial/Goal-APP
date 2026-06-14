"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Send } from "lucide-react";

interface Update { id: string; title: string; body: string; emoji: string | null; createdAt: string; }

export default function PlatformUpdatesAdmin() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/platform-updates");
    const data = await res.json();
    setUpdates(data.updates ?? []);
  };

  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/platform-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), emoji: emoji.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      setTitle(""); setBody(""); setEmoji("");
      await load();
    } catch { setError("Network error"); }
    finally { setSending(false); }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text)", letterSpacing: "-0.03em" }}>
          Platform Updates
        </h1>
        <p className="text-xs" style={{ color: "var(--text2)" }}>
          Updates posted here appear in every student&apos;s dashboard after they dismiss the welcome card.
        </p>
      </div>

      {/* Compose */}
      <div className="bracket-card mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", padding: "1.5rem" }}>
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase mb-4" style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>
          Post new update
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Emoji</label>
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🚀" maxLength={4} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's new?" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Body *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the update in detail for students…" rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 88 }} />
          </div>
          {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}
          <button onClick={post} disabled={!title.trim() || !body.trim() || sending} className="btn-primary flex items-center gap-2 self-start" style={{ opacity: title.trim() && body.trim() && !sending ? 1 : 0.5 }}>
            {sending ? "Posting…" : <><Send size={13} /> Post update</>}
          </button>
        </div>
      </div>

      {/* Existing updates */}
      <p className="text-[10px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
        {updates.length} published update{updates.length !== 1 ? "s" : ""}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {updates.map((u) => (
          <div key={u.id} className="bracket-card px-4 py-3 flex items-start gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {u.emoji && <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{u.emoji}</span>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>{u.title}</p>
              <p className="text-xs leading-relaxed mb-1.5" style={{ color: "var(--text2)" }}>{u.body}</p>
              <p className="text-[10px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {updates.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: "var(--muted)" }}>No updates posted yet.</p>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "var(--text2)",
  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 12px",
  border: "1px solid var(--border-md)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit",
};
