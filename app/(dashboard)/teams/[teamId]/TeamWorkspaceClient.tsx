"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Send, Plus, ChevronDown, ChevronUp, ExternalLink, X, Trash2, Check } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import GeniusTypeBadge from "@/components/ui/GeniusTypeBadge";
import { GENIUS_TYPES } from "@/lib/geniusTypes";
import type { GeniusTypeKey } from "@/lib/geniusTypes";
import { useSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  role: string;
  profile: { id: string; userId: string; displayName: string; avatarUrl: string | null; geniusType: GeniusTypeKey | null; handle: string | null } | null;
}

interface TeamData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  org: { id: string; name: string } | null;
  conversationId: string | null;
  members: Member[];
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: {
    id: string;
    name: string | null;
    profile: { displayName: string; avatarUrl: string | null; geniusType: string | null } | null;
  };
}

interface NoteboardCard {
  id: string;
  type: "NOTE" | "TASK" | "CHECKLIST";
  payload: string;
  creatorId: string;
  order: number;
  createdAt: string;
}

const NOTE_COLORS: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "#064e3b", text: "#a7f3d0" },
  navy: { bg: "#0f1b4a", text: "#bfdbfe" },
  burgundy: { bg: "#4c0519", text: "#fecdd3" },
  violet: { bg: "#2e1065", text: "#e9d5ff" },
  slate: { bg: "#1e293b", text: "#cbd5e1" },
  white: { bg: "#ffffff", text: "#1e293b" },
};

