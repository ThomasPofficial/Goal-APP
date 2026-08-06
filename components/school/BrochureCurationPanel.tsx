"use client";
import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Users, SortAsc, Quote, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";

interface StudentRow {
  profileId: string; name: string;
  college: string | null; jobTitle: string | null; employer: string | null;
  internshipTitle: string | null; internshipOrg: string | null;
  score: number; excluded: boolean;
}

interface TestimonialRow {
  id: string; body: string; sourceName: string; sourceContext: string | null;
  sourceType: string; approved: boolean; displayOrder: number;
}

type SortPreset = "top5" | "top10" | "top20" | "bottom5" | "recent" | "alpha" | null;

export default function BrochureCurationPanel({ schoolId }: { schoolId: string }) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<"ADMIN_ONLY" | "STUDENTS">("ADMIN_ONLY");
  const [cap, setCap] = useState<string>("");
  const [activePreset, setActivePreset] = useState<SortPreset>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);
  const [newQuote, setNewQuote] = useState({ body: "", sourceName: "", sourceContext: "", sourceType: "STUDENT" });
  const [addingQuote, setAddingQuote] = useState(false);

  const qs = schoolId ? `?schoolId=${schoolId}` : "";

  useEffect(() => {
    Promise.all([
      fetch(`/api/school/brochure/students${qs}`).then((r) => r.json()),
      fetch(`/api/school/brochure/settings${qs}`).then((r) => r.json()),
      fetch(`/api/school/brochure/testimonials${qs}`).then((r) => r.json()),
    ]).then(([{ students: s }, { settings }, { testimonials: t }]) => {
      setStudents(s ?? []);
      setExcluded(new Set(settings?.excludedIds ?? []));
      setVisibility(settings?.visibility ?? "ADMIN_ONLY");
      setCap(settings?.maxStudents ? String(settings.maxStudents) : "");
      setTestimonials(t ?? []);
      setLoading(false);
    });
  }, [qs]);

  const applyPreset = (preset: SortPreset) => {
    setActivePreset(preset);
    if (!preset) return;
    let sorted = [...students];
    if (preset === "top5" || preset === "top10" || preset === "top20") {
      sorted.sort((a, b) => b.score - a.score);
      const n = preset === "top5" ? 5 : preset === "top10" ? 10 : 20;
      const topIds = new Set(sorted.slice(0, n).map((s) => s.profileId));
      setExcluded(new Set(students.filter((s) => !topIds.has(s.profileId)).map((s) => s.profileId)));
      setCap(String(n));
    } else if (preset === "bottom5") {
      sorted.sort((a, b) => a.score - b.score);
      const bottomIds = new Set(sorted.slice(0, 5).map((s) => s.profileId));
      setExcluded(new Set(students.filter((s) => !bottomIds.has(s.profileId)).map((s) => s.profileId)));
      setCap("5");
    } else if (preset === "recent") {
      setStudents([...students].reverse());
    } else if (preset === "alpha") {
      setStudents([...students].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const toggle = (profileId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId); else next.add(profileId);
      return next;
    });
  };

  const saveSettings = useCallback(async () => {
    setSaving(true);
    await fetch("/api/school/brochure/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId,
        visibility,
        maxStudents: cap ? parseInt(cap, 10) : null,
        excludedIds: Array.from(excluded),
      }),
    });
    setSaving(false);
  }, [schoolId, visibility, cap, excluded]);

  const toggleApprove = async (t: TestimonialRow) => {
    const res = await fetch(`/api/school/brochure/testimonials/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !t.approved }),
    });
    const { testimonial } = await res.json();
    setTestimonials((prev) => prev.map((x) => x.id === t.id ? testimonial : x));
  };

  const deleteTestimonial = async (id: string) => {
    await fetch(`/api/school/brochure/testimonials/${id}`, { method: "DELETE" });
    setTestimonials((prev) => prev.filter((x) => x.id !== id));
  };

  const addTestimonial = async () => {
    if (!newQuote.body.trim() || !newQuote.sourceName.trim()) return;
    setAddingQuote(true);
    const res = await fetch("/api/school/brochure/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, ...newQuote }),
    });
    const { testimonial } = await res.json();
    setTestimonials((prev) => [...prev, testimonial]);
    setNewQuote({ body: "", sourceName: "", sourceContext: "", sourceType: "STUDENT" });
    setAddingQuote(false);
  };

  if (loading) return <div style={{ padding: 24, color: "var(--n-muted)", fontSize: 13 }}>Loading curation panel…</div>;

  const presets: { key: SortPreset; label: string }[] = [
    { key: "top5", label: "Top 5" },
    { key: "top10", label: "Top 10" },
    { key: "top20", label: "Top 20" },
    { key: "bottom5", label: "Bottom 5" },
    { key: "recent", label: "Most Recent" },
    { key: "alpha", label: "A–Z" },
  ];

  return (
    <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 16px" }}>
        Brochure Curation
      </p>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>

        {/* Visibility toggle */}
        <button
          onClick={() => setVisibility(visibility === "ADMIN_ONLY" ? "STUDENTS" : "ADMIN_ONLY")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", fontSize: 12, fontWeight: 600,
            background: visibility === "STUDENTS" ? "var(--amber)" : "var(--surface)",
            color: visibility === "STUDENTS" ? "#1a1a1f" : "var(--text)",
            border: "1px solid var(--border)", borderRadius: 0, cursor: "pointer",
          }}
        >
          {visibility === "STUDENTS" ? <Eye size={13} /> : <EyeOff size={13} />}
          {visibility === "STUDENTS" ? "Visible to Students" : "Admin Only"}
        </button>

        {/* Student cap */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={13} style={{ color: "var(--n-muted)" }} />
          <input
            type="number" min="1"
            placeholder="Show all"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            style={{
              width: 90, padding: "7px 10px", fontSize: 12,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 0, color: "var(--text)",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--n-muted)" }}>max students</span>
        </div>

        {/* Save */}
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: "8px 16px", fontSize: 12, fontWeight: 600,
            background: "var(--blue, #4a80f0)", color: "#fff",
            border: "none", borderRadius: 0, cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* Auto-sort presets */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        <SortAsc size={13} style={{ color: "var(--n-muted)" }} />
        <span style={{ fontSize: 11, color: "var(--n-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>AUTO-SORT:</span>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key === activePreset ? null : p.key)}
            style={{
              padding: "5px 12px", fontSize: 11, fontWeight: 600,
              background: activePreset === p.key ? "var(--amber)" : "var(--surface)",
              color: activePreset === p.key ? "#1a1a1f" : "var(--n-text2)",
              border: "1px solid var(--border)", borderRadius: 0, cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Student list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {students.map((s) => {
          const isExcluded = excluded.has(s.profileId);
          const outcome = s.jobTitle && s.employer
            ? `${s.jobTitle} @ ${s.employer}`
            : s.internshipTitle && s.internshipOrg
            ? `${s.internshipTitle} @ ${s.internshipOrg}`
            : null;
          return (
            <div
              key={s.profileId}
              onClick={() => toggle(s.profileId)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", cursor: "pointer",
                background: isExcluded ? "transparent" : "var(--surface)",
                border: "1px solid var(--border)",
                opacity: isExcluded ? 0.45 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                border: "2px solid var(--border)",
                background: isExcluded ? "transparent" : "var(--amber)",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</span>
                <span style={{ fontSize: 11, color: "var(--n-text2)", marginLeft: 10 }}>{s.college ?? "—"}</span>
                {outcome && <span style={{ fontSize: 11, color: "var(--n-muted)", marginLeft: 10 }}>· {outcome}</span>}
              </div>
              <span style={{
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: s.score >= 3 ? "var(--amber)" : "var(--n-muted)",
                letterSpacing: "0.1em",
              }}>
                {s.score >= 3 ? "●●●" : s.score === 2 ? "●●○" : s.score === 1 ? "●○○" : "○○○"}
              </span>
            </div>
          );
        })}
        {students.length === 0 && (
          <p style={{ color: "var(--n-muted)", fontSize: 13, padding: "16px 0" }}>
            No students linked to this school yet.
          </p>
        )}
      </div>

      {/* Testimonials */}
      <div style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Quote size={13} style={{ color: "var(--amber)" }} />
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: 0 }}>
            Testimonials
          </p>
        </div>

        {testimonials.map((t) => (
          <div key={t.id} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "12px 14px", background: t.approved ? "var(--surface)" : "transparent", border: "1px solid var(--border)", opacity: t.approved ? 1 : 0.6 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text)", fontStyle: "italic" }}>&quot;{t.body}&quot;</p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--n-muted)", fontFamily: "var(--font-mono)" }}>
                — {t.sourceName}{t.sourceContext ? ` · ${t.sourceContext}` : ""} · {t.sourceType}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <button onClick={() => toggleApprove(t)} title={t.approved ? "Unapprove" : "Approve"} style={{ background: "none", border: "none", cursor: "pointer", color: t.approved ? "var(--amber)" : "var(--n-muted)", padding: 0 }}>
                {t.approved ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>
              <button onClick={() => deleteTestimonial(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--n-muted)", padding: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {/* Add new testimonial form */}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            placeholder="Quote text…"
            value={newQuote.body}
            onChange={(e) => setNewQuote((q) => ({ ...q, body: e.target.value }))}
            rows={3}
            style={{ padding: "8px 12px", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)", resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Name"
              value={newQuote.sourceName}
              onChange={(e) => setNewQuote((q) => ({ ...q, sourceName: e.target.value }))}
              style={{ flex: 1, padding: "7px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)" }}
            />
            <input
              placeholder="Context (e.g. Grade 11 · Fellow)"
              value={newQuote.sourceContext}
              onChange={(e) => setNewQuote((q) => ({ ...q, sourceContext: e.target.value }))}
              style={{ flex: 2, padding: "7px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)" }}
            />
            <select
              value={newQuote.sourceType}
              onChange={(e) => setNewQuote((q) => ({ ...q, sourceType: e.target.value }))}
              style={{ padding: "7px 10px", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 0, color: "var(--text)" }}
            >
              <option value="STUDENT">Student</option>
              <option value="ALUMNI">Alumni</option>
              <option value="PARENT">Parent</option>
              <option value="ORG">Org</option>
            </select>
          </div>
          <button
            onClick={addTestimonial}
            disabled={addingQuote}
            style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 0, cursor: "pointer" }}
          >
            <Plus size={13} />
            {addingQuote ? "Adding…" : "Add Testimonial"}
          </button>
        </div>
      </div>
    </div>
  );
}
