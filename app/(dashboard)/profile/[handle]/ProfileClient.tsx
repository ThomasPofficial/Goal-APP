"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES, type GeniusTypeKey } from "@/lib/geniusTypes";

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
}

interface Props {
  profile: ProfileData;
  isOwn: boolean;
  myProfile: (Omit<ProfileData, "secondaryGeniusType"> & { geniusType: GeniusTypeKey | null }) | null;
}

export default function ProfileClient({ profile, isOwn }: Props) {
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

  const interests: string[] = (() => {
    try { return JSON.parse(profile.interests ?? "[]"); } catch { return []; }
  })();

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
            <h1 className="text-2xl font-bold text-[#e8e8ec]">{profile.displayName ?? "Anonymous"}</h1>
            {profile.handle && (
              <p className="text-sm text-[#9898a8] mt-0.5">@{profile.handle}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {profile.geniusType && <GeniusTypeBadge geniusType={profile.geniusType} size="md" />}
              {profile.secondaryGeniusType && (
                <GeniusTypeBadge geniusType={profile.secondaryGeniusType} size="sm" showEmoji={false} />
              )}
            </div>
          </div>
          {isOwn && (
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg border border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
            >
              Edit
            </button>
          )}
        </div>

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
                  backgroundColor: `${gt?.color ?? "#c9a84c"}18`,
                  color: gt?.color ?? "#c9a84c",
                  border: `1px solid ${gt?.color ?? "#c9a84c"}30`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
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
                <span className="px-2 py-0.5 bg-[#c9a84c15] text-[#c9a84c] border border-[#c9a84c30] rounded-full text-xs">Homeschooled</span>
              )}
              {profile.isInternational && (
                <span className="px-2 py-0.5 bg-[#45B7D115] text-[#45B7D1] border border-[#45B7D130] rounded-full text-xs">International</span>
              )}
            </div>
          </div>
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
                  className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9898a8] uppercase tracking-wider mb-1.5">Current Focus</label>
                <textarea
                  value={form.currentFocus}
                  onChange={(e) => setForm((f) => ({ ...f, currentFocus: e.target.value }))}
                  rows={3}
                  maxLength={120}
                  className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] placeholder-[#5a5a6a] px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] resize-none transition-colors"
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
                          ? "bg-[#c9a84c] text-[#0f0f11] border-[#c9a84c] font-semibold"
                          : "border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c]"
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
                  className="w-full rounded-lg border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] px-3 py-2 text-sm focus:outline-none focus:border-[#c9a84c] transition-colors"
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
                      className="w-4 h-4 accent-[#c9a84c]"
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
                className="flex-1 py-2.5 rounded-lg bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] text-sm font-semibold disabled:opacity-50 transition-colors"
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
