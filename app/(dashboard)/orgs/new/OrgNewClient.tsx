"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { CATEGORIES, type OrgCategory, Field, inputStyle, colorPickerStyle } from "@/components/org/OrgFormFields";

const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;
const GRADES = [9, 10, 11, 12] as const;
const APP_MATERIALS = ["Resume", "Cover Letter", "Portfolio", "Writing Sample", "Video Introduction", "GitHub Profile", "References"];
const FORMATS = ["Remote", "In-Person", "Hybrid"];

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Basics", "Brand", "Mission", "Project Details"];

export default function OrgNewClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 â€” Basics
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OrgCategory | "">("");
  const [website, setWebsite] = useState("");
  const [founded, setFounded] = useState("");
  const [hqLocation, setHqLocation] = useState("");

  // Step 2 â€” Brand
  const [logoLetter, setLogoLetter] = useState("");
  const [logoBg, setLogoBg] = useState("#0a1535");
  const [logoColor, setLogoColor] = useState("#ffffff");
  const [accentColor, setAccentColor] = useState("#E8893A");
  const [tagline, setTagline] = useState("");

  // Step 3 â€” Mission
  const [description, setDescription] = useState("");
  const [whatWeSeek, setWhatWeSeek] = useState("");
  const [whatInternsBuild, setWhatInternsBuild] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [newValue, setNewValue] = useState("");

  // Step 4 â€” Project (first listing)
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [openSpots, setOpenSpots] = useState(3);
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [duration, setDuration] = useState("");
  const [format, setFormat] = useState("Remote");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [preferredGeniusTypes, setPreferredGeniusTypes] = useState<string[]>([]);
  const [gradeEligibility, setGradeEligibility] = useState<number[]>([]);
  const [applicationMode, setApplicationMode] = useState<"TEAM" | "SOLO">("TEAM");
  const [appMaterials, setAppMaterials] = useState<string[]>([]);
  const [autoAccept, setAutoAccept] = useState(false);
  const [stipend, setStipend] = useState("");
  const [impactStatement, setImpactStatement] = useState("");

  const effectiveLogoLetter = logoLetter || name[0] || "?";

  function canAdvance() {
    if (step === 1) return name.trim().length > 0 && category !== "";
    if (step === 2) return true;
    if (step === 3) return description.trim().length >= 100;
    if (step === 4) return projectTitle.trim().length > 0 && projectDescription.trim().length >= 60;
    return false;
  }

  function handleNext() {
    if (step === 2 && !logoLetter && name[0]) setLogoLetter(name[0].toUpperCase());
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
    setError(null);
  }

  function toggleArr<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
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
          founded: founded.trim() || undefined,
          headquartersLocation: hqLocation.trim() || undefined,
          tagline: tagline.trim() || undefined,
          description: description.trim(),
          whatWeSeek: whatWeSeek.trim() || undefined,
          whatInternsBuild: whatInternsBuild.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          values: JSON.stringify(values),
          logoLetter: effectiveLogoLetter,
          logoBg,
          logoColor,
          accentColor,
          // Project details for first listing
          projectTitle: projectTitle.trim() || undefined,
          projectDescription: projectDescription.trim() || undefined,
          openSpots,
          hoursPerWeek: hoursPerWeek.trim() || undefined,
          duration: duration.trim() || undefined,
          format,
          requiredSkills: JSON.stringify(requiredSkills),
          preferredGeniusTypes: JSON.stringify(preferredGeniusTypes),
          gradeEligibility: JSON.stringify(gradeEligibility),
          applicationMode,
          appMaterials: JSON.stringify(appMaterials),
          autoAccept,
          stipend: stipend.trim() || undefined,
          impactStatement: impactStatement.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      router.push("/orgs/" + data.org.id);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text)", letterSpacing: "-0.03em" }}>
          Create Organization
        </h1>
        <p className="text-xs" style={{ color: "var(--text2)" }}>Fill in details carefully â€” this is what students see first.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((label, idx) => {
          const num = idx + 1;
          const isActive = num === step;
          const isDone = num < step;
          return (
            <div key={num} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div style={{
                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                  background: isDone ? "var(--amber)" : isActive ? "rgba(232,137,58,0.12)" : "var(--surface2)",
                  color: isDone ? "#fff" : isActive ? "var(--amber)" : "var(--muted)",
                  border: isActive ? "1px solid var(--amber)" : "1px solid var(--border-md)",
                  transition: "all 0.15s",
                }}>
                  {isDone ? "âœ“" : num}
                </div>
                <span style={{ fontSize: 11, color: isActive ? "var(--text)" : "var(--muted)", fontWeight: isActive ? 600 : 400 }}>
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div style={{ width: 16, height: 1, background: isDone ? "var(--amber)" : "var(--border-md)" }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="bracket-card" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", padding: "1.75rem" }}>

        {/* â”€â”€ Step 1: Basics â”€â”€ */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Field label="Organization name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Build Club" autoFocus style={inputStyle} />
            </Field>
            <Field label="Category" required>
              <select value={category} onChange={(e) => setCategory(e.target.value as OrgCategory)} style={inputStyle}>
                <option value="">Select a categoryâ€¦</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Field label="Website">
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" type="url" style={inputStyle} />
              </Field>
              <Field label="Founded year">
                <input value={founded} onChange={(e) => setFounded(e.target.value)} placeholder="e.g. 2022" maxLength={4} style={inputStyle} />
              </Field>
            </div>
            <Field label="Headquarters / Location">
              <input value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} placeholder="e.g. San Francisco, CA or Remote" style={inputStyle} />
            </Field>
          </div>
        )}

        {/* â”€â”€ Step 2: Brand â”€â”€ */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="flex items-center gap-4">
              <div style={{ background: logoBg, color: logoColor, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
                {effectiveLogoLetter}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{name || "Your Org"}</p>
                <p className="text-[11px]" style={{ color: "var(--muted)", marginTop: 2 }}>Logo preview</p>
              </div>
            </div>
            <Field label="Logo letter">
              <input value={logoLetter} onChange={(e) => setLogoLetter(e.target.value.slice(0, 1).toUpperCase())} placeholder={name[0]?.toUpperCase() || "A"} maxLength={1} style={{ ...inputStyle, maxWidth: 80 }} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              {[
                { label: "Logo background", value: logoBg, set: setLogoBg },
                { label: "Letter color", value: logoColor, set: setLogoColor },
                { label: "Accent color", value: accentColor, set: setAccentColor },
              ].map(({ label, value, set }) => (
                <Field key={label} label={label}>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={value} onChange={(e) => set(e.target.value)} style={colorPickerStyle} />
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{value}</span>
                  </div>
                </Field>
              ))}
            </div>
            <Field label="Tagline">
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One sentence that says what makes you different." style={inputStyle} maxLength={120} />
            </Field>
          </div>
        )}

        {/* â”€â”€ Step 3: Mission â”€â”€ */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Field label="Description" required hint={`${description.trim().length}/100 min`} hintOk={description.trim().length >= 100}>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Your org's mission, what you do, and what makes you worth a student's time." rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 96 }} />
            </Field>
            <Field label="What we look for in students">
              <textarea value={whatWeSeek} onChange={(e) => setWhatWeSeek(e.target.value)} placeholder="Skills, mindsets, qualities you actively screen for." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
            </Field>
            <Field label="What students actually build here">
              <textarea value={whatInternsBuild} onChange={(e) => setWhatInternsBuild(e.target.value)} placeholder="Specific projects, responsibilities, what they'll ship or contribute." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
            </Field>
            <Field label="Core values">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {values.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-1" style={{ background: "rgba(232,137,58,0.1)", border: "1px solid rgba(232,137,58,0.25)", color: "var(--amber)" }}>
                    {v}
                    <button onClick={() => setValues(values.filter((x) => x !== v))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newValue.trim()) { setValues([...values, newValue.trim()]); setNewValue(""); } }} placeholder="Add a value (press Enter)" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { if (newValue.trim()) { setValues([...values, newValue.trim()]); setNewValue(""); } }} className="btn-ghost" style={{ flexShrink: 0 }}>
                  <Plus size={13} />
                </button>
              </div>
            </Field>
            <Field label="Contact email">
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@example.com" type="email" style={inputStyle} />
            </Field>
          </div>
        )}

        {/* â”€â”€ Step 4: Project Details â”€â”€ */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p className="text-xs mb-2" style={{ color: "var(--text2)" }}>
              This creates your first project listing. Students apply to specific projects, not just your org.
            </p>
            <Field label="Project title" required>
              <input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="e.g. Product Design Intern â€” Summer 2026" autoFocus style={inputStyle} />
            </Field>
            <Field label="What students will do" required hint={`${projectDescription.trim().length}/60 min`} hintOk={projectDescription.trim().length >= 60}>
              <textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Concrete, specific â€” what will they actually work on? What will they ship?" rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 96 }} />
            </Field>
            <Field label="Impact statement">
              <input value={impactStatement} onChange={(e) => setImpactStatement(e.target.value)} placeholder="Why does this project matter? What's the outcome?" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <Field label="Open spots">
                <input type="number" min={1} max={20} value={openSpots} onChange={(e) => setOpenSpots(Number(e.target.value))} style={inputStyle} />
              </Field>
              <Field label="Hours/week">
                <input value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="e.g. 8â€“12 hours" style={inputStyle} />
              </Field>
              <Field label="Duration">
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 10 weeks" style={inputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Field label="Format">
                <select value={format} onChange={(e) => setFormat(e.target.value)} style={inputStyle}>
                  {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Stipend / Compensation">
                <input value={stipend} onChange={(e) => setStipend(e.target.value)} placeholder="e.g. Unpaid, $500/month" style={inputStyle} />
              </Field>
            </div>

            <Field label="Required skills">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {requiredSkills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1" style={{ background: "var(--surface2)", border: "1px solid var(--border-md)", color: "var(--text2)" }}>
                    {s}
                    <button onClick={() => setRequiredSkills(requiredSkills.filter((x) => x !== s))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim()) { setRequiredSkills([...requiredSkills, newSkill.trim()]); setNewSkill(""); } }} placeholder="Add a skill (press Enter)" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { if (newSkill.trim()) { setRequiredSkills([...requiredSkills, newSkill.trim()]); setNewSkill(""); } }} className="btn-ghost" style={{ flexShrink: 0 }}>
                  <Plus size={13} />
                </button>
              </div>
            </Field>

            <Field label="Preferred Genius Types">
              <div className="flex gap-2 flex-wrap mt-1">
                {GENIUS_TYPES.map((g) => (
                  <button key={g} onClick={() => toggleArr(preferredGeniusTypes, g, setPreferredGeniusTypes)} className="text-xs px-2.5 py-1 font-medium transition-all" style={{ border: `1px solid ${preferredGeniusTypes.includes(g) ? "var(--amber)" : "var(--border-md)"}`, background: preferredGeniusTypes.includes(g) ? "rgba(232,137,58,0.1)" : "transparent", color: preferredGeniusTypes.includes(g) ? "var(--amber)" : "var(--text2)", cursor: "pointer" }}>
                    {g}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Grade eligibility (leave empty for all grades)">
              <div className="flex gap-2 flex-wrap mt-1">
                {GRADES.map((g) => (
                  <button key={g} onClick={() => toggleArr(gradeEligibility, g, setGradeEligibility as (v: number[]) => void)} className="text-xs px-2.5 py-1 font-medium transition-all" style={{ border: `1px solid ${gradeEligibility.includes(g) ? "var(--amber)" : "var(--border-md)"}`, background: gradeEligibility.includes(g) ? "rgba(232,137,58,0.1)" : "transparent", color: gradeEligibility.includes(g) ? "var(--amber)" : "var(--text2)", cursor: "pointer" }}>
                    Grade {g}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Application materials">
              <div className="flex flex-wrap gap-2 mt-1">
                {APP_MATERIALS.map((m) => (
                  <button key={m} onClick={() => toggleArr(appMaterials, m, setAppMaterials)} className="text-xs px-2.5 py-1 font-medium transition-all" style={{ border: `1px solid ${appMaterials.includes(m) ? "var(--amber)" : "var(--border-md)"}`, background: appMaterials.includes(m) ? "rgba(232,137,58,0.1)" : "transparent", color: appMaterials.includes(m) ? "var(--amber)" : "var(--text2)", cursor: "pointer" }}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Field label="Application mode">
                <select value={applicationMode} onChange={(e) => setApplicationMode(e.target.value as "TEAM" | "SOLO")} style={inputStyle}>
                  <option value="TEAM">Teams apply together</option>
                  <option value="SOLO">Solo applications</option>
                </select>
              </Field>
              <Field label="Auto-accept teams?">
                <button onClick={() => setAutoAccept(!autoAccept)} className="text-xs px-3 py-2 font-medium transition-all mt-1" style={{ border: `1px solid ${autoAccept ? "var(--amber)" : "var(--border-md)"}`, background: autoAccept ? "rgba(232,137,58,0.1)" : "transparent", color: autoAccept ? "var(--amber)" : "var(--text2)", cursor: "pointer", width: "100%" }}>
                  {autoAccept ? "Yes â€” auto-accept" : "No â€” manual review"}
                </button>
              </Field>
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: "#f87171", marginTop: "1rem" }}>{error}</p>}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-7 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={handleBack} disabled={step === 1} className="flex items-center gap-1 text-sm" style={{ color: step === 1 ? "var(--muted)" : "var(--text2)", background: "none", border: "none", cursor: step === 1 ? "default" : "pointer", opacity: step === 1 ? 0.4 : 1, padding: "6px 0" }}>
            <ChevronLeft size={14} /> Back
          </button>
          {step < TOTAL_STEPS ? (
            <button onClick={handleNext} disabled={!canAdvance()} className="btn-primary flex items-center gap-1" style={{ opacity: canAdvance() ? 1 : 0.5, cursor: canAdvance() ? "pointer" : "default" }}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canAdvance() || submitting} className="btn-primary flex items-center gap-1.5" style={{ opacity: canAdvance() && !submitting ? 1 : 0.5, cursor: canAdvance() && !submitting ? "pointer" : "default" }}>
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? "Creatingâ€¦" : "Create organization"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
