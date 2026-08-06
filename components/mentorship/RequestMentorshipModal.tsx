"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  targetName: string;
  onSend: (message: string) => Promise<void> | void;
  onClose: () => void;
}

export default function RequestMentorshipModal({ targetName, onSend, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await onSend(message.trim());
    setSending(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0,
          width: "100%", maxWidth: 420, padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 6px" }}>
              Request Mentorship
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>{targetName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-muted)", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--n-text2)", marginBottom: 8 }}>
          Tell them what you&apos;re hoping for (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="e.g. I'd love guidance on breaking into product design..."
          style={{
            width: "100%", background: "var(--surface2)", border: "1px solid var(--border-md)",
            borderRadius: 0, padding: "10px 12px", fontSize: 13, color: "var(--text)",
            fontFamily: "inherit", resize: "vertical", marginBottom: 16,
          }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={sending}
            style={{
              padding: "8px 16px", border: "1px solid var(--border-md)", background: "transparent",
              color: "var(--n-text2)", borderRadius: 0, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: "8px 16px", border: "1px solid var(--amber)", background: "var(--amber)",
              color: "#000", borderRadius: 0, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.6 : 1,
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            {sending ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
