"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/socket";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import { Send, Plus, X, Search, Pencil, Check } from "lucide-react";

interface Participant {
  id: string;
  userId: string;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    geniusType: GeniusTypeKey | null;
    handle: string | null;
  } | null;
}

interface ConvSummary {
  id: string;
  type: string;
  name: string | null;
  canRename: boolean;
  teamId: string | null;
  teamName: string | null;
  updatedAt: string;
  lastMessage: { body: string; createdAt: string } | null;
  participants: Participant[];
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { name: string | null; image: string | null };
}

interface MyProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  geniusType: GeniusTypeKey | null;
}

interface PeerResult {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  geniusType: string | null;
  handle: string | null;
}

interface Props {
  conversations: ConvSummary[];
  myUserId: string;
  myProfileId: string;
  myProfile: MyProfile;
  initialOpenId?: string | null;
  canSearchAnyone: boolean;
}

interface OpenRoom {
  id: string;
  communityName: string | null;
  memberCount: number;
}

function convDisplayName(conv: ConvSummary, myUserId: string): string {
  if (conv.type === "TEAM") return conv.teamName ?? conv.name ?? "Team";
  if (conv.name) return conv.name;
  if (conv.type === "DIRECT") {
    const other = conv.participants.find((p) => p.userId !== myUserId);
    return other?.profile?.displayName ?? "Unknown";
  }
  const others = conv.participants
    .filter((p) => p.userId !== myUserId)
    .map((p) => p.profile?.displayName ?? "?")
    .join(", ");
  return others || "Group";
}

function convAvatar(conv: ConvSummary, myUserId: string) {
  if (conv.type === "DIRECT") {
    const other = conv.participants.find((p) => p.userId !== myUserId);
    return { src: other?.profile?.avatarUrl, displayName: other?.profile?.displayName, geniusType: other?.profile?.geniusType };
  }
  return { src: null, displayName: conv.name ?? "G", geniusType: null as GeniusTypeKey | null };
}

// ── New Message Modal ─────────────────────────────────────────────────────────

