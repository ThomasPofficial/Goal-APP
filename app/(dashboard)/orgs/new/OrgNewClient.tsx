"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const CATEGORIES = [
  "ACCELERATOR",
  "FELLOWSHIP",
  "INTERNSHIP",
  "COMPETITION",
  "BOOTCAMP",
  "RESEARCH",
  "CLUB",
] as const;

type OrgCategory = (typeof CATEGORIES)[number];

const TOTAL_STEPS = 3;

const STEP_LABELS = ["Basics", "Visual Identity", "About"];

export default function OrgNewClient() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Basics
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [website, setWebsite] = useState("");

  // Step 2 — Visual Identity
  const [logoLetter, setLogoLetter] = useState("");
  const [logoBg, setLogoBg] = useState("#1a2540");
  const [logoColor, setLogoColor] = useState("#ffffff");
  const [accentColor, setAccentColor] = useState("#4a80f0");

  // Step 3 — About
  const [description, setDescription] = useState("");
  const [whatInternsBuild, setWhatInternsBuild] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Derived
  const effectiveLogoLetter = logoLetter || name[0] || "?";

  // Validation per step
  function canAdvance() {
    if (step === 1) return name.trim().length > 0 && category !== "";
    if (step === 2) return true;
    if (step === 3) return description.trim().length >= 100;
    return false;
  }

  function handleNext() {
    if (step === 2 && !logoLetter && name[0]) {
      setLogoLetter(name[0].toUpperCase());
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
    setError(null);
  }

  async function handleSubmit() {
    if (!canAdvance()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          website: website.trim() || undefined,
          description: description.trim(),
          logoLetter: effectiveLogoLetter,
          logoBg,
          logoColor,
          accentColor,
          whatInternsBuild: whatInternsBuild.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/orgs/" + data.org.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: "1.5rem",
        }}
      >
        Create Organization
      </h1>

      {/* Progress indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "2rem",
        }}
      >
        {STEP_LABELS.map((label, idx) => {
          const num = idx + 1;
          const isActive = num === step;
          const isDone = num < step;
          return (
            <div
              key={num}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    background: isDone
                      ? "var(--blue)"
                      : isActive
                      ? "rgba(74,128,240,0.15)"
                      : "var(--surface)",
                    color: isDone
                      ? "#fff"
                      : isActive
                      ? "var(--blue)"
                      : "var(--muted)",
                    border: isActive
                      ? "1px solid var(--blue)"
                      : isDone
                      ? "none"
                      : "1px solid var(--border-md)",
                    transition: "all 0.15s",
                  }}
                >
                  {isDone ? "✓" : num}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: isActive ? "var(--text)" : "var(--muted)",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div
                  style={{
                    width: 24,
                    height: 1,
                    background: isDone ? "var(--blue)" : "var(--border-md)",
                    marginLeft: 4,
                    transition: "background 0.15s",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div
        className="bracket-card"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-md)",
          borderRadius: 12,
          padding: "1.75rem",
        }}
      >
        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={labelStyle}>
                Organization name <Required />
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Build Club"
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Category <Required />
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as OrgCategory)}
                style={inputStyle}
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Website</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                type="url"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Visual Identity ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Live preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
              <div
                style={{
                  background: logoBg,
                  color: logoColor,
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: "var(--font-serif)",
                  flexShrink: 0,
                }}
              >
                {effectiveLogoLetter}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-serif)" }}>
                  {name || "Your Org"}
                </p>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Logo preview</p>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Logo letter</label>
              <input
                value={logoLetter}
                onChange={(e) => setLogoLetter(e.target.value.slice(0, 1).toUpperCase())}
                placeholder={name[0]?.toUpperCase() || "A"}
                maxLength={1}
                style={{ ...inputStyle, maxWidth: 80 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Background</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input
                    type="color"
                    value={logoBg}
                    onChange={(e) => setLogoBg(e.target.value)}
                    style={colorPickerStyle}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {logoBg}
                  </span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Letter color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input
                    type="color"
                    value={logoColor}
                    onChange={(e) => setLogoColor(e.target.value)}
                    style={colorPickerStyle}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {logoColor}
                  </span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Accent color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    style={colorPickerStyle}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {accentColor}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: About ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label style={labelStyle}>
                  Description <Required />
                </label>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: description.trim().length >= 100 ? "var(--blue)" : "var(--muted)",
                  }}
                >
                  {description.trim().length}/100 min
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your organization, its mission, and what makes it unique…"
                rows={4}
                style={{ ...inputStyle, resize: "vertical", minHeight: 96 }}
              />
              {description.trim().length > 0 && description.trim().length < 100 && (
                <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>
                  Please write at least 100 characters ({100 - description.trim().length} more needed).
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>What students typically work on here</label>
              <textarea
                value={whatInternsBuild}
                onChange={(e) => setWhatInternsBuild(e.target.value)}
                placeholder="e.g. Building production features, shipping mobile apps, running experiments…"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
              />
            </div>

            <div>
              <label style={labelStyle}>Contact email</label>
              <input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hello@example.com"
                type="email"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ fontSize: 13, color: "#f87171", marginTop: "1rem" }}>{error}</p>
        )}

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.75rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={handleBack}
            disabled={step === 1}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              color: step === 1 ? "var(--muted)" : "var(--text2)",
              background: "none",
              border: "none",
              cursor: step === 1 ? "default" : "pointer",
              padding: "6px 0",
              opacity: step === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={15} />
            Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: canAdvance() ? 1 : 0.5,
                cursor: canAdvance() ? "pointer" : "default",
              }}
            >
              Next
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: canAdvance() && !submitting ? 1 : 0.5,
                cursor: canAdvance() && !submitting ? "pointer" : "default",
              }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Creating…" : "Create organization"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ──

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text2)",
  marginBottom: 6,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-md)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const colorPickerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--border-md)",
  cursor: "pointer",
  padding: 2,
  background: "var(--bg)",
  flexShrink: 0,
};

function Required() {
  return <span style={{ color: "#f87171", marginLeft: 2 }}>*</span>;
}
