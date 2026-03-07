"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProfileCard from "@/components/profile/ProfileCard";
import type { ProfileCardData } from "@/components/profile/ProfileCard";
import type { TraitCategory } from "@/data/traits";
import { TRAIT_CATEGORY_LABELS } from "@/data/traits";
import { Search } from "lucide-react";

interface Trait {
  id: string;
  slug: string;
  name: string;
  category: string;
}

interface Props {
  initialProfiles: ProfileCardData[];
  allTraits: Trait[];
  initialQuery: string;
  currentUserId: string;
}

export default function PeopleSearch({
  initialProfiles,
  allTraits,
  initialQuery,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState("");

  function handleSearch(q: string, cat?: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat ?? selectedCategory) params.set("category", cat ?? selectedCategory);
    startTransition(() => {
      router.push(`/people?${params.toString()}`);
    });
  }

  const categories = [
    ...new Set(allTraits.map((t) => t.category)),
  ] as TraitCategory[];

  async function addToTeam(targetUserId: string) {
    await fetch("/api/team/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#e8e8ec]">Discover People</h1>
        <p className="text-sm text-[#9898a8] mt-1">
          Find collaborators by name, strengths, or traits.
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            placeholder="Search by name, strengths, keywords..."
            className="w-full pl-10"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedCategory("");
              handleSearch(query, "");
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !selectedCategory
                ? "bg-[#c9a84c] text-[#0f0f11]"
                : "bg-[#1e1e24] text-[#9898a8] hover:text-[#e8e8ec] border border-[#2a2a33]"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                const next = selectedCategory === cat ? "" : cat;
                setSelectedCategory(next);
                handleSearch(query, next);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-[#c9a84c] text-[#0f0f11]"
                  : "bg-[#1e1e24] text-[#9898a8] hover:text-[#e8e8ec] border border-[#2a2a33]"
              }`}
            >
              {TRAIT_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div
        className={`transition-opacity duration-150 ${isPending ? "opacity-50" : "opacity-100"}`}
      >
        {initialProfiles.length > 0 ? (
          <>
            <p className="text-xs text-[#5a5a6a] mb-4">
              {initialProfiles.length} {initialProfiles.length === 1 ? "person" : "people"} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialProfiles.map((profile) => (
                <ProfileCard
                  key={profile.userId}
                  profile={profile}
                  showActions
                  onAddToTeam={addToTeam}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 border border-dashed border-[#2a2a33] rounded-xl">
            <p className="text-sm text-[#5a5a6a]">
              {query || selectedCategory
                ? "No people match your search."
                : "No other users have created profiles yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
