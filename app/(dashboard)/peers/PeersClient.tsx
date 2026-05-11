"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, X, Heart, Users, Plus, ChevronRight } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { cn } from "@/lib/utils";

interface Peer {
  id: string;
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  geniusType: string | null;
  secondaryGeniusType: string | null;
  currentFocus: string | null;
  interests: string[];
  grade: number | null;
  schoolName: string | null;
}

const GENIUS_KEYS: GeniusTypeKey[] = ["DYNAMO", "BLAZE", "TEMPO", "STEEL"];
const GRADES = [9, 10, 11, 12];

export default function PeersClient() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<GeniusTypeKey[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [savedContacts, setSavedContacts] = useState<Set<string>>(new Set());
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupPeers, setGroupPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPeers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      selectedTypes.forEach((t) => params.append("geniusType", t));
      selectedGrades.forEach((g) => params.append("grade", String(g)));
      const res = await fetch(`/api/peers?${params}`);
      const data = await res.json();
      setPeers(data.peers ?? []);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, selectedTypes, selectedGrades]);

  useEffect(() => { fetchPeers(); }, [fetchPeers]);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d) => setSavedContacts(new Set((d.contacts ?? []).map((c: { target: { id: string } }) => c.target.id))));
  }, []);

  const toggleContact = async (peer: Peer) => {
    const saved = savedContacts.has(peer.id);
    setSavedContacts((prev) => {
      const next = new Set(prev);
      saved ? next.delete(peer.id) : next.add(peer.id);
      return next;
    });
    try {
      if (saved) {
        await fetch(`/api/contacts/${peer.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetProfileId: peer.id }),
        });
      }
    } catch {
      setSavedContacts((prev) => {
        const next = new Set(prev);
        saved ? next.add(peer.id) : next.delete(peer.id);
        return next;
      });
    }
  };

  const toggleType = (t: GeniusTypeKey) =>
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  const toggleGrade = (g: number) =>
    setSelectedGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);

  const activeFilters = selectedTypes.length + selectedGrades.length;

  return (
    <div className="flex gap-6">
      {/* ── Filter sidebar ─────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 space-y-5">
        <div>
          <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider mb-2">Genius Type</p>
          <div className="space-y-1">
            {GENIUS_KEYS.map((t) => {
              const info = GENIUS_TYPES[t];
              const active = selectedTypes.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                    active
                      ? cn(info.tailwindBg, info.tailwindText, "border", info.tailwindBorder)
                      : "text-[#9898a8] hover:bg-[#1e1e24]"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0")} style={{ background: info.color }} />
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider mb-2">Grade</p>
          <div className="flex flex-wrap gap-1.5">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => toggleGrade(g)}
                className={cn(
                  "w-10 h-8 rounded-lg text-xs font-medium border transition-all",
                  selectedGrades.includes(g)
                    ? "bg-[#c9a84c] border-[#c9a84c] text-[#0f0f11]"
                    : "border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c]"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {activeFilters > 0 && (
          <button
            onClick={() => { setSelectedTypes([]); setSelectedGrades([]); }}
            className="text-xs text-[#5a5a6a] hover:text-[#c9a84c] transition-colors"
          >
            Clear all filters
          </button>
        )}
      </aside>

      {/* ── Main ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Search bar */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a6a]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, handle, or school…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#2a2a33] bg-[#16161a] text-sm text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none focus:border-[#c9a84c] transition-colors"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-[#5a5a6a]" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-[#16161a] animate-pulse" />
            ))}
          </div>
        ) : peers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-8 h-8 text-[#2a2a33] mx-auto mb-3" />
            <p className="text-sm text-[#9898a8]">No peers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {peers.map((peer) => (
              <StudentCard
                key={peer.id}
                peer={peer}
                saved={savedContacts.has(peer.id)}
                onSave={() => toggleContact(peer)}
                onClick={() => setSelectedPeer(peer)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Student Panel ──────────────────────────────────────── */}
      {selectedPeer && (
        <StudentPanel
          peer={selectedPeer}
          saved={savedContacts.has(selectedPeer.id)}
          onSave={() => toggleContact(selectedPeer)}
          onClose={() => setSelectedPeer(null)}
        />
      )}

      {/* ── Group FAB ─────────────────────────────────────────── */}
      <button
        onClick={() => setShowGroupModal(true)}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] flex items-center justify-center shadow-lg transition-colors z-30"
        title="Start group conversation"
      >
        <Plus className="w-5 h-5" />
      </button>

      {showGroupModal && (
        <GroupConversationModal
          peers={peers}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </div>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({
  peer, saved, onSave, onClick,
}: {
  peer: Peer; saved: boolean; onSave: () => void; onClick: () => void;
}) {
  return (
    <div
      className="bg-[#16161a] border border-[#2a2a33] rounded-xl p-4 cursor-pointer hover:border-[#c9a84c] transition-all relative group"
      onClick={onClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onSave(); }}
        className={cn(
          "absolute top-3 right-3 p-1 rounded transition-colors",
          saved ? "text-[#c9a84c]" : "text-[#2a2a33] group-hover:text-[#5a5a6a]"
        )}
      >
        <Heart className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
      </button>

      <Avatar
        src={peer.avatarUrl}
        name={peer.displayName}
        geniusType={peer.geniusType as GeniusTypeKey | null}
        size="md"
        className="mb-2"
      />
      <p className="font-medium text-sm text-[#e8e8ec] truncate">{peer.displayName}</p>
      {peer.handle && <p className="text-xs text-[#5a5a6a] mb-1">@{peer.handle}</p>}
      {peer.geniusType && <GeniusTypeBadge type={peer.geniusType as GeniusTypeKey} size="sm" />}

      {peer.interests.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {peer.interests.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e24] text-[#9898a8]">
              {tag}
            </span>
          ))}
          {peer.interests.length > 3 && (
            <span className="text-[10px] text-[#5a5a6a]">+{peer.interests.length - 3}</span>
          )}
        </div>
      )}

      {peer.schoolName && (
        <p className="text-[10px] text-[#5a5a6a] mt-1.5 truncate">{peer.schoolName}</p>
      )}
    </div>
  );
}

// ─── Student Panel ────────────────────────────────────────────────────────────

function StudentPanel({
  peer, saved, onSave, onClose,
}: {
  peer: Peer; saved: boolean; onSave: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#16161a] border-l border-[#2a2a33] z-40 overflow-y-auto">
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">Profile</p>
          <button onClick={onClose} className="text-[#5a5a6a] hover:text-[#e8e8ec]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-start gap-3 mb-4">
          <Avatar
            src={peer.avatarUrl}
            name={peer.displayName}
            geniusType={peer.geniusType as GeniusTypeKey | null}
            size="lg"
          />
          <div>
            <p className="font-semibold text-[#e8e8ec]">{peer.displayName}</p>
            {peer.handle && <p className="text-xs text-[#9898a8]">@{peer.handle}</p>}
            {peer.geniusType && (
              <GeniusTypeBadge type={peer.geniusType as GeniusTypeKey} size="sm" className="mt-1" />
            )}
          </div>
        </div>

        {peer.currentFocus && peer.geniusType && (
          <div
            className="border-l-4 pl-3 py-1 mb-4 text-xs text-[#9898a8] italic leading-relaxed"
            style={{ borderColor: GENIUS_TYPES[peer.geniusType as GeniusTypeKey].color }}
          >
            {peer.currentFocus}
          </div>
        )}

        {peer.schoolName && (
          <p className="text-xs text-[#9898a8] mb-4">{peer.schoolName}{peer.grade ? ` · Grade ${peer.grade}` : ""}</p>
        )}

        {peer.interests.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-[#5a5a6a] uppercase tracking-wider mb-2">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {peer.interests.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e24] text-[#9898a8] border border-[#2a2a33]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Link
            href={`/messages?dm=${peer.userId}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] text-sm font-semibold transition-colors"
          >
            Message
          </Link>
          <button
            onClick={onSave}
            className={cn(
              "flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border text-sm font-medium transition-colors",
              saved
                ? "border-[#c9a84c] text-[#c9a84c] bg-[#c9a84c10]"
                : "border-[#2a2a33] text-[#9898a8] hover:border-[#c9a84c] hover:text-[#c9a84c]"
            )}
          >
            <Heart className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Conversation Modal ─────────────────────────────────────────────────

function GroupConversationModal({ peers, onClose }: { peers: Peer[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Peer[]>([]);
  const [creating, setCreating] = useState(false);
  const router = useRef<ReturnType<typeof import("next/navigation").useRouter> | null>(null);

  // Use router via dynamic import workaround
  const { useRouter } = require("next/navigation") as { useRouter: () => ReturnType<typeof import("next/navigation").useRouter> };
  const nextRouter = useRouter();

  const filtered = peers.filter((p) =>
    p.displayName.toLowerCase().includes(q.toLowerCase()) &&
    !selected.some((s) => s.id === p.id)
  );

  const toggle = (peer: Peer) => {
    setSelected((prev) =>
      prev.some((p) => p.id === peer.id)
        ? prev.filter((p) => p.id !== peer.id)
        : prev.length < 10
        ? [...prev, peer]
        : prev
    );
  };

  const start = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantIds: selected.map((p) => p.userId),
        type: "GROUP",
      }),
    });
    const data = await res.json();
    onClose();
    nextRouter.push(`/messages?group=${data.conversation?.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#16161a] border border-[#2a2a33] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a33]">
          <p className="font-semibold text-sm text-[#e8e8ec]">Start group conversation</p>
          <button onClick={onClose}><X className="w-4 h-4 text-[#5a5a6a]" /></button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-[#2a2a33]">
            {selected.map((p) => (
              <div key={p.id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#1e1e24] text-xs text-[#e8e8ec]">
                <Avatar src={p.avatarUrl} name={p.displayName} size="xs" />
                {p.displayName}
                <button onClick={() => toggle(p)} className="ml-1 opacity-60 hover:opacity-100">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search peers…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#2a2a33] bg-transparent text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none focus:border-[#c9a84c]"
          />
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {filtered.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1e1e24] transition-colors text-left"
              >
                <Avatar src={p.avatarUrl} name={p.displayName} size="sm" />
                <span className="text-sm text-[#e8e8ec]">{p.displayName}</span>
                {p.geniusType && <GeniusTypeBadge type={p.geniusType as GeniusTypeKey} size="sm" className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-[#2a2a33]">
          <button
            onClick={start}
            disabled={selected.length === 0 || creating}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] transition-colors disabled:opacity-40"
          >
            {creating ? "Starting…" : `Start conversation${selected.length > 0 ? ` with ${selected.length}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
