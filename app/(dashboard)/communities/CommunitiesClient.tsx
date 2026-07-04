"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/lib/socket";
import { Send, Plus, X, Lock, Hash } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

interface RoomSummary {
  id: string;
  communityName: string | null;
  isPrivateRoom: boolean;
  memberCount: number;
  lastMessage: { body: string; createdAt: string } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { name: string | null; image: string | null };
}

interface Member {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  isAlumni: boolean;
}

interface Props {
  schoolId: string | null;
  myUserId: string;
  isAdmin: boolean;
  initialRooms: RoomSummary[];
}

// -- School Code Gate ---------------------------------------------------------

function SchoolCodeGate({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/communities/enter-school-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      onJoined();
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh", gap: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--amber)", margin: "0 0 10px" }}>
          School Community
        </p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Enter your school code
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 28px", lineHeight: 1.6 }}>
          {"Your school admin will give you a code. Once you enter it, you'll be added to your school's private community."}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="e.g. lakewood2026"
            className="flex-1 text-sm focus:outline-none"
            style={{ background: "var(--surface)", border: "1px solid var(--border-md)", color: "var(--text)", padding: "10px 16px", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
          />
          <button
            onClick={submit}
            disabled={loading || !code.trim()}
            className="px-5 py-2.5 text-sm font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", border: "none", cursor: "pointer" }}
          >
            {loading ? "..." : "Join"}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
        )}
      </div>
    </div>
  );
}

// -- New Private Room Modal ---------------------------------------------------