export default function TeamWorkspaceClient({
  team, myProfileId, myGeniusType, myUserId,
}: {
  team: TeamData; myProfileId: string; myGeniusType: GeniusTypeKey | null; myUserId: string;
}) {
  const [tab, setTab] = useState<"chat" | "board">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cards, setCards] = useState<NoteboardCard[]>([]);
  const [addingCard, setAddingCard] = useState<"NOTE" | "TASK" | "CHECKLIST" | null>(null);
  const [membersExpanded, setMembersExpanded] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  // Load messages
  useEffect(() => {
    fetch(`/api/teams/${team.id}/messages`)
      .then((r) => r.json())
      .then((d) => { setMessages(d.messages ?? []); });
  }, [team.id]);

  // Load noteboard
  const loadCards = useCallback(() => {
    fetch(`/api/teams/${team.id}/noteboard`)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []));
  }, [team.id]);

  useEffect(() => { loadCards(); }, [loadCards]);

  // Socket
  useEffect(() => {
    socket.connect();
    socket.emit("join_team_room", { teamId: team.id });
    socket.on("team_message_receive", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("noteboard_card_create", loadCards);
    socket.on("noteboard_card_update", loadCards);
    socket.on("noteboard_card_delete", loadCards);
    return () => {
      socket.emit("leave_team_room", { teamId: team.id });
      socket.off("team_message_receive");
      socket.off("noteboard_card_create");
      socket.off("noteboard_card_update");
      socket.off("noteboard_card_delete");
    };
  }, [team.id, socket, loadCards]);

  // Auto scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!msgInput.trim() || sending) return;
    const content = msgInput.trim();
    setSending(true);
    setMsgInput("");
    socket.emit("team_message_send", { teamId: team.id, content });
    await fetch(`/api/teams/${team.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: content }),
    });
    setSending(false);
  };

  const typeInfo = myGeniusType ? GENIUS_TYPES[myGeniusType] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-[#2a2a33]">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {team.org && (
              <Link href={`/orgs/${team.org.id}`} className="text-xs text-[#5a5a6a] hover:text-[#c9a84c] transition-colors flex items-center gap-1">
                {team.org.name} <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                team.status === "ACTIVE" ? "bg-green-950 text-green-400" :
                team.status === "SUBMITTED" ? "bg-blue-950 text-blue-400" :
                "bg-[#1e1e24] text-[#9898a8]"
              )}
            >
              {team.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#e8e8ec]">{team.name}</h1>
          {team.description && (
            <p className="text-sm text-[#9898a8] mt-0.5">{team.description}</p>
          )}
        </div>
        <div className="flex -space-x-2">
          {team.members.slice(0, 6).map((m) => (
            <Avatar
              key={m.id}
              src={m.profile?.avatarUrl}
              name={m.profile?.displayName}
              geniusType={m.profile?.geniusType}
              size="sm"
              className="border-2 border-[#0f0f11]"
            />
          ))}
          {team.members.length > 6 && (
            <div className="w-8 h-8 rounded-full bg-[#2a2a33] border-2 border-[#0f0f11] flex items-center justify-center text-[10px] text-[#9898a8] font-medium">
              +{team.members.length - 6}
            </div>
          )}
        </div>
      </div>

      {/* ── Member list (collapsible) ─────────────────────────────────────── */}
      <div className="mb-4">
        <button
          onClick={() => setMembersExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#9898a8] uppercase tracking-wider hover:text-[#e8e8ec] transition-colors"
        >
          Members · {team.members.length}
          {membersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {membersExpanded && (
          <div className="flex flex-wrap gap-2 mt-2">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#16161a] border border-[#2a2a33]">
                <Avatar src={m.profile?.avatarUrl} name={m.profile?.displayName} geniusType={m.profile?.geniusType} size="xs" />
                <span className="text-xs text-[#e8e8ec]">{m.profile?.displayName}</span>
                {m.role === "ADMIN" && <span className="text-[10px] text-[#c9a84c] font-semibold">Admin</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-4 lg:hidden">
        {(["chat", "board"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize",
              tab === t ? "bg-[#c9a84c] border-[#c9a84c] text-[#0f0f11]" : "border-[#2a2a33] text-[#9898a8]"
            )}
          >
            {t === "board" ? "Noteboard" : "Chat"}
          </button>
        ))}
      </div>

      {/* ── Main workspace ────────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat */}
        <div className={cn("flex flex-col flex-[3] min-w-0", tab === "board" ? "hidden lg:flex" : "flex")}>
          <div className="flex-1 overflow-y-auto space-y-1 mb-3 pr-1">
            {messages.map((msg, i) => {
              const isMe = msg.sender.id === myUserId;
              const senderInfo = msg.sender.profile;
              const senderType = senderInfo?.geniusType as GeniusTypeKey | null;
              const typeColor = senderType ? GENIUS_TYPES[senderType].color : undefined;
              const prevMsg = messages[i - 1];
              const grouped = prevMsg?.sender.id === msg.sender.id;

              return (
                <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row", grouped && "mt-0.5")}>
                  {!grouped && !isMe && (
                    <Avatar src={senderInfo?.avatarUrl} name={senderInfo?.displayName} geniusType={senderType} size="sm" className="flex-shrink-0 mt-0.5" />
                  )}
                  {grouped && !isMe && <div className="w-8 flex-shrink-0" />}
                  <div className={cn("max-w-[70%]")}>
                    {!grouped && (
                      <p className={cn("text-[11px] font-medium text-[#9898a8] mb-0.5", isMe && "text-right")}>
                        {isMe ? "You" : senderInfo?.displayName ?? msg.sender.name}
                      </p>
                    )}
                    <div
                      className={cn("px-3 py-2 rounded-2xl text-sm leading-relaxed", isMe ? "rounded-tr-sm" : "rounded-tl-sm")}
                      style={isMe && typeColor ? { background: `${typeColor}18`, color: "inherit" } : undefined}
                    >
                      <span className={cn(
                        !isMe && "bg-[#16161a] border border-[#2a2a33] px-3 py-2 rounded-2xl rounded-tl-sm block",
                        isMe && "block"
                      )}>
                        {msg.content}
                      </span>
                    </div>
                    <p className={cn("text-[10px] text-[#5a5a6a] mt-0.5", isMe && "text-right")}>
                      {format(new Date(msg.createdAt), "h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 items-end">
            <textarea
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Message the team…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[#2a2a33] bg-[#16161a] text-sm text-[#e8e8ec] placeholder-[#5a5a6a] px-4 py-2.5 focus:outline-none focus:border-[#c9a84c] max-h-32 transition-colors"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={sendMessage}
              disabled={!msgInput.trim() || sending}
              className="p-2.5 rounded-xl bg-[#c9a84c] hover:bg-[#e3c06a] text-[#0f0f11] disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Noteboard */}
        <div className={cn("flex flex-col flex-[2] min-w-0", tab === "chat" ? "hidden lg:flex" : "flex")}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#9898a8] uppercase tracking-wider">Noteboard</p>
            <div className="relative group">
              <button className="flex items-center gap-1 text-xs font-medium text-[#c9a84c] hover:text-[#e3c06a] transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
              <div className="absolute right-0 top-full mt-1 bg-[#1e1e24] border border-[#2a2a33] rounded-lg shadow-lg py-1 z-10 hidden group-focus-within:block min-w-[120px]">
                {(["NOTE", "TASK", "CHECKLIST"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddingCard(t)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#e8e8ec] hover:bg-[#2a2a33] transition-colors capitalize"
                  >
                    {t.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {addingCard && (
              <AddCardForm
                type={addingCard}
                teamId={team.id}
                myProfileId={myProfileId}
                members={team.members}
                onDone={() => { setAddingCard(null); loadCards(); }}
                onCancel={() => setAddingCard(null)}
              />
            )}
            {cards.map((card) => (
              <NoteCard
                key={card.id}
                card={card}
                teamId={team.id}
                members={team.members}
                myProfileId={myProfileId}
                onUpdate={loadCards}
              />
            ))}
            {cards.length === 0 && !addingCard && (
              <div className="text-center py-12 text-xs text-[#5a5a6a]">
                No cards yet. Add a note, task, or checklist.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AddCardForm ──────────────────────────────────────────────────────────────

function AddCardForm({
  type, teamId, myProfileId, members, onDone, onCancel,
}: {
  type: "NOTE" | "TASK" | "CHECKLIST"; teamId: string; myProfileId: string;
  members: Member[]; onDone: () => void; onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteColor, setNoteColor] = useState("emerald");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [checkItems, setCheckItems] = useState([{ id: crypto.randomUUID(), text: "", checked: false }]);

  const save = async () => {
    setSaving(true);
    let payload: unknown;
    if (type === "NOTE") payload = { body: noteBody, color: noteColor };
    else if (type === "TASK") payload = { title: taskTitle, assigneeIds: [myProfileId], dueDate: taskDue || null, status: "todo" };
    else payload = { title: checklistTitle, items: checkItems.filter((i) => i.text.trim()) };

    await fetch(`/api/teams/${teamId}/noteboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="bg-[#16161a] border border-[#c9a84c] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#9898a8] uppercase">{type.toLowerCase()}</span>
        <button onClick={onCancel}><X className="w-3.5 h-3.5 text-[#5a5a6a]" /></button>
      </div>

      {type === "NOTE" && (
        <>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value.slice(0, 500))}
            placeholder="Write something…"
            rows={3}
            className="w-full resize-none text-xs bg-transparent border-0 text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none"
          />
          <div className="flex gap-1">
            {Object.entries(NOTE_COLORS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setNoteColor(key)}
                className={cn("w-5 h-5 rounded-full border-2", noteColor === key ? "border-[#c9a84c]" : "border-transparent")}
                style={{ background: val.bg }}
              />
            ))}
          </div>
        </>
      )}

      {type === "TASK" && (
        <>
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" className="w-full text-xs bg-transparent border-b border-[#2a2a33] pb-1 text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none" />
          <input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="w-full text-xs bg-transparent text-[#9898a8] focus:outline-none" />
        </>
      )}

      {type === "CHECKLIST" && (
        <>
          <input value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} placeholder="Checklist title" className="w-full text-xs bg-transparent border-b border-[#2a2a33] pb-1 text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none" />
          {checkItems.map((item, i) => (
            <div key={item.id} className="flex gap-1">
              <input
                value={item.text}
                onChange={(e) => setCheckItems((p) => p.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                placeholder={`Item ${i + 1}`}
                className="flex-1 text-xs bg-transparent border-b border-[#2a2a33] pb-0.5 text-[#e8e8ec] placeholder-[#5a5a6a] focus:outline-none"
              />
            </div>
          ))}
          <button onClick={() => setCheckItems((p) => [...p, { id: crypto.randomUUID(), text: "", checked: false }])} className="text-[11px] text-[#c9a84c]">+ Add item</button>
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs text-[#5a5a6a]">Cancel</button>
        <button onClick={save} disabled={saving} className="text-xs font-semibold text-[#0f0f11] bg-[#c9a84c] hover:bg-[#e3c06a] px-3 py-1 rounded-lg disabled:opacity-40">
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
    </div>
  );
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ card, teamId, members, myProfileId, onUpdate }: {
  card: NoteboardCard; teamId: string; members: Member[]; myProfileId: string; onUpdate: () => void;
}) {
  const payload = JSON.parse(card.payload);
  const [optimistic, setOptimistic] = useState(payload);

  const deleteCard = async () => {
    await fetch(`/api/teams/${teamId}/noteboard/${card.id}`, { method: "DELETE" });
    onUpdate();
  };

  const updatePayload = async (newPayload: unknown) => {
    setOptimistic(newPayload);
    await fetch(`/api/teams/${teamId}/noteboard/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: newPayload }),
    });
    onUpdate();
  };

  if (card.type === "NOTE") {
    const colors = NOTE_COLORS[optimistic.color] ?? NOTE_COLORS.slate;
    return (
      <div className="relative rounded-xl p-3 group" style={{ background: colors.bg }}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.text }}>{optimistic.body}</p>
        <button onClick={deleteCard} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5 text-white/60 hover:text-white/90" />
        </button>
      </div>
    );
  }

  if (card.type === "TASK") {
    const STATUSES: ("todo" | "inprogress" | "done")[] = ["todo", "inprogress", "done"];
    const nextStatus = STATUSES[(STATUSES.indexOf(optimistic.status) + 1) % 3];
    return (
      <div className="relative bg-[#16161a] border border-[#2a2a33] rounded-xl p-3 group">
        <div className="flex items-start gap-2">
          <button
            onClick={() => updatePayload({ ...optimistic, status: nextStatus })}
            className={cn(
              "mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
              optimistic.status === "done" ? "bg-green-500 border-green-500" :
              optimistic.status === "inprogress" ? "border-yellow-400" : "border-[#2a2a33]"
            )}
          >
            {optimistic.status === "done" && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <div className="flex-1">
            <p className={cn("text-sm text-[#e8e8ec]", optimistic.status === "done" && "line-through text-[#5a5a6a]")}>
              {optimistic.title}
            </p>
            {optimistic.dueDate && (
              <p className="text-[11px] text-[#5a5a6a] mt-0.5">Due {format(new Date(optimistic.dueDate), "MMM d")}</p>
            )}
          </div>
        </div>
        <button onClick={deleteCard} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5 text-[#5a5a6a] hover:text-red-400" />
        </button>
      </div>
    );
  }

  if (card.type === "CHECKLIST") {
    const checked = optimistic.items.filter((i: { checked: boolean }) => i.checked).length;
    const total = optimistic.items.length;
    const toggleItem = (id: string) => {
      const newItems = optimistic.items.map((it: { id: string; checked: boolean }) =>
        it.id === id ? { ...it, checked: !it.checked } : it
      );
      updatePayload({ ...optimistic, items: newItems });
    };
    return (
      <div className="relative bg-[#16161a] border border-[#2a2a33] rounded-xl p-3 group">
        <p className="text-xs font-semibold text-[#e8e8ec] mb-2">{optimistic.title}</p>
        {total > 0 && (
          <div className="w-full h-1 bg-[#2a2a33] rounded-full mb-2 overflow-hidden">
            <div className="h-full bg-[#c9a84c] rounded-full transition-all" style={{ width: `${(checked / total) * 100}%` }} />
          </div>
        )}
        <div className="space-y-1">
          {optimistic.items.map((item: { id: string; text: string; checked: boolean }) => (
            <label key={item.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                className="w-3.5 h-3.5 accent-[#c9a84c]"
              />
              <span className={cn("text-xs", item.checked ? "line-through text-[#5a5a6a]" : "text-[#e8e8ec]")}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
        {checked === total && total > 0 && (
          <div className="mt-2 text-[11px] text-green-600 dark:text-green-400 font-semibold">✓ Complete</div>
        )}
        <button onClick={deleteCard} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5 text-[#5a5a6a] hover:text-red-400" />
        </button>
      </div>
    );
  }

  return null;
}
