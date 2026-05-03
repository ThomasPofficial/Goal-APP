"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/lib/socket";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import { Send } from "lucide-react";

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

interface Props {
  conversations: ConvSummary[];
  myUserId: string;
  myProfileId: string;
  myProfile: MyProfile;
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

export default function MessagesClient({ conversations: initialConvs, myUserId, myProfileId, myProfile }: Props) {
  const socket = useSocket();
  const [conversations, setConversations] = useState<ConvSummary[]>(initialConvs);
  const [activeId, setActiveId] = useState<string | null>(initialConvs[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socket || !activeId) return;
    socket.emit("join_conversation", activeId);

    const handler = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, lastMessage: { body: msg.content, createdAt: msg.createdAt }, updatedAt: msg.createdAt }
            : c
        )
      );
    };

    socket.on("conversation_message", handler);
    return () => {
      socket.off("conversation_message", handler);
      socket.emit("leave_conversation", activeId);
    };
  }, [socket, activeId]);

  const sendMessage = async () => {
    if (!input.trim() || !activeId || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const myGT = myProfile.geniusType ? GENIUS_TYPES[myProfile.geniusType] : null;

  const sections = [
    { label: "Direct", items: conversations.filter((c) => c.type === "DIRECT") },
    { label: "Group", items: conversations.filter((c) => c.type === "GROUP") },
    { label: "Team", items: conversations.filter((c) => c.type === "TEAM") },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-[#2a2a33]">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="w-64 border-r border-[#2a2a33] bg-[#16161a] flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-[#2a2a33]">
          <h2 className="text-sm font-semibold text-[#e8e8ec]">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sections.length === 0 ? (
            <div className="p-6 text-center text-[#5a5a6a] text-xs">
              No conversations yet.
            </div>
          ) : (
            sections.map(({ label, items }) => (
              <div key={label}>
                <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-[#5a5a6a] uppercase tracking-widest">
                  {label}
                </p>
                {items.map((conv) => {
                  const av = convAvatar(conv, myUserId);
                  const name = convDisplayName(conv, myUserId);
                  const isActive = conv.id === activeId;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveId(conv.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-[#c9a84c15] border-l-2 border-[#c9a84c] pl-[10px]"
                          : "hover:bg-[#1e1e24] border-l-2 border-transparent"
                      }`}
                    >
                      <Avatar src={av.src} displayName={av.displayName} geniusType={av.geniusType} size={34} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? "text-[#e8e8ec]" : "text-[#9898a8]"}`}>
                          {name}
                        </p>
                        {conv.lastMessage && (
                          <p className="text-xs text-[#5a5a6a] truncate">
                            {conv.lastMessage.body}
                          </p>
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

      {/* ── Thread ──────────────────────────────────────────── */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f11]">

          {/* Header */}
          <div className="h-14 border-b border-[#2a2a33] bg-[#16161a] flex items-center px-5 gap-3 shrink-0">
            {(() => {
              const av = convAvatar(activeConv, myUserId);
              return <Avatar src={av.src} displayName={av.displayName} geniusType={av.geniusType} size={30} />;
            })()}
            <div>
              <p className="text-sm font-semibold text-[#e8e8ec]">
                {convDisplayName(activeConv, myUserId)}
              </p>
              {activeConv.type === "DIRECT" && (() => {
                const other = activeConv.participants.find((p) => p.userId !== myUserId);
                return other?.profile?.geniusType ? (
                  <GeniusTypeBadge geniusType={other.profile.geniusType} size="sm" />
                ) : null;
              })()}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[#5a5a6a] text-sm">
                No messages yet — say hello!
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === myUserId;
                  const grouped = messages[i - 1]?.senderId === msg.senderId;
                  const bubbleBg = isMe ? (myGT?.color ?? "#c9a84c") : "#1e1e24";

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`}
                    >
                      {!grouped && !isMe && (
                        <div className="w-7 h-7 rounded-full bg-[#2a2a33] flex items-center justify-center text-xs font-medium text-[#9898a8] shrink-0">
                          {msg.sender?.name?.[0] ?? "?"}
                        </div>
                      )}
                      {(grouped || isMe) && <div className="w-7 shrink-0" />}
                      <div
                        className="max-w-[70%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
                        style={{
                          backgroundColor: bubbleBg,
                          color: isMe ? "#0f0f11" : "#e8e8ec",
                          border: isMe ? "none" : "1px solid #2a2a33",
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
          <div className="border-t border-[#2a2a33] bg-[#16161a] p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Message..."
                className="flex-1 resize-none rounded-xl border border-[#2a2a33] bg-[#1e1e24] text-[#e8e8ec] placeholder-[#5a5a6a] px-4 py-2.5 text-sm focus:outline-none focus:border-[#c9a84c] transition-colors max-h-32 overflow-y-auto"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="p-2.5 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#3a3a44] mt-1.5 pl-1">Enter to send · Shift+Enter for newline</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#0f0f11]">
          <div className="text-center">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm text-[#5a5a6a]">Select a conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
