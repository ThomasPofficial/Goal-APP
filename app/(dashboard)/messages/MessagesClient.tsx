"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import { Send, MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  otherUser: { id: string; name: string; avatarUrl: string | null };
  lastMessage: { content: string; isMe: boolean; createdAt: string } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: {
    id: string;
    profile: { displayName: string; avatarUrl: string | null } | null;
  };
}

interface Props {
  initialConversations: Conversation[];
  currentUserId: string;
  openWithUserId: string | null;
}

export default function MessagesClient({
  initialConversations,
  currentUserId,
  openWithUserId,
}: Props) {
  const router = useRouter();
  const [convos, setConvos] = useState(initialConversations);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConvo = convos.find((c) => c.id === activeConvoId);

  useEffect(() => {
    if (!openWithUserId) return;
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: openWithUserId }),
    })
      .then((r) => r.json())
      .then(async ({ conversationId }) => {
        if (!conversationId) return;
        // Fetch full conversation list so sidebar stays up to date
        const res = await fetch("/api/messages");
        if (res.ok) {
          const all = await res.json();
          // Re-format to match the Conversation shape expected by the client
          const formatted: Conversation[] = all.map((c: any) => {
            const other = c.participants.find((p: any) => p.userId !== currentUserId);
            const last = c.messages[0];
            return {
              id: c.id,
              otherUser: {
                id: other?.userId ?? "",
                name: other?.user?.profile?.displayName ?? other?.user?.name ?? "Unknown",
                avatarUrl: other?.user?.profile?.avatarUrl ?? null,
              },
              lastMessage: last
                ? { content: last.content, isMe: last.senderId === currentUserId, createdAt: last.createdAt }
                : null,
              updatedAt: c.updatedAt,
            };
          });
          setConvos(formatted);
        }
        setActiveConvoId(conversationId);
      });
  }, [openWithUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeConvoId) loadMessages(activeConvoId);
  }, [activeConvoId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(convoId: string) {
    setLoadingMessages(true);
    const res = await fetch(`/api/messages/${convoId}`);
    const data = await res.json();
    setLoadingMessages(false);
    setMessages(data);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvoId) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    await fetch(`/api/messages/${activeConvoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSending(false);
    await loadMessages(activeConvoId);
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 bg-[#16161a] border border-[#2a2a33] rounded-xl overflow-hidden">
      {/* Sidebar: Conversation list */}
      <div className="w-64 flex-shrink-0 border-r border-[#2a2a33] flex flex-col">
        <div className="px-4 py-3 border-b border-[#2a2a33]">
          <h2 className="text-sm font-semibold text-[#e8e8ec]">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare className="w-6 h-6 text-[#5a5a6a] mx-auto mb-2" />
              <p className="text-xs text-[#5a5a6a]">
                No messages yet. Visit a profile to start a conversation.
              </p>
            </div>
          ) : (
            convos.map((c) => {
              const initials = getInitials(c.otherUser.name);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveConvoId(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1e1e24] transition-colors text-left border-b border-[#2a2a3320] ${
                    activeConvoId === c.id ? "bg-[#1e1e24]" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#c9a84c20] text-[#c9a84c] text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#e8e8ec] truncate">
                      {c.otherUser.name}
                    </div>
                    {c.lastMessage && (
                      <div className="text-xs text-[#5a5a6a] truncate">
                        {c.lastMessage.isMe ? "You: " : ""}
                        {c.lastMessage.content}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main: Message thread */}
      {activeConvo ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="px-5 py-3 border-b border-[#2a2a33] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c20] text-[#c9a84c] text-xs font-bold flex items-center justify-center">
              {getInitials(activeConvo.otherUser.name)}
            </div>
            <span className="text-sm font-semibold text-[#e8e8ec]">
              {activeConvo.otherUser.name}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingMessages ? (
              <div className="text-center text-xs text-[#5a5a6a] py-8">
                Loading...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-xs text-[#5a5a6a] py-8">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-[#c9a84c20] text-[#e8e8ec] border border-[#c9a84c30]"
                          : "bg-[#1e1e24] text-[#e8e8ec] border border-[#2a2a33]"
                      }`}
                    >
                      {msg.content}
                      <div className="text-[10px] text-[#5a5a6a] mt-1">
                        {formatRelativeDate(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="px-5 py-3 border-t border-[#2a2a33] flex gap-3"
          >
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write a message..."
              className="flex-1 bg-[#1e1e24] border border-[#2a2a33] rounded-md px-3 py-2 text-sm text-[#e8e8ec] placeholder-[#5a5a6a] outline-none focus:border-[#c9a84c] transition-colors"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="flex items-center justify-center w-9 h-9 rounded-md bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#5a5a6a]">Select a conversation</p>
        </div>
      )}
    </div>
  );
}
