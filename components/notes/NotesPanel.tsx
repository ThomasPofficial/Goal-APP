"use client";

import { useState, useEffect } from "react";
import { X, Pin, PinOff, Trash2, Plus, Loader2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";

interface Note {
  id: string;
  title: string | null;
  content: string;
  pinned: boolean;
  updatedAt: string;
}

interface Props {
  onClose: () => void;
}

export default function NotesPanel({ onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const res = await fetch("/api/notes");
    const data = await res.json();
    setNotes(data);
    setLoading(false);
  }

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
      }),
    });
    setNewContent("");
    setNewTitle("");
    setSaving(false);
    await loadNotes();
  }

  async function togglePin(note: Note) {
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    await loadNotes();
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#0d0d0e] border-l border-[#1c1c20] shadow-[0_0_40px_rgba(0,0,0,0.5)] z-50 flex flex-col animate-[slideUp_0.2s_ease]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c1c20]">
        <h2 className="text-sm font-semibold text-[#eaeaea]">Quick Notes</h2>
        <button
          onClick={onClose}
          className="text-[#58586a] hover:text-[#909098] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* New note form */}
      <form onSubmit={createNote} className="px-4 py-3 border-b border-[#1c1c20] space-y-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full text-sm py-1.5"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Capture an idea..."
          rows={3}
          className="w-full text-sm resize-none font-mono"
        />
        <button
          type="submit"
          disabled={!newContent.trim() || saving}
          className="flex items-center gap-1.5 text-xs font-medium bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          Add note
        </button>
      </form>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#58586a] mx-auto" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-center text-[#58586a] py-8">
            No notes yet. Capture your first idea above.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`group bg-[#131315] border rounded-lg p-3 ${
                note.pinned ? "border-[#c9a84c30]" : "border-[#1c1c20]"
              }`}
            >
              {note.title && (
                <div className="text-xs font-semibold text-[#eaeaea] mb-1">
                  {note.pinned && (
                    <span className="text-[#c9a84c] mr-1">·</span>
                  )}
                  {note.title}
                </div>
              )}
              <p className="text-xs text-[#909098] font-mono leading-relaxed whitespace-pre-wrap">
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[#58586a]">
                  {formatRelativeDate(note.updatedAt)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => togglePin(note)}
                    className="text-[#58586a] hover:text-[#c9a84c] transition-colors p-0.5"
                    title={note.pinned ? "Unpin" : "Pin"}
                  >
                    {note.pinned ? (
                      <PinOff className="w-3 h-3" />
                    ) : (
                      <Pin className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-[#58586a] hover:text-[#f87171] transition-colors p-0.5"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
