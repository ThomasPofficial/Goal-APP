"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Briefcase,
} from "lucide-react";
import TraitBadge from "@/components/profile/TraitBadge";
import { GENIUS_TYPE_INFO, TRAIT_CATEGORY_LABELS, TRAIT_CATEGORY_COLORS } from "@/data/traits";
import type { TraitCategory, GeniusType } from "@/data/traits";
import { getInitials } from "@/lib/utils";

interface Trait {
  id: string;
  slug: string;
  name: string;
  category: string;
}

interface SearchResult {
  userId: string;
  displayName: string;
  headline?: string | null;
  avatarUrl?: string | null;
  geniusType?: string | null;
  dateOfBirth?: string | null;
  selfTraits: { name: string; slug: string; category: string }[];
  projects: { id: string; name: string; status: string }[];
  matchScore: number;
  matchReason: string;
}

interface Props {
  allTraits: Trait[];
}

const GENIUS_TYPES = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"] as const;

export default function SmartSearch({ allTraits }: Props) {
  const [query, setQuery] = useState("");
  const [geniusType, setGeniusType] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [minTraits, setMinTraits] = useState(1);
  const [dobFrom, setDobFrom] = useState("");
  const [dobTo, setDobTo] = useState("");
  const [dobOpen, setDobOpen] = useState(false);
  const [traitDropdownOpen, setTraitDropdownOpen] = useState(false);
  const [traitSearch, setTraitSearch] = useState("");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const traitDropdownRef = useRef<HTMLDivElement>(null);

  // Close trait dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        traitDropdownRef.current &&
        !traitDropdownRef.current.contains(e.target as Node)
      ) {
        setTraitDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const runSearch = useCallback(
    async (params: {
      q: string;
      geniusType: string;
      slugs: string[];
      minTraits: number;
      dobFrom: string;
      dobTo: string;
    }) => {
      setLoading(true);
      setHasSearched(true);
      const sp = new URLSearchParams();
      if (params.q) sp.set("q", params.q);
      if (params.geniusType) sp.set("geniusType", params.geniusType);
      if (params.slugs.length > 0) {
        sp.set("traits", params.slugs.join(","));
        sp.set("minTraits", String(params.minTraits));
      }
      if (params.dobFrom) sp.set("dobFrom", params.dobFrom);
      if (params.dobTo) sp.set("dobTo", params.dobTo);

      try {
        const res = await fetch(`/api/search?${sp.toString()}`);
        if (!res.ok) {
          setSearchError("Search failed. Please try again.");
          setResults([]);
          setTotal(0);
          return;
        }
        setSearchError("");
        const data = await res.json();
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setSearchError("Network error. Please check your connection.");
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function scheduleSearch(overrides?: Partial<Parameters<typeof runSearch>[0]>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch({
        q: query,
        geniusType,
        slugs: selectedSlugs,
        minTraits,
        dobFrom,
        dobTo,
        ...overrides,
      });
    }, 300);
  }

  function toggleSlug(slug: string) {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
    setSelectedSlugs(next);
    scheduleSearch({ slugs: next });
  }

  function removeSlug(slug: string) {
    const next = selectedSlugs.filter((s) => s !== slug);
    setSelectedSlugs(next);
    scheduleSearch({ slugs: next });
  }

  function setGenius(type: string) {
    const next = geniusType === type ? "" : type;
    setGeniusType(next);
    scheduleSearch({ geniusType: next });
  }

  const filteredTraits = traitSearch
    ? allTraits.filter((t) =>
        t.name.toLowerCase().includes(traitSearch.toLowerCase())
      )
    : allTraits;

  const traitsByCategory = filteredTraits.reduce<Record<string, Trait[]>>(
    (acc, t) => {
      (acc[t.category] ??= []).push(t);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#eaeaea]">Discover People</h1>
        <p className="text-sm text-[#909098] mt-1">
          Find collaborators by keywords, genius type, traits, or age range.
        </p>
      </div>

      {/* ── Filters ─────────────────────────────────── */}
      <div className="space-y-3">

        {/* Keyword search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#58586a]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              scheduleSearch({ q: e.target.value });
            }}
            placeholder="Search by name, bio, strengths, keywords..."
            className="w-full pl-10"
          />
        </div>

        {/* Genius type filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setGenius("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !geniusType
                ? "bg-[#c9a84c] text-[#080809]"
                : "bg-[#131315] text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20]"
            }`}
          >
            All types
          </button>
          {GENIUS_TYPES.map((type) => {
            const info = GENIUS_TYPE_INFO[type as GeniusType];
            const active = geniusType === type;
            return (
              <button
                key={type}
                onClick={() => setGenius(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  active
                    ? "border-transparent text-[#080809]"
                    : "bg-[#131315] text-[#909098] hover:text-[#eaeaea] border-[#1c1c20]"
                }`}
                style={
                  active
                    ? { backgroundColor: info.color }
                    : {}
                }
              >
                {info.icon} {info.label}
              </button>
            );
          })}
        </div>

        {/* Trait multi-select + min count */}
        <div className="flex items-start gap-3">
          <div className="relative flex-1" ref={traitDropdownRef}>
            <button
              type="button"
              onClick={() => setTraitDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#0d0d0e] border border-[#1c1c20] rounded-md text-sm text-[#909098] hover:border-[#28282e] transition-colors"
            >
              <span>
                {selectedSlugs.length > 0
                  ? `${selectedSlugs.length} trait${selectedSlugs.length > 1 ? "s" : ""} selected`
                  : "Filter by traits…"}
              </span>
              {traitDropdownOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {traitDropdownOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 w-full max-h-72 overflow-y-auto bg-[#0d0d0e] border border-[#1c1c20] rounded-xl shadow-xl">
                <div className="sticky top-0 bg-[#0d0d0e] p-2 border-b border-[#1c1c20]">
                  <input
                    autoFocus
                    value={traitSearch}
                    onChange={(e) => setTraitSearch(e.target.value)}
                    placeholder="Search traits..."
                    className="w-full text-xs"
                  />
                </div>
                <div className="p-2 space-y-3">
                  {Object.entries(traitsByCategory).map(([cat, traits]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold text-[#58586a] uppercase tracking-wider px-1 mb-1">
                        {TRAIT_CATEGORY_LABELS[cat as TraitCategory]}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {traits.map((t) => {
                          const active = selectedSlugs.includes(t.slug);
                          const color = TRAIT_CATEGORY_COLORS[t.category as TraitCategory];
                          return (
                            <button
                              key={t.slug}
                              type="button"
                              onClick={() => toggleSlug(t.slug)}
                              className="px-2 py-0.5 rounded text-xs font-medium border-l-2 transition-all"
                              style={{
                                borderLeftColor: color,
                                backgroundColor: active
                                  ? `${color}30`
                                  : `${color}0C`,
                                color: active ? color : "#909098",
                              }}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Min traits counter */}
          {selectedSlugs.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#0d0d0e] border border-[#1c1c20] rounded-md px-3 py-2 text-sm shrink-0">
              <span className="text-[#909098] text-xs">Min:</span>
              <button
                type="button"
                onClick={() => {
                  const n = Math.max(1, minTraits - 1);
                  setMinTraits(n);
                  scheduleSearch({ minTraits: n });
                }}
                className="w-5 h-5 flex items-center justify-center text-[#909098] hover:text-[#eaeaea] font-bold"
              >
                −
              </button>
              <span className="text-[#eaeaea] font-semibold w-4 text-center text-xs">
                {minTraits}
              </span>
              <button
                type="button"
                onClick={() => {
                  const n = Math.min(selectedSlugs.length, minTraits + 1);
                  setMinTraits(n);
                  scheduleSearch({ minTraits: n });
                }}
                className="w-5 h-5 flex items-center justify-center text-[#909098] hover:text-[#eaeaea] font-bold"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Selected trait chips */}
        {selectedSlugs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedSlugs.map((slug) => {
              const trait = allTraits.find((t) => t.slug === slug);
              if (!trait) return null;
              const color = TRAIT_CATEGORY_COLORS[trait.category as TraitCategory];
              return (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {trait.name}
                  <button
                    type="button"
                    onClick={() => removeSlug(slug)}
                    className="opacity-60 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* DOB range (collapsible) */}
        <div className="border border-[#1c1c20] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setDobOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#909098] hover:text-[#eaeaea] transition-colors"
          >
            <span className="font-medium">Date of birth range filter</span>
            {dobOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {dobOpen && (
            <div className="px-4 pb-4 grid grid-cols-2 gap-3 bg-[#0d0d0e]">
              <div>
                <label className="block text-[10px] text-[#58586a] uppercase tracking-wider mb-1">
                  Born after
                </label>
                <input
                  type="date"
                  value={dobFrom}
                  onChange={(e) => {
                    setDobFrom(e.target.value);
                    scheduleSearch({ dobFrom: e.target.value });
                  }}
                  className="w-full text-xs"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#58586a] uppercase tracking-wider mb-1">
                  Born before
                </label>
                <input
                  type="date"
                  value={dobTo}
                  onChange={(e) => {
                    setDobTo(e.target.value);
                    scheduleSearch({ dobTo: e.target.value });
                  }}
                  className="w-full text-xs"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              {(dobFrom || dobTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDobFrom("");
                    setDobTo("");
                    scheduleSearch({ dobFrom: "", dobTo: "" });
                  }}
                  className="col-span-2 text-xs text-[#58586a] hover:text-[#909098] text-left"
                >
                  Clear date filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────── */}
      <div className={`transition-opacity duration-150 ${loading ? "opacity-50" : "opacity-100"}`}>
        {searchError && (
          <p className="text-sm text-[#f87171] bg-[#f8717115] border border-[#f8717130] rounded-md px-3 py-2 mb-4">
            {searchError}
          </p>
        )}

        {hasSearched && !searchError && (
          <p className="text-xs text-[#58586a] mb-4">
            {loading ? "Searching…" : `${total} ${total === 1 ? "person" : "people"} found`}
          </p>
        )}

        {!hasSearched && (
          <div className="text-center py-16 border border-dashed border-[#1c1c20] rounded-xl">
            <p className="text-sm text-[#58586a]">
              Use the filters above to find collaborators.
            </p>
          </div>
        )}

        {hasSearched && !loading && results.length === 0 && (
          <div className="text-center py-16 border border-dashed border-[#1c1c20] rounded-xl">
            <p className="text-sm text-[#58586a]">No people match your filters.</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r) => (
              <SearchResultCard key={r.userId} result={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const initials = getInitials(result.displayName);
  const geniusInfo = result.geniusType
    ? GENIUS_TYPE_INFO[result.geniusType as GeniusType]
    : null;

  const activeProjects = result.projects.filter((p) => p.status === "ACTIVE");
  const completedProjects = result.projects.filter((p) => p.status === "COMPLETED");

  return (
    <div className="group bg-[#0d0d0e] border border-[#1c1c20] rounded-[10px] p-5 flex flex-col gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(201,168,76,0.15)] hover:border-[#28282e] transition-all duration-200">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold bg-[#c9a84c20] text-[#c9a84c] ring-1 ring-[#c9a84c30]">
          {result.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.avatarUrl}
              alt={result.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[#eaeaea] text-sm truncate">
            {result.displayName}
          </h3>
          {result.headline && (
            <p className="text-xs text-[#909098] truncate mt-0.5">
              {result.headline}
            </p>
          )}
        </div>
        {geniusInfo && (
          <span
            className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${geniusInfo.color}20`,
              color: geniusInfo.color,
            }}
          >
            {geniusInfo.icon} {geniusInfo.label}
          </span>
        )}
      </div>

      {/* Traits */}
      {result.selfTraits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.selfTraits.slice(0, 5).map((t) => (
            <TraitBadge
              key={t.slug}
              name={t.name}
              category={t.category as TraitCategory}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Projects (verified from DB) */}
      {result.projects.length > 0 && (
        <div className="space-y-1">
          {activeProjects.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-[#4ADE80]">
              <Briefcase className="w-3 h-3 shrink-0" />
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 opacity-60">· active</span>
            </div>
          ))}
          {completedProjects.slice(0, 1).map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs text-[#58586a]">
              <Briefcase className="w-3 h-3 shrink-0" />
              <span className="truncate">{p.name}</span>
              <span className="shrink-0">· completed</span>
            </div>
          ))}
        </div>
      )}

      {/* Match reason */}
      <div className="mt-auto pt-1 space-y-2">
        <p className="text-[11px] text-[#c9a84c] bg-[#c9a84c10] border border-[#c9a84c20] rounded px-2 py-1 leading-relaxed">
          {result.matchReason}
        </p>

        <Link
          href={`/people/${result.userId}`}
          className="block text-center text-xs font-medium text-[#909098] hover:text-[#eaeaea] border border-[#1c1c20] hover:border-[#28282e] rounded-md py-1.5 transition-colors"
        >
          View profile
        </Link>
      </div>
    </div>
  );
}