function NewRoomModal({
  schoolId,
  onClose,
  onCreate,
}: {
  schoolId: string;
  onClose: () => void;
  onCreate: (room: RoomSummary) => void;
}) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const roomsRes = await fetch("/api/communities/rooms");
        if (!roomsRes.ok) return;
        const roomsData = await roomsRes.json();
        const generalRoom = (roomsData.rooms as RoomSummary[]).find((r) => !r.isPrivateRoom);
        if (!generalRoom) return;
        const res = await fetch(`/api/communities/rooms/${generalRoom.id}/members`);
        if (!res.ok) return;
        const data = await res.json();
        setMembers(data.members ?? []);
      } finally { setLoading(false); }
    };
    fetchMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const create = async () => {
    if (!name.trim() || selected.size === 0 || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/communities/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), participantIds: Array.from(selected) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      onCreate({
        id: data.room.id,
        communityName: name.trim(),
        isPrivateRoom: true,
        memberCount: selected.size + 1,
        lastMessage: null,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div className="w-full max-w-md flex flex-col overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-md)", maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text)", margin: 0 }}>New Private Room</p>
          <button onClick={onClose}><X size={16} style={{ color: "var(--muted)" }} /></button>
        </div>
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name..."
            className="w-full text-sm focus:outline-none bg-transparent"
            style={{ color: "var(--text)", border: "none", padding: 0, fontFamily: "var(--font-body)" }}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
            </div>
          ) : (
            members.map((m) => {
              const isSelected = selected.has(m.userId);
              return (
                <button
                  key={m.userId}
                  onClick={() => toggle(m.userId)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left"
                  style={{ background: isSelected ? "rgba(232,137,58,0.08)" : "transparent", borderBottom: "1px solid var(--border)" }}
                >
                  <Avatar src={m.avatarUrl} displayName={m.displayName} geniusType={null} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{m.displayName}</p>
                    {m.email && <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{m.email}</p>}
                  </div>
                  <div
                    className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0"
                    style={{ background: isSelected ? "var(--amber)" : "transparent", border: `1px solid ${isSelected ? "var(--amber)" : "var(--border-md)"}` }}
                  >
                    {isSelected && <span style={{ color: "#000", fontSize: 10, fontWeight: 700 }}>V</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={create}
            disabled={!name.trim() || selected.size === 0 || creating}
            className="w-full py-2.5 text-sm font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--amber)", color: "#000", fontFamily: "var(--font-mono)", border: "none", cursor: "pointer" }}
          >
            {creating ? "Creating..." : `Create Room (${selected.size} selected)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Room Row -----------------------------------------------------------------

function RoomRow({ room, isActive, onSelect }: { room: RoomSummary; isActive: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 py-2.5 text-left"
      style={{
        background: isActive ? "rgba(232,137,58,0.08)" : "transparent",
        borderLeft: `2px solid ${isActive ? "var(--amber)" : "transparent"}`,
        paddingLeft: isActive ? "10px" : "12px",
        paddingRight: "12px",
        border: "none",
        cursor: "pointer",
      }}
    >
      <div
        className="w-8 h-8 flex items-center justify-center shrink-0"
        style={{ background: room.isPrivateRoom ? "rgba(232,137,58,0.15)" : "rgba(232,137,58,0.08)", color: "var(--amber)" }}
      >
        {room.isPrivateRoom ? <Lock size={13} /> : <Hash size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 600, color: isActive ? "var(--text)" : "var(--text2)" }}>
          {room.communityName ?? (room.isPrivateRoom ? "Private Room" : "General")}
        </p>
        {room.lastMessage ? (
          <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{room.lastMessage.body}</p>
        ) : (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{room.memberCount} members</p>
        )}
      </div>
    </button>
  );
}

// -- Main Component -----------------------------------------------------------

export default function CommunitiesClient({ schoolId, myUserId, isAdmin, initialRooms }: Props) {
  const socket = useSocket();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>(initialRooms);
  const [activeId, setActiveId] = useState<string | null>(initialRooms[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [notLinked, setNotLinked] = useState(!schoolId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find((r) => r.id === activeId) ?? null;

  const loadMessages = useCallback(async (roomId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversations/${roomId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => { if (!activeId) return; loadMessages(activeId); }, [activeId, loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!socket || !activeId) return;
    socket.emit("join_conversation", activeId);
    const handler = (msg: Message) => {
      if (msg.senderId === myUserId) return;
      setMessages((prev) => [...prev, msg]);
      setRooms((prev) => prev.map((r) =>
        r.id === activeId
          ? { ...r, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt }
          : r
      ));
    };
    socket.on("conversation_message", handler);
    return () => {
      socket.off("conversation_message", handler);
      socket.emit("leave_conversation", activeId);
    };
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
        setRooms((prev) => prev.map((r) =>
          r.id === activeId
            ? { ...r, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt }
            : r
        ));
      }
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleJoined = () => {
    setNotLinked(false);
    router.refresh();
  };

  if (notLinked) {
    return <SchoolCodeGate onJoined={handleJoined} />;
  }

  return (
    <>
      {showNewRoom && schoolId && (
        <NewRoomModal
          schoolId={schoolId}
          onClose={() => setShowNewRoom(false)}
          onCreate={(room) => {
            setRooms((prev) => [...prev, room]);
            setActiveId(room.id);
            setShowNewRoom(false);
            setShowThread(true);
          }}
        />
      )}

      <div className="flex overflow-hidden rounded-xl" style={{ height: "calc(100vh - 4rem)", border: "1px solid var(--border-md)" }}>

        <div
          className={`${showThread ? "hidden md:flex" : "flex"} w-full md:w-64 flex-col shrink-0`}
          style={{ background: "var(--bg2)", borderRight: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}>
              Community
            </h2>
            {isAdmin && (
              <button
                onClick={() => setShowNewRoom(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "var(--amber)", color: "#000" }}
                title="New private room"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs" style={{ color: "var(--muted)" }}>No rooms yet.</p>
              </div>
            ) : (
              <>
                {rooms.filter((r) => !r.isPrivateRoom).map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    isActive={room.id === activeId}
                    onSelect={() => { setActiveId(room.id); setShowThread(true); }}
                  />
                ))}
                {rooms.some((r) => r.isPrivateRoom) && (
                  <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)", fontFamily: "var(--font-display)" }}>
                    Private Rooms
                  </p>
                )}
                {rooms.filter((r) => r.isPrivateRoom).map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    isActive={room.id === activeId}
                    onSelect={() => { setActiveId(room.id); setShowThread(true); }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {activeRoom ? (
          <div
            className={`flex-1 flex-col min-w-0 ${showThread ? "flex" : "hidden md:flex"}`}
            style={{ background: "var(--bg)" }}
          >
            <div className="h-14 flex items-center px-5 gap-3 shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={() => setShowThread(false)}
                className="md:hidden mr-1 text-sm"
                style={{ color: "var(--text2)", background: "none", border: "none", cursor: "pointer" }}
              >
                Back
              </button>
              {activeRoom.isPrivateRoom
                ? <Lock size={16} style={{ color: "var(--amber)", flexShrink: 0 }} />
                : <Hash size={16} style={{ color: "var(--amber)", flexShrink: 0 }} />
              }
              <div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 500, color: "var(--text)", lineHeight: 1.1 }}>
                  {activeRoom.communityName ?? (activeRoom.isPrivateRoom ? "Private Room" : "General")}
                </p>
                <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                  {activeRoom.memberCount} members
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--amber)", borderTopColor: "transparent" }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-2xl">Hi</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {activeRoom.isPrivateRoom ? "This is a private room." : "Welcome to your school community."} Say hello!
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((msg, i) => {
                    const isMe = msg.senderId === myUserId;
                    const grouped = messages[i - 1]?.senderId === msg.senderId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}>
                        {!grouped && !isMe && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                            style={{ background: "var(--surface3)", color: "var(--text2)" }}
                          >
                            {msg.sender?.name?.[0] ?? "?"}
                          </div>
                        )}
                        {(grouped || isMe) && <div className="w-7 shrink-0" />}
                        <div
                          className="max-w-[70%] px-3.5 py-2.5 text-sm leading-relaxed"
                          style={isMe ? {
                            background: "linear-gradient(135deg, rgba(232,137,58,0.85), rgba(232,137,58,0.6))",
                            color: "#fff",
                            borderRadius: "13px 13px 3px 13px",
                            fontFamily: "var(--font-body)",
                            fontWeight: 500,
                          } : {
                            background: "var(--surface2)",
                            color: "var(--text)",
                            borderRadius: "13px 13px 13px 3px",
                            border: "1px solid var(--border-md)",
                            fontFamily: "var(--font-body)",
                            fontWeight: 500,
                          }}
                        >
                          {!isMe && !grouped && (
                            <p className="text-xs mb-1 font-semibold" style={{ color: "var(--amber)" }}>
                              {msg.sender?.name ?? "Member"}
                            </p>
                          )}
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 shrink-0" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Message the community..."
                  className="flex-1 resize-none text-sm focus:outline-none max-h-32 overflow-y-auto"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border-md)", padding: "10px 16px" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-md)"; }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{ background: "var(--amber)", color: "#000", border: "none", cursor: "pointer" }}
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-xs mt-1.5 pl-1" style={{ color: "var(--muted)" }}>Enter to send - Shift+Enter for newline</p>
            </div>
          </div>
        ) : (
          <div
            className={`flex-1 items-center justify-center gap-4 ${showThread ? "flex" : "hidden md:flex"}`}
            style={{ background: "var(--bg)" }}
          >
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>No room selected</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Pick a room from the list</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}