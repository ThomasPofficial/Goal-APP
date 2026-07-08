"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewSchoolPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [tagline, setTagline] = useState("");
  const [advancementEmail, setAdvancementEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/hq/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, schoolCode, tagline, advancementEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/hq/schools/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 0,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--n-text2)",
    marginBottom: 4,
  };

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Back link */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/hq"
          style={{
            color: "var(--muted)",
            fontSize: 13,
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
          }}
        >
          ← Schools
        </Link>
      </div>

      {/* Page title */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
          marginBottom: 8,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
        }}
      >
        Add New School
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
        Create a school account. A temporary password will be generated automatically.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* School Name */}
          <div>
            <label style={labelStyle}>School Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Westside Academy"
              style={inputStyle}
            />
          </div>

          {/* School Email */}
          <div>
            <label style={labelStyle}>School Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@westsideacademy.org"
              style={inputStyle}
            />
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
              This is the login email for the school account.
            </p>
          </div>

          {/* School Code */}
          <div>
            <label style={labelStyle}>School Code</label>
            <input
              type="text"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="e.g. westside-2026"
              style={inputStyle}
            />
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
              Unique slug used for community rooms.
            </p>
          </div>

          {/* Tagline */}
          <div>
            <label style={labelStyle}>Tagline / Description</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Empowering students through innovation"
              style={inputStyle}
            />
          </div>

          {/* Advancement Office Email */}
          <div>
            <label style={labelStyle}>Advancement Office Email</label>
            <input
              type="email"
              value={advancementEmail}
              onChange={(e) => setAdvancementEmail(e.target.value)}
              placeholder="e.g. giving@westsideacademy.org"
              style={inputStyle}
            />
            <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
              Where pledge notifications are sent.
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              marginTop: 20,
              padding: "10px 14px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "var(--error, #ef4444)",
              fontSize: 13,
              borderRadius: 0,
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: 28 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 24px",
              background: "var(--amber)",
              color: "#000",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "none",
              borderRadius: 0,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Creating..." : "Create School"}
          </button>
        </div>
      </form>
    </div>
  );
}
