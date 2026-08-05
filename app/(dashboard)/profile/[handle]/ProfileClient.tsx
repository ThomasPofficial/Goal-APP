"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES, type GeniusTypeKey } from "@/lib/geniusTypes";
import AnimalArchetypeCard from "@/components/AnimalArchetypeCard";
import type { AnimalKey } from "@/lib/animalArchetypes";

interface OwnReview {
  id: string;
  body: string;
  createdAt: string;
  org: { name: string; logoLetter: string | null; logoBg: string | null; logoColor: string | null };
  orgProject: { title: string };
}

interface ProfileData {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
  geniusType: GeniusTypeKey | null;
  secondaryGeniusType: GeniusTypeKey | null;
  currentFocus: string | null;
  interests: string | null;
  grade: number | null;
  schoolName: string | null;
  isFirstGen: boolean;
  isHomeschooled: boolean;
  isInternational: boolean;
  animalArchetypes: string;
  archetypeAnalysis: string | null;
  archetypeUpdatedAt: string | null;
  bio: string | null;
  staffTitle: string | null;
  industry: string | null;
  isAvailableToMentor: boolean;
  graduationYear: number | null;
  intendedCollege: string | null;
}

interface Props {
  profile: ProfileData;
  isOwn: boolean;
  myProfile: (Omit<ProfileData, "secondaryGeniusType"> & { geniusType: GeniusTypeKey | null }) | null;
  ownReviews?: OwnReview[];
}

