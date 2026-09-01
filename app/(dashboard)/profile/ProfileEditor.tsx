"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  userId: string;
  initialProfile: {
    displayName: string;
    headline: string;
    bio: string;
    strengthSummary: string;
    dateOfBirth: string;
  } | null;
  locked?: boolean;
}

export default function ProfileEditor({ initialProfile, locked = false }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    initialProfile?.displayName ?? ""
  );
  const [headline, setHeadline] = useState(initialProfile?.headline ?? "");
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [strengthSummary, setStrengthSummary] = useState(
    initialProfile?.strengthSummary ?? ""
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    initialProfile?.dateOfBirth ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        headline,
        bio,
        strengthSummary,
        dateOfBirth: dateOfBirth || undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save profile.");
    } else {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#eaeaea]">My Profile</h1>
        <p className="text-sm text-[#909098] mt-1">
          Tell others who you are and how you work best.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-[#909098] uppercase tracking-wider">
            Basic Information
          </h2>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Display Name *
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={locked}
              placeholder="Your name"
              className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {locked && (
              <p className="text-xs text-[#58586a] mt-1">Set by your school — ask your teacher if this needs to change.</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Headline
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Builder & Systems Thinker"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={locked}
              className="w-full disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-[#58586a] mt-1">
              {locked ? "Set by your school — ask your teacher if this needs to change." : "Used for age-range filtering in search. Not shown publicly."}
            </p>
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell others about yourself..."
              className="w-full resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#909098] mb-1.5 uppercase tracking-wider font-medium">
              Strength Summary
            </label>
            <textarea
              value={strengthSummary}
              onChange={(e) => setStrengthSummary(e.target.value)}
              rows={3}
              placeholder="What do you do best? How do you work?"
              className="w-full resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !displayName}
            className="flex items-center gap-2 bg-[#4a80f0] hover:bg-[#6a9fff] text-[#080809] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving..." : saved ? "Saved!" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
