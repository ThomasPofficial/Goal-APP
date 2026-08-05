"use client";

import { useState } from "react";
import DonationWidget from "@/components/donations/DonationWidget";

export default function DonateClient({ handle, displayName }: { handle: string; displayName: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/give/${handle}` : `/give/${handle}`;

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Donate
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Share this link so anyone can support you directly.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={link}
          style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
        />
        <button
          onClick={copyLink}
          style={{ padding: "10px 16px", background: "var(--amber)", border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <DonationWidget recipientHandle={handle} recipientName={displayName} />
    </div>
  );
}