export default function ProfileClient({ profile, isOwn, ownReviews = [] }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: profile.displayName ?? "",
    currentFocus: profile.currentFocus ?? "",
    grade: profile.grade ?? null as number | null,
    schoolName: profile.schoolName ?? "",
    isFirstGen: profile.isFirstGen,
    isHomeschooled: profile.isHomeschooled,
    isInternational: profile.isInternational,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [analyzingArchetype, setAnalyzingArchetype] = useState(false);
  const [archetypeError, setArchetypeError] = useState<string | null>(null);
  const [archetypes, setArchetypes] = useState<AnimalKey[]>(() => {
    try { return JSON.parse(profile.animalArchetypes ?? "[]"); } catch { return []; }
  });
  const [archetypeAnalysis, setArchetypeAnalysis] = useState<string | null>(profile.archetypeAnalysis);

  const interests: string[] = (() => {
    try { return JSON.parse(profile.interests ?? "[]"); } catch { return []; }
  })();

  const analyzeArchetype = async () => {
    if (!profile.handle) return;
    setAnalyzingArchetype(true);
    setArchetypeError(null);
    try {
      const res = await fetch(`/api/profile/${profile.handle}/analyze-archetype`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setArchetypeError(data.error ?? "Analysis failed");
        return;
      }
      setArchetypes(data.archetypes);
      setArchetypeAnalysis(data.analysis);
    } finally {
      setAnalyzingArchetype(false);
    }
  };

  const gt = profile.geniusType ? GENIUS_TYPES[profile.geniusType] : null;

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setSaveError(d.error ?? "Failed to save");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const GRADES = [
    { label: "8th", value: 8 }, { label: "9th", value: 9 },
    { label: "10th", value: 10 }, { label: "11th", value: 11 },
    { label: "12th", value: 12 }, { label: "Freshman", value: 13 },
    { label: "Sophomore", value: 14 }, { label: "Junior", value: 15 },
    { label: "Senior", value: 16 },
  ];
  const gradeLabel = (g: number | null) => GRADES.find((gr) => gr.value === g)?.label ?? null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Hero */}
      <div
        className="rounded-2xl p-8 mb-6"
        style={{
          background: gt ? `linear-gradient(135deg, ${gt.color}22, ${gt.color}06)` : "#16161a",
          border: `1px solid ${gt?.color ?? "#2a2a33"}30`,
        }}
      >
        <div className="flex items-start gap-5">
          <Avatar src={profile.avatarUrl} displayName={profile.displayName} geniusType={profile.geniusType} size={80} />
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-[#e8e8ec]" style={{ fontFamily: "var(--font-display)" }}>
              {profile.displayName ?? "Anonymous"}
            </h1>
            {profile.handle && (
              <p className="text-sm text-[#9898a8] mt-0.5">@{profile.handle}</p>
            )}
            {profile.staffTitle && (
              <p className="text-xs font-semibold uppercase tracking-wider mt-1.5" style={{ color: "var(--amber)", letterSpacing: "0.08em" }}>
                {profile.staffTitle}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {profile.geniusType && <GeniusTypeBadge geniusType={profile.geniusType} size="md" />}
              {profile.secondaryGeniusType && (
                <GeniusTypeBadge geniusType={profile.secondaryGeniusType} size="sm" showEmoji={false} />
              )}
              {profile.isAvailableToMentor && (
                <span
                  className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ color: "var(--amber)", background: "rgba(232,137,58,0.15)", letterSpacing: "0.1em" }}
                >
                  Mentor
                </span>
              )}
            </div>
            {(profile.industry || profile.graduationYear || profile.intendedCollege) && (
              <div className="flex items-center gap-3 mt-2 flex-wrap text-xs" style={{ color: "#9898a8" }}>
                {profile.graduationYear && <span>Class of &apos;{String(profile.graduationYear).slice(-2)}</span>}
                {profile.industry && <span>{profile.industry}</span>}
                {profile.intendedCollege && <span>{profile.intendedCollege}</span>}
              </div>
            )}
          </div>
          {isOwn && (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg border border-[#2a2a33] text-[#9898a8] hover:border-[#4a80f0] hover:text-[#4a80f0] transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {profile.bio && (
          <p className="mt-5 text-sm leading-relaxed" style={{ color: "#c8c8d0" }}>{profile.bio}</p>
        )}

        {profile.currentFocus && (
          <div className="mt-5 bg-black/20 rounded-xl px-4 py-3 border border-white/5">
            <p className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wide mb-1">Currently focused on</p>
            <p className="text-[#e8e8ec] text-sm">{profile.currentFocus}</p>
          </div>
        )}
      </div>

      {/* Interests */}
      {interests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {interests.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: `${gt?.color ?? "#4a80f0"}18`,
                  color: gt?.color ?? "#4a80f0",
                  border: `1px solid ${gt?.color ?? "#4a80f0"}30`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Animal Archetypes */}
      {(archetypes.length > 0 || isOwn) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#5a6a7a" }}>
              Animal Archetypes
            </h2>
            {isOwn && ownReviews.length >= 3 && (
              <button
                onClick={analyzeArchetype}
                disabled={analyzingArchetype}
                className="text-[11px] font-mono px-3 py-1 rounded-full transition-all"
                style={{
                  background: analyzingArchetype ? "#1a2030" : "#0A1628",
                  border: "1px solid #1E3A5A",
                  color: analyzingArchetype ? "#4a6a8a" : "#4A90D4",
                  cursor: analyzingArchetype ? "not-allowed" : "pointer",
                }}
              >
                {analyzingArchetype
                  ? "Analyzing…"
                  : archetypes.length > 0
                  ? "Re-analyze"
                  : "Analyze now"}
              </button>
            )}
          </div>

          {archetypeError && (
            <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: "#E87070", background: "#200A0A", border: "1px solid #3A1010" }}>
              {archetypeError}
            </p>
          )}

          {archetypes.length > 0 ? (
            <div>
              <div className="flex gap-3 flex-wrap">
                {archetypes.map((key) => (
                  <AnimalArchetypeCard key={key} animalKey={key} />
                ))}
              </div>
              {archetypeAnalysis && (
                <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: "#0A1020", border: "1px solid #1E2A3A" }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "#3A5A7A" }}>
                    AI Analysis
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "#6888a8" }}>{archetypeAnalysis}</p>
                </div>
              )}
            </div>
          ) : isOwn ? (
            <div
              className="rounded-xl p-5 text-center"
              style={{ background: "#060C14", border: "1px dashed #1E2A3A" }}
            >
              <div className="text-2xl mb-2">🦍 🐯 🦁</div>
              <p className="text-sm font-medium mb-1" style={{ color: "#4A6A8A" }}>
                Your animal archetypes haven&apos;t been discovered yet
              </p>
              <p className="text-xs" style={{ color: "#2A4060" }}>
                {ownReviews.length >= 3
                  ? "You have enough reviews — your archetypes will be assigned automatically, or click \"Analyze now\" above."
                  : `Archetypes unlock after ${3 - ownReviews.length} more detailed org review${3 - ownReviews.length === 1 ? "" : "s"} (240+ words each). They're assigned automatically when you hit 3.`}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Background — own profile only */}
      {isOwn && (
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-5">
          <h2 className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-3">Background</h2>
          <div className="space-y-2 text-sm text-[#9898a8]">
            {profile.grade != null && (
              <p><span className="font-medium text-[#e8e8ec]">Grade:</span> {gradeLabel(profile.grade) ?? profile.grade}</p>
            )}
            {profile.schoolName && (
              <p><span className="font-medium text-[#e8e8ec]">School:</span> {profile.schoolName}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.isFirstGen && (
                <span className="px-2 py-0.5 bg-[#7B61FF15] text-[#7B61FF] border border-[#7B61FF30] rounded-full text-xs">First-gen</span>
              )}
              {profile.isHomeschooled && (
                <span className="px-2 py-0.5 bg-[#4a80f015] text-[#4a80f0] border border-[#4a80f030] rounded-full text-xs">Homeschooled</span>
              )}
              {profile.isInternational && (
                <span className="px-2 py-0.5 bg-[#45B7D115] text-[#45B7D1] border border-[#45B7D130] rounded-full text-xs">International</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reviews — own profile only, Gate A */}
      {isOwn && ownReviews.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#5a7898" }}>
            Your Reviews
          </h2>
          <div className="space-y-3">
            {ownReviews.map((r) => (
              <div
                key={r.id}
                className="rounded-xl p-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border-md)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {r.org.logoLetter && (
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: r.org.logoBg ?? "#0A1E52", color: r.org.logoColor ?? "#6A9FFF" }}
                    >
                      {r.org.logoLetter}
                    </div>
                  )}
                  <span className="text-xs font-semibold" style={{ color: "#8ab0d8" }}>{r.org.name}</span>
                  <span className="text-[11px]" style={{ color: "#5a7898" }}>· {r.orgProject.title}</span>
                  <span className="ml-auto text-[10px]" style={{ color: "#5a7898" }}>{format(new Date(r.createdAt), "MMM d, yyyy")}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text)", fontFamily: "var(--font-serif)", fontSize: 15 }}>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwn && ownReviews.length === 0 && (
        <div
          className="mb-6 rounded-xl p-5 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm font-medium" style={{ color: "#5a7898" }}>No reviews yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Reviews appear here after you complete an org project. They&apos;re written by the org and visible only to you. Once you have 3, your animal archetypes are automatically assigned.
          </p>
        </div>
      )}

      {/* Edit Drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setEditing(false)} />
          <div className="w-full max-w-md bg-[#16161a] border-l border-[#2a2a33] h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a33]">
              <h2 className="text-sm font-semibold text-[#e8e8ec]">Edit Profile</h2>
              <button
                onClick={() => setEditing(false)}
                className="text-[#5a5a6a] hover:text-[#e8e8ec] text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              <div>
                <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Current Focus</label>
                <textarea
                  value={form.currentFocus}
                  onChange={(e) => setForm((f) => ({ ...f, currentFocus: e.target.value }))}
                  rows={3}
                  maxLength={120}
                  className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] placeholder-[#5a5a6a] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] resize-none transition-colors"
                />
                <p className="text-right text-xs text-[#5a5a6a] mt-1">{form.currentFocus.length}/120</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Grade</label>
                <div className="flex flex-wrap gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setForm((f) => ({ ...f, grade: f.grade === g.value ? null : g.value }))}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        form.grade === g.value
                          ? "bg-[#4a80f0] text-[#0f0f11] border-[#4a80f0] font-semibold"
                          : "border-[#2a2a33] text-[#9898a8] hover:border-[#4a80f0] hover:text-[#4a80f0]"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">School Name</label>
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
                  className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] px-3 py-2 text-sm focus:outline-none focus:border-[#4a80f0] transition-colors"
                />
              </div>

              <div className="space-y-3">
                {[
                  { key: "isFirstGen", label: "First-generation student" },
                  { key: "isHomeschooled", label: "Homeschooled" },
                  { key: "isInternational", label: "International student" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-[#4a80f0]"
                    />
                    <span className="text-sm text-[#9898a8] group-hover:text-[#e8e8ec] transition-colors">{label}</span>
                  </label>
                ))}
              </div>

              {saveError && (
                <p className="text-xs text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-lg px-3 py-2">{saveError}</p>
              )}
            </div>

            <div className="p-5 border-t border-[#2a2a33] flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-lg border border-[#2a2a33] text-sm font-medium text-[#9898a8] hover:border-[#3a3a44] hover:text-[#e8e8ec] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#4a80f0] hover:bg-[#6a9fff] text-[#0f0f11] text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
