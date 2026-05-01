"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, goal, description }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create project.");
    } else {
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    }
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[#909098] hover:text-[#eaeaea] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#eaeaea]">New Project</h1>
        <p className="text-sm text-[#909098] mt-1">
          Define your project, then handpick the right collaborators for it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-[#0d0d0e] border border-[#1c1c20] rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#909098] uppercase tracking-wider mb-1.5">
              Project Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Nivarro Platform v1"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#909098] uppercase tracking-wider mb-1.5">
              Goal
            </label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Ship a working MVP by Q2"
              className="w-full"
            />
            <p className="text-xs text-[#58586a] mt-1.5">
              A single clear sentence: what does success look like?
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#909098] uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project about? What are you building or accomplishing?"
              className="w-full resize-none"
            />
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
            disabled={saving || !name}
            className="flex items-center gap-2 bg-[#c9a84c] hover:bg-[#e3c06a] text-[#080809] font-semibold text-sm rounded-md px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Creating..." : "Create Project"}
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-[#909098] hover:text-[#eaeaea] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
