"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TraitBadge from "@/components/profile/TraitBadge";
import {
  TRAIT_CATEGORY_LABELS,
  TRAIT_CATEGORY_COLORS,
  TRAITS_BY_CATEGORY,
} from "@/data/traits";
import type { TraitCategory } from "@/data/traits";
import { Loader2, Check } from "lucide-react";

interface Trait {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
}

interface Props {
  userId: string;
  initialProfile: {
    displayName: string;
    headline: string;
    bio: string;
    strengthSummary: string;
    traitIds: string[];
  } | null;
  allTraits: Trait[];
}

const MAX_TRAITS = 5;

export default function ProfileEditor({ initialProfile, allTraits }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    initialProfile?.displayName ?? ""
  );
  const [headline, setHeadline] = useState(initialProfile?.headline ?? "");
  const [bio, setBio] = useState(initialProfile?.bio ?? "");
  const [strengthSummary, setStrengthSummary] = useState(
    initialProfile?.strengthSummary ?? ""
  );
  const [selectedTraitIds, setSelectedTraitIds] = useState<string[]>(
    initialProfile?.traitIds ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const traitById = Object.fromEntries(allTraits.map((t) => [t.id, t]));
  const categories = Object.keys(TRAIT_CATEGORY_LABELS) as TraitCategory[];

  function toggleTrait(traitId: string) {
    setSelectedTraitIds((prev) => {
      if (prev.includes(traitId)) return prev.filter((id) => id !== traitId);
      if (prev.length >= MAX_TRAITS) return prev;
      return [...prev, traitId];
    });
  }

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
        traitIds: selectedTraitIds,
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
        <h1 className="text-2xl font-semibold text-[#e8e8ec]">My Profile</h1>
        <p className="text-sm text-[#9898a8] mt-1">
          Tell others who you are and how you work best.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">
            Basic Information
          </h2>

          <div>
            <label className="block text-xs text-[#9898a8] mb-1.5 uppercase tracking-wider font-medium">
              Display Name *
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-[#9898a8] mb-1.5 uppercase tracking-wider font-medium">
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
            <label className="block text-xs text-[#9898a8] mb-1.5 uppercase tracking-wider font-medium">
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
            <label className="block text-xs text-[#9898a8] mb-1.5 uppercase tracking-wider font-medium">
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

        {/* Traits selector */}
        <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">
              Traits
            </h2>
            <span
              className={`text-xs font-medium ${
                selectedTraitIds.length >= MAX_TRAITS
                  ? "text-[#c9a84c]"
                  : "text-[#5a5a6a]"
              }`}
            >
              {selectedTraitIds.length}/{MAX_TRAITS} selected
            </span>
          </div>

          {/* Selected preview */}
          {selectedTraitIds.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-[#1e1e24] rounded-lg border border-[#2a2a33]">
              {selectedTraitIds.map((id) => {
                const t = traitById[id];
                if (!t) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleTrait(id)}
                    className="group"
                  >
                    <TraitBadge
                      name={t.name}
                      category={t.category as TraitCategory}
                      size="md"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Trait grid by category */}
          <div className="space-y-5">
            {categories.map((cat) => {
              const categoryTraits = TRAITS_BY_CATEGORY[cat];
              const dbTraits = allTraits.filter((t) => t.category === cat);

              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: TRAIT_CATEGORY_COLORS[cat],
                      }}
                    />
                    <span className="text-xs font-medium text-[#9898a8]">
                      {TRAIT_CATEGORY_LABELS[cat]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dbTraits.map((trait) => {
                      const isSelected = selectedTraitIds.includes(trait.id);
                      const isDisabled =
                        !isSelected && selectedTraitIds.length >= MAX_TRAITS;
                      const traitDef = categoryTraits.find(
                        (t) => t.slug === trait.slug
                      );

                      return (
                        <button
                          key={trait.id}
                          type="button"
                          onClick={() => !isDisabled && toggleTrait(trait.id)}
                          disabled={isDisabled}
                          title={traitDef?.description}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border-l-2 transition-all ${
                            isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                          }`}
                          style={{
                            borderLeftColor: TRAIT_CATEGORY_COLORS[cat],
                            backgroundColor: isSelected
                              ? `${TRAIT_CATEGORY_COLORS[cat]}25`
                              : `${TRAIT_CATEGORY_COLORS[cat]}0C`,
                            color: isSelected
                              ? TRAIT_CATEGORY_COLORS[cat]
                              : "#9898a8",
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {trait.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
            className="flex items-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving..." : saved ? "Saved!" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