function NewMessageModal({ myUserId, canSearchAnyone, onClose, onOpen }: {
  myUserId: string;
  canSearchAnyone: boolean;
  onClose: () => void;
  onOpen: (convId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PeerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(canSearchAnyone === false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (canSearchAnyone) inputRef.current?.focus(); }, [canSearchAnyone]);

  useEffect(() => {
    if (canSearchAnyone) return;
    (async () => {
      try {
        const res = await fetch("/api/communities/rooms");
        const data = await res.json();
        setRooms(((data.rooms ?? []) as (OpenRoom & { isPrivateRoom: boolean })[]).filter((r) => !r.isPrivateRoom));
      } finally { setRoomsLoading(false); }
    })();
  }, [canSearchAnyone]);

  useEffect(() => {
    if (!canSearchAnyone || !q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/peers?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults((data.peers ?? []).slice(0, 8));
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, canSearchAnyone]);

  const startDM = async (userId: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: [userId], type: "DIRECT" }),
      });
      const data = await res.json();
      if (data.conversation?.id) {
        onOpen(data.conversation.id);
        onClose();
      }
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border-md)", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {canSearchAnyone ? (
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted)" }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or handle…"
              className="flex-1 text-sm bg-transparent focus:outline-none"
              style={{ color: "var(--text)", border: "none", padding: 0 }}
            />
            <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--muted)" }} /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Open rooms</span>
            <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--muted)" }} /></button>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto">
          {canSearchAnyone ? (
            <>
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
                </div>
              )}
              {!loading && q && results.length === 0 && (
                <p className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>No users found</p>
              )}
              {!loading && !q && (
                <p className="text-center text-xs py-8" style={{ color: "var(--muted)" }}>Type a name to search</p>
              )}
              {results.map((peer) => (
                <button
                  key={peer.id}
                  onClick={() => startDM(peer.userId)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <Avatar src={peer.avatarUrl} displayName={peer.displayName} geniusType={peer.geniusType as GeniusTypeKey | null} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>{peer.displayName}</p>
                    {peer.handle && <p className="text-xs truncate" style={{ color: "var(--muted)" }}>@{peer.handle}</p>}
                  </div>
                  {peer.geniusType && <GeniusTypeBadge geniusType={peer.geniusType as GeniusTypeKey} size="sm" />}
                </button>
              ))}
            </>
          ) : (
            <>
              {roomsLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
                </div>
              )}
              {!roomsLoading && rooms.length === 0 && (
                <p className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>No open rooms yet</p>
              )}
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => onOpen(room.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>{room.communityName ?? "Room"}</p>
                    <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{room.memberCount} member{room.memberCount !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MessagesClient({ conversations: initialConvs, myUserId, myProfileId, myProfile, initialOpenId, canSearchAnyone }: Props) {
  const socket = useSocket();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConvSummary[]>(initialConvs);
  const [activeId, setActiveId] = useState<string | null>(initialOpenId ?? initialConvs[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => { if (!activeId) return; loadMessages(activeId); setRenaming(false); }, [activeId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!socket || !activeId) return;
    socket.emit("join_conversation", activeId);
    const handler = (msg: Message) => {
      if (msg.senderId === myUserId) return;
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) => prev.map((c) =>
        c.id === activeId ? { ...c, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt } : c
      ));
    };
    socket.on("conversation_message", handler);
    return () => { socket.off("conversation_message", handler); socket.emit("leave_conversation", activeId); };
  }, [socket, activeId, myUserId]);

  const sendMessage = async () => {
    if (!input.trim() || !activeId || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (res.ok) {
        const data = await res.json();
        const msg: Message = data.message;
        setMessages((prev) => [...prev, msg]);
        setConversations((prev) => prev.map((c) =>
          c.id === activeId ? { ...c, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt } : c
        ));
      }
    } finally { setSending(false); }
  };

  const saveRename = async () => {
    if (!activeId || !renameValue.trim() || savingRename) return;
    setSavingRename(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => prev.map((c) =>
          c.id === activeId ? { ...c, name: data.name } : c
        ));
        setRenaming(false);
      } else {
        const err = await res.json().catch(() => null);
        setRenameError(err?.error ?? "Couldn't rename this chat.");
      }
    } finally {
      setSavingRename(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleNewConv = async (convId: string) => {
    setActiveId(convId);
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
    }
  };

  const myGT = myProfile.geniusType ? GENIUS_TYPES[myProfile.geniusType] : null;

  const sections = [
    { label: "Direct", items: conversations.filter((c) => c.type === "DIRECT") },
    { label: "Group", items: conversations.filter((c) => c.type === "GROUP") },
    { label: "Team", items: conversations.filter((c) => c.type === "TEAM") },
    { label: "Rooms", items: conversations.filter((c) => c.type === "COMMUNITY") },
  ].filter((s) => s.items.length > 0);

  return (
    <>
      {showNewMsg && (
        <NewMessageModal
          myUserId={myUserId}
          canSearchAnyone={canSearchAnyone}
          onClose={() => setShowNewMsg(false)}
          onOpen={(convId) => {
            setShowNewMsg(false);
            handleNewConv(convId);
            setShowThread(true);
          }}
        />
      )}

      <div className="flex overflow-hidden rounded-xl" style={{ height: "calc(100vh - 4rem)", border: "1px solid var(--border-md)" }}>

        {/* ── Conversation list ─────────────────────── */}
        <div className={`${showThread ? "hidden md:flex" : "flex"} w-full md:w-64 flex-col shrink-0`} style={{ background: "var(--bg2)", borderRight: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-bold uppercase tracking-widest truncate" style={{ color: "var(--text)", fontFamily: "var(--font-display, sans-serif)" }}>
              Messages
            </h2>
            <button
              onClick={() => setShowNewMsg(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "var(--gold)", color: "#04070F" }}
              title="New message"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sections.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>No conversations yet.</p>
                <button
                  onClick={() => setShowNewMsg(true)}
                  className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}
                >
                  Start a conversation
                </button>
              </div>
            ) : (
              sections.map(({ label, items }) => (
                <div key={label}>
                  <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display, sans-serif)" }}>
                    {label}
                  </p>
                  {items.map((conv) => {
                    const av = convAvatar(conv, myUserId);
                    const name = convDisplayName(conv, myUserId);
                    const isActive = conv.id === activeId;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => { setActiveId(conv.id); setShowThread(true); }}
                        className="w-full flex items-center gap-3 py-2.5 text-left transition-colors"
                        style={{
                          background: isActive ? "rgba(74,128,240,0.08)" : "transparent",
                          borderLeft: `2px solid ${isActive ? "var(--gold)" : "transparent"}`,
                          paddingLeft: isActive ? "10px" : "12px",
                          paddingRight: "12px",
                        }}
                      >
                        <Avatar src={av.src} displayName={av.displayName} geniusType={av.geniusType} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, color: isActive ? "var(--text)" : "var(--text2)" }}>{name}</p>
                          {conv.lastMessage && (
                            <p className="text-xs truncate" style={{ color: "var(--text2)", fontWeight: 500 }}>{conv.lastMessage.body}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Thread ───────────────────────────────────── */}
        {activeConv ? (
          <div className={`flex-1 flex-col min-w-0 ${showThread ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg)" }}>
            {/* Header */}
            <div className="h-14 flex items-center px-5 gap-3 shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={() => setShowThread(false)}
                className="md:hidden mr-1 flex items-center gap-1 text-sm"
                style={{ color: "var(--text2)" }}
              >
                <span style={{ fontSize: 18 }}>←</span>
              </button>
              {(() => { const av = convAvatar(activeConv, myUserId); return <Avatar src={av.src} displayName={av.displayName} geniusType={av.geniusType} size={30} />; })()}
              <div className="flex-1 min-w-0">
                {renaming ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") { setRenaming(false); setRenameError(null); } }}
                        maxLength={80}
                        className="text-lg"
                        style={{ fontFamily: "var(--font-serif)", fontWeight: 500, color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border)", padding: "2px 8px", minWidth: 180 }}
                      />
                      <button type="button" onClick={saveRename} disabled={savingRename || !renameValue.trim()} title="Save" aria-label="Save">
                        <Check className="w-4 h-4" style={{ color: "var(--gold)" }} />
                      </button>
                      <button type="button" onClick={() => { setRenaming(false); setRenameError(null); }} title="Cancel" aria-label="Cancel">
                        <X className="w-4 h-4" style={{ color: "var(--text2)" }} />
                      </button>
                    </div>
                    {renameError && (
                      <p style={{ color: "#ef4444", fontSize: 11 }}>{renameError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.3px", color: "var(--text)", lineHeight: 1.1 }}>
                      {convDisplayName(activeConv, myUserId)}
                    </p>
                    {activeConv.canRename && (
                      <button
                        type="button"
                        onClick={() => { setRenameValue(activeConv.name ?? convDisplayName(activeConv, myUserId)); setRenameError(null); setRenaming(true); }}
                        title="Rename this chat"
                        aria-label="Rename this chat"
                      >
                        <Pencil className="w-3.5 h-3.5" style={{ color: "var(--text2)" }} />
                      </button>
                    )}
                  </div>
                )}
                {activeConv.type === "DIRECT" && (() => {
                  const other = activeConv.participants.find((p) => p.userId !== myUserId);
                  return other?.profile?.geniusType ? <GeniusTypeBadge geniusType={other.profile.geniusType} size="sm" /> : null;
                })()}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-2xl">👋</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>Say hello to start the conversation</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === myUserId;
                    const grouped = messages[i - 1]?.senderId === msg.senderId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}>
                        {!grouped && !isMe && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: "var(--surface3)", color: "var(--text2)" }}>
                            {msg.sender?.name?.[0] ?? "?"}
                          </div>
                        )}
                        {(grouped || isMe) && <div className="w-7 shrink-0" />}
                        <div
                          className="max-w-[70%] px-3.5 py-2.5 text-sm leading-relaxed"
                          style={isMe ? {
                            background: "linear-gradient(135deg, #0a3ea0, #1060d8)",
                            color: "#ffffff",
                            borderRadius: "13px 13px 3px 13px",
                            boxShadow: "0 4px 20px rgba(16,96,216,0.5)",
                            fontFamily: "var(--font-body, sans-serif)",
                            fontWeight: 500,
                          } : {
                            background: "var(--surface2)",
                            color: "var(--text)",
                            borderRadius: "13px 13px 13px 3px",
                            border: "1px solid var(--border-md)",
                            fontFamily: "var(--font-body, sans-serif)",
                            fontWeight: 500,
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 shrink-0" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Message…"
                  className="flex-1 resize-none rounded-xl text-sm focus:outline-none transition-colors max-h-32 overflow-y-auto"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", padding: "10px 16px" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-md)"; }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="p-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ background: "linear-gradient(135deg, #0a3ea0, #1060d8)", color: "#fff", boxShadow: "0 4px 16px rgba(16,96,216,0.5)" }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs mt-1.5 pl-1" style={{ color: "var(--muted)" }}>Enter to send · Shift+Enter for newline</p>
            </div>
          </div>
        ) : (
          <div className={`flex-1 flex-col items-center justify-center gap-4 ${showThread ? "flex" : "hidden md:flex"}`} style={{ background: "var(--bg)" }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(74,128,240,0.08)", border: "1px solid var(--border-md)" }}
            >
              <Send className="w-7 h-7" style={{ color: "var(--gold)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)", fontFamily: "var(--font-body, sans-serif)" }}>No conversation selected</p>
              <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>Pick one from the list or start a new one</p>
              <button
                onClick={() => setShowNewMsg(true)}
                className="text-sm font-bold px-5 py-2.5 rounded-lg uppercase tracking-widest"
                style={{ background: "var(--gold)", color: "#04070F", fontFamily: "var(--font-display, sans-serif)" }}
              >
                New Message
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
