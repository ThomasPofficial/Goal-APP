"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface SurveyFields {
  college: string;
  jobTitle: string;
  employer: string;
  internshipTitle: string;
  internshipOrg: string;
}

export default function SurveyClient({ initial }: { initial: SurveyFields }) {
  const [form, setForm] = useState<SurveyFields>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof SurveyFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/student/brochure-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const field = (label: string, key: keyof SurveyFields, placeholder: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--n-muted)", marginBottom: 6 }}>
        {label}
      </label>
      <input
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "10px 12px", fontSize: 14,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 0, color: "var(--text)", outline: "none",
        }}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 32px)", letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 6px" }}>
        Your Outcomes
      </h1>
      <p style={{ fontSize: 14, color: "var(--n-text2)", margin: "0 0 28px" }}>
        This feeds the school brochure. Only your name and outcomes appear — no test scores, no genius type.
      </p>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 16px" }}>College</p>
      {field("College / University", "college", "e.g. MIT, Howard University")}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "16px 0 16px" }}>Job</p>
      {field("Job Title", "jobTitle", "e.g. Software Engineer")}
      {field("Employer", "employer", "e.g. Google, NASA")}

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "16px 0 16px" }}>Internship</p>
      {field("Internship Title", "internshipTitle", "e.g. Research Intern")}
      {field("Internship Org", "internshipOrg", "e.g. Stanford AI Lab")}

      <button
        onClick={save}
        disabled={saving}
        style={{
          marginTop: 8, padding: "10px 24px", fontSize: 13, fontWeight: 600,
          background: "var(--amber)", color: "#1a1a1f", border: "none",
          borderRadius: 0, cursor: saving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {saved && <CheckCircle2 size={14} />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save Outcomes"}
      </button>
    </div>
  );
}
