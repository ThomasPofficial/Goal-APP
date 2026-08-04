"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Field, inputStyle, colorPickerStyle, CATEGORIES, type OrgCategory } from "@/components/org/OrgFormFields";
import { CATEGORY_COLORS, type OrgDetail } from "./OrgDetailClient";

export interface OrgProfileUpdate {
  name: string; category: OrgCategory; website: string; founded: string; headquartersLocation: string;
  tagline: string; logoLetter: string; logoBg: string; logoColor: string; accentColor: string;
  description: string; whatWeSeek: string; whatInternsBuild: string; contactEmail: string; values: string[];
}

export default function OrgSettingsForm({
  org,
  onSaved,
}: {
  org: OrgDetail;
  onSaved: (fields: OrgProfileUpdate) => void;
}) {
  const [name, setName] = useState(org.name);
  const [category, setCategory] = useState<OrgCategory>(org.category as OrgCategory);
  const [website, setWebsite] = useState(org.website ?? "");
  const [founded, setFounded] = useState(org.founded ?? "");
  const [headquartersLocation, setHeadquartersLocation] = useState(org.headquartersLocation ?? "");

  const viewAccent = org.accentColor ?? CATEGORY_COLORS[org.category] ?? "#1060d8";
  const [logoLetter, setLogoLetter] = useState(org.logoLetter ?? "");
  const [logoBg, setLogoBg] = useState(org.logoBg ?? viewAccent);
  const [logoColor, setLogoColor] = useState(org.logoColor ?? "#ffffff");
  const [accentColor, setAccentColor] = useState(viewAccent);
  const [tagline, setTagline] = useState(org.tagline ?? "");

  const [description, setDescription] = useState(org.description ?? "");
  const [whatWeSeek, setWhatWeSeek] = useState(org.whatWeSeek ?? "");
  const [whatInternsBuild, setWhatInternsBuild] = useState(org.whatInternsBuild ?? "");
  const [contactEmail, setContactEmail] = useState(org.contactEmail ?? "");
  const [values, setValues] = useState<string[]>(() => JSON.parse(org.values || "[]"));
  const [newValue, setNewValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const effectiveLogoLetter = logoLetter || name[0] || "?";

  async function handleSave() {
    if (!name.trim() || !category) {
      setError("Organization name and category are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), category, website: website.trim() || null,
          founded: founded.trim() || null, headquartersLocation: headquartersLocation.trim() || null,
          tagline: tagline.trim() || null, logoLetter: effectiveLogoLetter, logoBg, logoColor, accentColor,
          description: description.trim() || null, whatWeSeek: whatWeSeek.trim() || null,
          whatInternsBuild: whatInternsBuild.trim() || null, contactEmail: contactEmail.trim() || null,
          values,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      onSaved({
        name: name.trim(), category, website: website.trim(), founded: founded.trim(),
        headquartersLocation: headquartersLocation.trim(), tagline: tagline.trim(),
        logoLetter: effectiveLogoLetter, logoBg, logoColor, accentColor,
        description: description.trim(), whatWeSeek: whatWeSeek.trim(),
        whatInternsBuild: whatInternsBuild.trim(), contactEmail: contactEmail.trim(), values,
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl p-5 space-y-6 mb-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
    >
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Basics</h3>
        <Field label="Organization name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Category" required>
          <select value={category} onChange={(e) => setCategory(e.target.value as OrgCategory)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" type="url" style={inputStyle} />
          </Field>
          <Field label="Founded year">
            <input value={founded} onChange={(e) => setFounded(e.target.value)} maxLength={4} style={inputStyle} />
          </Field>
        </div>
        <Field label="Headquarters / Location">
          <input value={headquartersLocation} onChange={(e) => setHeadquartersLocation(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div className="space-y-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Brand</h3>
        <div className="flex items-center gap-4">
          <div style={{ background: logoBg, color: logoColor, width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
            {effectiveLogoLetter}
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{name || "Your Org"}</p>
        </div>
        <Field label="Logo letter">
          <input value={logoLetter} onChange={(e) => setLogoLetter(e.target.value.slice(0, 1).toUpperCase())} maxLength={1} style={{ ...inputStyle, maxWidth: 80 }} />
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
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} style={inputStyle} />
        </Field>
      </div>

      <div className="space-y-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Mission</h3>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 96 }} />
        </Field>
        <Field label="What we look for in students">
          <textarea value={whatWeSeek} onChange={(e) => setWhatWeSeek(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
        </Field>
        <Field label="What students actually build here">
          <textarea value={whatInternsBuild} onChange={(e) => setWhatInternsBuild(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />
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
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" style={inputStyle} />
        </Field>
      </div>

      {error && (
        <div className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-1.5"
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedFlash && <span className="text-xs" style={{ color: "#4ade80" }}>✓ Saved</span>}
      </div>
    </div>
  );
}
